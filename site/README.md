# OpenAvatar gallery

The gallery website: every avatar in [`../examples`](../examples/) and
[`avatars/`](avatars/) (approved submissions) with a picture, a page, its file and an install link. The avatars are live: on the
home page one reacts while you search, and each avatar's page lets you try
the host inputs of SPEC 12 on it. It builds to static files and runs on a
Cloudflare Worker. Without WebGL the pages show the pictures.

## Build and run it

```sh
npm install          # in openavatar/, once
cd site
npm run build        # writes dist/
npm run dev          # builds, then serves dist/ at http://localhost:8787
npm test
```

The build draws each avatar's picture with the reference renderer in a
headless Chrome, Edge or Chromium, as `openavatar render` does
(`OPENAVATAR_BROWSER` names another browser). Pictures are kept in `.cache/`
and drawn again only when the avatar, the renderer or the picture settings
change.

`OPENAVATAR_ORIGIN` is the address the site is served from (default
`https://openavatar.dev`). It goes into the install links, the API's list and
the skill's address on the Make page, so set it before a build that will be
deployed. Links to the source use `REPO` in `src/pages.js`,
https://github.com/Enconvo/OpenAvatar.

## What it serves

| Path | What |
|---|---|
| `/` | The live host, the gallery with search, and how to use the avatars |
| `/a/<slug>/` | One avatar, live: its credit, license, Open in Enconvo and Download, and the host inputs (conversation state, agent and user activity, expressions, motions) to try on it, with the call an app makes for each |
| `/avatars/<slug>.openavatar` | The file as it is, with the OpenAvatar media type and `Access-Control-Allow-Origin: *` |
| `/avatars/<slug>.webp` | Its picture: 512 px, three-quarter view, transparent |
| `/spec/` | The spec, rendered from `spec/SPEC.md`, with its schema and vocabulary beside it (`/spec/openavatar-0.1.schema.json`, `/spec/vocabulary.json`) |
| `/make/` | How to make an avatar: with an AI agent and the skill, in Enconvo, or with the `openavatar` command |
| `/skill/SKILL.md`, `/skill/reference.md` | The OpenAvatar skill, for agents that load a skill from an address |
| `/submit/` | Send an avatar: the file is checked on the page, shown live, then sent for review with a credit, a license and the sender's consent |
| `POST /api/submissions` | Takes `{ document, author, license, consent }` (JSON) and queues it in D1 as `pending` |
| `/developers/` | The API: make a token, check or revoke one, and the calls |
| `/api/v1/…` | The API (below). `/api/avatars.json`, the list before the API, answers like `/api/v1/avatars` and needs a token too |
| `/vendor/` | three.js, `@openavatar/core` and `@openavatar/three` for the live host |

Each avatar in the API has `slug`, `id`, `name`, `description`, `authors`
(names), `license` (an SPDX id), `tags`, `category`, `rig` (`blob` or
`biped`), `bytes`, `revision` (changes with the file), and the absolute
`file`, `picture` and `page` URLs. The build writes them all to
`dist/api/avatars.json`, which only the Worker reads.

Each avatar is in one category, by its tags (`src/categories.js`): Abstract,
Creatures, Plush or Objects, else Other.

Names, descriptions, tags and authors come from the documents and are
escaped on every page (SPEC 16.1). Install links follow SPEC 14.3:
`enconvo://avatar/install?url=<the file's URL>`.

## The API

Apps that offer the gallery call `/api/v1/…` with a token
(`Authorization: Bearer oa_…`). Avatar files, pictures and install links stay
free and need none, so an install link works in any app (SPEC 14.3).

| Call | What it answers | Cost |
|---|---|---|
| `GET /api/v1/categories` | The categories, with how many avatars each has | 1 call |
| `GET /api/v1/avatars` | The avatars; `category`, `tag` and `q` (search) narrow them, `limit` (up to 100) and `offset` page through them | 1 call |
| `GET /api/v1/avatars/<slug>` | One avatar, with its document | 1 call |
| `GET /api/v1/usage` | The token's calls this month | Free |
| `DELETE /api/v1/tokens/current` | Revokes the token | Free |
| `POST /api/v1/tokens` | A new free token, shown once; `{ "name": "…" }` is optional | Free |

A token made on `/developers/` has 1,000 calls a calendar month (UTC). A call
that counts says what is left in `OpenAvatar-Quota-Limit`,
`OpenAvatar-Quota-Remaining` and `OpenAvatar-Quota-Reset`; past the limit it is
`429 quota_exceeded` with `Retry-After`. One statement counts a call and
checks the limit, so calls made at once can't go past it. The gallery keeps a
token's SHA-256, how it is shown (`oa_` and seven characters) and its name,
nothing else about whoever made it.

There are no accounts yet, so making tokens is limited instead: three a
minute (`TOKEN_LIMIT`) and five a day from one address, counted under a hash
of the address, the day and the secret `ADDRESS_SALT`. Another site's page
can't make tokens; a program that sends no `Origin` can.

### Tokens

`scripts/tokens.mjs` (`npm run tokens -- <command>`) manages tokens, on the
local database or with `--remote` on the deployed one. A token for one of the
project's own apps can have no limit (`--unlimited`). Writes are dry runs
until `--yes`; `--out` puts a new token only in that file.

```sh
npm run tokens -- list
npm run tokens -- create --name "Enconvo" --unlimited --out enconvo-token.txt --yes
npm run tokens -- revoke oa_AbCdEfG… --yes
```

## Submissions

Anyone can send an avatar from `/submit/`. The page and the Worker run the
same check (`web/submission.js`): the file is at most 256 KB, is JSON, and
validates with no errors (SPEC 17.1); the credit is one short line; the
license is CC BY 4.0 or CC0; and the sender confirms they may share it. The
Worker then stores it in the gallery's own D1 database as `pending`, with the
credit they typed and nothing else about them. The same avatar (by its
document id) can wait or be in the gallery only once, and one address can
send at most five a minute.

Nothing sent is published: a person reviews each one, and approved avatars
join the gallery's files and the next build.

### Reviewing

`scripts/review.mjs` (`npm run review -- <command>`) works on the local
database that `npm run dev` uses, or on the deployed one with `--remote`.
Commands that change something print what they would do and stop; add
`--yes` to do it. A submission is named by its id or the first characters
of it.

```sh
npm run review -- list                       # what waits, oldest first (--all for every one)
npm run review -- show 3c53                  # its check, its file, and a contact sheet to look at
npm run review -- approve 3c53 --yes         # writes avatars/<name>.openavatar, marks it approved
npm run review -- decline 3c53 --note "Why" --yes
```

`show` writes the file it would approve and a contact sheet (four views and
the states a host shows most, as `openavatar render --sheet` draws) to
`.cache/review/`. Look at the sheet before approving: the check catches a
broken file, not a copy of someone else's character or a picture that
shouldn't be in a public gallery. Decline those with a note saying why.

`approve` writes the document with the credit and license the sender chose
(`meta.authors`, `meta.license`) under a name no other gallery avatar has,
then marks it approved, so the same avatar can't be sent again. It refuses an
avatar whose id is already in the gallery, and the build fails on two files
with one id. Commit the new file and build to publish it.

For a local run, create the tables once:

```sh
npx wrangler d1 migrations apply openavatar-gallery --local
```

The schema is in `migrations/`; add a change with
`npx wrangler d1 migrations create openavatar-gallery <name>`.

## Deploying

`npx wrangler deploy` publishes the Worker `openavatar-gallery` with `dist/`
as its assets. Before the first deploy, create the database
(`npx wrangler d1 create openavatar-gallery`), put its id in
`wrangler.jsonc`, apply the migrations with `--remote`, and set
`ADDRESS_SALT` to a long random value (`npx wrangler secret put ADDRESS_SALT`).
Apply a new migration with `--remote` before deploying the Worker that reads
it. The domain and
the deploy are the project owner's decision; nothing deploys it
automatically.

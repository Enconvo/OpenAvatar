# OpenAvatar

An open format for 3D avatars that react to what an AI agent and its user
are doing. An OpenAvatar character is one small JSON file (`.openavatar`):
its body built from soft solids, its materials, face and parts, and how it
reacts while the agent listens, thinks, speaks or works, and while the
person codes, reads or plays. Any app that implements the format can show
the same characters. Browse them, live, in the
[gallery](https://openavatar.enconvo.com).

| Folder | What |
|---|---|
| [`spec/`](spec/) | [SPEC.md](spec/SPEC.md) (OpenAvatar 0.1), the JSON Schema and `vocabulary.json` |
| [`packages/core`](packages/core/) | `@openavatar/core`: read, validate and repair documents, and resolve how an avatar reacts. No dependencies |
| [`packages/three`](packages/three/) | `@openavatar/three`: the reference renderer for three.js |
| [`packages/cli`](packages/cli/) | `@openavatar/cli`: the `openavatar` command, to check, render, pack and install avatars |
| [`skills/openavatar`](skills/openavatar/SKILL.md) | The agent skill: lets an AI agent design avatars of any shape from a description |
| [`examples/`](examples/) | Twenty-four characters |
| [`site/`](site/) | The gallery website: pages, pictures, the JSON list and a live avatar, on a Cloudflare Worker |
| [`conformance/`](conformance/) | The conformance suite for readers, renderers and hosts |

## Make an avatar

With an AI agent that loads skills, install `skills/openavatar` and describe
the character you want. By hand:

```sh
npx @openavatar/cli new "My avatar" --rig blob -o my-avatar.openavatar
npx @openavatar/cli validate --strict my-avatar.openavatar
npx @openavatar/cli render my-avatar.openavatar --sheet -o sheet.png
npx @openavatar/cli install my-avatar.openavatar
```

`install` puts it in the shared folder, `~/.openavatar/avatars/`, where
every OpenAvatar app on the computer finds it.

## Show avatars in your app

```js
import { OpenAvatarStage } from '@openavatar/three';

const stage = new OpenAvatarStage(canvas);
stage.load(document);                          // a parsed .openavatar file
stage.start();
stage.setInput({ state: 'speaking', voice: 0.6 });
```

Apps with their own three.js scene add `new OpenAvatar(document).object`
to it and call `update(dt)` each frame.

SPEC 12 describes what a host sends (conversation state, agent activity, user
activity, voice level, pointer) and SPEC 17 what a conforming reader,
renderer and host do.

## Development

```sh
npm install
npm test             # every package
npm run schema       # regenerate the JSON Schema and the skill's reference
node conformance/tools/build.mjs
```

The code is released under Apache-2.0, the specification and the examples
under CC BY 4.0, and the conformance documents under CC0 1.0.

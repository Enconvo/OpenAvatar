# @openavatar/cli

The `openavatar` command checks, renders, packs and installs
[OpenAvatar 0.1](https://github.com/Enconvo/OpenAvatar/blob/main/spec/SPEC.md) documents. Rendering uses the reference
renderer, `@openavatar/three`, in a headless Chrome, Edge or Chromium that is
already on the computer; nothing is downloaded.

```sh
npm install -g @openavatar/cli
```

| Command | What it does |
|---|---|
| `openavatar validate <file...>` | Checks each file against the spec (SPEC 14.1, 15), then builds it, prints the box of the body and of the whole avatar, checks their size (SPEC 4) and finds parts hidden inside the body. `--strict` also fails on warnings; `--json` prints the results |
| `openavatar fix <file>` | Prints the document with every repair a reader would make; `-o` or `--write` saves it |
| `openavatar render <file>` | Draws a PNG, WebP or JPEG. `--view`, `--state`, `--activity`, `--user-activity`, `--expression`, `--outfit` and `--motion` pick the moment |
| `openavatar render <file> --sheet` | Draws a labelled contact sheet: front, three-quarter, side and back, then happy, surprised, listening, thinking, speaking, sleeping, coding and a wave |
| `openavatar pack <file>` | Repairs the document, renders a front preview into `preview` (SPEC 3.3, at most 96 KB) and checks the 256 KB limit |
| `openavatar new [name]` | Writes a small valid document to start from; `--rig biped` for head, body, arms and legs |
| `openavatar vocabulary [kind]` | Lists the standard ids of a kind (`motions`, `props`, `outfits`, `user-activities` …) and what each means |
| `openavatar list` | Lists the avatars in the shared folder, `~/.openavatar/avatars/` (SPEC 14.2) |
| `openavatar install <file\|https url>` | Checks a document and copies it into the shared folder; `--replace` overwrites the copy with the same id |

Exit codes: 0 when all is well, 1 when a document has problems or a step
failed, 2 for a usage error. `openavatar <command> --help` lists a command's
options.

Environment:

- `OPENAVATAR_BROWSER`: the path of the browser to render with (the same as
  `--browser`). Without it the command tries Chrome, then Edge, then
  Playwright's Chromium.
- `OPENAVATAR_HOME`: moves the shared folder to `$OPENAVATAR_HOME/avatars`.

The same steps are exported for scripts: `checkBytes`, `openRenderer`,
`renderPreview`, `readShared`, `newDocument` and `main`.

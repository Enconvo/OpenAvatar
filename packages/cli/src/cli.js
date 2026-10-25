// The `openavatar` command. Each command returns an exit code: 0 when all is
// well, 1 when a document has problems or a step failed, 2 for a usage error.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { normalize, stringify, VOCABULARY } from '@openavatar/core';
import { checkBytes, kb, MAX_BYTES } from './check.js';
import { sharedFolder, readShared, fileNameFor } from './shared.js';
import { newDocument } from './templates.js';
import { openRenderer, renderPreview, SHEET, VIEWS } from './render.js';

const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const HELP = `openavatar ${VERSION}: check, render, pack and install OpenAvatar documents.

Usage: openavatar <command> [options]

Commands
  validate <file...>    Check documents against OpenAvatar 0.1 and measure them
  fix <file>            Print the document the way a reader repairs it
  render <file>         Draw a picture, or a contact sheet with --sheet
  pack <file>           Repair, add a preview picture and check the size limit
  new [name]            Start a new document from a template
  vocabulary [kind]     List the standard ids of a kind, or the kinds
  list                  List the avatars in the shared folder
  install <file|url>    Check a document and add it to the shared folder

Run "openavatar <command> --help" for its options.`;

const COMMANDS = {
  validate: {
    usage: `openavatar validate <file...> [--json] [--strict] [--no-geometry]

Checks each file against OpenAvatar 0.1 (SPEC 14.1 and 15), then builds it
with the reference renderer and checks its size (SPEC 4).
  --json          Print the results as JSON
  --strict        Fail on warnings too
  --no-geometry   Skip building the avatar`,
    options: { json: { type: 'boolean' }, strict: { type: 'boolean' }, 'no-geometry': { type: 'boolean' } },
    run: validateCommand,
  },
  fix: {
    usage: `openavatar fix <file> [-o <file> | --write]

Prints the document with every repair a reader would make (SPEC 15):
unknown members dropped, numbers clamped, fallbacks for unknown ids.
  -o, --out <file>   Write it to a file instead
  --write            Rewrite the input file`,
    options: { out: { type: 'string', short: 'o' }, write: { type: 'boolean' } },
    run: fixCommand,
  },
  render: {
    usage: `openavatar render <file> [-o <file.png|webp>] [options]

Draws the avatar with the reference renderer in a headless Chrome, Edge or
Chromium. With --sheet, draws a labelled contact sheet of four views and the
situations hosts show most, for checking a design.
  -o, --out <file>         Where to write the picture (default <name>.png)
  --sheet                  A contact sheet instead of one picture
  --size <px>              Width and height (default 512; a sheet cell 256)
  --width, --height <px>   One side only
  --view <view>            front, three-quarter, side, back, left, right, or degrees;
                           side shows the avatar's right, left and right are its own
  --state, --activity, --user-activity, --expression, --outfit <id>
  --motion <id>            Play a motion and show it midway
  --time <seconds>         How long to run before drawing (default 1.2)
  --room                   Leave room for effects, as a picture of a situation
                           or motion does, to compare it with one
  --background <color>     #RRGGBB, or transparent (default; a sheet's is #F4F1EC)
  --browser <path>         The browser to use (or set OPENAVATAR_BROWSER)`,
    options: {
      out: { type: 'string', short: 'o' }, sheet: { type: 'boolean' }, size: { type: 'string' }, width: { type: 'string' }, height: { type: 'string' },
      view: { type: 'string' }, state: { type: 'string' }, activity: { type: 'string' }, 'user-activity': { type: 'string' },
      expression: { type: 'string' }, outfit: { type: 'string' }, motion: { type: 'string' }, time: { type: 'string' },
      background: { type: 'string' }, browser: { type: 'string' }, room: { type: 'boolean' },
    },
    run: renderCommand,
  },
  pack: {
    usage: `openavatar pack <file> [-o <file>] [--no-preview] [--browser <path>]

Repairs the document, renders a front preview picture into "preview"
(SPEC 3.3) and checks that the file stays under ${kb(MAX_BYTES)}. Writes
<name>.openavatar beside the input unless -o says otherwise.
  -o, --out <file>   Where to write it
  --no-preview       Leave the preview out (and remove one already there)
  --browser <path>   The browser to use (or set OPENAVATAR_BROWSER)`,
    options: { out: { type: 'string', short: 'o' }, 'no-preview': { type: 'boolean' }, browser: { type: 'string' } },
    run: packCommand,
  },
  new: {
    usage: `openavatar new [name] [--rig blob|biped] [-o <file>] [--force]

Writes a small valid document with a fresh id to start from.
  --rig <rig>        blob (default): one body shape; biped: head, body, arms and legs
  -o, --out <file>   Where to write it (default <name>.openavatar)
  --force            Overwrite an existing file`,
    options: { rig: { type: 'string' }, out: { type: 'string', short: 'o' }, force: { type: 'boolean' } },
    run: newCommand,
  },
  vocabulary: {
    usage: `openavatar vocabulary [kind] [--json]

Lists the standard ids of a kind (states, motions, props, outfits, …) with
what each means, or the kinds when none is given.`,
    options: { json: { type: 'boolean' } },
    run: vocabularyCommand,
  },
  list: {
    usage: `openavatar list [--json]

Lists the avatars in the shared folder (${sharedFolder()}).`,
    options: { json: { type: 'boolean' } },
    run: listCommand,
  },
  install: {
    usage: `openavatar install <file|https url> [--replace]

Checks a document and copies it into the shared folder, where every
OpenAvatar app finds it.
  --replace   Overwrite the installed copy that has the same id`,
    options: { replace: { type: 'boolean' } },
    run: installCommand,
  },
};

/** Runs the command line; returns the exit code. io: { out(text), err(text) } */
export async function main(argv, io = { out: t => process.stdout.write(t), err: t => process.stderr.write(t) }) {
  const say = t => io.out(t + '\n'), warn = t => io.err(t + '\n');
  const [name, ...rest] = argv;
  if (!name || name === '--help' || name === '-h' || name === 'help') { say(HELP); return name ? 0 : 2; }
  if (name === '--version' || name === '-v') { say(VERSION); return 0; }
  const cmd = COMMANDS[name];
  if (!cmd) { warn(`openavatar: unknown command "${name}"\n\n${HELP}`); return 2; }
  if (rest.includes('--help') || rest.includes('-h')) { say(cmd.usage); return 0; }
  let args;
  try { args = parseArgs({ args: rest, options: cmd.options, allowPositionals: true, strict: true }); } catch (e) {
    warn(`openavatar ${name}: ${e.message}\n\n${cmd.usage}`); return 2;
  }
  try { return await cmd.run(args.values, args.positionals, { say, warn }); } catch (e) {
    if (e.usage) { warn(`openavatar ${name}: ${e.message}\n\n${cmd.usage}`); return 2; }
    warn(`openavatar ${name}: ${e.message}`); return 1;
  }
}

const usage = message => Object.assign(new Error(message), { usage: true });
const needOne = (positionals, what = 'a file') => {
  if (positionals.length !== 1) throw usage(positionals.length ? 'give one file' : `give ${what}`);
  return positionals[0];
};
const readFile = file => {
  try { return fs.readFileSync(file); } catch (e) { throw new Error(e.code === 'ENOENT' ? `${file}: no such file` : `${file}: ${e.message}`); }
};
const number = (v, name) => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw usage(`--${name} must be a number`);
  return n;
};

/** Reads and checks a file, failing with the reader's reason when it must be rejected. */
async function load(file, geometry = false) {
  const r = await checkBytes(readFile(file), { geometry });
  if (r.fatal) throw new Error(`${file}: ${r.fatal.message}`);
  return r;
}

async function validateCommand(o, files, { say }) {
  if (!files.length) throw usage('give at least one file');
  const results = [];
  for (const file of files) {
    let r;
    try { r = await checkBytes(readFile(file), { geometry: !o['no-geometry'] }); } catch (e) { r = { fatal: { code: 'unreadable', message: e.message }, errors: [], warnings: [] }; }
    results.push({ file, ok: !r.fatal && r.errors.length === 0 && !(o.strict && r.warnings.length), fatal: r.fatal, errors: r.errors, warnings: r.warnings, bounds: r.bounds ?? null, body: r.body ?? null, buildMs: r.buildMs ?? null });
  }
  if (o.json) say(JSON.stringify(results, null, 2));
  else for (const r of results) {
    if (r.fatal) { say(`${r.file}: rejected: ${r.fatal.message}`); continue; }
    const counts = [r.errors.length && plural(r.errors.length, 'error'), r.warnings.length && plural(r.warnings.length, 'warning')].filter(Boolean);
    say(`${r.file}: ${counts.length ? counts.join(', ') : 'valid'}${r.bounds ? ` (built in ${r.buildMs} ms)` : ''}`);
    if (r.body) say(`  body     ${span(r.body)}`);
    if (r.bounds) say(`  avatar   ${span(r.bounds)}`);
    for (const e of r.errors) say(`  error    ${e.path ? `${e.path}: ` : ''}${e.message}`);
    for (const w of r.warnings) say(`  warning  ${w}`);
  }
  return results.every(r => r.ok) ? 0 : 1;
}

const span = b => 'xyz'.split('').map((axis, i) => `${axis} ${b.min[i]} to ${b.max[i]}`).join(', ');

async function fixCommand(o, files, { say, warn }) {
  const file = needOne(files);
  if (o.out && o.write) throw usage('use -o or --write, not both');
  const r = await load(file);
  const { document, repairs } = normalize(r.value);
  const text = stringify(document);
  const target = o.write ? file : o.out;
  if (!target) { say(text.trimEnd()); return 0; }
  fs.writeFileSync(target, text);
  warn(`${target}: ${repairs.length ? `${plural(repairs.length, 'repair')} made` : 'nothing to repair'}`);
  for (const e of repairs) warn(`  ${e.path ? `${e.path}: ` : ''}${e.message}`);
  return 0;
}

const parseView = v => {
  if (v === undefined) return 0;
  if (v in VIEWS) return VIEWS[v];
  const n = Number(v);
  if (!Number.isFinite(n)) throw usage(`--view must be ${Object.keys(VIEWS).join(', ')} or degrees`);
  return n;
};

async function renderCommand(o, files, { say, warn }) {
  const file = needOne(files);
  const r = await load(file);
  const out = o.out || `${path.basename(file).replace(/\.openavatar$|\.json$/i, '')}${o.sheet ? '-sheet' : ''}.png`;
  const format = /\.webp$/i.test(out) ? 'webp' : /\.jpe?g$/i.test(out) ? 'jpeg' : /\.png$/i.test(out) ? 'png' : null;
  if (!format) throw usage('-o must end in .png, .webp or .jpg');
  const background = o.background === undefined || o.background === 'transparent' ? null : o.background;
  if (background && !/^#[0-9a-f]{6}$/i.test(background)) throw usage('--background must be #RRGGBB or transparent');
  if (format === 'jpeg' && !background) throw usage('a .jpg has no transparency; give --background');
  const input = {};
  for (const [opt, key] of [['state', 'state'], ['activity', 'activity'], ['user-activity', 'userActivity'], ['expression', 'expression'], ['outfit', 'outfit']]) if (o[opt]) input[key] = o[opt];
  if (input.state === 'speaking') input.voice = .8;
  if (input.state === 'listening') input.mic = .6;
  const size = number(o.size, 'size');
  const renderer = await openRenderer({ browser: o.browser });
  try {
    let image;
    if (o.sheet) {
      const cells = Object.keys(input).length ? SHEET.map(c => ({ ...c, input: { ...input, ...c.input } })) : SHEET;
      ({ image } = await renderer.sheet(r.document, { cells, cell: size ?? 256, background: background ?? '#F4F1EC', format }));
    } else {
      const job = {
        width: number(o.width, 'width') ?? size ?? 512, height: number(o.height, 'height') ?? size ?? 512,
        view: parseView(o.view), input, play: o.motion, time: number(o.time, 'time'), background, format,
        room: !!o.room || Object.keys(input).some(k => k !== 'outfit') || !!o.motion,
      };
      if (!(job.width >= 16 && job.width <= 4096 && job.height >= 16 && job.height <= 4096)) throw usage('sizes must be from 16 to 4096 pixels');
      ({ image } = await renderer.render(r.document, job));
    }
    fs.writeFileSync(out, image);
    say(`${out}: ${kb(image.length)}`);
    for (const w of renderer.warnings) warn(`  browser error  ${w.slice(0, 300)}`);
  } finally { await renderer.close(); }
  return 0;
}

async function packCommand(o, files, { say, warn }) {
  const file = needOne(files);
  const r = await load(file, true);
  for (const e of r.errors) warn(`  repaired  ${e.path ? `${e.path}: ` : ''}${e.message}`);
  for (const w of r.warnings) warn(`  warning   ${w}`);
  if (r.errors.some(e => /must fit inside/.test(e.message))) throw new Error('the avatar is too large to pack; fix its size first');
  const document = structuredClone(r.document);
  delete document.preview;
  let note = 'no preview';
  if (!o['no-preview']) {
    const renderer = await openRenderer({ browser: o.browser });
    try {
      const p = await renderPreview(renderer, document);
      document.preview = { image: p.image };
      note = `a ${p.size}×${p.size} preview of ${kb(p.bytes)}`;
    } finally { await renderer.close(); }
  }
  const text = stringify(document), bytes = Buffer.byteLength(text);
  if (bytes > MAX_BYTES) throw new Error(`the packed file would be ${kb(bytes)}, over the ${kb(MAX_BYTES)} limit${document.preview ? '; try --no-preview' : ''}`);
  const out = o.out || path.join(path.dirname(file), fileNameFor(document));
  if (path.resolve(out) === path.resolve(file) && !o.out) throw new Error(`${out} is the input; pass -o ${out} to rewrite it`);
  fs.writeFileSync(out, text);
  say(`${out}: ${kb(bytes)}, ${note}`);
  return 0;
}

async function newCommand(o, names, { say }) {
  if (names.length > 1) throw usage('give one name (quote it if it has spaces)');
  const doc = newDocument({ name: names[0] || 'New avatar', rig: o.rig || 'blob', version: VERSION });
  const out = o.out || `${fileNameFor(doc).replace(/-[^-]+\.openavatar$/, '')}.openavatar`;
  if (fs.existsSync(out) && !o.force) throw new Error(`${out} already exists; pass --force to overwrite it`);
  fs.writeFileSync(out, stringify(doc));
  say(`${out}: a new ${doc.body.rig || 'blob'} avatar "${doc.name}"`);
  return 0;
}

const KINDS = Object.fromEntries(Object.entries(VOCABULARY).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), [k, v]]));

async function vocabularyCommand(o, args, { say }) {
  if (args.length > 1) throw usage('give one kind');
  if (!args.length) {
    if (o.json) say(JSON.stringify(Object.keys(KINDS)));
    else for (const [kind, [, list]] of Object.entries(KINDS)) say(`${kind.padEnd(16)} ${list.length}`);
    return 0;
  }
  const hit = KINDS[args[0]] || Object.values(KINDS).find(([k]) => k === args[0]);
  if (!hit) throw usage(`unknown kind "${args[0]}"; the kinds are ${Object.keys(KINDS).join(', ')}`);
  const [, list] = hit;
  if (o.json) { say(JSON.stringify(list, null, 2)); return 0; }
  const ids = list.map(x => typeof x === 'string' ? x : x.id);
  const width = Math.max(...ids.map(i => i.length)) + 2;
  for (const x of list) {
    if (typeof x === 'string') { say(x); continue; }
    const notes = [x.description || x.name, x.hat && 'a hat', x.loops && 'loops', x.needs && `needs ${x.needs}`, x.fallback && `falls back to ${x.fallback}`].filter(Boolean).join('; ');
    say(`${x.id.padEnd(width)}${notes}`);
  }
  if (hit === KINDS.drivers && !o.json) say('and any agent activity, user activity or expression id (SPEC 10.2); thinking is the state');
  return 0;
}

async function listCommand(o, args, { say }) {
  if (args.length) throw usage('list takes no arguments');
  const { folder, avatars, broken } = readShared();
  if (o.json) { say(JSON.stringify({ folder, avatars, broken }, null, 2)); return 0; }
  if (!avatars.length && !broken.length) { say(`No avatars in ${folder}`); return 0; }
  say(folder);
  const width = Math.max(4, ...avatars.map(a => a.name.length)) + 2;
  for (const a of avatars) {
    say(`  ${a.name.padEnd(width)}${a.id.slice(0, 8)}  ${path.basename(a.file)}`);
    for (const f of a.olderCopies) say(`  ${''.padEnd(width)}          older copy: ${path.basename(f)}`);
  }
  for (const b of broken) say(`  unreadable: ${path.basename(b.file)} (${b.reason})`);
  return 0;
}

async function installCommand(o, sources, { say, warn }) {
  const source = needOne(sources, 'a file or an https URL');
  const bytes = /^https?:\/\//i.test(source) ? await download(source) : readFile(source);
  const r = await checkBytes(bytes, { geometry: true });
  if (r.fatal) throw new Error(`${source}: ${r.fatal.message}`);
  if (r.errors.some(e => /must fit inside/.test(e.message))) throw new Error(`${source}: ${r.errors.find(e => /must fit inside/.test(e.message)).message}`);
  for (const e of r.errors) warn(`  repaired by readers  ${e.path ? `${e.path}: ` : ''}${e.message}`);
  for (const w of r.warnings) warn(`  warning  ${w}`);
  const folder = sharedFolder();
  fs.mkdirSync(folder, { recursive: true });
  const same = readShared(folder).avatars.find(a => a.id === r.document.id);
  if (same && !o.replace) throw new Error(`"${same.name}" with this id is already installed as ${same.file}; pass --replace to overwrite it`);
  const target = same ? same.file : path.join(folder, fileNameFor(r.document));
  // The original bytes, without a byte order mark: readers repair the rest themselves.
  fs.writeFileSync(target, bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes);
  say(`${same ? 'Replaced' : 'Installed'} "${r.document.name}" as ${target}`);
  return 0;
}

async function download(url) {
  const u = new URL(url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !local) throw new Error('only https URLs can be installed');
  const res = await fetch(u, { redirect: 'follow', headers: { accept: 'application/vnd.openavatar+json, application/json;q=0.9' } });
  if (!res.ok) throw new Error(`${url}: the server answered ${res.status}`);
  if (Number(res.headers.get('content-length')) > MAX_BYTES) throw new Error(`${url}: the file is larger than ${kb(MAX_BYTES)}`);
  const chunks = []; let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error(`${url}: the file is larger than ${kb(MAX_BYTES)}`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

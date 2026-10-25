#!/usr/bin/env node
// Reviews the avatars people send from /submit/. They wait in the gallery's D1 as `pending`. This lists them, shows
// one (its checks and a contact sheet to look at), approves one into the gallery's files (`avatars/`, built and
// committed like the rest of the site) or declines one with a note. Writes are dry runs until --yes. Without
// --remote it works on the local database that `wrangler dev` uses.
//
//   node scripts/review.mjs list [--all] [--remote]
//   node scripts/review.mjs show <id> [--no-render] [--remote]
//   node scripts/review.mjs approve <id> [--slug <name>] [--remote] [--yes]
//   node scripts/review.mjs decline <id> --note "<why>" [--remote] [--yes]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { stringify } from 'openavatar';
import { slugOf } from '../src/catalog.js';
import { licenseName } from '../src/pages.js';
import { checkDocument } from '../web/submission.js';

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATABASE = 'openavatar-gallery';
export const AVATARS = path.join(site, 'avatars');
/** Where the gallery's avatars come from: the project's examples, then approved submissions. */
export const GALLERY = [path.join(site, '..', 'examples'), AVATARS];
const MAX_NOTE = 300;

const USAGE = `node scripts/review.mjs list [--all] [--remote]
node scripts/review.mjs show <id> [--no-render] [--remote]
node scripts/review.mjs approve <id> [--slug <name>] [--remote] [--yes]
node scripts/review.mjs decline <id> --note "<why>" [--remote] [--yes]`;

/** A SQL string literal. SQLite has no backslash escapes: a quote is doubled, and NUL can't appear. */
export const sql = value => (value == null ? 'NULL' : `'${String(value).replace(/\0/g, '').replace(/'/g, "''")}'`);

/** Runs SQL on the gallery's D1 through wrangler and returns the rows. */
export function wranglerRunner({ remote = false } = {}) {
  return async query => {
    const r = spawnSync('npx', ['wrangler', 'd1', 'execute', DATABASE, remote ? '--remote' : '--local', '--json', '--command', query],
      { cwd: site, encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
    if (r.status !== 0) throw new Error(`wrangler d1 execute failed: ${(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' ')}`);
    return JSON.parse(r.stdout).flatMap(part => part.results ?? []);
  };
}

/** The ids and slugs already in the gallery, from its folders. */
export function galleryFiles(dirs = GALLERY) {
  const ids = new Map(), slugs = new Set();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).filter(n => n.toLowerCase().endsWith('.openavatar'))) {
      const file = path.join(dir, name);
      slugs.add(slugOf(name));
      try { ids.set(JSON.parse(fs.readFileSync(file, 'utf8')).id, file); } catch { /* the build reports a broken file */ }
    }
  }
  return { ids, slugs };
}

const kb = bytes => `${Math.max(1, Math.round(bytes / 1024))} KB`;
const credit = row => (row.author ? `by ${row.author}` : 'anonymous');
const short = id => id.slice(0, 8);
const fail = message => Object.assign(new Error(message), { usage: true });

async function one(run, prefix) {
  if (!/^[0-9a-f-]{4,36}$/i.test(prefix ?? '')) throw fail('give a submission id, or its first 4 or more characters');
  const rows = await run(`SELECT id, avatar_id, name, author, license, bytes, status, note, created_at, document FROM submissions WHERE id LIKE ${sql(`${prefix.toLowerCase()}%`)} LIMIT 2`);
  if (!rows.length) throw new Error(`no submission starts with ${prefix}`);
  if (rows.length > 1) throw new Error(`more than one submission starts with ${prefix}; give more of its id`);
  return rows[0];
}

/** The file approving it would write: the document with the credit and license the sender chose. */
export function approvedText(row) {
  const doc = JSON.parse(row.document);
  doc.meta = { ...doc.meta, license: row.license };
  if (row.author) doc.meta.authors = [{ name: row.author }];
  else delete doc.meta.authors;
  return stringify(doc);
}

function freeSlug(base, taken) {
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!taken.has(slug)) return slug;
  }
}

const COMMANDS = {
  async list(o, { run, say }) {
    const rows = await run(`SELECT id, name, author, license, bytes, status, created_at FROM submissions ${o.all ? '' : `WHERE status = 'pending' `}ORDER BY created_at`);
    if (!rows.length) return say(o.all ? 'Nothing has been sent yet.' : 'No avatars are waiting for review.');
    for (const r of rows) say(`${short(r.id)}  ${r.created_at.slice(0, 16).replace('T', ' ')}  ${o.all ? `${r.status.padEnd(8)}  ` : ''}${r.name} ${credit(r)}, ${licenseName(r.license)}, ${kb(r.bytes)}`);
  },

  async show(o, { run, say, positionals, render, reviewDir }) {
    const row = await one(run, positionals[0]);
    say(`${row.name} ${credit(row)}, ${licenseName(row.license)}, ${kb(row.bytes)}`);
    say(`  submission ${row.id}, ${row.status}${row.note ? ` (${row.note})` : ''}, sent ${row.created_at}`);
    const checked = checkDocument(row.document);
    say(checked.ok ? '  check: no errors' : `  check: ${checked.error}${(checked.problems ?? []).map(p => `\n    ${p.path}: ${p.message}`).join('')}`);
    const clash = galleryFiles(o.gallery).ids.get(row.avatar_id);
    if (clash) say(`  already in the gallery as ${path.relative(site, clash)}`);
    fs.mkdirSync(reviewDir, { recursive: true });
    const file = path.join(reviewDir, `${short(row.id)}-${slugOf(row.name)}.openavatar`);
    fs.writeFileSync(file, approvedText(row));
    say(`  file: ${file}`);
    if (!render) return;
    // The command's checks: warnings (--strict) and the built avatar's size (SPEC 4), then the contact sheet.
    const { main } = await import('@openavatar/cli');
    const io = { out: t => say(`  ${t.trimEnd().replace(/\n/g, '\n  ')}`), err: t => say(`  ${t.trimEnd().replace(/\n/g, '\n  ')}`) };
    await main(['validate', '--strict', file], io);
    await main(['render', file, '--sheet', '-o', file.replace(/\.openavatar$/, '.png')], io);
  },

  async approve(o, { run, say, positionals, avatars }) {
    const row = await one(run, positionals[0]);
    if (row.status !== 'pending') throw new Error(`${row.name} is ${row.status} already`);
    const text = approvedText(row);
    const checked = checkDocument(text);
    if (!checked.ok) throw new Error(`${row.name} doesn't pass the check now (${checked.error}); decline it with a note instead`);
    const gallery = galleryFiles(o.gallery);
    const clash = gallery.ids.get(checked.value.id);
    if (clash) throw new Error(`an avatar with this id is already in the gallery: ${path.relative(site, clash)}`);
    const slug = o.slug ? slugOf(o.slug) : freeSlug(slugOf(row.name), gallery.slugs);
    if (o.slug && gallery.slugs.has(slug)) throw new Error(`the gallery already has an avatar called ${slug}`);
    const file = path.join(avatars, `${slug}.openavatar`);
    say(`Approve ${row.name} (${short(row.id)}) ${credit(row)}, ${licenseName(row.license)}: write ${path.relative(site, file)} (${kb(Buffer.byteLength(text))}) and mark it approved in the ${o.remote ? 'remote' : 'local'} database.`);
    if (!o.yes) return say('Dry run. Add --yes to do it.');
    fs.mkdirSync(avatars, { recursive: true });
    fs.writeFileSync(file, text, { flag: 'wx' });
    try {
      await run(`UPDATE submissions SET status = 'approved', reviewed_at = ${sql(new Date().toISOString())} WHERE id = ${sql(row.id)} AND status = 'pending'`);
    } catch (error) {
      fs.rmSync(file, { force: true });
      throw error;
    }
    say(`Approved. Build the site to show it, and commit ${path.relative(path.join(site, '..'), file)}.`);
  },

  async decline(o, { run, say, positionals }) {
    const note = (o.note ?? '').trim();
    if (!note || note.length > MAX_NOTE) throw fail(`give a --note of 1 to ${MAX_NOTE} characters saying why`);
    const row = await one(run, positionals[0]);
    if (row.status !== 'pending') throw new Error(`${row.name} is ${row.status} already`);
    say(`Decline ${row.name} (${short(row.id)}) ${credit(row)} in the ${o.remote ? 'remote' : 'local'} database, noting: ${note}`);
    if (!o.yes) return say('Dry run. Add --yes to do it.');
    await run(`UPDATE submissions SET status = 'declined', note = ${sql(note)}, reviewed_at = ${sql(new Date().toISOString())} WHERE id = ${sql(row.id)} AND status = 'pending'`);
    say('Declined.');
  },
};

/**
 * Runs a review command; returns the exit code.
 * deps: { run(sql) → rows, out(text), avatars (folder approved files go to), gallery (folders to check against),
 * render (draw the contact sheet), reviewDir (where `show` puts its files) }
 */
export async function review(argv, deps = {}) {
  const say = deps.out ?? (t => process.stdout.write(`${t}\n`));
  const [name, ...rest] = argv;
  const command = COMMANDS[name];
  if (!command) { say(USAGE); return name ? 2 : 0; }
  let args;
  try {
    args = parseArgs({ args: rest, allowPositionals: true, options: {
      remote: { type: 'boolean' }, yes: { type: 'boolean' }, all: { type: 'boolean' }, 'no-render': { type: 'boolean' },
      slug: { type: 'string' }, note: { type: 'string' },
    } });
  } catch (e) { say(`${e.message}\n\n${USAGE}`); return 2; }
  const o = { ...args.values, gallery: deps.gallery ?? GALLERY };
  try {
    await command(o, {
      run: deps.run ?? wranglerRunner({ remote: o.remote }), say, positionals: args.positionals,
      avatars: deps.avatars ?? AVATARS, render: deps.render ?? !o['no-render'],
      reviewDir: deps.reviewDir ?? path.join(site, '.cache', 'review'),
    });
    return 0;
  } catch (e) {
    say(e.usage ? `${e.message}\n\n${USAGE}` : e.message);
    return e.usage ? 2 : 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await review(process.argv.slice(2));

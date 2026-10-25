// Builds the gallery into dist/: the pages, each avatar's file and picture, the JSON list, and the scripts the live
// host needs. Pictures come from the reference renderer in a headless browser (playwright-core, as `openavatar render`
// does) and are kept in .cache/, so a build only draws the avatars, or the renderer, that changed.
//
//   node build.mjs                          avatars from ../examples and avatars/ (approved submissions)
//   OPENAVATAR_ORIGIN=https://… node build.mjs   the address the site is served from (for install links and the list)
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'openavatar';
import { catalogOf, TEXT } from './src/catalog.js';
import { avatarPage, homePage, makePage, notFoundPage, specPage, submitPage } from './src/pages.js';
import { LICENSES } from './web/submission.js';
import { renderSpec } from './src/spec.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist'), cache = path.join(here, '.cache');
const root = path.join(here, '..');
// The project's examples, then the avatars approved from submissions (scripts/review.mjs writes them).
const sources = [path.join(root, 'examples'), path.join(here, 'avatars')];
const origin = (process.env.OPENAVATAR_ORIGIN || 'https://openavatar.dev').replace(/\/+$/, '');
// A three-quarter view shows a face and the body's shape at once. Twice the size a card shows, for sharp screens.
export const PICTURE = { width: 512, height: 512, view: 35, format: 'webp', quality: .86 };
// The contact sheet on the Make page: the avatar an agent's checks are shown for, and how it is drawn.
const SHEET = { slug: 'matcha', cell: 240, columns: 4, background: '#F4F5F9', format: 'webp', quality: .86 };
// Files beside the pages: the spec's schema and vocabulary, and the skill an agent loads.
const COPIES = {
  'spec/openavatar-0.1.schema.json': 'spec/schema/openavatar-0.1.schema.json',
  'spec/vocabulary.json': 'spec/vocabulary.json',
  'skill/SKILL.md': 'skills/openavatar/SKILL.md',
  'skill/reference.md': 'skills/openavatar/reference.md',
};

const dirOf = spec => path.dirname(fileURLToPath(import.meta.resolve(spec)));
const VENDOR = {
  three: { from: dirOf('three'), files: ['three.module.min.js', 'three.core.min.js'] },
  openavatar: { from: dirOf('openavatar'), files: name => name.endsWith('.js') },
  renderer: { from: dirOf('@openavatar/three'), files: name => name.endsWith('.js') },
};

async function filesOf({ from, files }) {
  const names = Array.isArray(files) ? files : (await fs.readdir(from)).filter(files).sort();
  return names.map(name => path.join(from, name));
}

/** Changes when the renderer, the reader or the picture's settings do, so cached pictures are drawn again. */
async function rendererRevision() {
  const hash = createHash('sha256').update(JSON.stringify([PICTURE, SHEET]));
  for (const v of [VENDOR.openavatar, VENDOR.renderer]) for (const file of await filesOf(v)) hash.update(await fs.readFile(file));
  return hash.digest('hex').slice(0, 12);
}

async function readAvatars() {
  const files = [];
  for (const dir of sources) {
    const names = (await fs.readdir(dir).catch(() => [])).filter(n => n.toLowerCase().endsWith('.openavatar')).sort();
    files.push(...await Promise.all(names.map(async fileName => ({ fileName, file: path.join(dir, fileName), text: await fs.readFile(path.join(dir, fileName), 'utf8') }))));
  }
  // An avatar's id names it everywhere (SPEC 3.1), so the gallery shows each one once.
  const seen = new Map();
  for (const { file, text } of files) {
    let id;
    try { ({ id } = parse(text).document); } catch { continue; } // the catalogue says what's wrong with it
    if (seen.has(id)) throw new Error(`${path.relative(root, file)} has the same id as ${path.relative(root, seen.get(id))}`);
    seen.set(id, file);
  }
  return files.map(({ fileName, text }) => ({ fileName, text }));
}

const exists = file => fs.access(file).then(() => true, () => false);

/**
 * Each entry's picture and the Make page's contact sheet, from the cache or drawn now in one browser session.
 * Returns the picture files by slug, and the sheet's file (none when its avatar isn't in the gallery).
 */
async function pictures(entries, renderer) {
  await fs.mkdir(cache, { recursive: true });
  const cached = entry => path.join(cache, `${entry.slug}-${entry.revision}-${renderer}.webp`);
  const sheetEntry = entries.find(e => e.slug === SHEET.slug);
  const sheetFile = sheetEntry && path.join(cache, `sheet-${sheetEntry.slug}-${sheetEntry.revision}-${renderer}.webp`);
  const missing = [];
  for (const entry of entries) if (!await exists(cached(entry))) missing.push(entry);
  const needSheet = sheetFile && !await exists(sheetFile);
  if (missing.length || needSheet) {
    const { openRenderer } = await import('@openavatar/cli');
    const session = await openRenderer();
    try {
      for (const entry of missing) {
        const { image } = await session.render(parse(entry[TEXT]).document, PICTURE);
        await fs.writeFile(cached(entry), image);
        console.log(`  drew ${entry.slug} (${Math.round(image.length / 1024)} KB)`);
      }
      if (needSheet) {
        const { image } = await session.sheet(parse(sheetEntry[TEXT]).document, { cell: SHEET.cell, columns: SHEET.columns, background: SHEET.background, format: SHEET.format, quality: SHEET.quality });
        await fs.writeFile(sheetFile, image);
        console.log(`  drew the ${sheetEntry.slug} sheet (${Math.round(image.length / 1024)} KB)`);
      }
      for (const w of session.warnings) console.warn(`  browser error  ${w.slice(0, 300)}`);
    } finally { await session.close(); }
  }
  // Pictures of avatars that changed or left are not needed again.
  const keep = new Set([...entries.map(e => path.basename(cached(e))), sheetFile && path.basename(sheetFile)]);
  for (const name of await fs.readdir(cache)) if (name.endsWith('.webp') && !keep.has(name)) await fs.rm(path.join(cache, name));
  return { drawn: new Map(entries.map(e => [e.slug, cached(e)])), sheet: sheetFile && { file: sheetFile, entry: sheetEntry } };
}

/** The list other apps and galleries read: what each card shows, plus where the file, picture and page are. */
export function listOf(entries, origin) {
  return {
    openavatar: '0.1',
    avatars: entries.map(e => ({
      ...e,
      file: `${origin}/avatars/${e.slug}.openavatar`,
      picture: `${origin}/avatars/${e.slug}.webp`,
      page: `${origin}/a/${e.slug}/`,
    })),
  };
}

async function write(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
}

async function build() {
  const entries = catalogOf(await readAvatars());
  console.log(`${entries.length} avatars`);
  const { drawn, sheet } = await pictures(entries, await rendererRevision());

  await fs.rm(dist, { recursive: true, force: true });
  await write(path.join(dist, 'index.html'), homePage(entries));
  await write(path.join(dist, '404.html'), notFoundPage());
  await write(path.join(dist, 'spec', 'index.html'), specPage(renderSpec(await fs.readFile(path.join(root, 'spec', 'SPEC.md'), 'utf8'))));
  let sheetPicture = null;
  if (sheet) {
    await write(path.join(dist, 'pictures', 'sheet.webp'), await fs.readFile(sheet.file));
    const { SHEET: CELLS } = await import('@openavatar/cli');
    const rows = Math.ceil(CELLS.length / SHEET.columns);
    // The CLI's sheet: its cells in rows, each with a 24 px label under it.
    sheetPicture = { src: `/pictures/sheet.webp?v=${sheet.entry.revision}`, name: sheet.entry.name, width: SHEET.columns * SHEET.cell, height: rows * (SHEET.cell + 24) };
  }
  await write(path.join(dist, 'make', 'index.html'), makePage({ origin, sheet: sheetPicture }));
  await write(path.join(dist, 'submit', 'index.html'), submitPage({ licenses: LICENSES }));
  for (const [to, from] of Object.entries(COPIES)) await write(path.join(dist, to), await fs.readFile(path.join(root, from)));
  for (const entry of entries) {
    await write(path.join(dist, 'a', entry.slug, 'index.html'), avatarPage(entry, { origin }));
    await write(path.join(dist, 'avatars', `${entry.slug}.openavatar`), entry[TEXT]);
    await fs.copyFile(drawn.get(entry.slug), path.join(dist, 'avatars', `${entry.slug}.webp`));
  }
  await write(path.join(dist, 'api', 'avatars.json'), `${JSON.stringify(listOf(entries, origin), null, 2)}\n`);
  for (const [name, v] of Object.entries(VENDOR)) {
    for (const file of await filesOf(v)) await write(path.join(dist, 'vendor', name, path.basename(file)), await fs.readFile(file));
  }
  for (const name of await fs.readdir(path.join(here, 'web'))) await fs.copyFile(path.join(here, 'web', name), path.join(dist, name));
  console.log(`built ${path.relative(process.cwd(), dist) || '.'} for ${origin}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await build();

// The gallery's catalogue: one entry per avatar, read from its document. Only what the pages and the JSON list show;
// the document itself is served as it is.
import { createHash } from 'node:crypto';
import { parse } from '@openavatar/core';

const MAX_SLUG = 48;
/** The document's text on an entry, for the build. A symbol, so JSON (the pages' catalogue, the list) leaves it out. */
export const TEXT = Symbol('text');

/** A URL-safe slug from a file name: lower case letters, digits and single dashes. */
export function slugOf(fileName) {
  return fileName.replace(/\.openavatar$/i, '').normalize('NFKD').replace(/[^\w\s-]/g, '').toLowerCase()
    .replace(/[\s_-]+/g, '-').replace(/^-|-$/g, '').slice(0, MAX_SLUG) || 'avatar';
}

/** What a gallery card and the list need. Throws when the text is not a document an OpenAvatar reader accepts. */
export function entryFor(fileName, text) {
  const { document } = parse(text);
  const meta = document.meta ?? {};
  const authors = (meta.authors ?? []).map(a => a?.name).filter(Boolean);
  return {
    slug: slugOf(fileName),
    id: document.id,
    name: document.name,
    description: meta.description ?? '',
    authors,
    license: meta.license ?? '',
    tags: [...new Set((meta.tags ?? []).map(t => String(t).toLowerCase()))],
    rig: document.body?.rig === 'biped' ? 'biped' : 'blob',
    bytes: Buffer.byteLength(text),
    // Changes whenever the file does, so a picture or a cached copy can be told apart.
    revision: createHash('sha256').update(text).digest('hex').slice(0, 12),
    [TEXT]: text,
  };
}

/** Entries sorted by name, slugs made unique. */
export function catalogOf(files) {
  const seen = new Map();
  return files.map(({ fileName, text }) => entryFor(fileName, text))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .map(entry => {
      const n = (seen.get(entry.slug) ?? 0) + 1;
      seen.set(entry.slug, n);
      return n === 1 ? entry : { ...entry, slug: `${entry.slug}-${n}` };
    });
}

/** The tags worth a filter, most used first: on at least two avatars, and on no more than half (one on nearly every
 * avatar narrows nothing). */
export function tagCounts(entries, min = 2) {
  const counts = new Map();
  for (const e of entries) for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].filter(([, n]) => n >= min && n <= entries.length / 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// The shared folder of SPEC 14.2, where every OpenAvatar app on a computer
// finds the same characters. OPENAVATAR_HOME moves it (for tests and
// portable setups); the folder is then $OPENAVATAR_HOME/avatars.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse, compareCopies } from '@openavatar/core';

export const sharedFolder = () => path.join(process.env.OPENAVATAR_HOME || path.join(os.homedir(), '.openavatar'), 'avatars');

/**
 * Every document in the folder, grouped the way a reader sees them: each is
 * normalized, and for each id the copy SPEC 14.2 picks (compareCopies) wins
 * while the rest are listed as older copies. A file a reader rejects is
 * listed as broken.
 */
export function readShared(folder = sharedFolder()) {
  if (!fs.existsSync(folder)) return { folder, avatars: [], broken: [] };
  const byId = new Map(), broken = [];
  for (const name of fs.readdirSync(folder).sort()) {
    if (!name.endsWith('.openavatar')) continue;
    const file = path.join(folder, name);
    let doc;
    try { doc = parse(fs.readFileSync(file, 'utf8')).document; } catch (e) { broken.push({ file, reason: e.message }); continue; }
    const entry = { file, id: doc.id, name: doc.name, updated: doc.meta?.updated || '', mtime: fs.statSync(file).mtimeMs };
    (byId.get(doc.id) || byId.set(doc.id, []).get(doc.id)).push(entry);
  }
  const avatars = [...byId.values()].map(copies => {
    copies.sort((a, b) => compareCopies(b, a));
    return { ...copies[0], olderCopies: copies.slice(1).map(c => c.file) };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { folder, avatars, broken };
}

export function fileNameFor(doc) {
  const slug = String(doc.name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'avatar';
  return `${slug}-${String(doc.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 8)}.openavatar`;
}

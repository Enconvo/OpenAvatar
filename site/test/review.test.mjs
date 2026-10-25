// The review script against the real migration, in an in-memory SQLite database standing in for D1.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { review, sql } from '../scripts/review.mjs';

const examples = new URL('../../examples/', import.meta.url);
const matchaText = fs.readFileSync(new URL('matcha.openavatar', examples), 'utf8');
const migration = fs.readFileSync(new URL('../migrations/0001_submissions.sql', import.meta.url), 'utf8');

const dirs = [];
after(() => { for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true }); });

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(migration);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openavatar-review-'));
  dirs.push(dir);
  const avatars = path.join(dir, 'avatars');
  const lines = [];
  const deps = {
    run: async query => (/^\s*SELECT/i.test(query) ? db.prepare(query).all() : (db.prepare(query).run(), [])),
    out: text => lines.push(text),
    avatars, gallery: [fileURLToPath(examples), avatars], render: false, reviewDir: path.join(dir, 'review'),
  };
  const add = (id, change = () => {}, row = {}) => {
    const doc = JSON.parse(matchaText);
    change(doc);
    const text = JSON.stringify(doc);
    db.prepare(`INSERT INTO submissions (id, avatar_id, name, author, license, document, bytes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, doc.id, doc.name, row.author ?? null, row.license ?? 'CC0-1.0', text,
      Buffer.byteLength(text), row.created_at ?? '2026-10-25T08:00:00.000Z');
  };
  const status = id => db.prepare('SELECT status, note, reviewed_at FROM submissions WHERE id = ?').get(id);
  const said = () => lines.splice(0).join('\n');
  return { db, dir, avatars, deps, add, status, said };
}
const remix = (name, id) => doc => { doc.id = id; doc.name = name; };

test('a SQL literal doubles quotes and drops NUL, so any text reads back as it was', () => {
  assert.equal(sql("O'Brien"), "'O''Brien'");
  assert.equal(sql(null), 'NULL');
  const db = new DatabaseSync(':memory:');
  const nasty = "it's'); DROP TABLE x; --\\ \n\0end";
  assert.equal(db.prepare(`SELECT ${sql(nasty)} AS v`).get().v, nasty.replace('\0', ''));
});

test('list shows what waits for review, oldest first', async () => {
  const { deps, add, said } = setup();
  add('bbbbbbbb-0000-4000-8000-000000000002', remix('Later Leaf', '00000000-0000-4000-8000-0000000000b2'), { created_at: '2026-10-25T09:00:00.000Z', author: 'Ada' });
  add('aaaaaaaa-0000-4000-8000-000000000001', remix('Early Leaf', '00000000-0000-4000-8000-0000000000a1'));
  assert.equal(await review(['list'], deps), 0);
  const out = said().split('\n');
  assert.match(out[0], /^aaaaaaaa {2}2026-10-25 08:00 {2}Early Leaf anonymous, CC0/);
  assert.match(out[1], /Later Leaf by Ada/);
});

test('approve is a dry run until --yes, then writes the file with the chosen credit and license', async () => {
  const { deps, add, status, avatars, said } = setup();
  const id = 'cccccccc-0000-4000-8000-000000000003';
  add(id, remix('Leaf Remix', '00000000-0000-4000-8000-0000000000c3'), { author: "O'Brien", license: 'CC-BY-4.0' });
  assert.equal(await review(['approve', 'cccc'], deps), 0);
  assert.match(said(), /Dry run/);
  assert.equal(fs.existsSync(avatars), false);
  assert.equal(status(id).status, 'pending');

  assert.equal(await review(['approve', 'cccc', '--yes'], deps), 0);
  const doc = JSON.parse(fs.readFileSync(path.join(avatars, 'leaf-remix.openavatar'), 'utf8'));
  assert.deepEqual(doc.meta.authors, [{ name: "O'Brien" }]);
  assert.equal(doc.meta.license, 'CC-BY-4.0');
  assert.equal(status(id).status, 'approved');
  assert.ok(status(id).reviewed_at);

  said();
  assert.equal(await review(['approve', 'cccc', '--yes'], deps), 1);
  assert.match(said(), /approved already/);
});

test('approve picks a free name, and refuses an avatar the gallery already has', async () => {
  const { deps, add, avatars, said } = setup();
  // Named like an example, with its own id: it gets the next free name.
  add('dddddddd-0000-4000-8000-000000000004', remix('Matcha', '00000000-0000-4000-8000-0000000000d4'));
  assert.equal(await review(['approve', 'dddd', '--yes'], deps), 0);
  assert.ok(fs.existsSync(path.join(avatars, 'matcha-2.openavatar')));
  // The example itself, sent again.
  add('eeeeeeee-0000-4000-8000-000000000005');
  said();
  assert.equal(await review(['approve', 'eeee', '--yes'], deps), 1);
  assert.match(said(), /already in the gallery/);
  // A name asked for that is taken.
  add('ffffffff-0000-4000-8000-000000000006', remix('Fern', '00000000-0000-4000-8000-0000000000f6'));
  assert.equal(await review(['approve', 'ffff', '--slug', 'Mochi', '--yes'], deps), 1);
  assert.match(said(), /already has an avatar called mochi/);
});

test('approve refuses a document that no longer passes the check', async () => {
  const { deps, add, status, said } = setup();
  const id = '11111111-0000-4000-8000-000000000007';
  add(id, doc => { doc.id = '00000000-0000-4000-8000-000000000017'; doc.body = { rig: 'tripod' }; });
  assert.equal(await review(['approve', '1111', '--yes'], deps), 1);
  assert.match(said(), /doesn't pass the check now \(invalid\)/);
  assert.equal(status(id).status, 'pending');
});

test('decline needs a note, and keeps it as written', async () => {
  const { deps, add, status, said } = setup();
  const id = '22222222-0000-4000-8000-000000000008';
  add(id, remix('Copy Leaf', '00000000-0000-4000-8000-000000000028'));
  assert.equal(await review(['decline', '2222', '--yes'], deps), 2);
  assert.match(said(), /give a --note/);
  const note = "It's a copy of Matcha; send your own design.";
  assert.equal(await review(['decline', '2222', '--note', note, '--yes'], deps), 0);
  assert.deepEqual({ ...status(id), reviewed_at: !!status(id).reviewed_at }, { status: 'declined', note, reviewed_at: true });
});

test('a submission is found by a unique start of its id, and only that way', async () => {
  const { deps, add, said } = setup();
  add('33333333-0000-4000-8000-000000000009', remix('One', '00000000-0000-4000-8000-000000000039'));
  add('33333333-1111-4000-8000-000000000010', remix('Two', '00000000-0000-4000-8000-000000000310'));
  assert.equal(await review(['show', '3333'], deps), 1);
  assert.match(said(), /more than one/);
  assert.equal(await review(['show', "3333' OR 1=1 --"], deps), 2);
  assert.match(said(), /give a submission id/);
  assert.equal(await review(['show', '9999'], deps), 1);
  assert.match(said(), /no submission starts with 9999/);
});

test('show reports the check and writes the file it would approve', async () => {
  const { deps, add, dir, said } = setup();
  add('44444444-0000-4000-8000-000000000011', remix('Shown Leaf', '00000000-0000-4000-8000-000000000411'), { author: 'Ada' });
  assert.equal(await review(['show', '4444'], deps), 0);
  const out = said();
  assert.match(out, /^Shown Leaf by Ada, /);
  assert.match(out, /check: no errors/);
  const file = path.join(dir, 'review', '44444444-shown-leaf.openavatar');
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).meta.authors[0].name, 'Ada');
});

test('an unknown command prints how to use it', async () => {
  const { deps, said } = setup();
  assert.equal(await review([], deps), 0);
  assert.equal(await review(['publish'], deps), 2);
  assert.match(said(), /scripts\/review\.mjs list/);
});

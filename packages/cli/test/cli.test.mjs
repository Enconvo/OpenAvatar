// Runs the openavatar command in process against the examples and broken
// documents. The render and pack tests need a Chromium-based browser and are
// skipped without one.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { validate } from '@openavatar/core';
import { main, openRenderer, readShared } from '../src/index.js';

const examples = new URL('../../../examples/', import.meta.url).pathname;
const exampleFiles = fs.readdirSync(examples).filter(f => f.endsWith('.openavatar')).map(f => path.join(examples, f));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'openavatar-cli-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

async function run(...argv) {
  let out = '', err = '';
  const code = await main(argv, { out: t => { out += t; }, err: t => { err += t; } });
  return { code, out, err };
}
const write = (name, value) => {
  const file = path.join(tmp, name);
  fs.writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value));
  return file;
};
const mochi = () => JSON.parse(fs.readFileSync(path.join(examples, 'mochi.openavatar'), 'utf8'));
// A body that reaches 1.8: each sphere is in range, their union is not.
const hugeBody = { type: 'union', children: [{ type: 'sphere', radius: 0.6, position: [1.2, 0, 0] }, { type: 'sphere', radius: 0.6, position: [-1.2, 0, 0] }] };

// Checked before any test is registered: a top-level await between tests lets the root's after() run early.
let hasBrowser = true;
try { await (await openRenderer()).close(); } catch (e) { if (e.code === 'no-browser') hasBrowser = false; else throw e; }

test('every example is valid, fits its box and meets the SHOULDs', async () => {
  const r = await run('validate', '--json', '--strict', ...exampleFiles);
  const results = JSON.parse(r.out);
  for (const x of results) assert.ok(x.ok, `${path.basename(x.file)}: ${JSON.stringify([x.fatal, x.errors, x.warnings])}`);
  assert.equal(r.code, 0);
});

test('validate rejects what a reader must reject and reports what it repairs', async () => {
  const cases = {
    'big.openavatar': [Buffer.alloc(300 * 1024, 32), 'limit'],
    'text.openavatar': ['not json', 'json'],
    'latin1.openavatar': [Buffer.from([0x7b, 0xe9, 0x7d]), 'not-utf8'],
    'no-id.openavatar': [{ ...mochi(), id: undefined }, 'missing'],
    'future.openavatar': [{ ...mochi(), openavatar: '1.0' }, 'version'],
  };
  for (const [name, [value, code]] of Object.entries(cases)) {
    const r = await run('validate', '--json', write(name, value));
    assert.equal(r.code, 1, name);
    assert.equal(JSON.parse(r.out)[0].fatal.code, code, name);
  }
  const doc = mochi(); doc.face.eyes.size = 9; doc.body.material = 'missing-material'; doc.wobble = true;
  const bom = write('bom.openavatar', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify(doc))]));
  const r = await run('validate', bom);
  assert.equal(r.code, 1);
  assert.match(r.out, /byte order mark/);
  assert.match(r.out, /face\.eyes\.size/);
  assert.match(r.out, /wobble/);
});

test('validate measures the avatar against SPEC 4', async () => {
  const huge = mochi(); huge.body.shape = hugeBody;
  let r = await run('validate', '--json', write('huge.openavatar', huge));
  assert.equal(r.code, 1);
  assert.match(JSON.parse(r.out)[0].errors.map(e => e.message).join('\n'), /body reaches past 1\.6/);
  const wide = mochi(); wide.body.shape = { type: 'ellipsoid', radii: [1.2, 0.8, 0.8] };
  r = await run('validate', '--json', write('wide.openavatar', wide));
  assert.equal(r.code, 0, 'a warning alone passes');
  assert.match(JSON.parse(r.out)[0].warnings.join('\n'), /should fit inside ±1/);
  r = await run('validate', '--strict', write('wide.openavatar', wide));
  assert.equal(r.code, 1, '--strict fails on warnings');
  r = await run('validate', '--json', '--no-geometry', write('huge.openavatar', huge));
  assert.equal(JSON.parse(r.out)[0].bounds, null);
  const far = mochi(); far.parts[1].attach.position = [1.95, 0, 0];
  r = await run('validate', '--json', write('far.openavatar', far));
  assert.match(JSON.parse(r.out)[0].errors.map(e => e.message).join('\n'), /with its parts it must fit inside ±2/);
});

test('validate prints the body and the whole avatar, and finds parts hidden in the body', async () => {
  let r = await run('validate', path.join(examples, 'mochi.openavatar'));
  assert.match(r.out, /\n  body     x -?[\d.]+ to [\d.]+, y .+, z .+\n  avatar   x /);
  const buried = mochi();
  buried.parts.push({ id: 'core', shape: { type: 'sphere', radius: 0.3 }, attach: { position: [0, 0, 0] } });
  r = await run('validate', '--json', write('buried.openavatar', buried));
  const [result] = JSON.parse(r.out);
  assert.deepEqual(result.warnings, [`parts[${buried.parts.length - 1}] "core" is hidden inside the body; move it out or raise its lift`]);
  assert.equal(result.body.min.length, 3);
  // Inside another part, the warning names it.
  const capped = mochi();
  capped.parts.push({ id: 'cap', shape: { type: 'sphere', radius: 0.4 }, attach: { position: [0, 1, 0] } },
    { id: 'gem', shape: { type: 'sphere', radius: 0.1 }, attach: { position: [0, 1, 0] } });
  r = await run('validate', '--json', write('capped.openavatar', capped));
  assert.deepEqual(JSON.parse(r.out)[0].warnings, [`parts[${capped.parts.length - 1}] "gem" is hidden inside part "cap"; move it out or raise its lift`]);
  // A stalk whose ends are buried in the body and its bulb still shows its side; buried along its length, it names both.
  const sugar = () => JSON.parse(fs.readFileSync(path.join(examples, 'sugar.openavatar'), 'utf8'));
  const stalk = (length, at, bulbAt, bulb) => {
    const doc = sugar();
    doc.parts.push({ id: 'stalk', shape: { type: 'capsule', from: [0, 0, 0], to: [0, length, 0], radius: 0.04 }, attach: { position: [0, at, 0] } },
      { id: 'bulb', shape: { type: 'sphere', radius: bulb }, attach: { position: [0, bulbAt, 0] } });
    return doc;
  };
  r = await run('validate', '--json', write('stalk.openavatar', stalk(0.4, 0.7, 1.1, 0.12)));
  assert.deepEqual(JSON.parse(r.out)[0].warnings, []);
  r = await run('validate', '--json', write('sunk.openavatar', stalk(0.2, 0.68, 0.9, 0.16)));
  assert.match(JSON.parse(r.out)[0].warnings.join('\n'), /"stalk" is hidden inside (the body and part "bulb"|part "bulb" and the body);/);
  // Parts that appear only in some situations are hidden at rest, so overlapping there is fine.
  const puffs = mochi();
  for (const id of ['puff-1', 'puff-2']) puffs.parts.push({ id, shape: { type: 'sphere', radius: 0.08 }, attach: { position: [0.6, 1.1, 0] }, animations: [{ type: 'appear', driver: 'thinking' }] });
  r = await run('validate', '--json', write('puffs.openavatar', puffs));
  assert.deepEqual(JSON.parse(r.out)[0].warnings, []);
});

test('validate warns about an x- expression the document names but does not define', async () => {
  const doc = mochi();
  doc.behavior = { reactions: { userActivities: { reading: { expression: 'x-shy' } } } };
  let r = await run('validate', '--json', write('shy.openavatar', doc));
  assert.deepEqual(JSON.parse(r.out)[0].warnings, ['behavior.reactions.userActivities.reading.expression "x-shy" is not defined in face.expressions, so it shows neutral; define its poses there']);
  doc.face.expressions = { 'x-shy': { eyes: 'wide', mouth: 'o', cheeks: true } };
  r = await run('validate', '--json', write('shy.openavatar', doc));
  assert.deepEqual(JSON.parse(r.out)[0].warnings, []);
});

test('validate reports a front point that misses the solid', async () => {
  const doc = mochi();
  doc.parts.push({ id: 'stray', shape: { type: 'sphere', radius: 0.1 }, attach: { at: [1.4, 0.2] } });
  const r = await run('validate', '--json', write('stray.openavatar', doc));
  assert.deepEqual(JSON.parse(r.out)[0].warnings, [`parts[${doc.parts.length - 1}].attach.at [1.4,0.2] misses the body, so it sits at z = 0 there; move it onto the surface`]);
  assert.equal((await run('validate', '--strict', write('stray.openavatar', doc))).code, 1);
});

test('fix prints or writes the repaired document', async () => {
  const doc = mochi(); doc.face.eyes.size = 9; doc.wobble = true;
  const file = write('fixme.openavatar', doc);
  let r = await run('fix', file);
  const fixed = JSON.parse(r.out);
  assert.equal(fixed.wobble, undefined);
  assert.ok(fixed.face.eyes.size < 1);
  assert.ok(validate(fixed).valid);
  r = await run('fix', file, '--write');
  assert.equal(r.code, 0);
  assert.ok(validate(JSON.parse(fs.readFileSync(file, 'utf8'))).valid);
  assert.match(r.err, /repairs? made/);
});

test('new writes a valid document for each rig and keeps existing files', async () => {
  for (const rig of ['blob', 'biped']) {
    const out = path.join(tmp, `new-${rig}.openavatar`);
    let r = await run('new', `New ${rig}`, '--rig', rig, '-o', out);
    assert.equal(r.code, 0);
    r = await run('validate', '--strict', out);
    assert.equal(r.code, 0, r.out);
    // Dates to the second, as the skill shows them.
    const { meta } = JSON.parse(fs.readFileSync(out, 'utf8'));
    for (const date of [meta.created, meta.updated]) assert.match(date, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    r = await run('new', 'Again', '-o', out);
    assert.equal(r.code, 1);
    assert.match(r.err, /already exists/);
  }
  const r = await run('new', '--rig', 'snake');
  assert.equal(r.code, 1);
});

test('vocabulary lists the standard ids', async () => {
  let r = await run('vocabulary', 'motions', '--json');
  assert.equal(JSON.parse(r.out).length, 30);
  r = await run('vocabulary', 'user-activities');
  assert.match(r.out, /^listening-music/m);
  r = await run('vocabulary', 'userActivities', '--json');
  assert.equal(JSON.parse(r.out).length, 12);
  r = await run('vocabulary', 'nonsense');
  assert.equal(r.code, 2);
});

test('install and list use the shared folder', async () => {
  const home = path.join(tmp, 'home'); process.env.OPENAVATAR_HOME = home;
  try {
    let r = await run('list');
    assert.match(r.out, /No avatars/);
    r = await run('install', path.join(examples, 'mochi.openavatar'));
    assert.equal(r.code, 0, r.err);
    r = await run('install', path.join(examples, 'mochi.openavatar'));
    assert.equal(r.code, 1);
    assert.match(r.err, /--replace/);
    r = await run('install', '--replace', path.join(examples, 'mochi.openavatar'));
    assert.equal(r.code, 0);
    const huge = mochi(); huge.id = 'huge-one'; huge.body.shape = hugeBody;
    r = await run('install', write('huge.openavatar', huge));
    assert.equal(r.code, 1, 'an avatar too large to fit is refused');
    // Two copies of one id: the later meta.updated wins (SPEC 14.2).
    const folder = path.join(home, 'avatars');
    const older = mochi(); older.name = 'Old Mochi'; older.meta.updated = '2026-01-01T00:00:00Z';
    const newer = mochi(); newer.name = 'New Mochi'; newer.meta.updated = '2026-06-01T00:00:00Z';
    fs.writeFileSync(path.join(folder, 'a.openavatar'), JSON.stringify(newer));
    fs.writeFileSync(path.join(folder, 'b.openavatar'), JSON.stringify(older));
    fs.writeFileSync(path.join(folder, 'c.openavatar'), '{ broken');
    fs.writeFileSync(path.join(folder, 'd.openavatar'), JSON.stringify({ ...mochi(), id: 'future', openavatar: '2.0' }));
    const { avatars, broken } = readShared(folder);
    assert.equal(avatars.length, 1);
    assert.equal(avatars[0].name, 'New Mochi');
    assert.equal(avatars[0].olderCopies.length, 2);
    assert.deepEqual(broken.map(b => path.basename(b.file)), ['c.openavatar', 'd.openavatar'], 'a file a reader rejects is broken');
    fs.rmSync(path.join(folder, 'd.openavatar'));
    r = await run('list');
    assert.match(r.out, /New Mochi/);
    assert.match(r.out, /older copy: b\.openavatar/);
    assert.match(r.out, /unreadable: c\.openavatar/);
  } finally { delete process.env.OPENAVATAR_HOME; }
});

test('install downloads from a URL within the size limit', async () => {
  const home = path.join(tmp, 'home-url'); process.env.OPENAVATAR_HOME = home;
  const body = fs.readFileSync(path.join(examples, 'sprout.openavatar'));
  const server = http.createServer((req, res) => {
    if (req.url === '/big.openavatar') { res.writeHead(200); res.end(Buffer.alloc(300 * 1024, 32)); return; }
    if (req.url !== '/sprout.openavatar') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/vnd.openavatar+json' }); res.end(body);
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let r = await run('install', `${base}/sprout.openavatar`);
    assert.equal(r.code, 0, r.err);
    assert.equal(readShared(path.join(home, 'avatars')).avatars[0].name, 'Sprout');
    r = await run('install', `${base}/big.openavatar`);
    assert.equal(r.code, 1);
    assert.match(r.err, /larger than/);
    r = await run('install', `${base}/missing.openavatar`);
    assert.match(r.err, /404/);
    r = await run('install', 'http://example.com/a.openavatar');
    assert.match(r.err, /only https/);
  } finally { server.close(); delete process.env.OPENAVATAR_HOME; }
});

test('usage errors exit with 2', async () => {
  assert.equal((await run()).code, 2);
  assert.equal((await run('frobnicate')).code, 2);
  assert.equal((await run('validate')).code, 2);
  assert.equal((await run('render', 'a', '--colour', 'red')).code, 2);
  assert.equal((await run('validate', '--help')).code, 0);
});

// The browser steps.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

test('render draws a picture and a contact sheet', { skip: !hasBrowser && 'no browser' }, async () => {
  const out = path.join(tmp, 'mochi.png');
  let r = await run('render', path.join(examples, 'mochi.openavatar'), '-o', out, '--size', '96', '--view', 'side', '--expression', 'happy');
  assert.equal(r.code, 0, r.err);
  assert.ok(fs.readFileSync(out).subarray(0, 4).equals(PNG));
  const sheet = path.join(tmp, 'sheet.webp');
  r = await run('render', path.join(examples, 'matcha.openavatar'), '--sheet', '--size', '64', '-o', sheet);
  assert.equal(r.code, 0, r.err);
  assert.equal(fs.readFileSync(sheet).subarray(8, 12).toString(), 'WEBP');
  r = await run('render', path.join(examples, 'mochi.openavatar'), '-o', path.join(tmp, 'x.gif'));
  assert.equal(r.code, 2);
});

test('render draws the same picture on every run, idle motions and blinks included', { skip: !hasBrowser && 'no browser' }, async () => {
  // By 14 s an idle motion has started and the eyes have blinked, both timed at random.
  const draw = async name => {
    const out = path.join(tmp, name);
    const r = await run('render', path.join(examples, 'sprout.openavatar'), '-o', out, '--size', '128', '--time', '14');
    assert.equal(r.code, 0, r.err);
    return fs.readFileSync(out);
  };
  assert.ok((await draw('once.png')).equals(await draw('twice.png')));
});

test('pack embeds a preview within the limits', { skip: !hasBrowser && 'no browser' }, async () => {
  const out = path.join(tmp, 'packed.openavatar');
  let r = await run('pack', path.join(examples, 'starling.openavatar'), '-o', out);
  assert.equal(r.code, 0, r.err);
  const doc = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.ok(validate(doc).valid);
  assert.match(doc.preview.image, /^data:image\/webp;base64,/);
  assert.ok(Buffer.from(doc.preview.image.split(',')[1], 'base64').length <= 96 * 1024);
  r = await run('pack', out, '-o', out, '--no-preview');
  assert.equal(r.code, 0, r.err);
  assert.equal(JSON.parse(fs.readFileSync(out, 'utf8')).preview, undefined);
});

test('the biped head the agent skill describes is the default suit\'s', async () => {
  const { bipedSuit } = await import('@openavatar/three');
  const { head } = bipedSuit();
  const skill = fs.readFileSync(new URL('../../../skills/openavatar/SKILL.md', import.meta.url), 'utf8').replace(/\s+/g, ' ');
  const [, y, ...radii] = skill.match(/head is centered at y ([\d.]+) with radii of about ([\d.]+) across, ([\d.]+) up and ([\d.]+) deep/).map(Number);
  assert.equal(y, Math.round(head.center[1] * 100) / 100);
  assert.deepEqual(radii, head.radii.map(r => Math.round(r * 100) / 100));
});

test('the commands in the agent skill exist with the options it shows', async () => {
  const skill = fs.readFileSync(new URL('../../../skills/openavatar/SKILL.md', import.meta.url), 'utf8');
  const lines = [...skill.matchAll(/`openavatar (\w+)([^`]*)`/g)];
  assert.ok(lines.length >= 6);
  for (const [line, name, rest] of lines) {
    const help = await run(name, '--help');
    assert.equal(help.code, 0, line);
    for (const flag of rest.match(/--?[a-z][\w-]*/g) || []) assert.ok(help.out.includes(flag), `${line}: ${flag}`);
  }
});

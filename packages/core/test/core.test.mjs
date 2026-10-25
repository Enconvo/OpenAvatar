import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import * as oa from '../src/index.js';

const root = new URL('../../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const examples = fs.readdirSync(new URL('examples/', root)).filter(f => f.endsWith('.openavatar'));
const ajv = new Ajv({ allErrors: true, strict: true }); addFormats(ajv);
const schemaValid = ajv.compile(read('spec/schema/openavatar-0.1.schema.json'));
const sprout = () => read('examples/sprout.openavatar');

test('every example is valid by the schema and by validate()', () => {
  assert.ok(examples.length >= 2);
  for (const f of examples) {
    const doc = read(`examples/${f}`);
    assert.equal(schemaValid(doc), true, `${f}: ${JSON.stringify(schemaValid.errors)}`);
    assert.deepEqual(oa.validate(doc), { valid: true, errors: [] }, f);
  }
});

// The same mistakes must be caught by the JSON Schema and by validate(), and the same fine documents pass both.
const MUTATIONS = {
  'unknown top-level member': d => { d.personality = 'cheerful' },
  'blob without a shape': d => { delete d.body.shape },
  'biped without a shape': d => { delete d.body.shape; d.body.rig = 'biped' },
  'attach with at and position': d => { d.parts[0].attach = { at: [0, .5], position: [0, 0, 0] } },
  'color name': d => { d.materials.lime.color = 'green' },
  'short color': d => { d.materials.lime.color = '#abc' },
  'unknown shape type': d => { d.body.shape = { type: 'blobby' } },
  'x- idle motion': d => { d.behavior.idleMotions = ['x-moonwalk'] },
  'unknown idle motion': d => { d.behavior.idleMotions = ['moonwalk'] },
  'part with shape and patch': d => { d.parts[0].patch = { type: 'circle', radius: .1 } },
  'radius over range': d => { d.body.shape = { type: 'sphere', radius: 9 } },
  'reaction turned off': d => { d.behavior.reactions.activities = { done: null } },
  'reaction member off': d => { d.behavior.reactions.activities = { done: { effect: null } } },
  'unknown reaction key': d => { d.behavior.reactions.activities = { dancing: {} } },
  'subtract of one child': d => { d.body.shape = { type: 'subtract', children: [{ type: 'sphere', radius: 1 }] } },
  'nested union with deform': d => { d.body.shape = { type: 'union', smooth: .2, children: [{ type: 'sphere', radius: .8, deform: [{ type: 'twist', axis: 'y', amount: 30 }] }, { type: 'box', size: [1, 1, 1], rounding: .2, position: [0, -.4, 0] }] } },
  'extrusion of a star': d => { d.body.shape = { type: 'extrusion', depth: .4, puff: .6, outline: { type: 'star', points: 5, radius: 1, innerRadius: .5 } } },
  'polygon of two points': d => { d.body.shape = { type: 'extrusion', depth: .4, outline: { type: 'polygon', points: [[0, 0], [1, 1]] } } },
  'patch part': d => { d.parts.push({ id: 'belly', patch: { type: 'ellipse', radii: [.3, .25] }, attach: { at: [0, -.3] } }) },
  'bad tag': d => { d.meta.tags = ['Plant'] },
  'version 2.0.0': d => { d.meta.version = '2.0.0' },
  'bad version': d => { d.meta.version = 'v2' },
  'expression override': d => { d.face.expressions = { happy: { eyes: 'heart', effect: 'hearts' } } },
  'unknown eye pose': d => { d.face.expressions = { happy: { eyes: 'starry' } } },
  'glow driven by a user activity': d => { d.materials.leaf.glow = { driver: 'coding' } },
  'extension data': d => { d.extensions = { 'com.enconvo': { voice: 'x' } } },
  'bad extension key': d => { d.extensions = { enconvo: {} } },
  'too many animations': d => { d.parts[0].animations = Array(5).fill({ type: 'bob' }) },
  'integer star points as float': d => { d.body.shape = { type: 'extrusion', depth: .4, outline: { type: 'star', points: 5.5, radius: 1, innerRadius: .5 } } },
  'impossible date': d => { d.meta.updated = '2026-02-30T12:00:00Z' },
  'leap second': d => { d.meta.updated = '2016-12-31T23:59:60Z' },
  'leap second at noon': d => { d.meta.updated = '2016-12-31T12:59:60Z' },
  'lowercase date': d => { d.meta.updated = '2026-10-25t10:00:00z' },
  'date with a space': d => { d.meta.updated = '2026-10-25 10:00:00Z' },
  'id with a space': d => { d.id = 'sprout one' },
  'body that is a string': d => { d.body = 'round' },
  'name of 64 emoji': d => { d.name = '\u{1F331}'.repeat(64) },
  'name of 65 emoji': d => { d.name = '\u{1F331}'.repeat(65) },
};
test('validate() agrees with the JSON Schema', () => {
  for (const [name, f] of Object.entries(MUTATIONS)) {
    const d = sprout(); f(d);
    assert.equal(oa.validate(d).valid, schemaValid(d), `${name}: validate ${JSON.stringify(oa.validate(d).errors)} schema ${JSON.stringify(schemaValid.errors?.slice(0, 2))}`);
  }
});

test('normalize() repairs what a reader must repair', () => {
  const d = sprout();
  d.personality = 'x';
  d.body.shape = { type: 'sphere', radius: 9 };
  d.materials.lime.color = '#abc';
  d.face.eyes.size = 1;
  d.behavior.reactions.states.speaking = { expression: 'joyful', motion: 'moonwalk', prop: 'umbrella' };
  d.parts.push({ id: 'stem', shape: { type: 'sphere', radius: .1 } });
  d.parts.push({ id: 'late', shape: { type: 'sphere', radius: .1 }, attach: { to: 'later' } });
  const { document: n, repairs } = oa.normalize(d);
  assert.equal(n.personality, undefined);
  assert.equal(n.body.shape.radius, 1.5);
  assert.equal(n.materials.lime.color, '#AABBCC');
  assert.equal(n.face.eyes.size, .3);
  assert.deepEqual(n.behavior.reactions.states.speaking, { expression: 'neutral', motion: 'nod', prop: null });
  assert.equal(n.parts[2].id, 'stem-2');
  assert.equal(n.parts[3].attach.to, 'body');
  assert.ok(repairs.length >= 8);
  assert.deepEqual(oa.validate(n), { valid: true, errors: [] }, 'a normalized document is valid');
});

test('normalize() empties what it cannot repair and keeps the rest', () => {
  const d = sprout();
  d.body.shape = { type: 'subtract', children: [{ type: 'blobby' }, { type: 'sphere', radius: .5 }] };
  d.parts[0].shape = { type: 'cloud' };
  const { document: n } = oa.normalize(d);
  assert.deepEqual(n.body.shape, { type: 'sphere', radius: .9 });
  assert.equal(n.parts.length, 1, 'the part with an empty shape is dropped');
  assert.equal(n.parts[0].id, 'leaves');
  assert.equal(n.parts[0].attach.to, 'body', 'its parent was dropped, so it hangs on the body');
  const i = oa.normalize({ ...sprout(), body: { shape: { type: 'intersect', children: [{ type: 'sphere', radius: 1 }, { type: 'nope' }] } } }).document;
  assert.equal(i.body.shape.type, 'union');
});

test('normalization follows Appendix B exactly', () => {
  const n = d => oa.normalize(d).document;
  // B.1: an id's other code points become -, one each; a body that is not an object is a blob.
  assert.equal(n({ ...sprout(), id: 'a b\u{1F331}' }).id, 'a-b-');
  assert.deepEqual(n({ ...sprout(), body: 7, parts: [] }).body, { shape: { type: 'sphere', radius: .9 } });
  // B.1: strings are cut by code point.
  assert.equal(n({ ...sprout(), name: 'x' + '\u{1F331}'.repeat(70) }).name, 'x' + '\u{1F331}'.repeat(63));
  // B.2: a repeat keeps the first place, and the report names the item as written.
  const r = oa.normalize({ ...sprout(), behavior: { idleMotions: ['wave', 'nod', 'wave', 'moonwalk'] } });
  assert.deepEqual(r.document.behavior.idleMotions, ['wave', 'nod']);
  assert.deepEqual(r.repairs.map(x => x.path), ['behavior.idleMotions[3]', 'behavior.idleMotions[2]', 'behavior.idleMotions[3]'], 'moonwalk turns into nod, then the repeats go');
  // B.2: over 16 materials, the ids that sort first stay, in the order written.
  const mats = Object.fromEntries(['q', 'b', ...'ponmlkjihgfedc', 'a'].map(k => [k, { color: '#FFFFFF' }]));
  assert.deepEqual(Object.keys(n({ ...sprout(), materials: mats }).materials), ['b', ...'ponmlkjihgfedc', 'a']);
  // B.5: a renamed id stays within 32 characters.
  const long = 'x'.repeat(32), part = { id: long, shape: { type: 'sphere', radius: .1 } };
  assert.deepEqual(n({ ...sprout(), parts: [part, part, part] }).parts.map(p => p.id), [long, 'x'.repeat(30) + '-2', 'x'.repeat(30) + '-3']);
});

test('instant() and compareCopies() follow B.2 and 14.2', () => {
  assert.equal(oa.instant('2026-10-25T10:00:00.1239Z'), Date.UTC(2026, 9, 25, 10, 0, 0, 123));
  assert.equal(oa.instant('2026-10-25t12:30:00+02:30'), Date.UTC(2026, 9, 25, 10, 0));
  assert.equal(oa.instant('2016-12-31T23:59:60Z'), Date.UTC(2017, 0, 1));
  assert.equal(oa.instant('2017-01-01T00:59:60+01:00'), Date.UTC(2017, 0, 1));
  for (const bad of ['2016-12-31T22:59:60Z', '2026-02-29T00:00:00Z', '2026-13-01T00:00:00Z', '2026-10-25T24:00:00Z', '2026-10-25T10:00:00+24:00', '2026-10-25 10:00:00Z', '2026-10-25T10:00:00', 5]) assert.ok(Number.isNaN(oa.instant(bad)), String(bad));
  assert.equal(oa.instant('2024-02-29T00:00:00Z'), Date.UTC(2024, 1, 29));
  assert.equal(oa.instant('0001-01-01T00:00:00Z'), -62135596800000, 'years below 100 are not read as 19xx');
  const c = (a, b) => Math.sign(oa.compareCopies(a, b));
  assert.equal(c({ updated: '2026-01-01T00:00:00Z', mtime: 1, file: 'b' }, { mtime: 9, file: 'a' }), 1, 'a real date wins over none');
  assert.equal(c({ updated: '2026-02-30T00:00:00Z', mtime: 9, file: 'b' }, { updated: '2026-01-01T00:00:00Z', mtime: 1, file: 'a' }), -1, 'an impossible date is no date');
  assert.equal(c({ updated: '2026-01-01T02:00:00+01:00', mtime: 1, file: 'b' }, { updated: '2026-01-01T00:30:00Z', mtime: 9, file: 'a' }), 1, 'dates compare as instants');
  assert.equal(c({ updated: '2026-01-01T00:00:00Z', mtime: 2, file: 'b' }, { updated: '2026-01-01T00:00:00.000Z', mtime: 1, file: 'a' }), 1, 'equal instants fall to the modification time');
  assert.equal(c({ mtime: 1, file: 'a.openavatar' }, { mtime: 1, file: 'b.openavatar' }), 1, 'then the name that sorts first');
  assert.ok(oa.byCodePoint('\uFF01', '\u{1F331}') < 0 && '\uFF01' > '\u{1F331}', 'code point order, not UTF-16 order');
  assert.ok(oa.byCodePoint('ab', 'abc') < 0 && oa.byCodePoint('abc', 'abc') === 0);
});

test('a reader rejects only what section 15 lists', () => {
  const code = f => { try { f(); return null } catch (e) { assert.ok(e instanceof oa.OpenAvatarError); return e.code } };
  assert.equal(code(() => oa.normalize([])), 'not-object');
  assert.equal(code(() => oa.normalize({ ...sprout(), body: undefined })), 'missing');
  assert.equal(code(() => oa.normalize({ ...sprout(), openavatar: '1.0' })), 'version');
  assert.equal(code(() => oa.normalize({ ...sprout(), openavatar: '0.7' })), null, 'a later minor version is read');
  const many = { type: 'union', children: Array.from({ length: 32 }, () => ({ type: 'union', children: Array.from({ length: 20 }, () => ({ type: 'sphere', radius: .1 })) })) };
  assert.equal(code(() => oa.normalize({ ...sprout(), body: { shape: many } })), 'limit');
  let deep = { type: 'sphere', radius: .5 }; for (let i = 0; i < 20; i++) deep = { type: 'union', children: [deep] };
  assert.equal(code(() => oa.normalize({ ...sprout(), body: { shape: deep } })), 'limit');
  assert.equal(code(() => oa.parse('x'.repeat(300000))), 'limit');
  assert.equal(code(() => oa.parse('{')), 'json');
  assert.equal(oa.validate([]).valid, false);
});

test('parse() and stringify() round-trip a file', () => {
  const text = fs.readFileSync(new URL('examples/mochi.openavatar', root), 'utf8');
  const { document, repairs } = oa.parse('﻿' + text);
  assert.deepEqual(repairs, []);
  assert.deepEqual(oa.parse(oa.stringify(document)).document, document);
  assert.match(oa.newId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('reactions combine channel by channel (SPEC 11.3)', () => {
  const d = sprout();
  const b = oa.resolveBehavior(d, { state: 'thinking', userActivity: 'coding' });
  assert.equal(b.prop, 'laptop', 'the user activity keeps its prop');
  assert.equal(b.expression, 'thinking');
  assert.equal(b.layers.expression, 'thinking');
  assert.equal(b.effect, null, 'Sprout turns the thinking dots off');
  assert.equal(b.motion, 'nod-beat', 'typing needs arms; Sprout has none');
  assert.equal(oa.resolveBehavior(d, { state: 'idle' }).gaze, 'user');
  const speaking = oa.resolveBehavior(d, { state: 'speaking', activity: 'done', userActivity: 'meeting' });
  assert.equal(speaking.quiet, true);
  assert.equal(speaking.effect, null, 'a meeting is quiet');
  assert.equal(speaking.expression, 'happy');
  assert.equal(speaking.motion, 'hop');
  const host = oa.resolveBehavior(d, { state: 'speaking', expression: 'laugh', expressionIntensity: .7, command: 'spin' });
  assert.deepEqual([host.expression, host.expressionIntensity, host.motion, host.motionLoops], ['laugh', .7, 'spin', false]);
  const off = { ...d, behavior: { reactions: { activities: { done: null } } } };
  assert.equal(oa.reactionFor(off, 'activities', 'done'), null);
  assert.equal(oa.resolveBehavior(off, { activity: 'done' }).motion, null);
});

test('a motion played once lets the channel go to the next layer down, and the host\'s expression outranks speaking (SPEC 11.3)', () => {
  const d = sprout();
  const both = { activity: 'done', userActivity: 'coding' };
  assert.equal(oa.resolveBehavior(d, both).motion, 'hop', 'the hop plays first');
  const after = oa.resolveBehavior(d, { ...both, finished: ['activity'] });
  assert.deepEqual([after.motion, after.layers.motion, after.motionLoops], ['nod-beat', 'userActivity', true], 'then the user activity\'s motion takes the channel');
  assert.equal(after.effect, 'sparkles', 'only the motion channel lets go');
  assert.equal(oa.resolveBehavior(d, { ...both, finished: ['activity', 'userActivity'] }).motion, null);
  const host = oa.resolveBehavior(d, { state: 'speaking', expression: 'sad', expressionIntensity: .5 });
  assert.deepEqual([host.expression, host.expressionIntensity, host.layers.expression], ['sad', .5, 'host'], 'not speaking\'s happy at 0.4');
});

test('an x- expression the document defines is its own; one it does not define falls back (SPEC 8.5, 13)', () => {
  const d = sprout();
  d.face = { ...d.face, expressions: { 'x-shy': { eyes: 'wide', mouth: 'o' } } };
  d.behavior = { ...d.behavior, reactions: { userActivities: { reading: { expression: 'x-shy' }, writing: { expression: 'x-smug' } } } };
  assert.equal(oa.resolveBehavior(d, { userActivity: 'reading' }).expression, 'x-shy');
  assert.equal(oa.resolveBehavior(d, { userActivity: 'writing' }).expression, 'neutral');
  assert.equal(oa.resolveBehavior(d, { expression: 'x-shy' }).expression, 'x-shy', 'the host can name it too');
});

test('fallback chains end where the renderer can play', () => {
  assert.equal(oa.resolveMotion('wave'), 'wiggle');
  assert.equal(oa.resolveMotion('wave', { arms: true }), 'wave');
  assert.equal(oa.resolveMotion('clap'), 'celebrate');
  assert.equal(oa.resolveMotion('clap', { supported: [] }), 'hop', 'clap > celebrate > jump > hop');
  assert.equal(oa.resolveMotion('x-moonwalk'), 'nod');
  assert.equal(oa.resolveMotion('x-moonwalk', { supported: ['x-moonwalk'] }), 'x-moonwalk');
  assert.equal(oa.resolveExpression('love'), 'love');
  assert.equal(oa.resolveExpression('love', ['happy']), 'happy');
  assert.equal(oa.resolveExpression('sleepy', []), 'neutral');
  assert.equal(oa.resolveExpression('x-smug'), 'neutral');
  assert.equal(oa.hasArms({ body: { rig: 'biped' } }), true);
  assert.equal(oa.hasArms({ body: { arms: { style: 'nub' } } }), true);
  for (const m of oa.VOCABULARY.motions) assert.ok(oa.BASE_MOTIONS.includes(oa.resolveMotion(m.id, { supported: [] })), `${m.id} reaches a base motion`);
});

test('the vocabulary is consistent', () => {
  const V = oa.VOCABULARY, motions = new Set(oa.MOTIONS);
  for (const m of V.motions) if (m.fallback) assert.ok(motions.has(m.fallback), m.id);
  for (const e of V.expressions) if (e.fallback) assert.ok(oa.EXPRESSIONS.includes(e.fallback), e.id);
  for (const kind of ['states', 'activities', 'userActivities']) for (const { id, reaction } of V[kind]) {
    if (reaction.motion) assert.ok(motions.has(reaction.motion), `${id} motion`);
    if (reaction.expression) assert.ok(oa.EXPRESSIONS.includes(reaction.expression), `${id} expression`);
    if (reaction.prop) assert.ok(oa.PROPS.includes(reaction.prop), `${id} prop`);
    if (reaction.effect) assert.ok(oa.EFFECTS.includes(reaction.effect), `${id} effect`);
    if (reaction.gaze) assert.ok(V.gazes.includes(reaction.gaze), `${id} gaze`);
  }
});

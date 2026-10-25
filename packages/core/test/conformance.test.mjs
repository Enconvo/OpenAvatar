// The reference reader against the conformance suite (SPEC 17.2): it must
// produce every expected repair, rejection and behavior, and the suite's
// render cases must cover every value the vocabulary lists.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse, validate, normalize, resolveBehavior, OpenAvatarError, VOCABULARY } from '../src/index.js';
import { covers } from '../../../conformance/tools/cases.mjs';

const root = new URL('../../../conformance/', import.meta.url).pathname;
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const manifest = JSON.parse(read('manifest.json'));

test('every repair case repairs to its expected document', () => {
  assert.ok(manifest.repair.length >= 15);
  for (const c of manifest.repair) {
    const { document, repairs } = parse(read(c.file));
    assert.deepEqual(document, JSON.parse(read(c.expected)), c.id);
    assert.deepEqual(repairs.map(r => r.path), c.repairs, c.id);
    assert.ok(normalize(document).repairs.every(r => /names no material/.test(r.message)), `${c.id}: the expected document needs no further repair`);
  }
});

test('every reject case is rejected with its code', () => {
  assert.ok(manifest.reject.length >= 10);
  for (const c of manifest.reject) {
    assert.throws(() => parse(read(c.file)), e => e instanceof OpenAvatarError && e.code === c.code, c.id);
  }
});

test('every behavior case resolves to its expected channels', () => {
  const { cases } = JSON.parse(read(manifest.behavior));
  assert.ok(cases.length >= 30);
  for (const c of cases) {
    const doc = normalize(JSON.parse(read(c.document))).document;
    const r = resolveBehavior(doc, c.input);
    for (const [k, v] of Object.entries(c.expected)) assert.deepEqual(r[k], v, `${c.id}.${k}`);
  }
});

test('render cases are valid, list what they cover, and cover the vocabulary', () => {
  const all = new Set();
  for (const c of manifest.render) {
    const doc = JSON.parse(read(c.file));
    assert.ok(validate(doc).valid, `${c.id}: ${JSON.stringify(validate(doc).errors)}`);
    assert.deepEqual(c.covers, covers(doc), `${c.id}: the manifest is out of date; run node conformance/tools/build.mjs`);
    assert.ok(fs.existsSync(path.join(root, c.render)), `${c.id}: no reference render`);
    for (const t of c.covers) all.add(t);
  }
  const lists = {
    shape: VOCABULARY.shapeTypes, outline: VOCABULARY.outlineTypes, deformer: VOCABULARY.deformerTypes, rig: VOCABULARY.rigs,
    anchor: VOCABULARY.anchors, face: VOCABULARY.faceTypes, eyes: VOCABULARY.eyeShapes, mouth: VOCABULARY.mouthShapes,
    nose: VOCABULARY.noseShapes, material: VOCABULARY.materialTypes, pattern: VOCABULARY.patternTypes, headShape: VOCABULARY.headShapes,
    bodyShape: VOCABULARY.bodyShapes, armStyle: VOCABULARY.armStyles, role: VOCABULARY.partRoles, animation: Object.keys(VOCABULARY.animationTypes),
  };
  const missing = Object.entries(lists).flatMap(([kind, values]) => values.filter(v => !all.has(`${kind}:${v}`)).map(v => `${kind}:${v}`));
  assert.deepEqual(missing, [], 'values no render case covers');
  for (const t of ['glow', 'glow:base', 'patch', 'mirror', 'brows', 'cheeks', 'attach:position', 'attach:at', 'attach:direction', 'attach:to', 'align:surface', 'align:upright', 'align:none',
    ...VOCABULARY.attachTargets.filter(t => t !== 'body').map(t => `target:${t}`)]) assert.ok(all.has(t), t);
});

// The reference renderer against the conformance suite (SPEC 17.2): it builds
// every render case and every document a reader must repair, and keeps each
// one inside the box of SPEC 4 through the standard situations.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'openavatar';
import { OpenAvatar } from '../src/index.js';
import { geometryVectors } from '../../../conformance/tools/geometry.mjs';

const root = new URL('../../../conformance/', import.meta.url).pathname;
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const finite = o => { let ok = true; o.traverse(n => { for (const v of [...n.position.toArray(), ...n.quaternion.toArray(), ...n.scale.toArray()]) if (!Number.isFinite(v)) ok = false; }); return ok; };
const run = (a, input, n = 15) => { a.setInput(input); for (let i = 0; i < n; i++) a.update(1 / 30); };

test('every render case builds within the box and runs every state', () => {
  for (const c of manifest.render.filter(c => !c.id.startsWith('example-'))) {
    const a = new OpenAvatar(JSON.parse(read(c.file)), { quality: 'low' });
    assert.equal(a.repairs.length, 0, c.id);
    for (const v of [...a.bounds.min.toArray(), ...a.bounds.max.toArray()]) assert.ok(Math.abs(v) <= 1.5, `${c.id} reaches ${v}`);
    for (const state of ['idle', 'listening', 'thinking', 'speaking']) run(a, { state, voice: .7, mic: .5 });
    run(a, { state: 'idle', userActivity: 'coding' });
    assert.ok(finite(a.object), `${c.id}: a transform went NaN`);
    a.dispose();
  }
});

test('every repair case renders, before and after repair', () => {
  for (const c of manifest.repair) {
    for (const file of [c.file, c.expected]) {
      const a = new OpenAvatar(parse(read(file)).document, { quality: 'low' });
      run(a, { state: 'speaking', voice: .5 });
      assert.ok(finite(a.object), `${file}: a transform went NaN`);
      a.dispose();
    }
  }
});

test('the geometry vectors are the reference renderer\'s, at every quality', () => {
  for (const c of manifest.render) {
    const doc = JSON.parse(read(c.file)), want = JSON.parse(read(c.geometry));
    assert.deepEqual(JSON.parse(JSON.stringify(geometryVectors(doc, c.id))), want, `${c.id}: run node conformance/tools/build.mjs`);
  }
  // Placements come from the solid's field, not its mesh, so a coarser mesh gives the same numbers (SPEC 17.2).
  const strip = v => JSON.parse(JSON.stringify(v, (k, x) => (k === 'points' ? undefined : x)));
  for (const c of manifest.render.filter((_, i) => i % 3 === 0)) {
    const doc = JSON.parse(read(c.file)), low = strip(geometryVectors(doc, c.id, { quality: 'low' })), want = strip(JSON.parse(read(c.geometry)));
    const walk = (a, b, at) => {
      if (typeof a === 'number') return assert.ok(Math.abs(a - b) <= 2e-6, `${c.id} ${at}: low ${a}, high ${b}`);
      if (a && typeof a === 'object') for (const k of Object.keys(b)) walk(a[k], b[k], `${at}.${k}`);
      else assert.equal(a, b, `${c.id} ${at}`);
    };
    walk(low, want, '');
  }
});

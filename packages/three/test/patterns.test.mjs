// The patterns of SPEC 7.2 in plain JavaScript: the hash against an independent 64-bit version, and each pattern's
// colors where the spec fixes them. The CLI's tests run the shader in a browser against these functions.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cellBits, cellHash, patternWeights, patternGLSL } from '../src/patterns.js';
import { OpenAvatar, makeMaterial, addShells } from '../src/index.js';

// SPEC 7.2's hash, written with BigInt so no 32-bit trick is shared with the code under test.
const M = (1n << 32n) - 1n;
function slowBits(cx, cy, cz, k) {
  let h = (BigInt(cx + 1024) * 0x8DA6B343n + BigInt(cy + 1024) * 0xD8163841n + BigInt(cz + 1024) * 0xCB1AB31Fn + BigInt(k) * 0x165667B1n) & M;
  h ^= h >> 16n; h = (h * 0x85EBCA6Bn) & M; h ^= h >> 13n; h = (h * 0xC2B2AE35n) & M; h ^= h >> 16n;
  return Number(h >> 8n);
}

test('the cell hash is the spec\'s, for negative cells too', () => {
  for (let cx = -6; cx <= 6; cx++) for (let cy = -6; cy <= 6; cy += 3) for (let cz = -6; cz <= 6; cz += 4) for (let k = 0; k < 5; k++) {
    assert.equal(cellBits(cx, cy, cz, k), slowBits(cx, cy, cz, k), `${cx},${cy},${cz},${k}`);
  }
  for (const c of [[-1500, 7, 3], [1500, -2000, 9]]) assert.equal(cellBits(...c, 2), slowBits(...c, 2));
  // The test vectors printed in SPEC 7.2.
  assert.equal(cellBits(0, 0, 0, 0), 8173136);
  assert.equal(cellBits(-1, 2, -3, 4), 16178321);
  assert.equal(cellHash(0, 0, 0, 0), 8173136 / 16777216);
});

const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const point = () => [rnd() * 4 - 2, rnd() * 4 - 2, rnd() * 4 - 2];
const sum = w => w.reduce((a, b) => a + b, 0);
const COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF'];

test('the weights add up to one for every pattern and palette', () => {
  for (const type of ['gradient', 'stripes', 'spots', 'checks', 'waves']) for (let n = 1; n <= 4; n++) for (const axis of ['x', 'y', 'z']) {
    const p = { type, colors: COLORS.slice(0, n), axis, scale: .2 + rnd(), angle: rnd() * 180 - 90 };
    for (let i = 0; i < 40; i++) {
      const w = patternWeights(p, point(), [-1.2, .8]);
      assert.equal(w.length, n + 1);
      assert.ok(Math.abs(sum(w) - 1) < 1e-12 && w.every(x => x >= 0), `${type} ${JSON.stringify(w)}`);
    }
  }
  // A type this version doesn't know is the base color.
  assert.deepEqual(patternWeights({ type: 'waves', colors: ['#FF0000'] }, [.1, .2, .3]), [1, 0]);
});

test('a gradient runs from the base color at the low end to the last color at the high end', () => {
  const p = { type: 'gradient', colors: ['#FF0000', '#00FF00'], axis: 'z' };
  assert.deepEqual(patternWeights(p, [0, 0, -.4], [-.4, .6]), [1, 0, 0]);
  assert.deepEqual(patternWeights(p, [0, 0, .6], [-.4, .6]), [0, 0, 1]);
  assert.deepEqual(patternWeights(p, [0, 0, 5], [-.4, .6]), [0, 0, 1], 'past the end');
  // Each color is pure at its own step; halfway between two steps they are even.
  assert.deepEqual(patternWeights(p, [0, 0, .1], [-.4, .6]), [0, 1, 0]);
  const half = patternWeights(p, [0, 0, -.15], [-.4, .6]);
  assert.ok(Math.abs(half[0] - .5) < 1e-12 && Math.abs(half[1] - .5) < 1e-12, JSON.stringify(half));
  // Only the axis matters, and a flat solid is the base color.
  assert.deepEqual(patternWeights(p, [9, -9, .1], [-.4, .6]), [0, 1, 0]);
  assert.deepEqual(patternWeights(p, [0, 0, .1], [.1, .1]), [1, 0, 0]);
});

test('stripes take the palette in turn, each scale wide, and blend only at their edges', () => {
  const p = { type: 'stripes', colors: ['#FF0000', '#00FF00'], scale: .25 };
  for (let i = -5; i <= 5; i++) {
    const w = patternWeights(p, [0, (i + .5) * .25, 0]);
    assert.equal(w[((i % 3) + 3) % 3], 1, `stripe ${i}`);
    // At the edge between stripes i - 1 and i the two are even.
    const e = patternWeights(p, [0, i * .25, 0]);
    assert.ok(Math.abs(e[((i % 3) + 3) % 3] - .5) < 1e-9 && Math.abs(e[(((i - 1) % 3) + 3) % 3] - .5) < 1e-9, `edge ${i}: ${e}`);
  }
  // The blend is a smoothstep over 0.03 of a stripe on each side of the edge: a quarter of the way in, 15.625%.
  const before = patternWeights(p, [0, 1.985 * .25, 0]), after = patternWeights(p, [0, 2.015 * .25, 0]);
  assert.ok(Math.abs(before[1] - .84375) < 1e-9 && Math.abs(before[2] - .15625) < 1e-9, `before: ${before}`);
  assert.ok(Math.abs(after[2] - .84375) < 1e-9 && Math.abs(after[1] - .15625) < 1e-9, `after: ${after}`);
  assert.deepEqual(patternWeights(p, [0, 1.969 * .25, 0]), [0, 1, 0]);
  // `angle` turns them: at 90 degrees stripes on y run across x instead.
  const turned = { ...p, angle: 90 };
  assert.deepEqual(patternWeights(turned, [.125, 7, 0]), patternWeights(p, [0, .125, 0]));
  assert.deepEqual(patternWeights({ ...p, axis: 'x', angle: 90 }, [5, .375, 0]), patternWeights(p, [0, .375, 0]));
});

test('spots never reach the edge of their cell, and every color gets spots', () => {
  const p = { type: 'spots', colors: COLORS.slice(0, 3), scale: .5 };
  const seen = new Set();
  for (let cx = -4; cx < 4; cx++) for (let cy = -4; cy < 4; cy++) for (let cz = -2; cz < 2; cz++) {
    const at = (fx, fy, fz) => patternWeights(p, [(cx + fx) * .5, (cy + fy) * .5, (cz + fz) * .5]);
    // Every face of the cell is the base color, so neighboring cells never cut a spot.
    for (const f of [[0, .5, .5], [.9999, .5, .5], [.5, 0, .5], [.5, .9999, .5], [.5, .5, 0], [.5, .5, .9999], [0, 0, 0]]) assert.equal(at(...f)[0], 1, `${cx},${cy},${cz} at ${f}`);
    // The spot's middle is all one color, chosen by the fifth hash.
    const o = [0, 1, 2].map(k => .5 + .3 * (cellHash(cx, cy, cz, k) - .5)), w = at(...o);
    const pick = 1 + Math.floor(3 * cellHash(cx, cy, cz, 4));
    assert.equal(w[pick], 1, `${cx},${cy},${cz}: ${w}`);
    seen.add(pick);
    // Its radius is .2 to .3 cells, blended over .03 on either side.
    const r = .2 + .1 * cellHash(cx, cy, cz, 3);
    assert.equal(at(o[0] + r - .031, o[1], o[2])[pick], 1);
    assert.equal(at(o[0] + r + .031, o[1], o[2])[0], 1);
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
});

test('checks alternate across every axis, below zero too', () => {
  const p = { type: 'checks', colors: ['#FF0000', '#00FF00'], scale: .2 };
  for (const [c, want] of [[[0, 0, 0], 0], [[1, 0, 0], 1], [[1, 1, 0], 2], [[1, 1, 1], 0], [[-1, 0, 0], 2], [[-1, -1, 0], 1], [[-3, 0, 0], 0]]) {
    const w = patternWeights(p, c.map(x => (x + .5) * .2));
    assert.equal(w[want], 1, `${c}: ${w}`);
  }
});

test('the shader makes every choice between colors with integers', () => {
  const base = new THREE.Color('#808080');
  for (const type of ['gradient', 'stripes', 'spots', 'checks']) {
    const src = patternGLSL({ type, colors: ['#FF0000', '#00FF00'] }, base);
    assert.match(src, /vec3 oaPattern\(vec3 c\)/);
    assert.doesNotMatch(src, /\bsin\(|\bfract\(|\bmod\(/, type);
    assert.equal(/uOARange/.test(src), type === 'gradient', type);
  }
  assert.equal(patternGLSL(null, base), '');
});

test('a gradient spans the mesh it colors, and the fuzz on it follows', () => {
  const doc = { openavatar: '0.1', id: 'gradient-test', name: 'Gradient test',
    materials: { main: { type: 'felt', color: '#F7C531', pattern: { type: 'gradient', colors: ['#3A6FD8'] } } },
    body: { shape: { type: 'sphere', radius: .5 } } };
  const a = new OpenAvatar(doc, { quality: 'low' });
  const [lo, hi] = a.bodyMesh.material.userData.oaRange;
  assert.ok(Math.abs(lo + .5) < .02 && Math.abs(hi - .5) < .02, `${lo}..${hi}`);
  const shells = a.bodyMesh.children.filter(c => c.userData.shell);
  assert.ok(shells.length > 0);
  for (const s of shells) {
    const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
    s.material.onBeforeCompile(sh);
    assert.deepEqual(sh.uniforms.uOARange.value.toArray(), [lo, hi]);
  }
  a.dispose();
  // A material no avatar placed spans -1 to 1.
  const { material } = makeMaterial({ type: 'plastic', color: '#F7C531', pattern: { type: 'gradient', colors: ['#3A6FD8'] } });
  const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  material.onBeforeCompile(sh);
  assert.deepEqual(sh.uniforms.uOARange.value.toArray(), [-1, 1]);
  assert.equal(addShells(new THREE.Mesh(new THREE.SphereGeometry(1), material), material, null).length, 0);
});

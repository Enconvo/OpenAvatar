// The face of SPEC Appendix C in the reference renderer: each feature's outline at the sizes C.2 and C.3 give, the
// bead's sad and mad tilts, and glyphs bent onto the surface by the rule of A.9.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OpenAvatar } from '../src/index.js';
import { eyeGlyph, mouthGlyph, glyphGeometry } from '../src/face.js';
import { patchDepth } from '../src/geometry.js';

const box = shape => {
  const p = shape.getPoints(64);
  return { x0: Math.min(...p.map(q => q.x)), x1: Math.max(...p.map(q => q.x)), y0: Math.min(...p.map(q => q.y)), y1: Math.max(...p.map(q => q.y)) };
};
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} is not ${b}`);
const RADII = { round: [1, 1], oval: [.82, 1.1], tall: [.62, 1.28], wide: [1.28, .74], dot: [.5, .5], almond: [1.2, .68] };

test('eye outlines have the radii of C.2', () => {
  const k = .1;
  for (const [shape, [a, b]] of Object.entries(RADII)) {
    const o = box(eyeGlyph('open', shape, k)), low = shape === 'almond' ? .8 : 1;
    near(o.x1, a * k, 1e-9, `${shape} open x`); near(o.x0, -a * k, 1e-9, `${shape} open -x`);
    near(o.y1, b * k, 1e-9, `${shape} open y`); near(o.y0, -b * k * low, 1e-9, `${shape} open -y`);
    const [wa, wb] = shape === 'almond' ? [1.22, 1.3] : [1.2, 1.25], w = box(eyeGlyph('wide', shape, k));
    near(w.x1, wa * a * k, 1e-9, `${shape} wide x`); near(w.y1, wb * b * k, 1e-9, `${shape} wide y`);
  }
  // A sad lid falls toward the outer corner (+x for this eye), a mad one toward the inner.
  const top = (pose, side) => Math.max(...eyeGlyph(pose, 'round', k).getPoints(64).filter(p => p.x * side > 0).map(p => p.y));
  assert.ok(top('sad', 1) < top('sad', -1) - .1 * k, 'sad');
  assert.ok(top('mad', 1) > top('mad', -1) + .1 * k, 'mad');
  // Each lid is the line C.2 names: nothing above it, and the lid's corners on it.
  for (const [pose, ya, yb] of [['sad', .5, -.05], ['mad', -.05, .55]]) {
    const line = x => k * (ya + (yb - ya) * (x + k) / (2 * k)), gap = eyeGlyph(pose, 'round', k).getPoints(64).map(p => p.y - line(p.x));
    assert.ok(Math.max(...gap) < 1e-9, `${pose}: above its lid`); assert.ok(gap.filter(g => Math.abs(g) < 1e-9).length >= 2, `${pose}: the lid's corners`);
  }
  // Strokes: the curve widened by w/2, with round ends.
  const w = Math.max(.012, .3 * k), arc = box(eyeGlyph('arc', 'round', k));
  near(arc.x1, .95 * k + w / 2, 2e-3, 'arc x'); near(arc.y1, .3 * k + w / 2, 2e-3, 'arc top'); near(arc.y0, -.12 * k - w / 2, 2e-3, 'arc ends');
  const shut = box(eyeGlyph('shut', 'round', k));
  near(shut.y0, -.2 * k - .85 * w / 2, 2e-3, 'shut bottom'); near(shut.y1, .1 * k + .85 * w / 2, 2e-3, 'shut ends');
  const chev = box(eyeGlyph('chevron', 'round', k));
  near(chev.y1, .55 * k + w / 2, 2e-3, 'chevron top'); near(chev.x0, -.48 * k - w / 2, 3e-3, 'chevron point');
});

test('mouth outlines have the sizes of C.3', () => {
  const m = .2, t = Math.max(.012, .13 * m);
  const smile = box(mouthGlyph('smile', m));
  near(smile.x1, m / 2 + t / 2, 2e-3, 'smile x'); near(smile.y0, -.2 * m - t / 2, 2e-3, 'smile bottom'); near(smile.y1, t / 2, 2e-3, 'smile ends');
  const frown = box(mouthGlyph('frown', m));
  near(frown.y1, .08 * m + t / 2, 2e-3, 'frown top'); near(frown.y0, -.08 * m - t / 2, 2e-3, 'frown ends');
  const grin = box(mouthGlyph('grin', m));
  near(grin.x1, m / 2, 1e-9, 'grin x'); near(grin.y0, -.45 * m, 1e-9, 'grin depth'); near(grin.y1, 0, 1e-9, 'grin top');
  const o = box(mouthGlyph('o', m));
  near(o.x1, .2 * m, 1e-9, 'o x'); near(o.y1, .24 * m, 1e-9, 'o y');
  near(box(mouthGlyph('open', m)).x1, .42 * m, 1e-9, 'open');
  const line = box(mouthGlyph('line', m));
  near(line.x1, .42 * m + t / 2, 2e-3, 'line x'); near(line.y1, t / 2, 2e-3, 'line y');
});

test('a bead eye tips its outer end down when sad and up when angry (C.2)', () => {
  const doc = { openavatar: '0.1', id: 'bead-tilt', name: 'Bead tilt', body: { shape: { type: 'sphere', radius: .9 } }, face: { type: 'bead' } };
  for (const [expression, sign] of [['sad', -1], ['angry', 1]]) {
    const a = new OpenAvatar(doc, { quality: 'low' });
    a.setInput({ expression });
    for (let i = 0; i < 30; i++) a.update(1 / 30);
    for (const eye of a.face.eyes) {
      // Turning about +z by a positive angle lifts the +x end; the outer end of the eye at -x is its -x end.
      assert.equal(Math.sign(eye.bead.rotation.z) * eye.side, sign, `${expression}: the eye at ${eye.side > 0 ? '+' : '-'}x`);
    }
    a.dispose();
  }
});

test('a face glyph is bent onto the surface by the rule of A.9', () => {
  // A small ball, so the surface curves fast under a big eye and an approximate bend would show.
  const doc = { openavatar: '0.1', id: 'glyph-bend', name: 'Glyph bend', body: { shape: { type: 'sphere', radius: .55 } }, face: { type: 'sewn', eyes: { size: .3, spacing: .25, height: .1 } } };
  const a = new OpenAvatar(doc, { quality: 'low' }), face = a.face, eye = face.eyes[0];
  const shape = eyeGlyph('open', 'round', .3), offset = face.ink() - face.lift;
  const flat = glyphGeometry(shape, { depth: face.depth }), bent = glyphGeometry(shape, { depth: face.depth, sdf: face.sdf, frame: eye.frame, offset });
  const origin = eye.frame.p.clone().addScaledVector(eye.frame.n, offset);
  const depth = patchDepth(face.sdf, new THREE.Matrix4().compose(origin, eye.frame.q, new THREE.Vector3(1, 1, 1)));
  const fp = flat.attributes.position, bp = bent.attributes.position;
  assert.equal(fp.count, bp.count);
  let worst = 0, most = 0;
  for (let i = 0; i < fp.count; i += 3) {
    const t = depth(fp.getX(i), fp.getY(i));
    worst = Math.max(worst, Math.abs(bp.getZ(i) - fp.getZ(i) - t)); most = Math.max(most, Math.abs(t));
  }
  assert.ok(most > .03, `the surface falls away ${most} under the eye`);
  assert.ok(worst < 3e-4, `the bend strays ${worst} from A.9`);
  flat.dispose(); bent.dispose(); a.dispose();
});

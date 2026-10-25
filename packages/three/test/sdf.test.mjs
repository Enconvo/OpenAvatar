import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalize } from '../../core/src/index.js';
import { compileShape, compileOutline, shapeBounds, frontPoint, surfaceAlong } from '../src/sdf.js';
import { meshField } from '../src/mesh.js';

const near = (a, b, e = 1e-3, m = '') => assert.ok(Math.abs(a - b) < e, `${m} ${a} != ${b}`);
const inside = (f, ...p) => f(...p) < 0;

test('primitives are solid where the spec says', () => {
  const cases = [
    [{ type: 'sphere', radius: 1 }, [[0, 0, 0], [.99, 0, 0]], [[1.01, 0, 0]]],
    [{ type: 'ellipsoid', radii: [1, .5, .25] }, [[.9, 0, 0], [0, .45, 0]], [[0, .55, 0], [0, 0, .3]]],
    [{ type: 'box', size: [2, 1, 1], rounding: .1 }, [[.95, .45, 0]], [[1.05, 0, 0], [.99, .49, .49]]],
    [{ type: 'superellipsoid', radii: [1, 1, 1], exponent: 8 }, [[.9, .9, 0]], [[1.05, 0, 0]]],
    [{ type: 'capsule', from: [0, 0, 0], to: [0, 1, 0], radius: .2, radiusTo: .05 }, [[.15, 0, 0], [0, 1.03, 0]], [[.15, 1, 0]]],
    [{ type: 'cylinder', radius: .5, height: 2 }, [[.45, .95, 0]], [[0, 1.05, 0], [.55, 0, 0]]],
    [{ type: 'cone', radius: .5, height: 1 }, [[.45, -.45, 0], [0, .45, 0]], [[.3, .45, 0]]],
    [{ type: 'torus', radius: 1, thickness: .2 }, [[1, 0, 0], [0, .15, 1]], [[0, 0, 0], [1, .25, 0]]],
    [{ type: 'halfspace', normal: [0, 1, 0], offset: .5 }, [[0, .4, 0], [9, -9, 9]], [[0, .6, 0]]],
    [{ type: 'extrusion', depth: .4, outline: { type: 'rect', size: [1, 1] } }, [[.45, .45, .15]], [[.45, .45, .25], [.55, 0, 0]]],
  ];
  for (const [s, ins, outs] of cases) {
    const f = compileShape(s);
    for (const p of ins) assert.ok(inside(f, ...p), `${s.type} contains ${p}`);
    for (const p of outs) assert.ok(!inside(f, ...p), `${s.type} excludes ${p}`);
  }
  near(compileShape({ type: 'sphere', radius: 1 })(2, 0, 0), 1, 1e-9, 'exact distance');
});

test('outlines', () => {
  const star = compileOutline({ type: 'star', points: 5, radius: 1, innerRadius: .4 });
  assert.ok(star(0, .95) < 0, 'top point'); assert.ok(star(0, -.5) > 0, 'between the bottom points');
  const heart = compileOutline({ type: 'heart', size: 1 });
  assert.ok(heart(0, 0) < 0); assert.ok(heart(0, .6) > 0, 'the notch'); assert.ok(heart(.25, .25) < 0, 'a lobe');
  const stroke = compileOutline({ type: 'stroke', points: [[0, 0], [1, 0]], width: .2, widthTo: .02 });
  assert.ok(stroke(.05, .09) < 0); assert.ok(stroke(.95, .05) > 0, 'tapers');
  const poly = compileOutline({ type: 'polygon', points: [[-1, -1], [1, -1], [1, 1], [-1, 1]], rounding: .3 });
  assert.ok(poly(.9, 0) < 0); assert.ok(poly(.98, .98) > 0, 'corner rounded off');
  const ring = compileOutline({ type: 'subtract', children: [{ type: 'circle', radius: 1 }, { type: 'circle', radius: .5 }] });
  assert.ok(ring(0, 0) > 0); assert.ok(ring(.75, 0) < 0);
  const m = compileOutline({ type: 'circle', radius: .2, center: [.5, 0], mirror: 'x' });
  assert.ok(m(-.5, 0) < 0 && m(.5, 0) < 0);
});

test('transforms, mirror, combinators and deformers', () => {
  const moved = compileShape({ type: 'sphere', radius: .2, position: [1, 0, 0], mirror: 'x' });
  assert.ok(inside(moved, -1, 0, 0) && inside(moved, 1, 0, 0) && !inside(moved, 0, 0, 0));
  const turned = compileShape({ type: 'box', size: [2, .2, .2], rotation: [0, 0, 90] });
  assert.ok(inside(turned, 0, .9, 0) && !inside(turned, .9, 0, 0), 'rotated about z');
  const scaled = compileShape({ type: 'sphere', radius: 1, scale: [2, 1, 1] });
  assert.ok(inside(scaled, 1.9, 0, 0) && !inside(scaled, 0, 1.1, 0));
  const blend = compileShape({ type: 'union', smooth: .3, children: [{ type: 'sphere', radius: .5, position: [-.55, 0, 0] }, { type: 'sphere', radius: .5, position: [.55, 0, 0] }] });
  assert.ok(inside(blend, 0, 0, 0), 'smooth union fills the gap');
  const cut = compileShape({ type: 'subtract', children: [{ type: 'sphere', radius: 1 }, { type: 'sphere', radius: .5 }] });
  assert.ok(!inside(cut, 0, 0, 0) && inside(cut, .75, 0, 0));
  const tapered = compileShape({ type: 'cylinder', radius: .5, height: 2, deform: [{ type: 'taper', axis: 'y', amount: -.4 }] });
  assert.ok(inside(tapered, .45, -.9, 0) && !inside(tapered, .45, .9, 0), 'narrow at the top');
  const squashed = compileShape({ type: 'sphere', radius: 1, deform: [{ type: 'squash', axis: 'y', below: .5 }] });
  assert.ok(!inside(squashed, 0, -.6, 0) && inside(squashed, 0, .9, 0));
  const inflated = compileShape({ type: 'sphere', radius: 1, inflate: .1 });
  assert.ok(inside(inflated, 1.05, 0, 0));
  const twisted = compileShape({ type: 'box', size: [1.6, 2, .2], deform: [{ type: 'twist', axis: 'y', amount: 90 }] });
  assert.ok(inside(twisted, 0, 1 - 1e-3, .7) || inside(twisted, 0, .99, -.7), 'turned 90 degrees at y = 1');
});

test('bounds hold every mesh vertex of the examples', () => {
  const dir = new URL('../../../examples/', import.meta.url);
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.openavatar'))) {
    const { document: d } = normalize(JSON.parse(fs.readFileSync(new URL(f, dir))));
    const shapes = [d.body.shape, ...(d.parts || []).map(p => p.shape)].filter(Boolean);
    for (const s of shapes) {
      const b = shapeBounds(s), m = meshField(compileShape(s), b, { cells: 40, limit: 5 });
      assert.ok(m.indices.length > 0, `${f} meshes`);
      for (let i = 0; i < m.positions.length; i++) {
        const a = i % 3;
        assert.ok(m.positions[i] >= b.lo[a] - .05 && m.positions[i] <= b.hi[a] + .05, `${f} vertex inside bounds`);
      }
    }
  }
});

test('every solid stays inside its bounds, so the mesher never cuts it', () => {
  // Nothing on the faces of the box, grown a little, may be inside: a solid that reached past the box would cross them.
  const outsideBox = (f, b, m) => {
    const lo = b.lo.map(v => v - .005), hi = b.hi.map(v => v + .005), n = 60;
    for (let a = 0; a < 3; a++) for (const side of [lo[a], hi[a]]) {
      const [u, v] = [0, 1, 2].filter(i => i !== a);
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
        const p = []; p[a] = side; p[u] = lo[u] + (hi[u] - lo[u]) * i / n; p[v] = lo[v] + (hi[v] - lo[v]) * j / n;
        assert.ok(f(...p) > 0, `${m} reaches past its box at ${p.map(x => x.toFixed(3))}`);
      }
    }
  };
  const flat = [
    { type: 'heart', size: 1.7 }, { type: 'heart', size: 1, rotation: 90 },
    { type: 'polygon', points: [[0, 0], [1, 0], [1, .2]], rounding: .05 }, { type: 'polygon', points: [[-1, 0], [1, 0], [0, .1]], rounding: .3 },
    { type: 'star', points: 5, radius: 1, innerRadius: .4, rotation: 20 }, { type: 'stroke', points: [[0, 0], [1, .5]], width: .2, widthTo: .4 },
  ];
  for (const o of flat) { const s = { type: 'extrusion', outline: o, depth: .2 }; outsideBox(compileShape(s), shapeBounds(s), o.type); }
  const solids = [
    { type: 'box', size: [2, 2, .4], deform: [{ type: 'bend', axis: 'x', toward: 'y', amount: 45 }] },
    { type: 'capsule', from: [-1, 0, 0], to: [1, 0, 0], radius: .2, deform: [{ type: 'bend', axis: 'x', toward: 'y', amount: 170 }], inflate: .05 },
    { type: 'box', size: [.3, 1.6, .5], position: [.2, 0, 0], deform: [{ type: 'bend', axis: 'y', toward: 'z', amount: -120 }] },
    { type: 'box', size: [1, 1, 1], rotation: [30, 45, 60], scale: [1.5, .5, 1], inflate: .1 },
    { type: 'sphere', radius: .6, deform: [{ type: 'squash', axis: 'y', below: .4 }], inflate: .2 },
    { type: 'cylinder', radius: .4, height: 1.4, deform: [{ type: 'taper', axis: 'y', amount: .5 }, { type: 'twist', axis: 'y', amount: 120 }], inflate: .05 },
    { type: 'union', smooth: 1, children: [{ type: 'sphere', radius: .4, position: [-.5, 0, 0] }, { type: 'sphere', radius: .4, position: [.5, 0, 0] }] },
  ];
  for (const s of solids) outsideBox(compileShape(s), shapeBounds(s), `${s.type} ${(s.deform || []).map(d => d.type)}`);
  // A strong taper keeps narrowing past the box, so inflate reaches further than the box says: the mesher grows it.
  const tip = { type: 'cylinder', radius: .4, height: 1.4, deform: [{ type: 'taper', axis: 'y', amount: .9 }], inflate: .05 }, f = compileShape(tip);
  let bottom = shapeBounds(tip).lo[1];
  assert.ok(f(0, bottom - .01, 0) < 0, 'the box falls short here');
  while (f(0, bottom, 0) < 0) bottom -= .002;
  const m = meshField(f, shapeBounds(tip), { cells: 60, fit: true });
  let low = Infinity; for (let i = 1; i < m.positions.length; i += 3) low = Math.min(low, m.positions[i]);
  near(low, bottom, .03, 'the mesh reaches the tip');
});

test('a bend lays the axis on a circular arc that turns by amount degrees per unit, keeping distances across it (SPEC 5.4)', () => {
  for (const amount of [35, 95, -140]) {
    const k = amount * Math.PI / 180, R = 1 / k;
    const f = compileShape({ type: 'capsule', from: [0, 0, 0], to: [1, 0, 0], radius: .1, deform: [{ type: 'bend', axis: 'x', toward: 'y', amount }] });
    for (let s = 0; s <= 1; s += .125) for (const h of [-.1, 0, .05, .1]) {
      // s along the axis and h toward +y land on the arc about (0, R), turned by k·s.
      const p = [(R - h) * Math.sin(k * s), R - (R - h) * Math.cos(k * s), 0];
      near(f(...p), Math.abs(h) - .1, 1e-9, `${amount}: s ${s}, h ${h}`);
    }
  }
  const straight = compileShape({ type: 'capsule', from: [0, 0, 0], to: [1, 0, 0], radius: .1 });
  const none = compileShape({ type: 'capsule', from: [0, 0, 0], to: [1, 0, 0], radius: .1, deform: [{ type: 'bend', axis: 'x', toward: 'y', amount: 0 }] });
  for (const p of [[.5, .05, 0], [1.2, 0, .1], [-.3, .4, 0]]) assert.equal(none(...p), straight(...p), 'amount 0 leaves it straight');
});

test('polygon rounding never grows the polygon, and a polygon too thin for it rounds by what it can hold', () => {
  const sharp = compileOutline({ type: 'polygon', points: [[0, 0], [1, 0], [1, .2]] });
  for (const rounding of [.02, .05, .2, 1]) {
    const f = compileOutline({ type: 'polygon', points: [[0, 0], [1, 0], [1, .2]], rounding });
    for (let x = -.2; x <= 1.2; x += .01) for (let y = -.2; y <= .4; y += .01) if (f(x, y) < 0) assert.ok(sharp(x, y) < 1e-9, `rounding ${rounding} grows the polygon at ${x}, ${y}`);
  }
  // A circle of radius 0.05 fits the 11.3 degree corner 0.508 from its tip, so the rounded tip starts 0.458 in.
  const f = compileOutline({ type: 'polygon', points: [[0, 0], [1, 0], [1, .2]], rounding: .05 });
  assert.ok(f(.47, .02) < 0 && f(.44, .02) > 0, 'the sharp corner is rounded with the radius asked for');
  // A triangle can hold at most its incircle.
  const thin = compileOutline({ type: 'polygon', points: [[-1, 0], [1, 0], [0, .1]], rounding: .3 }), r = .1 / (1 + Math.hypot(1, .1));
  near(thin(0, r), -r, 2e-3, 'the incircle');
});

test('a ripple with a range waves only inside it, and a range with equal ends holds none', () => {
  const plain = compileShape({ type: 'cylinder', radius: .5, height: 2 });
  const rip = range => compileShape({ type: 'cylinder', radius: .5, height: 2, deform: [{ type: 'ripple', axis: 'y', count: 6, amplitude: .1, range }] });
  const at = [Math.cos(Math.PI / 12) * .5, 0, Math.sin(Math.PI / 12) * .5];
  near(rip(undefined)(at[0], .8, at[2]) - plain(at[0], .8, at[2]), .1, 1e-6, 'everywhere without a range');
  near(rip([-.5, .5])(...at) - plain(...at), .1, 1e-6, 'inside the range');
  near(rip([-.5, .5])(at[0], .8, at[2]), plain(at[0], .8, at[2]), 1e-9, 'not outside it');
  near(rip([.5, -.5])(...at) - plain(...at), .1, 1e-6, 'either order');
  near(rip([.2, .2])(...at), plain(...at), 1e-9, 'none with equal ends');
});

test('front points and rays find the surface', () => {
  const f = compileShape({ type: 'sphere', radius: 1 });
  const p = frontPoint(f, 0, 0); near(p.p[2], 1, 2e-3); near(p.n[2], 1, 1e-2);
  const q = frontPoint(f, .6, 0); near(q.p[2], .8, 2e-3);
  assert.equal(frontPoint(f, 1.2, 0), null);
  const top = surfaceAlong(f, [0, 0, 0], [0, 1, 0]); near(top.p[1], 1, 2e-3); near(top.n[1], 1, 1e-2);
  const ring = compileShape({ type: 'torus', radius: 1, thickness: .2, rotation: [90, 0, 0] });
  near(frontPoint(ring, 1, 0).p[2], .2, 3e-3, 'the ring faces the viewer');
});

// Outfits (SPEC 13.8): worn pieces the renderer provides, fitted to whatever
// head the document describes. Nothing here knows the head's shape in
// advance; every piece is placed by rays from the head's center:
// - fitted hats (top hat, bowler, witch hat …) sit where the head is as wide
//   as the hat's opening, so a big hat sinks lower than a small one;
// - caps (beanie, helmets, baseball cap …) are grown from the head's own
//   surface above a cut line that stays clear of the eyes;
// - bands (crown, headband, flower crown, goggles …) follow the head's cross
//   section, and pairs (ears, horns, antennae) stand on its surface.
// Pieces are sized for a head about 1.4 units across and scaled to the real one.
import * as THREE from 'three';
import { frontPoint, surfaceAlong, smax } from './sdf.js';
import { meshField } from './mesh.js';
import { shapeGeometry } from './geometry.js';
import { VOCABULARY } from '@openavatar/core';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0), FWD = V3(0, 0, 1);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const pop = v => v < 1 ? 1 + 2.4 * (v - 1) ** 3 + 1.4 * (v - 1) ** 2 : 1;

// ---------- the head, measured ----------
class Fit {
  constructor(avatar) {
    const sdf = this.sdf = avatar.bodySdf, bb = avatar.bodyBounds, suit = avatar.suit, face = avatar.document.face || {};
    const H = bb.hi[1] - bb.lo[1], mid = (bb.lo[1] + bb.hi[1]) / 2;
    this.c = suit ? V3(...suit.head.center) : V3(0, mid + H * .15, 0);
    this.lift = avatar.face?.lift ?? .01;
    this.top = this.ray([0, 1, 0]);
    this.rx = Math.max(.2, this.ray([1, 0, 0]).p.x - this.c.x);
    this.rz = Math.max(.2, this.ray([0, 0, 1]).p.z - this.c.z);
    this.k = clamp(this.rx / .7, .55, 1.8);
    this.ez = clamp(this.rz / this.rx, .75, 1.2);
    const e = face.eyes || {};
    this.eyeTop = (e.height ?? .15) + (avatar.faceDy || 0) + (e.size ?? .09) * 1.25;
    this.bounds = bb;
    // The neck: under a biped's head, or under a blob's mouth.
    const neckY = suit ? suit.head.center[1] - suit.head.radii[1] * .8 : Math.max(bb.lo[1] + H * .18, (face.mouth?.height ?? -.1) - .2 * this.k);
    this.neckY = neckY;
  }
  ray(d, from = this.c) {
    const f = Array.isArray(from) ? from : [from.x, from.y, from.z];
    const hit = surfaceAlong(this.sdf, f, d);
    return hit ? { p: V3(...hit.p), n: V3(...hit.n) } : { p: V3(...f).addScaledVector(V3(...d).normalize(), .8), n: V3(...d).normalize() };
  }
  front(x, y) { const h = frontPoint(this.sdf, x, y); return h ? { p: V3(...h.p), n: V3(...h.n) } : { p: V3(x, y, this.rz), n: FWD.clone() }; }
  /** The head's half-width at height y (0 above the top). */
  widthAt(y) {
    if (y >= this.top.p.y) return 0;
    const from = [this.c.x, y, this.c.z];
    return this.sdf(...from) >= 0 ? 0 : surfaceAlong(this.sdf, from, [1, 0, 0])?.p[0] - this.c.x || 0;
  }
  /** The height above the head's center where it is w wide, so an opening of radius w rests there. */
  heightFor(w) {
    let lo = this.c.y, hi = this.top.p.y;
    if (this.widthAt(lo) + this.lift <= w) return lo;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (this.widthAt(m) + this.lift > w) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  /** Points around the head's cross section at height y, out by `out` beyond the fur. */
  ringAt(y, out = 0, n = 48, from = this.c) {
    return Array.from({ length: n }, (_, i) => {
      const a = i / n * Math.PI * 2, h = this.ray([Math.sin(a), 0, Math.cos(a)], [from.x, y, from.z]);
      return h.p.addScaledVector(h.n, this.lift + out);
    });
  }
  /** Points over the top of the head from one side to the other (or back to front), leaning back by `lean`. */
  arch(out = 0, lean = 0, n = 24, across = false) {
    return Array.from({ length: n + 1 }, (_, i) => {
      const a = -Math.PI / 2 + Math.PI * i / n, h = this.ray(across ? [0, Math.cos(a), Math.sin(a)] : [Math.sin(a), Math.cos(a), -lean * Math.cos(a)]);
      return h.p.addScaledVector(h.n, this.lift + out);
    });
  }
  /** A frame on the surface toward d: its +y leaves the surface, blended with `up` toward straight up. */
  stand(d, up = .5, out = 0) {
    const h = this.ray(d), n = h.n.clone().lerp(UP, up).normalize();
    return { p: h.p.addScaledVector(h.n, this.lift + out), q: new THREE.Quaternion().setFromUnitVectors(UP, n), n: h.n };
  }
}

// ---------- geometry helpers ----------
const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const tube = (pts, r, closed = true, seg = 96) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'centripetal'), seg, r, 10, closed);
const sphere = (r, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);
const extrude = (shape, depth, bevel = depth * .4) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .8, bevelSegments: 3, curveSegments: 16 }); g.translate(0, 0, -depth / 2); return g; };
// Leans the top of a geometry toward +x: by `amount` at height `h` above `from`, growing with the square.
function bendX(g, from, h, amount) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > from) { const k = (y - from) / h; p.setX(i, p.getX(i) + amount * k * k); p.setY(i, from + (y - from) * (1 - .12 * k * k)); } }
  g.computeVertexNormals(); return g;
}
function ellipseShape(rx, ry) { const s = new THREE.Shape(); s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0); return s; }
function petalFlower(k, petals, center, r = .05, n = 5) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, m = k.mesh(sphere(r, 16, 10), petals); m.scale.set(1, .55, 1.25); m.position.set(Math.cos(a) * r * 1.05, 0, Math.sin(a) * r * 1.05); m.rotation.y = -a; g.add(m); }
  const c = k.mesh(sphere(r * .65, 16, 10), center); c.position.y = r * .25; g.add(c);
  return g;
}
function bowShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.bezierCurveTo(w * .3, h * .9, w, h, w, 0); s.bezierCurveTo(w, -h, w * .3, -h * .9, 0, 0);
  s.bezierCurveTo(-w * .3, -h * .9, -w, -h, -w, 0); s.bezierCurveTo(-w, h, -w * .3, h * .9, 0, 0);
  return s;
}

// ---------- the outfits ----------
// Each builder gets the kit (materials, meshes, the fit) and returns a group in
// the body's space, with an optional update(t, dt, avatar) for moving bits.
const FELT = c => ({ type: 'felt', color: c });
const OUTFITS = {
  // Fitted hats: a lathe profile in units of the opening radius r0.
  'top-hat': k => k.hat(.62, [[.96, 0], [1.55, 0], [1.58, .05], [1.5, .08], [1.02, .08], [1, .5], [1.05, 1.22], [1, 1.27], [0, 1.27]], FELT('#22232A'), { band: ['#E8483F', .1, .22], tilt: -.1 }),
  'bowler-hat': k => k.hat(.7, [[.97, 0], [1.3, .02], [1.34, .07], [1.25, .09], [1.02, .1], [1.03, .4], [.9, .74], [.5, .9], [0, .93]], FELT('#22232A'), { band: ['#5A3A22', .1, .12] }),
  'cowboy-hat': k => k.hat(.72, [[.97, 0], [1.8, .05], [1.96, .22], [1.9, .25], [1.74, .12], [1.05, .12], [1.02, .55], [.85, .72], [.3, .64], [0, .68]], FELT('#B07A48'), { band: ['#5A3A22', .13, .1], tilt: .08 }),
  'witch-hat': k => k.hat(.7, [[.96, 0], [2, 0], [2.03, .04], [1.9, .06], [1, .08], [.62, .8], [.3, 1.5], [.1, 2.1], [0, 2.3]], FELT('#4B3A73'), { band: ['#8E6CF0', .1, .16], bend: [1.1, 1.2, .7], tilt: -.08 }),
  fez: k => k.hat(.5, [[.96, 0], [1, 0], [.8, .78], [.77, .82], [0, .82]], FELT('#C8323A'), { tassel: '#22232A', tilt: .12 }),
  'straw-hat': k => k.hat(.72, [[.97, 0], [2.2, .08], [2.26, .13], [2.15, .14], [1.03, .13], [1, .55], [.75, .7], [0, .72]], FELT('#E9C98A'), { band: ['#E8483F', .14, .14] }),
  'sailor-hat': k => k.hat(.66, [[.97, 0], [1, 0], [1.18, .06], [1.24, .38], [1.18, .4], [1.06, .22], [1.04, .5], [.9, .64], [0, .68]], FELT('#FFFFFF'), { band: ['#3D5BC9', .25, .1], tilt: .1 }),
  'chef-hat': k => {
    const g = k.hat(.7, [[.97, 0], [1.02, 0], [1.04, .5], [1, .52], [0, .52]], FELT('#FFFFFF'));
    const puff = k.made(FELT('#FFFFFF'));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, m = k.mesh(sphere(.55), puff); m.position.set(Math.cos(a) * .62, .95, Math.sin(a) * .62); g.inner.add(m); }
    const top = k.mesh(sphere(.7), puff); top.position.y = 1.15; g.inner.add(top);
    return g;
  },
  'party-hat': k => {
    const g = k.hat(.36, [[1, 0], [.05, 2.1], [0, 2.12]], { type: 'felt', color: '#FF6778', pattern: { type: 'stripes', colors: ['#FFF4D6'], axis: 'y', scale: .09, angle: 35 } }, { tilt: .22 });
    const trim = k.mesh(new THREE.TorusGeometry(1, .14, 12, 48).rotateX(Math.PI / 2), k.made(FELT('#FFF4D6'))); trim.position.y = .08; g.inner.add(trim);
    const pom = k.mesh(sphere(.22), k.made(FELT('#FFF4D6'))); pom.position.y = 2.15; g.inner.add(pom);
    return g;
  },
  beret: k => {
    const g = k.hat(.86, [[.92, 0], [1.25, .12], [1.28, .22], [1.05, .4], [.5, .48], [0, .5]], FELT('#E8483F'), { tilt: .32, sink: .06 });
    const stem = k.mesh(new THREE.CylinderGeometry(.04, .05, .14, 10), k.made(FELT('#E8483F'))); stem.position.y = .55; g.inner.add(stem);
    return g;
  },
  'pirate-hat': k => {
    // A bicorne: a crescent across the head with a skull on the front.
    const g = k.hat(.68, [[.97, 0], [1, 0], [1, .3], [0, .3]], FELT('#22232A'));
    const s = new THREE.Shape(); s.moveTo(-1.9, .1); s.bezierCurveTo(-1.3, .15, -.9, 1.35, 0, 1.35); s.bezierCurveTo(.9, 1.35, 1.3, .15, 1.9, .1); s.bezierCurveTo(.8, .35, -.8, .35, -1.9, .1);
    const body = k.mesh(extrude(s, .55, .12), k.made(FELT('#22232A'))); g.inner.add(body);
    const bone = k.made(FELT('#FFFFFF')), skull = k.mesh(sphere(.17), bone); skull.scale.set(1, .95, .4); skull.position.set(0, .72, .38); g.inner.add(skull);
    for (const s2 of [1, -1]) { const b = k.mesh(new THREE.CylinderGeometry(.03, .03, .55, 8), bone); b.rotation.z = s2 * .8; b.position.set(0, .5, .36); g.inner.add(b); }
    return g;
  },
  // Caps grown from the head itself.
  beanie: k => {
    const g = k.cap(.07, .06, '#5B7CFA');
    g.add(k.band(k.capCut(.06), .05, '#4A67D8', .06, true));
    g.add(k.pom(.11 * k.fit.k, '#F6EEDC', .14));
    return g;
  },
  'propeller-cap': k => {
    const g = k.cap(.045, .12, '#5B7CFA', { pattern: { type: 'checks', colors: ['#FFC83D'], scale: .22 } });
    const at = k.fit.stand([0, 1, 0], 1, .05), hub = new THREE.Group(); hub.position.copy(at.p); g.add(hub);
    hub.add(k.mesh(new THREE.CylinderGeometry(.03, .03, .12, 10).translate(0, .06, 0), k.made({ type: 'plastic', color: '#30333A' })));
    const blades = new THREE.Group(); blades.position.y = .12; hub.add(blades);
    for (const [c, a] of [['#FF6778', 0], ['#FFC83D', Math.PI]]) { const b = k.mesh(sphere(.06), k.made({ type: 'plastic', color: c })); b.scale.set(3.2, .25, 1); b.position.set(Math.cos(a) * .19, 0, Math.sin(a) * .19); b.rotation.y = -a; blades.add(b); }
    hub.scale.setScalar(k.fit.k);
    g.update = (t, dt, av) => { blades.rotation.y += dt * (4 + 14 * av.weights.get('active')); };
    return g;
  },
  'baseball-cap': k => {
    const g = k.cap(.05, .1, '#E8483F', {}, .08);
    const f = k.fit, y = k.capCut(.1).front, w = f.widthAt(y) + f.lift;
    // The upper half of an ellipse, turned to point forward.
    const visor = new THREE.Shape(); visor.absellipse(0, 0, w * .9, w * .62, 0, Math.PI, false);
    const v = k.mesh(extrude(visor, .03, .012), k.made(FELT('#C93B32'))); v.rotation.x = Math.PI / 2 + .18;
    const fp = f.front(0, y + .02); v.position.set(0, y + .02, fp.p.z - .05); g.add(v);
    g.add(k.pom(.04 * f.k, '#E8483F', .05));
    return g;
  },
  'bucket-hat': k => {
    const g = k.cap(.06, .08, '#7FA7D9', {}, .02);
    const y = k.capCut(.08).front, w = k.fit.widthAt(y) + k.fit.lift;
    const brim = k.mesh(lathe([[w * .96, .04], [w * 1.55, -.18], [w * 1.58, -.15], [w * 1.0, .07]]), k.made(FELT('#7FA7D9'))); brim.position.set(k.fit.c.x, y, k.fit.c.z); brim.scale.z = k.fit.ez; g.add(brim);
    return g;
  },
  'hard-hat': k => {
    const g = k.cap(.07, .1, '#FFC83D', { type: 'plastic' });
    const y = k.capCut(.1).front, w = k.fit.widthAt(y) + k.fit.lift + .07;
    const brim = k.mesh(lathe([[w * .95, .02], [w * 1.28, -.02], [w * 1.3, .02], [w * .98, .05]]), k.made({ type: 'plastic', color: '#FFC83D' })); brim.position.set(k.fit.c.x, y, k.fit.c.z); brim.scale.z = k.fit.ez; g.add(brim);
    // A ridge from the back over the top to the front.
    g.add(k.mesh(tube(k.fit.arch(.09, 0, 24, true).filter((_, i, a) => i > 4 && i < a.length - 6), .035 * k.fit.k, false, 48), k.made({ type: 'plastic', color: '#F2B32C' })));
    return g;
  },
  'fire-helmet': k => {
    const g = k.cap(.07, .1, '#D63A2F', { type: 'plastic' });
    const y = k.capCut(.1).front, w = k.fit.widthAt(y) + k.fit.lift + .06;
    const brim = k.mesh(lathe([[w * .95, .02], [w * 1.25, -.04], [w * 1.28, 0], [w * .98, .05]]), k.made({ type: 'plastic', color: '#D63A2F' }));
    brim.position.set(k.fit.c.x, y, k.fit.c.z - w * .22); brim.scale.set(1, 1, k.fit.ez * 1.25); g.add(brim);
    const shield = new THREE.Shape(); shield.moveTo(0, -.16); shield.quadraticCurveTo(.15, -.08, .15, .12); shield.lineTo(-.15, .12); shield.quadraticCurveTo(-.15, -.08, 0, -.16);
    const fp = k.fit.front(0, y + .2 * k.fit.k), badge = k.mesh(extrude(shield, .03), k.made({ type: 'metal', color: '#FFC83D' }));
    badge.position.copy(fp.p).addScaledVector(fp.n, .1); badge.quaternion.setFromUnitVectors(FWD, fp.n); badge.scale.setScalar(k.fit.k); g.add(badge);
    return g;
  },
  'viking-helmet': k => {
    const g = k.cap(.06, .06, '#9AA3AE', { type: 'metal', roughness: .45 });
    g.add(k.band(k.capCut(.06), .04, '#C9A54A', .05, false, 'metal'));
    for (const s of [1, -1]) g.add(k.horn(s, [s * .9, .5, 0], '#F2E6D0', .1, .42, 55));
    return g;
  },
  'mushroom-cap': k => {
    const g = k.cap(.16, .14, '#E8483F', { pattern: { type: 'spots', colors: ['#FFFFFF'], scale: .16 } });
    return g;
  },
  'frog-hat': k => {
    const g = k.cap(.07, .12, '#6FBF5A');
    for (const s of [1, -1]) {
      const at = k.fit.stand([s * .42, 1, .3], .6, .02), eye = new THREE.Group(); eye.position.copy(at.p); eye.quaternion.copy(at.q); eye.scale.setScalar(k.fit.k); g.add(eye);
      const lid = k.mesh(sphere(.15), k.made(FELT('#6FBF5A'))); eye.add(lid);
      const white = k.mesh(sphere(.11), k.made({ type: 'ceramic', color: '#FFFFFF' })); white.position.set(0, .04, .08); eye.add(white);
      const pupil = k.mesh(sphere(.05), k.made({ type: 'ceramic', color: '#16151B' })); pupil.position.set(0, .05, .18); eye.add(pupil);
    }
    return g;
  },
  'strawberry-hat': k => {
    const g = k.cap(.07, .1, '#E8483F', { pattern: { type: 'spots', colors: ['#FFE08A'], scale: .1 } });
    const at = k.fit.stand([0, 1, 0], 1, .04), leaf = new THREE.Shape();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = i % 2 ? .12 : .34; i ? leaf.lineTo(Math.cos(a) * r, Math.sin(a) * r) : leaf.moveTo(r, 0); }
    const crown = k.mesh(extrude(leaf, .03).rotateX(-Math.PI / 2), k.made(FELT('#4CAF50'))); crown.position.copy(at.p); crown.quaternion.copy(at.q); crown.scale.setScalar(k.fit.k); g.add(crown);
    const stem = k.mesh(new THREE.CylinderGeometry(.03, .04, .14, 8).translate(0, .07, 0), k.made(FELT('#3E8E41'))); crown.add(stem);
    return g;
  },
  deerstalker: k => {
    const g = k.cap(.06, .08, '#A0835C', { pattern: { type: 'checks', colors: ['#7A5F3E'], scale: .09 } });
    const y = k.capCut(.08).front, w = k.fit.widthAt(y) + k.fit.lift;
    for (const s of [1, -1]) {
      const visor = new THREE.Shape(); visor.absellipse(0, 0, w * .55, w * .32, 0, Math.PI, false);
      const v = k.mesh(extrude(visor, .03, .012), k.made({ type: 'felt', color: '#A0835C', pattern: { type: 'checks', colors: ['#7A5F3E'], scale: .09 } }));
      v.rotation.x = s * (Math.PI / 2 - .35); const fp = k.fit.ray([0, 0, s], [k.fit.c.x, y, k.fit.c.z]); v.position.set(0, y + .02, fp.p.z - s * .03); g.add(v);
    }
    return g;
  },
  bandana: k => {
    const g = k.cap(.035, .1, '#5B7CFA', { pattern: { type: 'spots', colors: ['#FFFFFF'], scale: .1 } }, .06);
    const back = k.fit.ray([0, .1, -1]), knot = new THREE.Group(); knot.position.copy(back.p).addScaledVector(back.n, .06); g.add(knot);
    const m = k.made({ type: 'felt', color: '#5B7CFA', pattern: { type: 'spots', colors: ['#FFFFFF'], scale: .1 } });
    for (const s of [1, -1]) { const t = k.mesh(sphere(.09), m); t.scale.set(.55, 1.4, .3); t.position.set(s * .07, -.14, -.03); t.rotation.z = s * .4; knot.add(t); }
    knot.add(k.mesh(sphere(.06), m)); knot.scale.setScalar(k.fit.k);
    return g;
  },
  'graduation-cap': k => {
    const g = k.cap(.05, .14, '#22232A', {}, .04);
    const at = k.fit.stand([0, 1, 0], 1, .02), board = new THREE.Group(); board.position.copy(at.p); g.add(board);
    const b = k.mesh(new THREE.BoxGeometry(1.05, .05, 1.05), k.made(FELT('#22232A'))); b.rotation.y = Math.PI / 4; board.add(b);
    const gold = k.made(FELT('#FFC83D'));
    const cord = k.mesh(tube([V3(0, .03, 0), V3(.35, .03, .2), V3(.52, -.02, .3), V3(.55, -.3, .32)], .012, false, 24), gold); board.add(cord);
    const tas = k.mesh(new THREE.CylinderGeometry(.035, .05, .14, 10), gold); tas.position.set(.55, -.36, .32); board.add(tas);
    board.scale.setScalar(k.fit.k * .95);
    return g;
  },
  'jester-hat': k => {
    const g = k.cap(.06, .1, '#8E6CF0', { pattern: { type: 'stripes', colors: ['#FFC83D'], axis: 'x', scale: 2 } });
    for (const s of [1, -1]) {
      const at = k.fit.stand([s * .8, .75, 0], .2, -.02), arm = new THREE.Group(); arm.position.copy(at.p); g.add(arm);
      const cone = bendX(new THREE.ConeGeometry(.16, .7, 24, 8).translate(0, .35, 0), .1, .6, .5).scale(s, 1, 1);
      arm.add(k.mesh(cone, k.made(FELT(s > 0 ? '#FFC83D' : '#8E6CF0'))));
      const bell = k.mesh(sphere(.07), k.made({ type: 'metal', color: '#FFD54F' })); bell.position.set(s * .5, .62, 0); arm.add(bell);
      arm.rotation.z = -s * .6; arm.scale.setScalar(k.fit.k);
    }
    return g;
  },
  'santa-hat': k => {
    const r0 = .7, g = k.hat(r0, [[.97, 0], [1, 0], [.12, 1.7], [0, 1.72]], FELT('#E8483F'), { bend: [.5, 1.2, .8], tilt: .1, sink: .05 });
    const cuff = k.mesh(new THREE.TorusGeometry(1.02, .16, 14, 48).rotateX(Math.PI / 2), k.made(FELT('#FFFFFF'))); cuff.position.y = .06; g.inner.add(cuff);
    // At the bent tip (bendX moves y = 1.72 to about 1.57 and x by 0.83).
    const pom = k.mesh(sphere(.2), k.made(FELT('#FFFFFF'))); pom.position.set(.83, 1.57, 0); g.inner.add(pom);
    return g;
  },
  // Bands around the head.
  crown: k => {
    const f = k.fit, r0 = f.rx * .5, y = f.heightFor(r0), g = new THREE.Group(), gold = k.made({ type: 'metal', color: '#FFC83D', roughness: .32 });
    const band = k.mesh(lathe([[r0 * .98, 0], [r0 * 1.06, 0], [r0 * 1.1, .14 * f.k], [r0 * 1.02, .14 * f.k]]), gold); band.position.set(f.c.x, y, f.c.z); band.scale.z = f.ez; g.add(band);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2, x = Math.sin(a) * r0 * 1.06, z = Math.cos(a) * r0 * 1.06 * f.ez;
      const spike = k.mesh(new THREE.ConeGeometry(.07 * f.k, .2 * f.k, 4).translate(0, .1 * f.k, 0), gold); spike.position.set(f.c.x + x, y + .12 * f.k, f.c.z + z); spike.rotation.y = a; g.add(spike);
      const ball = k.mesh(sphere(.035 * f.k, 12, 8), gold); ball.position.set(f.c.x + x, y + .33 * f.k, f.c.z + z); g.add(ball);
    }
    const gem = k.mesh(sphere(.05 * f.k), k.made({ type: 'glass', color: '#5B7CFA', opacity: .5, glow: { color: '#3F7BFF', intensity: .4 } })); gem.scale.z = .5; gem.position.set(f.c.x, y + .07 * f.k, f.c.z + r0 * 1.08 * f.ez + .01); g.add(gem);
    return g;
  },
  tiara: k => {
    const f = k.fit, g = new THREE.Group(), silver = k.made({ type: 'metal', color: '#E4E7EC', roughness: .25 });
    const pts = f.arch(.02, -.35, 16); g.add(k.mesh(tube(pts, .022 * f.k, false, 48), silver));
    const mid = pts[8], peak = k.mesh(new THREE.ConeGeometry(.07 * f.k, .2 * f.k, 4).translate(0, .1 * f.k, 0), silver); peak.position.copy(mid); g.add(peak);
    const gem = k.mesh(sphere(.045 * f.k), k.made({ type: 'glass', color: '#FF8FB8', opacity: .45, glow: { color: '#FF6FA8', intensity: .35 } })); gem.position.copy(mid).add(V3(0, .06 * f.k, .03)); g.add(gem);
    return g;
  },
  halo: k => {
    const f = k.fit, g = new THREE.Group(), ring = k.mesh(new THREE.TorusGeometry(f.rx * .55, .035 * f.k, 12, 64).rotateX(Math.PI / 2), k.made({ type: 'plastic', color: '#FFD54F', glow: { color: '#FFC400', intensity: .7 } }));
    const y0 = f.top.p.y + .2 * f.k; ring.position.set(f.c.x, y0, f.c.z); ring.rotation.x = -.15; g.add(ring);
    g.update = t => { ring.position.y = y0 + .025 * f.k * Math.sin(t * 1.6); };
    return g;
  },
  headband: k => {
    const f = k.fit, y = Math.max(f.eyeTop + .12 * f.k, f.c.y), g = new THREE.Group(), m = k.made(FELT('#E8483F'));
    g.add(k.mesh(tube(f.ringAt(y, .02), .05 * f.k), m));
    const back = f.ray([0, 0, -1], [f.c.x, y, f.c.z]);
    for (const s of [1, -1]) { const tail = k.mesh(new THREE.BoxGeometry(.08, .32, .02).translate(0, -.16, 0), m); tail.position.copy(back.p).add(V3(s * .05, 0, -.04)); tail.rotation.z = s * .35; tail.scale.setScalar(f.k); g.add(tail); }
    return g;
  },
  'flower-crown': k => {
    const f = k.fit, r0 = f.rx * .72, y = f.heightFor(r0), pts = f.ringAt(y, .03, 9), g = new THREE.Group();
    g.add(k.mesh(tube(f.ringAt(y, .0), .02 * f.k), k.made(FELT('#5FA35A'))));
    const cols = ['#FF8FB8', '#FFD54F', '#FFFFFF', '#BC82F3'];
    pts.forEach((p, i) => { const fl = petalFlower(k, k.made(FELT(cols[i % cols.length])), k.made(FELT('#FFC83D')), .06); fl.position.copy(p); fl.quaternion.setFromUnitVectors(UP, p.clone().sub(f.c).setY(0).normalize().lerp(UP, .6).normalize()); fl.scale.setScalar(f.k); g.add(fl); });
    return g;
  },
  'laurel-wreath': k => {
    const f = k.fit, r0 = f.rx * .7, y = f.heightFor(r0), pts = f.ringAt(y, .01, 28), g = new THREE.Group(), leaf = k.made({ type: 'metal', color: '#E0BE55', roughness: .35 }), dark = k.made({ type: 'metal', color: '#C29B3A', roughness: .35 });
    pts.forEach((p, i) => {
      if (Math.abs(Math.atan2(p.x - f.c.x, p.z - f.c.z)) < .45) return; // open at the front
      const l = k.mesh(sphere(.07, 12, 8), i % 2 ? leaf : dark); l.scale.set(.45, 1, .25); l.position.copy(p); l.lookAt(f.c.x, p.y, f.c.z); l.rotateX(i % 2 ? .8 : -.8); l.scale.multiplyScalar(f.k); g.add(l);
    });
    return g;
  },
  goggles: k => {
    const f = k.fit, y = f.eyeTop + .12 * f.k, g = new THREE.Group();
    g.add(k.mesh(tube(f.ringAt(y, .015), .035 * f.k), k.made(FELT('#6B4A2E'))));
    for (const s of [1, -1]) {
      const fp = f.front(s * .22 * f.k, y), cup = new THREE.Group(); cup.position.copy(fp.p).addScaledVector(fp.n, f.lift + .04); cup.quaternion.setFromUnitVectors(FWD, fp.n); cup.scale.setScalar(f.k); g.add(cup);
      cup.add(k.mesh(new THREE.TorusGeometry(.12, .03, 12, 32), k.made({ type: 'metal', color: '#C9A54A' })));
      const lens = k.mesh(new THREE.CircleGeometry(.12, 32), k.made({ type: 'glass', color: '#F2A93B', opacity: .55 })); lens.position.z = .01; cup.add(lens);
    }
    return g;
  },
  headlamp: k => {
    const f = k.fit, y = f.eyeTop + .14 * f.k, g = new THREE.Group();
    g.add(k.mesh(tube(f.ringAt(y, .015), .035 * f.k), k.made(FELT('#30333A'))));
    const fp = f.front(0, y), lamp = new THREE.Group(); lamp.position.copy(fp.p).addScaledVector(fp.n, f.lift + .06); lamp.quaternion.setFromUnitVectors(FWD, fp.n); lamp.scale.setScalar(f.k); g.add(lamp);
    lamp.add(k.mesh(new THREE.CylinderGeometry(.1, .1, .1, 24).rotateX(Math.PI / 2), k.made({ type: 'plastic', color: '#30333A' })));
    const lens = k.mesh(new THREE.CircleGeometry(.08, 24), k.made({ type: 'plastic', color: '#FFF4C2', glow: { color: '#FFF1B0', intensity: 1.4 } })); lens.position.z = .051; lamp.add(lens);
    return g;
  },
  headphones: k => {
    const f = k.fit, g = new THREE.Group(), tone = k.made({ type: 'plastic', color: '#30333A' }), cushion = k.made({ type: 'velvet', color: '#5B5F68' });
    g.add(k.mesh(tube(f.arch(.07, .08), .032 * f.k, false, 48), tone));
    for (const s of [1, -1]) {
      const h = f.ray([s, -.05, -.05]), cup = new THREE.Group(); cup.position.copy(h.p).addScaledVector(h.n, f.lift + .04); cup.quaternion.setFromUnitVectors(FWD, h.n); cup.scale.setScalar(f.k); g.add(cup);
      cup.add(k.mesh(new THREE.CylinderGeometry(.13, .13, .07, 32).rotateX(Math.PI / 2).translate(0, 0, .02), tone));
      cup.add(k.mesh(new THREE.TorusGeometry(.105, .035, 12, 32).translate(0, 0, -.025), cushion));
    }
    return g;
  },
  earmuffs: k => {
    const f = k.fit, g = new THREE.Group();
    g.add(k.mesh(tube(f.arch(.05, .05), .03 * f.k, false, 48), k.made({ type: 'plastic', color: '#E8483F' })));
    for (const s of [1, -1]) { const h = f.ray([s, -.05, 0]), m = k.mesh(sphere(.17 * f.k), k.made({ type: 'fur', color: '#FFFFFF', fur: { length: .4 } })); m.scale.set(.75, 1, 1); m.position.copy(h.p).addScaledVector(h.n, f.lift + .07); g.add(m); }
    return g;
  },
  // Pairs and single pieces standing on the head.
  'cat-ears': k => {
    const g = new THREE.Group();
    for (const s of [1, -1]) {
      const at = k.fit.stand([s * .55, .85, -.05], .35), ear = new THREE.Group(); ear.position.copy(at.p); ear.quaternion.copy(at.q); ear.rotateZ(-s * .15); ear.scale.setScalar(k.fit.k); g.add(ear);
      const outer = k.mesh(new THREE.ConeGeometry(.17, .3, 3, 1).rotateY(Math.PI / 6).translate(0, .1, 0), k.body()); outer.scale.z = .45; ear.add(outer);
      const inner = k.mesh(new THREE.ConeGeometry(.1, .2, 3, 1).rotateY(Math.PI / 6).translate(0, .08, 0), k.made(FELT('#FF9DB2'))); inner.scale.z = .3; inner.position.z = .035; ear.add(inner);
    }
    return g;
  },
  'bunny-ears': k => {
    const g = new THREE.Group();
    for (const s of [1, -1]) {
      const at = k.fit.stand([s * .35, 1, -.05], .6), ear = new THREE.Group(); ear.position.copy(at.p); ear.quaternion.copy(at.q); ear.rotateZ(-s * .18); ear.scale.setScalar(k.fit.k); g.add(ear);
      const outer = k.mesh(sphere(.12), k.body()); outer.scale.set(1, 3.4, .45); outer.position.y = .36; ear.add(outer);
      const inner = k.mesh(sphere(.075), k.made(FELT('#FF9DB2'))); inner.scale.set(1, 3.6, .3); inner.position.set(0, .36, .04); ear.add(inner);
      if (s < 0) ear.rotateX(-.35);
    }
    return g;
  },
  'devil-horns': k => { const g = new THREE.Group(); for (const s of [1, -1]) g.add(k.horn(s, [s * .45, .9, .05], '#E8483F', .07, .22, 30)); return g; },
  'unicorn-horn': k => {
    const at = k.fit.stand([0, .85, .45], .5, -.01), g = new THREE.Group();
    const geo = shapeGeometry({ type: 'cone', radius: .085, height: .42, rounding: .01, position: [0, .21, 0], deform: [{ type: 'twist', axis: 'y', amount: 540 }, { type: 'ripple', axis: 'y', count: 6, amplitude: .012 }] }, { quality: 'medium', limit: 2 });
    const horn = k.mesh(geo ? geo.geometry : new THREE.ConeGeometry(.085, .42, 24).translate(0, .21, 0), k.made({ type: 'ceramic', color: '#FFE9A8' }));
    horn.position.copy(at.p); horn.quaternion.copy(at.q); horn.scale.setScalar(k.fit.k); g.add(horn);
    return g;
  },
  antennae: k => {
    const g = new THREE.Group(), tips = [];
    for (const s of [1, -1]) {
      const at = k.fit.stand([s * .3, 1, 0], .7, -.02), a = new THREE.Group(); a.position.copy(at.p); a.quaternion.copy(at.q); a.scale.setScalar(k.fit.k); g.add(a);
      a.add(k.mesh(tube([V3(0, 0, 0), V3(s * .04, .15, 0), V3(s * .1, .3, 0)], .018, false, 16), k.made({ type: 'plastic', color: '#30333A' })));
      const tip = k.mesh(sphere(.06), k.made({ type: 'felt', color: '#FFC83D', glow: { color: '#FFC400', intensity: .5 } })); tip.position.set(s * .1, .32, 0); a.add(tip);
      tips.push({ a, s });
    }
    g.update = (t, dt, av) => { for (const { a, s } of tips) a.rotation.z = .12 * Math.sin(t * 3 + s) * (1 + 2 * av.weights.get('voice')); };
    return g;
  },
  sprout: k => {
    const at = k.fit.stand([0, 1, 0], .8, -.02), g = new THREE.Group(), s = new THREE.Group(); s.position.copy(at.p); s.quaternion.copy(at.q); s.scale.setScalar(k.fit.k); g.add(s);
    const green = k.made(FELT('#7CC36A'));
    s.add(k.mesh(tube([V3(0, 0, 0), V3(.02, .1, 0), V3(0, .2, 0)], .02, false, 12), green));
    for (const d of [1, -1]) { const l = k.mesh(sphere(.08), green); l.scale.set(1.6, .35, .9); l.position.set(d * .12, .22, 0); l.rotation.z = d * .35; s.add(l); }
    g.update = t => { s.rotation.z = .08 * Math.sin(t * 1.4); };
    return g;
  },
  'hair-bow': k => {
    const at = k.fit.stand([.55, .8, .25], .3, .02), g = new THREE.Group(), b = new THREE.Group(); b.position.copy(at.p); b.quaternion.copy(at.q); b.rotateX(-Math.PI / 2 + .3); b.scale.setScalar(k.fit.k); g.add(b);
    const m = k.made(FELT('#FF8FB8'));
    b.add(k.mesh(extrude(bowShape(.2, .13), .06), m)); b.add(k.mesh(sphere(.05), m));
    return g;
  },
  flower: k => {
    const at = k.fit.stand([.6, .75, .3], .2, .02), g = new THREE.Group(), fl = petalFlower(k, k.made(FELT('#FF8FB8')), k.made(FELT('#FFC83D')), .07, 6);
    fl.position.copy(at.p); fl.quaternion.setFromUnitVectors(UP, at.n); fl.scale.setScalar(k.fit.k * 1.5); g.add(fl);
    return g;
  },
  butterfly: k => {
    const at = k.fit.stand([-.35, 1, .2], .8, .02), g = new THREE.Group(), b = new THREE.Group(); b.position.copy(at.p); b.quaternion.copy(at.q); b.scale.setScalar(k.fit.k * 1.7); g.add(b);
    b.add(k.mesh(new THREE.CapsuleGeometry(.018, .12, 4, 8).rotateX(Math.PI / 2), k.made(FELT('#30333A'))));
    const wings = [1, -1].map(s => {
      const w = new THREE.Group(); b.add(w);
      for (const [c, z, r] of [['#8D9FFF', .03, .1], ['#BC82F3', -.05, .07]]) { const m = k.mesh(extrude(ellipseShape(r, r * .7), .006, .003), k.made(FELT(c))); m.rotation.x = -Math.PI / 2; m.position.set(s * r * .95, 0, z); w.add(m); }
      return { w, s };
    });
    g.update = t => { for (const { w, s } of wings) w.rotation.z = s * (.25 + .5 * Math.abs(Math.sin(t * 2.2))); };
    return g;
  },
  chick: k => {
    const at = k.fit.stand([0, 1, .05], 1, .06), g = new THREE.Group(), c = new THREE.Group(); c.position.copy(at.p); c.scale.setScalar(k.fit.k); g.add(c);
    const yellow = k.made({ type: 'fur', color: '#FFD54F', fur: { length: .3 } });
    const body = k.mesh(sphere(.15), yellow); body.scale.set(1, .85, 1); body.position.y = .1; c.add(body);
    const head = k.mesh(sphere(.1), yellow); head.position.set(0, .26, .05); c.add(head);
    const beak = k.mesh(new THREE.ConeGeometry(.03, .06, 12).rotateX(Math.PI / 2), k.made(FELT('#FF9F43'))); beak.position.set(0, .25, .16); c.add(beak);
    for (const s of [1, -1]) { const e = k.mesh(sphere(.017, 10, 8), k.made({ type: 'ceramic', color: '#16151B' })); e.position.set(s * .045, .29, .135); c.add(e); }
    g.update = t => { c.rotation.y = .3 * Math.sin(t * .7); head.rotation.x = .1 * Math.max(0, Math.sin(t * 2.3)); };
    return g;
  },
  // Round the neck.
  'bow-tie': k => {
    const f = k.fit, fp = f.front(0, f.neckY), g = new THREE.Group(), b = new THREE.Group();
    b.position.copy(fp.p).addScaledVector(fp.n, f.lift + .04); b.quaternion.setFromUnitVectors(FWD, fp.n); b.scale.setScalar(f.k); g.add(b);
    const m = k.made(FELT('#E8483F'));
    b.add(k.mesh(extrude(bowShape(.2, .11), .06), m)); const knot = k.mesh(sphere(.05), m); knot.scale.z = .7; b.add(knot);
    return g;
  },
  scarf: k => {
    const f = k.fit, g = new THREE.Group(), m = k.made({ type: 'felt', color: '#E8483F', pattern: { type: 'stripes', colors: ['#FFF4D6'], axis: 'y', scale: .06 } });
    g.add(k.mesh(tube(f.ringAt(f.neckY, .05), .085 * f.k), m));
    const fp = f.front(.25 * f.k, f.neckY - .02), tail = k.mesh(roundedTail(.14, .42), m);
    tail.position.copy(fp.p).addScaledVector(fp.n, f.lift + .1); tail.quaternion.setFromUnitVectors(FWD, fp.n); tail.rotateZ(.12); tail.scale.setScalar(f.k); g.add(tail);
    return g;
  },
  lei: k => {
    const f = k.fit, pts = f.ringAt(f.neckY - .03, .06, 14), g = new THREE.Group(), cols = ['#FF8FB8', '#FFD54F', '#BC82F3', '#FF9F43'];
    pts.forEach((p, i) => { const fl = petalFlower(k, k.made(FELT(cols[i % cols.length])), k.made(FELT('#FFF4D6')), .055); fl.position.copy(p); fl.quaternion.setFromUnitVectors(UP, p.clone().sub(V3(f.c.x, p.y, f.c.z)).normalize()); fl.scale.setScalar(f.k); g.add(fl); });
    return g;
  },
};
function roundedTail(w, h) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2 * .9, -h); s.lineTo(-w / 2 * .9, -h); s.closePath();
  return extrude(s, .04, .02);
}

export const SUPPORTED_OUTFITS = Object.freeze(Object.keys(OUTFITS));

export class Outfits {
  constructor(avatar) {
    this.avatar = avatar; this.fit = null; this.built = new Map(); this.current = null;
    this.group = new THREE.Group(); this.group.name = 'outfits'; this.group.userData.noBounds = true;
    avatar.bodyMesh.add(this.group);
  }
  kit() {
    const av = this.avatar, fit = this.fit ||= new Fit(av), self = this;
    const made = spec => av.material(spec);
    const mesh = (geo, m) => { av.disposables.push(geo); const o = m.material ? av.mesh(geo, m) : new THREE.Mesh(geo, m); o.userData.noBounds = true; o.traverse(c => { c.userData.noBounds = true; }); return o; };
    const k = {
      fit, made, mesh,
      body: () => made(av.document.body.material ?? 'main'),
      // A fitted hat: the lathe profile scaled to an opening of f × the head's half-width, resting where the head is that wide.
      hat(f, profile, spec, o = {}) {
        const r0 = fit.rx * f, y = fit.heightFor(r0) - (o.sink ?? .02) * fit.k;
        const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); g.inner = inner;
        const m = made(spec); m.material.side = THREE.DoubleSide;
        let geo = lathe(profile);
        if (o.bend) bendX(geo, ...o.bend);
        inner.add(mesh(geo, m));
        if (o.band) { const [c, y0, h] = o.band, b = mesh(new THREE.CylinderGeometry(1.035, 1.035 - h * .05, h, 64, 1, true).translate(0, y0 + h / 2, 0), made(FELT(c))); inner.add(b); }
        if (o.tassel) { const t = mesh(tube([V3(0, .82, 0), V3(.25, .8, .1), V3(.42, .5, .15)], .025, false, 16), made(FELT(o.tassel))); inner.add(t); const e = mesh(new THREE.CylinderGeometry(.04, .07, .18, 10), made(FELT(o.tassel))); e.position.set(.42, .42, .15); inner.add(e); }
        inner.scale.set(r0, r0, r0 * fit.ez);
        g.position.set(fit.c.x, y, fit.c.z);
        if (o.tilt) { g.rotation.z = -o.tilt; g.position.x += o.tilt * r0 * .6; g.position.y -= Math.abs(o.tilt) * r0 * .15; }
        return g;
      },
      // Where a cap's edge runs: above the eyes in front, a little lower at the back.
      capCut(gap, drop = .14) { const front = Math.max(fit.eyeTop + gap * fit.k, fit.c.y - fit.rx * .1); return { front, back: front - drop * fit.k }; },
      // A cap grown out of the head's surface above the cut.
      cap(t, gap, color, spec = {}, drop) {
        const { front, back } = k.capCut(gap, drop), sdf = fit.sdf, lift = fit.lift, bb = fit.bounds, th = t * fit.k + lift;
        const slope = (front - back) / (2 * fit.rz), mid = (front + back) / 2, cz = fit.c.z;
        const field = (x, y, z) => smax(sdf(x, y, z) - th, mid + slope * (z - cz) - y, .015);
        const lo = [bb.lo[0] - th - .05, Math.min(front, back) - .05, bb.lo[2] - th - .05], hi = [bb.hi[0] + th + .05, fit.top.p.y + th + .05, bb.hi[2] + th + .05];
        const m = meshField(field, { lo, hi }, { cells: av.quality === 'low' ? 56 : 80 });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(m.positions, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2)); geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
        const g = new THREE.Group(); g.add(mesh(geo, made({ type: 'felt', color, ...spec })));
        return g;
      },
      // A band along the cap's edge.
      band(cut, r, color, out = .05, fuzzy = false, type = 'felt') {
        const pts = Array.from({ length: 48 }, (_, i) => {
          const a = i / 48 * Math.PI * 2, z0 = Math.cos(a), y = cut.back + (cut.front - cut.back) * (z0 + 1) / 2 + r * .6;
          const h = fit.ray([Math.sin(a), 0, Math.cos(a)], [fit.c.x, y, fit.c.z]); return h.p.addScaledVector(h.n, fit.lift + out * fit.k);
        });
        return mesh(tube(pts, r * fit.k), made(fuzzy ? { type: 'fur', color, fur: { length: .2, density: .8 } } : { type, color }));
      },
      pom(r, color, out) { const at = fit.stand([0, 1, 0], 1, out * fit.k), m = mesh(sphere(r), made({ type: 'fur', color, fur: { length: .35, density: .8 } })); m.position.copy(at.p); return m; },
      horn(s, dir, color, r, h, bend) {
        const at = fit.stand(dir, .3, -.02), geo = shapeGeometry({ type: 'cone', radius: r, height: h, rounding: .01, position: [0, h / 2, 0], deform: [{ type: 'bend', axis: 'y', toward: 'x', amount: bend * s }] }, { quality: 'medium', limit: 2 });
        const m = mesh(geo ? geo.geometry : new THREE.ConeGeometry(r, h, 16).translate(0, h / 2, 0), made({ type: 'ceramic', color }));
        m.position.copy(at.p); m.quaternion.copy(at.q); m.scale.setScalar(fit.k); return m;
      },
    };
    return k;
  }
  /** Puts on an outfit by id (null takes it off). Unknown ids show nothing (SPEC 13.8). */
  wear(id) {
    if (id === this.current) return;
    this.current = id && OUTFITS[id] ? id : null;
    if (this.current && !this.built.has(this.current)) {
      let g = null;
      try { g = OUTFITS[this.current](this.kit()); } catch (e) { console.warn(`[openavatar] outfit ${this.current} failed`, e); }
      if (g) { g.userData.noBounds = true; this.group.add(g); g.visible = false; }
      this.built.set(this.current, g ? { id: this.current, g, v: 0 } : null);
    }
    // A hat outfit hides the document's own hats (SPEC 9.2).
    const hat = Boolean(this.current && OUTFIT_HATS.has(this.current));
    for (const e of this.avatar.parts.values()) if (e.part.role === 'hat') for (const c of e.copies) c.anchor.visible = !hat;
  }
  update(t, dt) {
    for (const e of this.built.values()) {
      if (!e) continue;
      const target = e.id === this.current ? 1 : 0;
      e.v += (target - e.v) * (1 - Math.exp(-dt / .15));
      e.g.visible = e.v > .02;
      if (e.g.visible) { e.g.scale.setScalar(1); e.g.update?.(t, dt, this.avatar); }
    }
  }
}
// Hats replace the document's own hats; the vocabulary says which outfits are hats.
const OUTFIT_HATS = new Set(VOCABULARY.outfits.filter(o => o.hat).map(o => o.id));

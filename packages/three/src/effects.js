// Effects (SPEC 13.7): small comic signs beside the avatar's head, made of
// felt like the avatar. They hang in the avatar's own space but not on its
// body, so they stay upright while it moves. Each eases in and out; signs that
// rise (zzz, hearts, notes, steam) loop while the effect holds.
import * as THREE from 'three';
import { surfaceAlong } from './sdf.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const pop = v => v < 1 ? 1 + 2.4 * (v - 1) ** 3 + 1.4 * (v - 1) ** 2 : 1;

// ---------- glyph outlines ----------
function strokeShape(pts, w) {
  const r = w / 2, L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    L.push([pts[i][0] - dy / l * r, pts[i][1] + dx / l * r]); R.push([pts[i][0] + dy / l * r, pts[i][1] - dx / l * r]);
  }
  const dir = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]), n = pts.length - 1, s = new THREE.Shape();
  s.moveTo(...L[0]); for (let i = 1; i <= n; i++) s.lineTo(...L[i]);
  const fe = dir(pts[n - 1], pts[n]); s.absarc(pts[n][0], pts[n][1], r, fe + Math.PI / 2, fe - Math.PI / 2, true);
  for (let i = n; i >= 0; i--) s.lineTo(...R[i]);
  const fs = dir(pts[0], pts[1]); s.absarc(pts[0][0], pts[0][1], r, fs - Math.PI / 2, fs + Math.PI / 2, true);
  return s;
}
const circle = (x, y, r) => { const s = new THREE.Shape(); s.absarc(x, y, r, 0, Math.PI * 2, false); return s; };
const arc = (cx, cy, r, a0, a1, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
function heart(k) {
  const h = new THREE.Shape();
  h.moveTo(0, -1.05 * k);
  h.bezierCurveTo(-.25 * k, -.75 * k, -1.2 * k, -.25 * k, -1.05 * k, .35 * k);
  h.bezierCurveTo(-.95 * k, .95 * k, -.25 * k, 1.05 * k, 0, .55 * k);
  h.bezierCurveTo(.25 * k, 1.05 * k, .95 * k, .95 * k, 1.05 * k, .35 * k);
  h.bezierCurveTo(1.2 * k, -.25 * k, .25 * k, -.75 * k, 0, -1.05 * k);
  return h;
}
function star4(r, inner) {
  const s = new THREE.Shape();
  for (let i = 0; i < 8; i++) { const a = Math.PI / 2 + i * Math.PI / 4, q = i % 2 ? inner : r; i ? s.lineTo(q * Math.cos(a), q * Math.sin(a)) : s.moveTo(q * Math.cos(a), q * Math.sin(a)); }
  s.closePath(); return s;
}
function drop(r) {
  const s = new THREE.Shape();
  s.moveTo(0, r * 2.1);
  s.bezierCurveTo(r * .35, r * 1.3, r * 1.05, r * .55, r, -.05 * r);
  s.absarc(0, 0, r, 0, -Math.PI, true);
  s.bezierCurveTo(-r * 1.05, r * .55, -r * .35, r * 1.3, 0, r * 2.1);
  return s;
}
function bubble(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w * .3, y); s.lineTo(x + w * .18, y - h * .32); s.lineTo(x + w * .46, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const GLYPHS = {
  z: () => [strokeShape([[-.05, .055], [.05, .055], [-.05, -.055], [.05, -.055]], .026)],
  question: () => [strokeShape([...arc(0, .045, .045, 160, -70, 9), [.006, -.02]], .028), circle(.006, -.075, .02)],
  exclaim: () => [strokeShape([[0, .1], [0, -.02]], .036), circle(0, -.08, .022)],
  note: () => [circle(-.03, -.06, .04), strokeShape([[.006, -.06], [.006, .085], [.06, .055]], .018)],
  note2: () => [circle(-.05, -.06, .032), circle(.05, -.04, .032), strokeShape([[-.022, -.06], [-.022, .085], [.078, .105], [.078, -.04]], .016)],
  heart: () => [heart(.06)],
  sparkle: () => [star4(.07, .018)],
  drop: () => [drop(.035)],
};

// Colors in the felt palette of Enconvo's characters.
const COLORS = { z: '#6F8BFF', question: '#5B7CFA', exclaim: '#FFB12E', note: '#5B7CFA', note2: '#5B7CFA', heart: '#FF4D6D', sparkle: '#FFD23F', drop: '#7CC4FF' };
const GLOW = { heart: '#FF2E57', sparkle: '#FFC400' };

// Each effect: copies, and the pose of copy i at phase ph (0..1, looping at
// `rate` per second), time t and level v: [x, y, scale, spin] around the
// anchor beside the head. A head is about 1.1 units across here.
const rise = (x0, y0, x1, y1, s) => (ph, t, v, i) => [x0 + (x1 - x0) * ph + .03 * Math.sin(ph * 9 + i), y0 + (y1 - y0) * ph, s * v * sstep(0, .2, ph) * sstep(1, .75, ph), .25 * Math.sin(ph * 6 + i)];
const EFFECTS = {
  zzz: { glyph: 'z', n: 3, rate: .4, at: (ph, t, v, i) => { const [x, y, s, r] = rise(0, 0, .22, .42, 1.3)(ph, t, v, i); return [x, y, s * (.7 + .5 * ph), r * .5]; } },
  hearts: { glyph: 'heart', n: 3, rate: .55, at: rise(0, -.05, .14, .45, 1.25) },
  notes: { glyph: ['note', 'note2'], n: 2, rate: .6, at: rise(0, -.05, .2, .45, 1.2) },
  question: { glyph: 'question', n: 1, at: (ph, t, v) => [.05, .12 + .02 * Math.sin(t * 2.4), 1.35 * pop(v), .12 * Math.sin(t * 1.7)] },
  exclaim: { glyph: 'exclaim', n: 1, at: (ph, t, v) => [.02, .14, 1.35 * pop(v) * (1 + .06 * Math.sin(t * 9)), .1] },
  sweat: { glyph: 'drop', n: 1, at: (ph, t, v) => { const k = (t * .45) % 1; return [-.06, -.04 - .1 * k, 1.3 * v * sstep(0, .15, k) * sstep(1, .8, k), -.25]; } },
  sparkles: { glyph: 'sparkle', n: 3, at: (ph, t, v, i) => [[.1, -.75, -.12][i], [.06, .05, .3][i], [1.3, 1, .85][i] * v * (.6 + .4 * Math.sin(t * 5 + i * 2.1)), t * .8 + i] },
};

// The field, in the body's space, of the resting parts that touch neither the body nor a part that does; null when
// there are none. A part touches when a point of its surface comes within 0.03 of the other solid.
function looseParts(avatar) {
  const inv = avatar.bodyMesh.matrixWorld.clone().invert(), v = new THREE.Vector3();
  const held = o => { for (; o && o !== avatar.bodyMesh; o = o.parent) if (o.userData.hand || o.userData.restsHidden) return true; return false; };
  const pieces = [];
  for (const e of avatar.parts.values()) for (const c of e.copies) {
    if (held(c.mesh)) continue;
    const m = inv.clone().multiply(c.mesh.matrixWorld), pos = c.mesh.geometry.attributes.position, pts = [];
    for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 200))) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(m).toArray());
    const w = m.invert().elements, f = c.sdf;
    pieces.push({ pts, f: (x, y, z) => f(w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]) });
  }
  const fixed = [avatar.bodySdf];
  let loose = pieces;
  for (let grew = true; grew && loose.length;) {
    grew = false;
    loose = loose.filter(p => {
      if (!p.pts.some(([x, y, z]) => fixed.some(f => f(x, y, z) < .03))) return true;
      fixed.push(p.f); grew = true; return false;
    });
  }
  if (!loose.length) return null;
  return (x, y, z) => { let d = Infinity; for (const p of loose) d = Math.min(d, p.f(x, y, z)); return d; };
}

export class Effects {
  constructor(avatar) {
    this.avatar = avatar; this.built = new Map();
    const bb = avatar.bodyBounds, suit = avatar.suit;
    const c = suit ? suit.head.center : [0, (bb.lo[1] + bb.hi[1]) / 2 + (bb.hi[1] - bb.lo[1]) * .15, 0];
    // Clear of the body and the parts on it (SPEC 13.7), so a big cap or helmet doesn't hide them.
    const sdf = avatar.restingSdf();
    const side = surfaceAlong(sdf, c, [.75, .55, 0])?.p || [bb.hi[0], bb.hi[1], 0];
    const top = surfaceAlong(sdf, c, [0, 1, 0])?.p || [0, bb.hi[1], 0];
    // Beside the head on the viewer's right, a little above it, and in front so nothing hides it.
    this.anchor = new THREE.Vector3(side[0] + .14, Math.max(side[1], top[1] - .25) + .06, Math.max(.25, bb.hi[2] * .55));
    this.top = new THREE.Vector3(...top); this.width = bb.hi[0] - bb.lo[0];
    // Signs are drawn for a head about 1.1 units across; bigger avatars get bigger signs.
    this.k = clamp(this.width / 1.1, .9, 1.7);
    // The signs are drawn in front, so a wing or an ear behind them still reads; a part floating free of the body (a
    // moon, a star, a ring) would look tangled with them, so where they rise none may stand in the front view: such a
    // part moves them further out the same way, by up to 0.6.
    const loose = looseParts(avatar);
    if (loose) {
      const zs = [avatar.bounds.min.z, avatar.bounds.max.z];
      const free = (x, y) => { for (let z = zs[0]; z <= zs[1] + 1e-9; z += .04) if (loose(x, y, z) < .08 * this.k) return false; return true; };
      const clear = at => [0, .25, .5, .75, 1].every(s => free(at.x + .2 * this.k * s, at.y + .45 * this.k * s));
      const out = new THREE.Vector3(.75, .55, 0).normalize();
      for (let step = 1, at = this.anchor.clone(); !clear(at) && step <= 12; step++) if (clear(at.addScaledVector(out, .05))) this.anchor.copy(at);
    }
    this.group = new THREE.Group(); this.group.name = 'effects'; this.group.userData.noBounds = true; avatar.root.add(this.group);
    this.materials = {}; this.geometry = {};
  }
  mat(name) {
    if (this.materials[name]) return this.materials[name];
    const color = new THREE.Color(COLORS[name] || '#ffffff');
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: .9, sheen: .8, sheenColor: color.clone().lerp(new THREE.Color(1, 1, 1), .5), envMap: this.avatar.envMap, envMapIntensity: .4 });
    if (GLOW[name]) { m.emissive = new THREE.Color(GLOW[name]); m.emissiveIntensity = .25; }
    this.avatar.disposables.push(m);
    return this.materials[name] = m;
  }
  geo(name) {
    if (this.geometry[name]) return this.geometry[name];
    const g = new THREE.ExtrudeGeometry(GLYPHS[name](), { depth: .012, bevelEnabled: true, bevelThickness: .01, bevelSize: .008, bevelSegments: 3, curveSegments: 16 });
    g.translate(0, 0, -.006); this.avatar.disposables.push(g);
    return this.geometry[name] = g;
  }
  build(id) {
    if (this.built.has(id)) return this.built.get(id);
    const av = this.avatar, holder = new THREE.Group(); this.group.add(holder);
    let entry;
    if (EFFECTS[id]) {
      const E = EFFECTS[id];
      const copies = Array.from({ length: E.n }, (_, i) => {
        const name = Array.isArray(E.glyph) ? E.glyph[i % E.glyph.length] : E.glyph;
        const m = new THREE.Mesh(this.geo(name), this.mat(name)); m.visible = false; m.userData.noBounds = true; holder.add(m); return m;
      });
      holder.position.copy(this.anchor); holder.scale.setScalar(this.k);
      entry = { id, holder, copies, v: 0, update: (t, v) => copies.forEach((c, i) => {
        const ph = ((t * (E.rate ?? 0)) + i / copies.length) % 1, [x, y, s, r] = E.at(ph, t, v, i);
        c.visible = s > .02; c.position.set(x, y, 0); c.scale.setScalar(Math.max(1e-4, s)); c.rotation.z = r;
      }) };
    } else if (id === 'dots') {
      // A typing bubble: white felt with three blue dots that bob in turn.
      const paper = new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: .95, sheen: .6, sheenColor: new THREE.Color('#FFFFFF'), envMap: av.envMap, envMapIntensity: .4 });
      const dotM = new THREE.MeshPhysicalMaterial({ color: '#5B7CFA', roughness: .6, emissive: new THREE.Color('#3F7BFF'), emissiveIntensity: .2, envMap: av.envMap });
      av.disposables.push(paper, dotM);
      const g = new THREE.ExtrudeGeometry(bubble(.34, .2, .1), { depth: .03, bevelEnabled: true, bevelThickness: .02, bevelSize: .018, bevelSegments: 4, curveSegments: 16 }); g.translate(0, 0, -.015);
      const sph = new THREE.SphereGeometry(.03, 16, 10); av.disposables.push(g, sph);
      const b = new THREE.Mesh(g, paper); b.userData.noBounds = true; holder.add(b);
      const dots = [-1, 0, 1].map(i => { const d = new THREE.Mesh(sph, dotM); d.position.set(i * .085, 0, .04); b.add(d); return d; });
      holder.position.copy(this.anchor).add(new THREE.Vector3(.08, .08, 0));
      entry = { id, holder, v: 0, update: (t, v) => {
        holder.visible = v > .02; holder.scale.setScalar(Math.max(1e-4, pop(v) * this.k));
        dots.forEach((d, i) => { d.position.y = .03 * Math.max(0, Math.sin(t * 6.5 - i * .9)); });
        dotM.emissiveIntensity = .15 + .25 * (.5 + .5 * Math.sin(t * 6.5));
      } };
    } else if (id === 'steam') {
      // Puffs that rise from the top of the head, grow and thin out.
      const m = new THREE.MeshStandardMaterial({ color: '#F4F5F7', roughness: 1, transparent: true, opacity: .85, depthWrite: false });
      const sph = new THREE.IcosahedronGeometry(.06, 2); av.disposables.push(m, sph);
      const puffs = Array.from({ length: 4 }, () => { const p = new THREE.Mesh(sph, m); p.userData.noBounds = true; holder.add(p); return p; });
      holder.position.copy(this.top).add(new THREE.Vector3(0, .02, .1)); holder.scale.setScalar(this.k);
      entry = { id, holder, v: 0, update: (t, v) => puffs.forEach((p, i) => {
        const ph = (t * .5 + i / puffs.length) % 1, s = v * sstep(0, .2, ph) * sstep(1, .7, ph) * (.6 + 1.2 * ph);
        p.visible = s > .02; p.position.set((i % 2 ? 1 : -1) * (.12 + .1 * ph) + .02 * Math.sin(t * 3 + i), .3 * ph, 0); p.scale.setScalar(Math.max(1e-4, s));
      }) };
    } else if (id === 'confetti') {
      // Bits of felt falling across the avatar, turning as they go.
      const cols = ['#FF6778', '#FFC83D', '#6FD08C', '#5B7CFA', '#BC82F3', '#FF9DB2'];
      const mats = cols.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .9, side: THREE.DoubleSide }));
      const g = new THREE.PlaneGeometry(.05, .028); av.disposables.push(g, ...mats);
      const w = this.width * .7 + .6, top = this.top.y + .5;
      const bits = Array.from({ length: 30 }, (_, i) => {
        const b = new THREE.Mesh(g, mats[i % mats.length]); b.userData.noBounds = true; holder.add(b);
        return { b, x: (((i * 0.6180339) % 1) - .5) * w, z: .2 + .35 * ((i * 0.381966) % 1), speed: .35 + .25 * ((i * 0.7548) % 1), ph: (i * 0.2451) % 1, spin: 2 + 3 * ((i * 0.5698) % 1) };
      });
      entry = { id, holder, v: 0, update: (t, v) => bits.forEach(q => {
        const k = (t * q.speed + q.ph) % 1;
        q.b.visible = v > .05; q.b.position.set(q.x + .05 * Math.sin(t * 2 + q.ph * 9), top - 2.2 * k, q.z);
        q.b.rotation.set(t * q.spin, t * q.spin * .7, q.ph * 6); q.b.scale.setScalar(Math.max(1e-4, v));
      }) };
    } else entry = null;
    this.built.set(id, entry);
    return entry;
  }
  /** The box effects can reach, in the avatar's space, for framing a stage. */
  reach() {
    const r = .32 * this.k;
    return new THREE.Box3(new THREE.Vector3(-this.anchor.x - r, this.anchor.y - r * .6, 0), new THREE.Vector3(this.anchor.x + r, Math.max(this.anchor.y + r * 1.4, this.top.y + .4 * this.k), this.anchor.z));
  }
  /** @param {Set<string>} active the effect ids to show now */
  update(t, dt, active) {
    for (const id of active) this.build(id);
    for (const e of this.built.values()) {
      if (!e) continue;
      const target = active.has(e.id) ? 1 : 0;
      e.v += (target - e.v) * (1 - Math.exp(-dt / (target ? .2 : .15)));
      if (e.v < .005 && !target) { e.holder.visible = false; continue; }
      e.holder.visible = true;
      e.update(t, clamp(e.v));
    }
  }
}

export const SUPPORTED_EFFECTS = Object.freeze(['dots', 'zzz', 'sparkles', 'hearts', 'notes', 'question', 'exclaim', 'sweat', 'steam', 'confetti']);

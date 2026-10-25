// The face (SPEC 8): eyes, mouth, cheeks, brows and nose placed on the body's
// front points, with the eye and mouth poses of each expression (8.5, 13.4),
// blinking, gaze and speech. Flat features are three.js shapes extruded thin
// and bent onto the surface, so they hug a small head as well as a big one.
import * as THREE from 'three';
import { expressionPoses } from 'openavatar';
import { frontPoint } from './sdf.js';
import { bendGeometry } from './geometry.js';
import { featureLift } from './materials.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const Z = new THREE.Vector3(0, 0, 1);
const ease = (v, target, dt, tau) => v + (target - v) * (1 - Math.exp(-dt / tau));

// ---------- 2D glyphs ----------
function polygonShape(pts) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; }
function ellipsePoints(rx, ry, n = 64) { return Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [rx * Math.cos(a), ry * Math.sin(a)]; }); }
// Keeps the part of a convex polygon below the line through a and b.
function clipBelow(pts, a, b) {
  const side = ([x, y]) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], sp = side(p), sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp < 0) !== (sq < 0) && sp !== sq) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
// A stroke with round ends along a polyline.
function strokeShape(pts, w) {
  const r = w / 2, L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    L.push([pts[i][0] + nx * r, pts[i][1] + ny * r]); R.push([pts[i][0] - nx * r, pts[i][1] - ny * r]);
  }
  const dir = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const s = new THREE.Shape(), n = pts.length - 1;
  s.moveTo(...L[0]); for (let i = 1; i <= n; i++) s.lineTo(...L[i]);
  const fe = dir(pts[n - 1], pts[n]); s.absarc(pts[n][0], pts[n][1], r, fe + Math.PI / 2, fe - Math.PI / 2, true);
  for (let i = n; i >= 0; i--) s.lineTo(...R[i]);
  const fs = dir(pts[0], pts[1]); s.absarc(pts[0][0], pts[0][1], r, fs - Math.PI / 2, fs + Math.PI / 2, true);
  return s;
}
const curve = (f, n = 18) => Array.from({ length: n + 1 }, (_, i) => f(i / n * 2 - 1));
function heartShape(s) {
  const h = new THREE.Shape(), k = s / 1.6;
  h.moveTo(0, -1.05 * k);
  h.bezierCurveTo(-.25 * k, -.75 * k, -1.2 * k, -.25 * k, -1.05 * k, .35 * k);
  h.bezierCurveTo(-.95 * k, .95 * k, -.25 * k, 1.05 * k, 0, .55 * k);
  h.bezierCurveTo(.25 * k, 1.05 * k, .95 * k, .95 * k, 1.05 * k, .35 * k);
  h.bezierCurveTo(1.2 * k, -.25 * k, .25 * k, -.75 * k, 0, -1.05 * k);
  return h;
}
const EYE_RADII = { round: [1, 1], oval: [.82, 1.1], tall: [.62, 1.28], wide: [1.28, .74], dot: [.5, .5], almond: [1.2, .68] };
function almondPoints(rx, ry, n = 48) { return Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; const c = Math.cos(a), s = Math.sin(a); return [rx * c, ry * s * (1 - .35 * Math.abs(c) ** 3) * (s > 0 ? 1 : .8)]; }); }

/** The 2D glyph of an eye pose for the right-hand eye (x > 0); the other eye mirrors it. */
export function eyeGlyph(pose, shape, s) {
  const [kx, ky] = EYE_RADII[shape] || EYE_RADII.round, rx = s * kx, ry = s * ky;
  const body = () => shape === 'almond' ? almondPoints(rx, ry) : ellipsePoints(rx, ry);
  const w = Math.max(.012, s * .3);
  switch (pose) {
    case 'arc': return strokeShape(curve(t => [t * s * .95, s * (.42 * (1 - t * t) - .12)]), w);
    case 'squint': return strokeShape(curve(t => [t * s * .85, s * (.14 * (1 - t * t) - .02)]), w * .9);
    case 'shut': return strokeShape(curve(t => [t * s * .9, s * (-.3 * (1 - t * t) + .1)]), w * .85);
    case 'chevron': return strokeShape([[s * .62, s * .55], [-s * .48, 0], [s * .62, -s * .55]], w);
    case 'heart': return heartShape(s * 1.25);
    case 'wide': return polygonShape((shape === 'almond' ? almondPoints(rx * 1.22, ry * 1.3) : ellipsePoints(rx * 1.2, ry * 1.25)));
    // Sad: the lid falls toward the outer corner (+x). Mad: toward the inner corner.
    case 'sad': return polygonShape(clipBelow(body(), [-rx, ry * .5], [rx, -ry * .05]));
    case 'mad': return polygonShape(clipBelow(body(), [-rx, -ry * .05], [rx, ry * .55]));
    default: return polygonShape(body());
  }
}
/** The 2D glyph of a mouth shape or pose, width w. */
export function mouthGlyph(kind, w) {
  const t = Math.max(.012, w * .13);
  switch (kind) {
    case 'smile': return strokeShape(curve(u => [u * w / 2, -w * .2 * (1 - u * u)]), t);
    case 'frown': return strokeShape(curve(u => [u * w * .42, w * .16 * (1 - u * u) - w * .08]), t);
    case 'line': case 'flat': return strokeShape([[-w * .42, 0], [w * .42, 0]], t);
    case 'hmm': return strokeShape(curve(u => [u * w * .4, -u * w * .06 + Math.sin(u * Math.PI) * w * .035]), t);
    case 'cat': return strokeShape(curve(u => [u * w / 2, -w * .16 * Math.abs(Math.sin(Math.PI * u)) + w * .02], 28), t * .85);
    case 'grin': return polygonShape([[-w / 2, 0], ...Array.from({ length: 25 }, (_, i) => { const a = Math.PI + i / 24 * Math.PI; return [Math.cos(a) * w / 2, Math.sin(a) * w * .45]; }), [w / 2, 0]].reverse());
    case 'o': return polygonShape(ellipsePoints(w * .2, w * .24));
    case 'open': return polygonShape(ellipsePoints(w * .42, w * .42));
  }
  return null;
}

// ---------- placing on the surface ----------
// A frame on the surface at a front point: its +z along the normal. A miss (SPEC A.9) is (x, y, 0), facing +z, and
// sets `missed`.
function frameAt(sdf, x, y, lift) {
  const hit = frontPoint(sdf, x, y);
  const p = hit ? new THREE.Vector3(...hit.p) : new THREE.Vector3(x, y, 0), n = hit ? new THREE.Vector3(...hit.n) : Z.clone();
  return { p: p.addScaledVector(n, lift), n, q: new THREE.Quaternion().setFromUnitVectors(Z, n), missed: !hit };
}
// Extrudes a glyph and bends it onto the surface by the rule of SPEC A.9, as a patch is, around its frame moved `offset`
// along the frame's +z (where the mesh will sit).
export function glyphGeometry(shape, { depth, sdf, frame, mirror, offset = 0 }) {
  if (mirror) shape = polygonShape(shape.getPoints(24).map(p => [-p.x, p.y]));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * .5, bevelSize: depth * .45, bevelSegments: 2, curveSegments: 20, steps: 1 });
  g.translate(0, 0, -depth * .6);
  if (!sdf || !frame) return g;
  const origin = frame.p.clone().addScaledVector(frame.n, offset);
  const { geometry } = bendGeometry(g, sdf, new THREE.Matrix4().compose(origin, frame.q, new THREE.Vector3(1, 1, 1)));
  g.dispose();
  return geometry;
}

export class Face {
  constructor(avatar, face) {
    this.avatar = avatar; this.spec = face; this.type = face.type || 'bead';
    // The surface the features sit on: the body and the patches laid on it.
    this.sdf = avatar.faceSdf || avatar.bodySdf;
    this.group = new THREE.Group(); this.group.name = 'face';
    avatar.bodyMesh.add(this.group);
    if (this.type === 'none') return;
    const ink = face.color || '#1C1E23';
    // Features sit in or on the pile so it doesn't hide them (SPEC 7.1, C.1). Thin ink strokes (a mouth, brows, a nose,
    // stitched eyes) half in felt fuzz come out in broken pieces, so on felt they sit above it. `ink(k)` is a stroke's lift.
    const lift = featureLift(avatar.bodyMesh.material.userData.oa?.spec);
    this.lift = lift.feature;
    this.ink = (k = 1) => lift.ink ?? this.lift * k;
    this.depth = this.type === 'drawn' ? .004 : .014;
    // A biped's face heights are written for the default proportions; the face moves with the head (SPEC 6.2).
    this.dy = avatar.faceDy || 0;
    this.flat = color => {
      // Drawn features are painted on, or lit like a screen: unlit, in their exact colors.
      if (this.type === 'drawn') { const m = new THREE.MeshBasicMaterial({ color, toneMapped: false }); avatar.disposables.push(m); return m; }
      const m = new THREE.MeshPhysicalMaterial({ color, roughness: .95, sheen: .6, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), .25), envMap: avatar.envMap, envMapIntensity: .35 });
      avatar.disposables.push(m); return m;
    };
    this.cache = new Map();
    this.buildEyes(face.eyes || {}, ink);
    this.buildMouth(face.mouth || {});
    if (face.cheeks && face.cheeks.show !== 'never') this.buildCheeks(face.cheeks);
    if (face.brows) this.buildBrows(face.brows, ink);
    if (face.nose) this.buildNose(face.nose, ink);
    this.blinkAt = 1.5 + Math.random() * 2; this.blinkT = -1; this.pose = { eyes: 'open', mouth: null };
    this.open = 0; this.cheekW = 0; this.swap = 0;
  }

  /** A frame on the surface at a face position; `path` names the feature in the document, for a miss. */
  at(x, y, lift, path) {
    const frame = frameAt(this.sdf, x, y + this.dy, lift);
    if (frame.missed && path) this.avatar.miss(path, [x, y], 'the body');
    return frame;
  }

  glyphMesh(key, shapeFn, frame, material, mirror, offset = 0) {
    let g = this.cache.get(key);
    if (!g) {
      const shape = shapeFn();
      if (!shape) return null;
      g = glyphGeometry(shape, { depth: this.depth, sdf: this.sdf, frame, mirror, offset });
      this.avatar.disposables.push(g); this.cache.set(key, g);
    }
    const m = new THREE.Mesh(g, material); m.userData.noBounds = true;
    return m;
  }

  // ---------- eyes ----------
  buildEyes(e, ink) {
    const s = e.size ?? .09, sp = e.spacing ?? .3, h = e.height ?? .15, shape = e.shape || 'round';
    this.eyeSpec = { s, shape, blink: e.blink !== false, gaze: e.gaze !== false };
    // Bead eyes are near-black glass; sewn and drawn eyes take the face's ink unless they have their own color.
    const color = e.color || (this.type === 'bead' ? '#040406' : ink);
    this.eyeMat = this.type === 'bead'
      ? new THREE.MeshPhysicalMaterial({ color, roughness: .12, clearcoat: 1, clearcoatRoughness: .04, envMap: this.avatar.envMap, envMapIntensity: 1.2 })
      : this.flat(color);
    this.avatar.disposables.push(this.eyeMat);
    this.inkMat = this.type === 'bead' ? this.flat(color) : this.eyeMat;
    this.eyes = [];
    for (const side of [1, -1]) {
      // side +1 is at +x: the avatar's own left eye (it faces +z).
      const frame = this.at(side * sp, h, this.lift, 'face.eyes');
      const anchor = new THREE.Group(); anchor.position.copy(frame.p); anchor.quaternion.copy(frame.q);
      const holder = new THREE.Group(); anchor.add(holder); this.group.add(anchor);
      const eye = { side, frame, anchor, holder, poses: {}, current: null, bead: null };
      if (this.type === 'bead') {
        const [kx, ky] = EYE_RADII[shape] || EYE_RADII.round;
        const bead = new THREE.Mesh(new THREE.SphereGeometry(s, 32, 20), this.eyeMat);
        bead.scale.set(kx, ky, .55); bead.position.z = -s * .12; bead.userData.noBounds = true;
        this.avatar.disposables.push(bead.geometry);
        if (e.highlight !== false) {
          const hl = new THREE.Mesh(new THREE.SphereGeometry(s * .26, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
          hl.position.set(-s * .32 / kx, s * .36 / ky, s * .9); hl.scale.set(1 / kx, 1 / ky, .5); this.avatar.disposables.push(hl.geometry, hl.material);
          bead.add(hl);
        }
        eye.bead = bead; holder.add(bead);
      }
      this.eyes.push(eye);
    }
  }
  eyeMesh(eye, pose) {
    if (eye.poses[pose]) return eye.poses[pose];
    const { s, shape } = this.eyeSpec;
    const mesh = this.glyphMesh(`eye:${eye.side}:${pose}`, () => eyeGlyph(pose, shape, s), eye.frame, this.inkMat, eye.side < 0, this.ink() - this.lift);
    mesh.position.z = this.ink() - this.lift;
    eye.holder.add(mesh); mesh.visible = false;
    return eye.poses[pose] = mesh;
  }
  setEyePose(eye, pose) {
    // Bead eyes show open, wide, sad and mad through the bead; the rest swap to stitched glyphs.
    const beadPose = this.type === 'bead' && ['open', 'wide', 'sad', 'mad'].includes(pose);
    if (eye.bead) eye.bead.visible = beadPose;
    for (const m of Object.values(eye.poses)) m.visible = false;
    if (!beadPose) this.eyeMesh(eye, pose).visible = true;
    eye.current = pose; eye.beadPose = beadPose ? pose : null;
  }

  // ---------- mouth ----------
  buildMouth(m) {
    const w = m.width ?? .17, h = m.height ?? -.1, shape = m.shape || 'oval';
    this.mouthSpec = { w, shape, speaks: m.speaks !== false };
    if (shape === 'none') { this.mouth = null; return; }
    const frame = this.at(0, h, this.ink(.8), 'face.mouth');
    const anchor = new THREE.Group(); anchor.position.copy(frame.p); anchor.quaternion.copy(frame.q); this.group.add(anchor);
    const color = m.color || '#2A0E17';
    this.mouthMat = this.flat(color);
    this.mouth = { frame, anchor, poses: {}, open: null, beak: null };
    if (shape === 'beak') {
      // A small two-part beak that opens with the voice.
      const mat = new THREE.MeshPhysicalMaterial({ color, roughness: .5, clearcoat: .4, envMap: this.avatar.envMap, envMapIntensity: .6 });
      this.avatar.disposables.push(mat);
      const cone = new THREE.ConeGeometry(w * .36, w * .55, 24).rotateX(Math.PI / 2).translate(0, 0, w * .26);
      this.avatar.disposables.push(cone);
      const top = new THREE.Mesh(cone, mat); top.scale.set(1, .55, 1); top.position.y = w * .06;
      const jaw = new THREE.Group(); const low = new THREE.Mesh(cone, mat); low.scale.set(.85, .4, .8); low.position.y = -w * .06; jaw.add(low);
      for (const o of [top, low]) o.userData.noBounds = true;
      anchor.add(top, jaw); this.mouth.beak = jaw;
    }
  }
  mouthMesh(kind) {
    const mo = this.mouth;
    if (mo.poses[kind] !== undefined) return mo.poses[kind];
    const mesh = this.glyphMesh(`mouth:${kind}`, () => mouthGlyph(kind, this.mouthSpec.w), mo.frame, this.mouthMat);
    if (mesh) { mesh.visible = false; mo.anchor.add(mesh); }
    return mo.poses[kind] = mesh;
  }

  // ---------- cheeks, brows, nose ----------
  buildCheeks(c) {
    const s = c.size ?? .12, sp = c.spacing ?? .5, h = c.height ?? -.02;
    const mat = new THREE.MeshStandardMaterial({ color: c.color || '#FF9DB2', roughness: 1, transparent: true, opacity: .82, depthWrite: false });
    this.avatar.disposables.push(mat);
    this.cheekShow = c.show || 'happy';
    this.cheeks = [1, -1].map(side => {
      const frame = this.at(side * sp, h, this.lift * .7, 'face.cheeks');
      const a = new THREE.Group(); a.position.copy(frame.p); a.quaternion.copy(frame.q); this.group.add(a);
      const m = this.glyphMesh(`cheek:${side}`, () => polygonShape(ellipsePoints(s * .5, s * .36)), frame, mat);
      a.add(m); return a;
    });
  }
  buildBrows(b, ink) {
    const e = this.spec.eyes || {}, L = b.length ?? .12, T = b.thickness ?? .035;
    const h = (e.height ?? .15) + (b.height ?? .12), sp = e.spacing ?? .3;
    const mat = this.flat(b.color || ink);
    this.brows = [1, -1].map(side => {
      const frame = this.at(side * sp, h, this.ink(), 'face.brows');
      const a = new THREE.Group(); a.position.copy(frame.p); a.quaternion.copy(frame.q); this.group.add(a);
      const tilt = new THREE.Group(); a.add(tilt);
      tilt.add(this.glyphMesh(`brow:${side}`, () => strokeShape(curve(u => [u * L / 2, L * .12 * (1 - u * u)]), T), frame, mat));
      return { side, a, tilt, y: 0, r: 0 };
    });
  }
  buildNose(n, ink) {
    const e = this.spec.eyes || {}, m = this.spec.mouth || {}, s = n.size ?? .05;
    const h = n.height ?? ((e.height ?? .15) + (m.height ?? -.1)) / 2;
    const frame = this.at(0, h, n.shape === 'snout' ? -s * .25 : this.ink(), 'face.nose');
    const a = new THREE.Group(); a.position.copy(frame.p); a.quaternion.copy(frame.q); this.group.add(a);
    const color = n.color || ink;
    if (n.shape === 'triangle') a.add(this.glyphMesh('nose', () => strokeShape([[-s * .55, s * .3], [s * .55, s * .3], [0, -s * .4], [-s * .55, s * .3]], s * .35), frame, this.flat(color)));
    else {
      const snout = n.shape === 'snout';
      const mat = snout ? this.avatar.material(this.avatar.document.body.material ?? 'main').material : new THREE.MeshPhysicalMaterial({ color, roughness: .25, clearcoat: .8, envMap: this.avatar.envMap });
      if (!snout) this.avatar.disposables.push(mat);
      const geo = new THREE.SphereGeometry(s, 24, 16); this.avatar.disposables.push(geo);
      const nose = new THREE.Mesh(geo, mat); nose.userData.noBounds = true;
      if (snout) {
        nose.scale.set(1.7, 1.15, 1.1); nose.position.z = s * .5;
        const dotM = new THREE.MeshBasicMaterial({ color }); this.avatar.disposables.push(dotM);
        for (const side of [1, -1]) { const d = new THREE.Mesh(geo, dotM); d.scale.set(.2, .26, .12); d.position.set(side * s * .55, 0, s * 1.55); nose.add(d); }
      } else { nose.scale.set(1.1, .8, .6); }
      a.add(nose);
    }
  }

  // ---------- each frame ----------
  update(t, dt, b) {
    if (this.type === 'none') return;
    const av = this.avatar, inp = av.input, temper = av.document.behavior?.temperament || {};
    const intensity = b.expressionIntensity ?? 1;
    const poses = expressionPoses(av.document, b.expression && intensity >= .3 ? b.expression : 'neutral');
    // Eye pose changes happen behind a quick blink.
    const want = poses.eyes || 'open';
    if (want !== this.pose.eyes && this.swap <= 0) { this.swap = .16; this.nextEyes = want; }
    let lid = 1;
    if (this.swap > 0) { this.swap -= dt; const k = 1 - this.swap / .16; lid = Math.abs(1 - 2 * clamp(k)); if (k >= .5 && this.nextEyes) { this.pose.eyes = this.nextEyes; this.nextEyes = null; } }
    const sleepy = av.weights.get('sleeping');
    // Blinks: every few seconds, faster with a higher blink temperament.
    if (this.eyeSpec.blink && this.swap <= 0) {
      if (t > this.blinkAt) { this.blinkT = 0; this.blinkAt = t + (2.2 + Math.random() * 3.6) / (.5 + (temper.blink ?? .5)); }
      if (this.blinkT >= 0) { this.blinkT += dt; const k = this.blinkT / .14; lid = Math.min(lid, k < 1 ? Math.abs(1 - 2 * k) : 1); if (k >= 1) this.blinkT = -1; }
    }
    lid = Math.max(.08, lid * (1 - .82 * sleepy));
    const gz = this.eyeSpec.gaze ? (av.gaze || { x: 0, y: 0 }) : { x: 0, y: 0 };
    for (const eye of this.eyes) {
      let pose = this.pose.eyes;
      if (pose === 'wink-left') pose = eye.side > 0 ? 'shut' : 'open';
      else if (pose === 'wink-right') pose = eye.side < 0 ? 'shut' : 'open';
      if (sleepy > .9 && pose === 'open') pose = 'shut';
      if (eye.current !== pose) this.setEyePose(eye, pose);
      const glyph = pose !== 'open' && pose !== 'wide' && !eye.beadPose;
      eye.holder.scale.set(1, glyph ? Math.max(lid, .6) : lid, 1);
      const s = this.eyeSpec.s;
      eye.holder.position.set(gz.x * s * .38 * (glyph ? .4 : 1), gz.y * s * .3 * (glyph ? .4 : 1), 0);
      if (eye.bead) {
        const k = eye.beadPose === 'wide' ? 1.22 : 1, sq = eye.beadPose === 'sad' ? .82 : eye.beadPose === 'mad' ? .72 : 1;
        eye.bead.scale.set((EYE_RADII[this.eyeSpec.shape] || [1])[0] * k, (EYE_RADII[this.eyeSpec.shape] || [1, 1])[1] * k * sq, .55);
        // Sad tips the outer end (away from x = 0) down and mad tips it up, as the stitched sad and mad lids do.
        eye.bead.rotation.z = eye.beadPose === 'mad' ? eye.side * .28 : eye.beadPose === 'sad' ? -eye.side * .25 : 0;
      }
    }
    // Mouth: the pose of the expression, or the shape at rest; open while speaking.
    if (this.mouth) {
      const speaking = inp.state === 'speaking' && this.mouthSpec.speaks;
      this.open = ease(this.open, Math.max(speaking ? clamp(inp.voice || 0) : 0, (av.mouthOpen || 0) * .8), dt, .05);
      const vis = { aa: [1, 1], ih: [1.15, .5], ou: [.55, .75], ee: [1.2, .4], oh: [.75, .9] }[inp.viseme] || [.9, .8];
      const mo = this.mouth, open = this.open > .06;
      for (const m of Object.values(mo.poses)) if (m) m.visible = false;
      if (mo.beak) mo.beak.rotation.x = this.open * .5;
      else if (open) {
        const m = this.mouthMesh('open');
        m.visible = true; m.scale.set(vis[0] * (.6 + .4 * this.open), vis[1] * (.25 + .75 * this.open), 1);
      } else {
        const kind = poses.mouth || ({ oval: null, smile: 'smile', line: 'line', cat: 'cat', beak: null }[this.mouthSpec.shape]);
        if (kind) { const m = this.mouthMesh(kind); if (m) { m.visible = true; m.scale.setScalar(1); } }
      }
    }
    // Cheeks flush with happy expressions, or while speaking, as `show` says.
    if (this.cheeks) {
      const happy = ['happy', 'laugh', 'love', 'relaxed'].reduce((a, e) => Math.max(a, av.weights.get(`expr:${e}`)), 0);
      let target = { always: 1, happy, speaking: av.weights.get('speaking'), never: 0 }[this.cheekShow] ?? 0;
      if (poses.cheeks === true) target = 1; else if (poses.cheeks === false) target = 0;
      this.cheekW = ease(this.cheekW, target, dt, .18);
      for (const c of this.cheeks) { c.visible = this.cheekW > .03; c.scale.setScalar(Math.max(1e-3, .4 + .6 * this.cheekW)); }
    }
    // Brows tilt with the eye pose: inner ends down when mad, up when sad, higher when surprised.
    if (this.brows) {
      const p = this.pose.eyes, s = this.eyeSpec.s;
      const r = p === 'mad' ? -.38 : p === 'sad' ? .32 : p === 'squint' ? -.12 : 0, y = p === 'wide' ? s * .45 : p === 'arc' || p === 'chevron' ? s * .2 : p === 'mad' ? -s * .12 : 0;
      for (const br of this.brows) {
        br.r = ease(br.r, r, dt, .1); br.y = ease(br.y, y, dt, .1);
        // Positive r lifts the inner end (toward x = 0).
        br.tilt.rotation.z = -br.side * br.r; br.tilt.position.y = br.y;
      }
    }
  }
}

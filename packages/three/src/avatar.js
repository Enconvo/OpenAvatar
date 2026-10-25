// One OpenAvatar character as a three.js object: the body, its face and its
// parts, moved every frame by the host's inputs (SPEC 12.1). Add `object` to
// your scene, call update() each frame. stage.js wraps it with a renderer,
// camera and lights for pages that just want a character on a canvas.
import * as THREE from 'three';
import { normalize, resolveBehavior, expressionPoses, STATES, ACTIVITIES, USER_ACTIVITIES, EXPRESSIONS, VOCABULARY } from '@openavatar/core';
import { shapeGeometry, cachedBody, bentPatch, extentOf } from './geometry.js';
import { makeMaterial, addShells } from './materials.js';
import { compileShape, frontPoint, shapeBounds, surfaceAlong, smin, smax } from './sdf.js';
import { meshField } from './mesh.js';
import { Face } from './face.js';
import { Motion } from './motion.js';
import { Props } from './props.js';
import { Effects } from './effects.js';
import { Outfits } from './outfits.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const Z = new THREE.Vector3(0, 0, 1);
const V3 = a => new THREE.Vector3(...a);

// ---------- the biped suit (SPEC 6.2) ----------
// A big head, a pear body and two stub legs in one solid, after Enconvo's plush yeti.
function ellipsoidF(x, y, z, a, b, c) { const k0 = Math.hypot(x / a, y / b, z / c), k1 = Math.hypot(x / (a * a), y / (b * b), z / (c * c)); return k1 < 1e-9 ? -Math.min(a, b, c) : k0 * (k0 - 1) / k1; }
function superF(x, y, z, a, b, c, n) { return (Math.pow(Math.pow(Math.abs(x / a), n) + Math.pow(Math.abs(y / b), n) + Math.pow(Math.abs(z / c), n), 1 / n) - 1) * Math.min(a, b, c); }
function legF(x, y, z, lx, top, bottom, r) {
  const ax = Math.abs(x) - lx, h = clamp((y - top) / (bottom - top));
  return Math.hypot(ax, y - (top + (bottom - top) * h), z - .04 * h) - r * (1 + .08 * h);
}
export function bipedSuit(p = {}) {
  const head = p.head ?? .5, body = p.body ?? .5, legs = p.legs ?? .5;
  const hk = .8 + .4 * head, bk = .8 + .4 * body;
  let hw = .7 * hk, hh = .6 * hk, hd = .62 * hk;
  if (p.headShape === 'wide') { hw *= 1.15; hh *= .92; } else if (p.headShape === 'tall') { hh *= 1.15; hw *= .95; }
  let bw = .56 * bk, bh = .56 * bk, bd = .5 * bk;
  if (p.bodyShape === 'round') { bw = bh = Math.max(bw, bh); bd *= 1.08; } else if (p.bodyShape === 'slim') { bw *= .8; bd *= .85; }
  // At the default proportions this is the plush yeti: head at y 0.42, body at -0.36, feet on y = -1.
  let by = -.36, hy = by + .672 * (bh + hh);
  const hasLegs = legs > .02, legLen = .14 + .4 * legs;
  let bottom = hasLegs ? by - bh * .54 - legLen : by - bh * .9;
  const shift = -1 - bottom; by += shift; hy += shift; bottom = -1;
  const headF = p.headShape === 'square' ? (x, y, z) => superF(x, y - hy, z, hw, hh, hd, 3.2) : (x, y, z) => ellipsoidF(x, y - hy, z, hw, hh, hd);
  const torsoF = p.bodyShape === 'square' ? (x, y, z) => superF(x, y - by, z, bw, bh, bd, 3.2)
    : p.bodyShape === 'pear' || !p.bodyShape ? (x, y, z) => ellipsoidF(x, y - by, z, bw * (1 + .12 * clamp(-(y - by) / bh, -1, 1)), bh, bd) : (x, y, z) => ellipsoidF(x, y - by, z, bw, bh, bd);
  const lx = bw * .48, lr = .19 * (.85 + .3 * body);
  const sdf = (x, y, z) => {
    let d = smin(headF(x, y, z), torsoF(x, y, z), .2);
    if (hasLegs) d = smin(d, legF(x, y, z, lx, by - bh * .3, bottom + lr * .6, lr), .1);
    return smax(d, -(y - bottom), .06);
  };
  const W = Math.max(hw, bw * 1.12) + .1, D = Math.max(hd, bd) + .1;
  // A suit that grows past the top of the box (a big head on long legs) is scaled down about its feet (SPEC 4, 6.2).
  const k = Math.min(1, 2.05 / (hy + hh + 1));
  const up = y => -1 + (y + 1) * k;
  return {
    sdf: k === 1 ? sdf : (x, y, z) => k * sdf(x / k, (y + 1) / k - 1, z / k),
    lo: [-W * k, bottom - .05, -D * k], hi: [W * k, up(hy + hh + .05), D * k],
    head: { center: [0, up(hy), 0], radii: [hw * k, hh * k, hd * k] }, torso: { center: [0, up(by), 0], radii: [bw * k, bh * k, bd * k] }, bottom,
  };
}

// Where the default suit puts the head's center; a biped's face heights are written for it (SPEC 6.2).
const DEFAULT_HEAD_Y = bipedSuit().head.center[1];

// ---------- drivers (SPEC 10.2) ----------
class Weights {
  constructor() { this.w = Object.create(null); }
  ease(key, target, dt, tau = .3) { const v = this.w[key] ?? 0; this.w[key] = v + (target - v) * (1 - Math.exp(-dt / tau)); return this.w[key]; }
  get(key) { return this.w[key] ?? 0; }
}

export class OpenAvatar {
  /**
   * @param {object} document an OpenAvatar document (it is normalized here)
   * @param {{ quality?: 'low'|'medium'|'high', envMap?: THREE.Texture }} [options]
   */
  constructor(document, { quality = 'high', envMap = null } = {}) {
    const { document: doc, repairs } = normalize(document);
    this.document = doc; this.repairs = repairs; this.quality = quality; this.envMap = envMap;
    this.object = new THREE.Group(); this.object.name = `openavatar:${doc.id}`;
    this.weights = new Weights();
    this.input = { state: 'idle', voice: 0, mic: 0, viseme: null, activity: null, userActivity: null, expression: null, pointer: null };
    // The layers whose motion played once and ended (SPEC 11.3), each with the situation it ended in.
    this.finished = new Map();
    this.time = 0; this.disposables = []; this.glows = []; this.animated = [];
    // Front points and rays that missed their solid (SPEC A.9): { path, value, target }.
    this.misses = [];
    // The standard expressions and the document's own (SPEC 8.5), each eased as a driver.
    this.expressionIds = [...EXPRESSIONS, ...Object.keys(this.document?.face?.expressions || {}).filter(id => id.startsWith('x-'))];
    this.phase = (doc.id.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 1000) / 1000 * Math.PI * 2;
    this.build();
  }

  // ---------- building ----------
  material(ref) {
    const doc = this.document, mats = doc.materials || {};
    const bodyRef = doc.body.material ?? 'main';
    let spec = typeof ref === 'object' && ref ? ref : mats[ref];
    if (!spec && ref !== bodyRef) spec = typeof bodyRef === 'object' ? bodyRef : mats[bodyRef];
    if (!spec) spec = { type: 'felt', color: '#9AA4B2' };
    const made = makeMaterial(spec, { envMap: this.envMap, quality: this.quality });
    this.disposables.push(made.material);
    if (made.glow) this.glows.push({ material: made.material, ...made.glow });
    return { ...made, spec };
  }
  mesh(geometry, made, sdf) {
    const mesh = new THREE.Mesh(geometry, made.material), pattern = made.spec.pattern;
    // A gradient runs from the lowest to the highest point of the first solid its material colors (SPEC 7.2); set
    // before the shells copy the material.
    if (pattern?.type === 'gradient' && !made.material.userData.oaRange) {
      const i = 'xyz'.indexOf(pattern.axis || 'y'), e = extentOf(geometry, sdf);
      made.material.userData.oaRange = [e.lo[i], e.hi[i]];
    }
    for (const m of addShells(mesh, made.material, made.shells, made.spec)) { this.disposables.push(m); if (made.glow) this.glows.push({ material: m, ...made.glow }); }
    if (made.spec.type === 'toon') {
      // An inverted hull: the back faces pushed out along the normal draw the outline (SPEC 7.1).
      const outline = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x15161a, side: THREE.BackSide }));
      outline.material.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed+=normalize(normal)*.022;'); };
      this.disposables.push(outline.material); mesh.add(outline);
    }
    return mesh;
  }

  build() {
    const doc = this.document, body = doc.body;
    // root: placed by the stage; motion: the whole-body moves; shell: squash and stretch.
    this.root = new THREE.Group(); this.motionGroup = new THREE.Group(); this.squash = new THREE.Group();
    this.object.add(this.root); this.root.add(this.motionGroup); this.motionGroup.add(this.squash);
    const made = this.material(body.material ?? 'main');
    if (body.rig === 'biped') {
      // Meshed once per proportions, shape and quality and shared, like a shape's mesh: avatars that differ only in
      // their face, colors or parts (an editor's tiles) don't mesh the suit again.
      const key = `biped:${this.quality}:${JSON.stringify(body.proportions ?? {})}:${JSON.stringify(body.shape ?? null)}`;
      const { geometry, sdf, lo, hi, suit } = cachedBody(key, () => {
        const suit = bipedSuit(body.proportions);
        let sdf = suit.sdf, lo = suit.lo, hi = suit.hi, mlo = lo, mhi = hi;
        if (body.shape) {
          const extra = compileShape(body.shape), own = sdf, box = shapeBounds(body.shape);
          sdf = (x, y, z) => smin(own(x, y, z), extra(x, y, z), .06);
          // Mesh what the shape adds past the suit too (ears grown from the head); the suit still sets where it stands.
          if (box) { mlo = lo.map((v, i) => Math.min(v, box.lo[i] - .06)); mhi = hi.map((v, i) => Math.max(v, box.hi[i] + .06)); }
        }
        const m = meshField(sdf, { lo: mlo, hi: mhi }, { cells: { low: 64, medium: 88, high: 112 }[this.quality], fit: true });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3)); g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2)); g.setIndex(new THREE.BufferAttribute(m.indices, 1)); g.computeBoundingBox();
        return { geometry: g, sdf, lo, hi, suit };
      });
      this.bodySdf = sdf; this.bodyBounds = { lo, hi }; this.suit = suit;
      this.faceDy = suit.head.center[1] - DEFAULT_HEAD_Y;
      this.bodyMesh = this.mesh(geometry, made, sdf);
    } else {
      const sg = shapeGeometry(body.shape, { quality: this.quality });
      const fallback = sg || shapeGeometry({ type: 'sphere', radius: .9 }, { quality: this.quality });
      this.bodySdf = fallback.sdf; this.bodyBounds = fallback.bounds;
      this.bodyMesh = this.mesh(fallback.geometry, made, fallback.sdf);
    }
    this.squash.add(this.bodyMesh);
    this.bodyGlow = made.glow;
    // The body's lowest and highest points, found on its field: the box worked out from a shape's members can be larger
    // (a subtract keeps its first child's). Its center is halfway between them (SPEC 9.1), and it squashes about its
    // lowest point when it stands and its center when it floats.
    this.bodyExtent = extentOf(this.bodyMesh.geometry, this.bodySdf);
    const mid = (this.bodyExtent.lo[1] + this.bodyExtent.hi[1]) / 2;
    this.float = body.anchor === 'float';
    const pivotY = this.float ? mid : this.bodyExtent.lo[1];
    this.pivotY = pivotY; this.motionGroup.position.y = pivotY; this.bodyMesh.position.y = -pivotY;
    // `pile` is how far its fuzz or fur stands off the surface, which a patch laid on it clears.
    const pile = made.shells?.length ?? 0;
    this.targets = { body: { groups: [this.bodyMesh], sdf: this.bodySdf, center: [0, mid, 0], name: 'the body', pile } };
    if (this.suit) {
      // A biped's head is a space of its own, centered on the head, so what sits on it follows the proportions.
      const [cx, cy, cz] = this.suit.head.center, head = new THREE.Group(), f = this.bodySdf;
      head.position.set(cx, cy, cz); this.bodyMesh.add(head);
      this.targets.head = { groups: [head], sdf: (x, y, z) => f(x + cx, y + cy, z + cz), center: [0, 0, 0], name: 'the head', pile };
    } else this.targets.head = this.targets.body;
    this.buildArms();
    this.buildParts();
    // The face goes on last, on the body and the patches laid on it (SPEC 8), so a patch never covers it.
    this.faceSdf = this.restingSdf(e => e.part.patch);
    this.face = new Face(this, doc.face || {});
    this.motion = new Motion(this);
    this.computeBounds();
    this.props = new Props(this);
    this.effects = new Effects(this);
    this.outfits = new Outfits(this);
    this.outfits.wear(doc.outfit || null);
  }

  /** Notes a front point or ray that missed its solid (SPEC A.9), once per path, for checkers to report. */
  miss(path, value, target) { if (!this.misses.some(m => m.path === path)) this.misses.push({ path, value, target }); }

  // Where a part goes on its target (SPEC 9.1): a frame { position, quaternion } in the target's space, and whether it
  // is on the surface. `path` names the attachment in the document, for a miss.
  placement(attach = {}, target, mirrored, path) {
    const flip = a => mirrored ? [-a[0], ...a.slice(1)] : a;
    const q = new THREE.Quaternion(), pos = new THREE.Vector3();
    let hit = null;
    if (attach.at) hit = frontPoint(target.sdf, ...flip(attach.at));
    // A direction of length 0 points nowhere, so it misses (SPEC A.9).
    else if (attach.direction?.some(Boolean)) hit = surfaceAlong(target.sdf, target.center, flip(attach.direction));
    if (hit) {
      pos.set(...hit.p).addScaledVector(V3(hit.n), attach.lift || 0);
      if ((attach.align || 'surface') === 'surface') q.setFromUnitVectors(Z, V3(hit.n));
    } else if (attach.position) pos.set(...flip(attach.position));
    else if (attach.at || attach.direction) {
      // A miss (SPEC A.9) acts as a surface facing +z: at (x, y, 0) of the target's space for a front point, at the
      // target's center for a ray. So it stays unturned, and `lift` moves it along +z.
      pos.set(...(attach.at ? [...flip(attach.at), 0] : flip(target.center))).z += attach.lift || 0;
      if (path) this.miss(`${path}.${attach.at ? 'at' : 'direction'}`, attach.at || attach.direction, target.name);
    }
    if (attach.rotation?.some(Boolean)) {
      // As for shapes: first about x, then y, then z (an extrinsic turn, which three.js calls 'ZYX'), about the
      // part's own axes as align left them.
      const r = attach.rotation.map(v => v * Math.PI / 180);
      q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], mirrored ? -r[1] : r[1], mirrored ? -r[2] : r[2], 'ZYX')));
    }
    return { pos, q, onSurface: !!hit };
  }

  buildParts() {
    this.parts = new Map();
    for (const [index, part] of (this.document.parts || []).entries()) {
      const made = this.material(part.material);
      let geo;
      if (part.patch) {
        // A patch: the outline as a thin felt cut-out, bent onto the surface at its attach point below.
        geo = shapeGeometry({ type: 'extrusion', depth: .02, rounding: .008, puff: .4, outline: part.patch }, { quality: this.quality, limit: 5 });
      } else geo = shapeGeometry(part.shape, { quality: this.quality, limit: 5 });
      if (!geo) continue;
      const target = this.targets[part.attach?.to || 'body'] || this.targets.body;
      const copies = [];
      // On a mirrored part it goes on both copies: the copy under the mirrored one is mirrored with it (SPEC 9.1).
      // In a hand, its mirror is the same part in the other hand, whose space is already the mirror image.
      const places = target.hand
        ? [[target.groups[0], false], ...(part.mirror === 'x' ? [[this.targets[target.hand].groups[0], true]] : [])]
        : target.groups.flatMap(g => (part.mirror === 'x' ? [false, true] : [false]).map(m => [g, m]));
      // A part that appears only in some situations is hidden at rest: it doesn't move the frame or the effects.
      const restsHidden = (part.animations || []).some(a => a.type === 'appear' && !['always', 'idle'].includes(a.driver ?? 'always'));
      for (const [group, mirrored] of places) {
        const flip = mirrored && !target.hand;
        const anchor = new THREE.Group(), pivot = new THREE.Group();
        // On a bent patch, each copy has a surface of its own.
        const on = target.copyOf?.(group) || target;
        // A patch sits `lift` off the surface (0.006 unless given), and at least far enough out that the surface's fuzz
        // or fur doesn't show through its face, which is 0.01 above its middle.
        const attach = part.patch ? { ...part.attach, lift: Math.max(part.attach?.lift ?? .006, (target.pile ?? 0) - .008) } : part.attach;
        const { pos, q, onSurface } = this.placement(attach, on, flip, copies.length ? null : `parts[${index}].attach`);
        anchor.position.copy(pos); anchor.quaternion.copy(q);
        if (flip) anchor.scale.x = -1;
        // A patch on the surface is bent onto it, each copy onto the surface under it; one placed by `position`, or
        // that missed, stays flat.
        let { geometry, sdf } = geo;
        if (part.patch && onSurface) { anchor.updateMatrix(); ({ geometry, sdf } = bentPatch(geo, on.sdf, anchor.matrix)); this.disposables.push(geometry); }
        const pv = part.pivot || [0, 0, 0];
        pivot.position.set(...pv);
        const mesh = this.mesh(geometry, made, sdf);
        mesh.position.set(-pv[0], -pv[1], -pv[2]); mesh.userData.restsHidden = restsHidden;
        pivot.add(mesh); anchor.add(pivot); group.add(anchor);
        // Its center (SPEC A.9) is halfway between its lowest and highest points on each axis.
        const pe = extentOf(geometry, sdf), center = [0, 1, 2].map(i => (pe.lo[i] + pe.hi[i]) / 2);
        copies.push({ anchor, pivot, mesh, mirrored, sdf, center, rest: { pos: pivot.position.clone(), quat: pivot.quaternion.clone() } });
      }
      if (!copies.length) continue;
      const entry = { part, copies, made, sdf: copies[0].sdf, center: copies[0].center };
      // Parts attached to this one hang on every copy's mesh, in its own space. A part id never shadows the
      // body, the head or a hand.
      if (!VOCABULARY.attachTargets.includes(part.id)) {
        const name = `part "${part.id}"`;
        this.targets[part.id] = { groups: copies.map(c => c.mesh), sdf: entry.sdf, center: entry.center, name, pile: made.shells?.length ?? 0, copyOf: g => { const c = copies.find(c => c.mesh === g); return c && { sdf: c.sdf, center: c.center, name }; } };
      }
      this.parts.set(part.id, entry);
      if (part.animations?.length) this.animated.push(entry);
    }
  }

  buildArms() {
    const doc = this.document, a = doc.body.arms || {};
    const style = a.style ?? (doc.body.rig === 'biped' ? 'nub' : 'none');
    this.arms = [];
    // At the defaults these are the plush yeti's arms: 0.46 long, 0.15 thick, hanging 0.42 rad out.
    const length = .26 + .4 * (a.length ?? doc.body.proportions?.arms ?? .5), r = .08 + .14 * (a.thickness ?? .5);
    const shape = style === 'paw'
      ? { type: 'union', smooth: .04, children: [{ type: 'capsule', from: [0, 0, 0], to: [0, -length + r * .3, 0], radius: r * .9 }, { type: 'sphere', radius: r * 1.2, position: [0, -length + r * .3, 0] }] }
      : { type: 'capsule', from: [0, 0, 0], to: [0, -length, 0], radius: r * 1.1, radiusTo: r };
    const geo = style === 'none' ? null : shapeGeometry(shape, { quality: this.quality, limit: 5 });
    const made = geo && (a.material ? this.material(a.material) : this.material(doc.body.material ?? 'main'));
    let shoulder;
    if (this.suit) { const t = this.suit.torso; shoulder = [t.radii[0] * .9, t.center[1] + t.radii[1] * .5, .04]; }
    else {
      const { lo, hi } = this.bodyExtent, at = a.at || [Math.min(.9, hi[0] * .85), (lo[1] + hi[1]) / 2 - .1];
      const hit = frontPoint(this.bodySdf, ...at); shoulder = hit ? [hit.p[0], hit.p[1], hit.p[2] * .4] : [at[0], at[1], 0];
      if (!hit && a.at) this.miss('body.arms.at', a.at, 'the body');
    }
    // The hands (SPEC 9.1): a space at each arm's tip that turns with the arm; the right hand's mirrors the left's.
    // Without arms they stay where the tips would hang.
    const tip = style === 'paw' ? -length + r * .3 : -length;
    const armSdf = geo ? geo.sdf : (x, y, z) => Math.hypot(x, y - tip, z) - r;
    // The hand's space undoes the arm's outward hang, so it is upright while the arm rests.
    const rest = .42, cr = Math.cos(rest), sr = Math.sin(rest);
    const handSdf = (x, y, z) => armSdf(cr * x + sr * y, cr * y - sr * x + tip, z);
    for (const side of [1, -1]) {
      const g = new THREE.Group(); g.position.set(side * shoulder[0], shoulder[1], shoulder[2]);
      g.rotation.z = side * rest;
      this.bodyMesh.add(g);
      if (geo) { g.add(this.mesh(geo.geometry, made, geo.sdf)); this.arms.push({ group: g, side, length, rest }); }
      const hand = new THREE.Group(); hand.position.y = tip; hand.rotation.z = -side * rest; hand.scale.x = side; hand.userData.hand = true; g.add(hand);
      this.targets[side > 0 ? 'left-hand' : 'right-hand'] = { groups: [hand], sdf: handSdf, center: [0, 0, 0], hand: side > 0 ? 'right-hand' : 'left-hand', name: side > 0 ? 'the left hand' : 'the right hand', pile: made?.shells?.length ?? 0 };
    }
  }

  /**
   * The body joined with the resting parts that `keep(entry)` picks, in the body's space: the parts on the body,
   * the head or other parts that show at rest, not those held in a hand.
   */
  restingSdf(keep = () => true) {
    this.object.updateMatrixWorld(true);
    const inv = this.bodyMesh.matrixWorld.clone().invert(), pieces = [];
    const held = o => { for (; o && o !== this.bodyMesh; o = o.parent) if (o.userData.hand || o.userData.restsHidden) return true; return false; };
    for (const e of this.parts.values()) {
      if (!keep(e)) continue;
      for (const c of e.copies) if (!held(c.mesh)) pieces.push({ m: inv.clone().multiply(c.mesh.matrixWorld).invert().elements, f: c.sdf });
    }
    const body = this.bodySdf;
    if (!pieces.length) return body;
    return (x, y, z) => {
      let d = body(x, y, z);
      for (const { m, f } of pieces) d = Math.min(d, f(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]));
      return d;
    };
  }

  computeBounds() {
    // The resting body, its parts and arms; props, effects and the face's small pieces don't move the frame.
    this.object.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const visit = o => {
      if (!o.visible || o.userData.noBounds || o.userData.restsHidden) return;
      if (o.isMesh && o.geometry) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); }
      for (const c of o.children) visit(c);
    };
    visit(this.object);
    this.bounds = box;
  }

  /**
   * The box of what computeBounds measures, seen turned by `yaw` radians about y, from the meshes' vertices as they
   * are now: a turned box would grow at its corners, framing a wide flat part too loosely.
   */
  viewBounds(yaw = 0) {
    this.object.updateMatrixWorld(true);
    const m = new THREE.Matrix4().makeRotationY(yaw).multiply(this.object.matrixWorld.clone().invert());
    const box = new THREE.Box3(), v = new THREE.Vector3(), t = new THREE.Matrix4();
    const visit = o => {
      if (!o.visible || o.userData.noBounds || o.userData.restsHidden || o.userData.shell) return;
      if (o.isMesh && o.geometry) {
        t.multiplyMatrices(m, o.matrixWorld);
        const p = o.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(t));
      }
      for (const c of o.children) visit(c);
    };
    visit(this.object);
    return box.isEmpty() ? this.bounds.clone().applyMatrix4(new THREE.Matrix4().makeRotationY(yaw)) : box;
  }

  // ---------- each frame ----------
  /** Sets host inputs (SPEC 12.1); omitted members keep their value. */
  setInput(input) {
    Object.assign(this.input, input);
    // `outfit` is a host command (SPEC 12.2): an id puts it on, null takes it off.
    if (input && 'outfit' in input) this.outfits.wear(input.outfit || null);
    if (typeof this.input.expression === 'string') this.input.expression = { id: this.input.expression, strength: 1 };
  }
  /** Plays a motion on top of everything (SPEC 12.2), once or, with `loop`, until stop(). Returns how long one play lasts, in seconds. */
  play(id, { loop = false } = {}) { return this.motion.command(id, { loop }); }
  stop() { this.motion.command(null); }

  /** Advances the avatar by dt seconds. */
  update(dt = 1 / 60) {
    dt = Math.min(Math.max(dt, 0), .1);
    this.time += dt;
    const t = this.time, inp = this.input, W = this.weights;
    // Conversation state weights (11.3), activities, user activities.
    for (const s of STATES) W.ease(s, inp.state === s ? 1 : 0, dt);
    for (const a of ACTIVITIES) W.ease(a, inp.activity === a ? 1 : 0, dt, a === 'sleeping' ? 1.2 : .3);
    for (const a of USER_ACTIVITIES) W.ease(a, inp.userActivity === a ? 1 : 0, dt, .5);
    W.w.voice = inp.state === 'speaking' ? clamp(inp.voice || 0) : 0;
    W.w.mic = inp.state === 'listening' ? clamp(inp.mic || 0) : 0;
    W.w.active = 1 - W.get('idle');
    W.ease('pointer', inp.pointer && Math.hypot(inp.pointer[0] ?? inp.pointer.x, inp.pointer[1] ?? inp.pointer.y) < .5 ? 1 : 0, dt, .2);
    W.w.always = 1;
    // What the layers resolve to (11.3). A layer whose motion played once keeps it off until its situation changes.
    for (const [layer, at] of this.finished) if (this.situation(layer) !== at) this.finished.delete(layer);
    const b = resolveBehavior(this.document, {
      state: inp.state, activity: inp.activity, userActivity: inp.userActivity,
      expression: inp.expression?.id || null, expressionIntensity: inp.expression?.strength ?? 1, command: this.motion.commanded,
      finished: [...this.finished.keys()],
    });
    this.behavior = b;
    for (const e of this.expressionIds) W.ease(`expr:${e}`, b.expression === e ? b.expressionIntensity : 0, dt, .25);
    for (const g of this.glows) g.material.emissiveIntensity = this.glowLevel(g);
    this.motion.update(t, dt, b);
    this.face.update(t, dt, b);
    this.updateParts(t, dt);
    this.props.update(t, dt, b);
    this.outfits.update(t, dt);
    // The effect the layers resolve to, and the one the document gives the expression (8.5).
    const shown = new Set();
    if (b.effect) shown.add(b.effect);
    const own = b.expression && !b.quiet ? expressionPoses(this.document, b.expression).effect : null;
    if (own && (b.expressionIntensity ?? 1) >= .3) shown.add(own);
    this.effects.update(t, dt, shown);
  }

  /** The situation a layer of SPEC 11.3 holds for now: a state's layer while it is the state, the activities' ids. */
  situation(layer) {
    const inp = this.input;
    return layer === 'activity' ? inp.activity : layer === 'userActivity' ? inp.userActivity : inp.state === layer ? layer : null;
  }
  /** Notes that a layer's motion played to its end (SPEC 11.3). */
  finish(layer) { const at = this.situation(layer); if (at) this.finished.set(layer, at); }

  /** A driver's weight now (SPEC 10.2). */
  drive(driver) {
    if (!driver || driver === 'always') return 1;
    // A state's name is the state, though `thinking` is an expression too (SPEC 10.2).
    if (!STATES.includes(driver) && this.expressionIds.includes(driver)) return this.weights.get(`expr:${driver}`);
    return this.weights.get(driver);
  }

  // A material's glow (SPEC 7.3): its base, and the rest of the way to full with the driver's weight.
  glowLevel(g) { return g.intensity * (g.base + (1 - g.base) * this.drive(g.driver)); }

  updateParts(t, dt) {
    for (const entry of this.animated) {
      let glow = 0, hasGlow = false;
      for (const c of entry.copies) {
        c.pivot.position.copy(c.rest.pos); c.pivot.quaternion.copy(c.rest.quat); c.pivot.scale.setScalar(1); c.mesh.visible = true;
      }
      for (const a of entry.part.animations) {
        // The curves of SPEC 10.1, with u = speed·t + phase.
        const w = this.drive(a.driver), speed = a.speed ?? VOCABULARY.animationTypes[a.type]?.speed ?? 1, ph = (a.phase || 0) * Math.PI * 2;
        const s = Math.sin(t * speed * Math.PI * 2 + ph);
        const axis = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }[a.axis || (a.type === 'spin' ? 'y' : a.type === 'bob' || a.type === 'drift' ? 'y' : 'z')];
        const key = `spin:${entry.part.id}:${entry.part.animations.indexOf(a)}`;
        for (const c of entry.copies) {
          const turn = deg => c.pivot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, deg * Math.PI / 180));
          switch (a.type) {
            case 'sway': turn((a.amount ?? 10) * s * w); break;
            case 'wiggle': turn((a.amount ?? 6) * w * (Math.sin(2 * Math.PI * 1.2 * speed * t + ph) * .6 + Math.sin(2 * Math.PI * 2 * speed * t + ph * 2) * .4)); break;
            case 'flap': turn((a.amount ?? 25) * w * Math.abs(s)); break;
            case 'bob': c.pivot.position.addScaledVector(axis, (a.amount ?? .05) * s * w); break;
            case 'pulse': c.pivot.scale.multiplyScalar(1 + (a.amount ?? .15) * (.5 + .5 * s) * w); break;
            case 'appear': { const v = clamp(w); if (v < .02) c.mesh.visible = false; c.pivot.scale.multiplyScalar(Math.max(1e-4, v < 1 ? 1 + 2.4 * (v - 1) ** 3 + 1.4 * (v - 1) ** 2 : 1)); break; }
            case 'drift': {
              const k = ((t * speed + (a.phase || 0)) % 1 + 1) % 1, v = clamp(w);
              c.pivot.position.addScaledVector(axis, (a.amount ?? -.6) * k);
              c.pivot.scale.multiplyScalar(Math.max(1e-4, v * Math.sin(Math.PI * k) ** .5));
              if (v < .02) c.mesh.visible = false;
              break;
            }
            case 'spin': {
              // Turns while the driver holds, then slows and settles back to rest, on the nearest whole turn.
              const st = this.spins ||= new Map(); let ang = st.get(key) ?? 0;
              if (c === entry.copies[0]) {
                ang += dt * speed * Math.PI * 2 * w;
                if (w < .08) { const rest = Math.round(ang / (2 * Math.PI)) * 2 * Math.PI; ang += (rest - ang) * (1 - Math.exp(-dt * 5)); }
                st.set(key, ang);
              }
              c.pivot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, ang));
              break;
            }
            case 'glow': glow = Math.max(glow, clamp(a.amount ?? 1, 0, 4) * w); hasGlow = true; break;
          }
        }
      }
      if (hasGlow) {
        const m = entry.made.material;
        if (!entry.made.glow && !entry.glowColor) { entry.glowColor = new THREE.Color(entry.made.spec.color || '#9AA4B2'); m.emissive = entry.glowColor; }
        m.emissiveIntensity = (entry.made.glow ? this.glowLevel(entry.made.glow) : 0) + glow;
      }
    }
  }

  dispose() {
    for (const d of this.disposables) d.dispose?.();
    this.object.removeFromParent();
  }
}

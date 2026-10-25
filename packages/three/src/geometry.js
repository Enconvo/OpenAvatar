// Shapes as three.js geometry. A single primitive with no deformers, rounding
// or inflate uses three.js's own geometry (exact and fast); anything else is
// meshed from its distance field. Meshes are kept per shape and quality, so a
// shape that appears twice, or on a second avatar, is meshed once.
import * as THREE from 'three';
import { compileShape, shapeBounds, inverseRotation } from './sdf.js';
import { meshField } from './mesh.js';

const CACHE = new Map();
const CELLS = { low: 64, medium: 88, high: 112 };

function plain(s) {
  if (s.deform?.length || s.inflate || s.mirror) return null;
  switch (s.type) {
    case 'sphere': return new THREE.SphereGeometry(s.radius, 48, 32);
    case 'ellipsoid': return new THREE.SphereGeometry(1, 48, 32).scale(...s.radii);
    case 'cylinder': return s.rounding ? null : new THREE.CylinderGeometry(s.radius, s.radius, s.height, 48, 1);
    case 'cone': return s.rounding ? null : new THREE.CylinderGeometry(s.radiusTop ?? 0, s.radius, s.height, 48, 1);
    case 'torus': return new THREE.TorusGeometry(s.radius, s.thickness, 24, 72).rotateX(Math.PI / 2);
    case 'box': return s.rounding ? null : new THREE.BoxGeometry(...s.size);
    case 'capsule': {
      if ((s.radiusTo ?? s.radius) !== s.radius) return null;
      const a = new THREE.Vector3(...s.from), b = new THREE.Vector3(...s.to), d = b.clone().sub(a), l = d.length();
      const g = new THREE.CapsuleGeometry(s.radius, l, 8, 24);
      if (l > 1e-6) g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
      return g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());
    }
  }
  return null;
}
function place(g, s) {
  const sc = s.scale ?? 1, S = Array.isArray(sc) ? sc : [sc, sc, sc];
  g.scale(...S);
  if (s.rotation?.some(Boolean)) {
    // The forward rotation is the transpose of the inverse that sdf.js uses.
    const M = inverseRotation(s.rotation);
    g.applyMatrix4(new THREE.Matrix4().set(M[0], M[3], M[6], 0, M[1], M[4], M[7], 0, M[2], M[5], M[8], 0, 0, 0, 0, 1));
  }
  if (s.position) g.translate(...s.position);
  return g;
}
function fromArrays(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  return g;
}

/**
 * A solid's lowest and highest points on each axis (SPEC A.9, 7.2), found on its field `sdf` so the result does not
 * depend on how finely the solid was meshed. `positions` is its mesh's position array, which starts the search on each
 * side at the outermost vertex. Returns { lo, hi }.
 *
 * Seen along an axis, the solid's surface is a height over the other two; its top is the extreme. A height comes from
 * a ray traced inward and a root refined by the Illinois method, and the top from a pattern search that tries eight
 * directions, keeps going the way that gained (so it runs along a ridge, such as a puffed outline's crest, instead of
 * stalling across it), and halves its step until 1e-7.
 */
export function solidExtent(sdf, positions) {
  const n = positions.length / 3, lo = [0, 0, 0], hi = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const [u, v] = [0, 1, 2].filter(i => i !== axis);
    let best = 0;
    for (let k = 1; k < n; k++) if (sign * (positions[k * 3 + axis] - positions[best * 3 + axis]) > 0) best = k;
    const f = (a, b, x) => { const p = [0, 0, 0]; p[axis] = x; p[u] = a; p[v] = b; return sdf(...p); };
    const floor = positions[best * 3 + axis] - sign * .25;
    let h = positions[best * 3 + axis], s = .01;
    // The outermost point of the solid along the axis over (a, b): traced inward from just past the best so far.
    const height = (a, b) => {
      let out = h + sign * (2 * s + 1e-4), dOut = f(a, b, out);
      for (let g = 0; dOut <= 0 && g < 60; g++) { out += sign * .05; dOut = f(a, b, out); }
      if (dOut <= 0) return sign * Infinity;
      let inn = out, dIn = dOut;
      for (let g = 0; dIn > 0; g++) {
        if (g > 400 || sign * (inn - floor) < 0) return -sign * Infinity;
        out = inn; dOut = dIn; inn -= sign * Math.max(dIn * .9, 1e-6); dIn = f(a, b, inn);
      }
      for (let g = 0, side = 0; g < 60 && Math.abs(out - inn) > 1e-12; g++) {
        const x = (inn * dOut - out * dIn) / (dOut - dIn), d = f(a, b, x);
        if (d > 0) { out = x; dOut = d; if (side === 1) dIn /= 2; side = 1; } else { inn = x; dIn = d; if (side === -1) dOut /= 2; side = -1; }
        if (d === 0) break;
      }
      return inn;
    };
    let a = positions[best * 3 + u], b = positions[best * 3 + v];
    h = height(a, b);
    if (!Number.isFinite(h)) { h = positions[best * 3 + axis]; s = 0; }
    for (let turn = 0; s > 1e-7; turn++) {
      let moved = false;
      for (let k = 0; k < 8 && !moved; k++) {
        const th = (k + (turn % 2) / 2) * Math.PI / 4, da = s * Math.cos(th), db = s * Math.sin(th);
        for (let t = height(a + da, b + db); sign * (t - h) > 0 && Number.isFinite(t); t = height(a + da, b + db)) { a += da; b += db; h = t; moved = true; }
      }
      if (!moved) s /= 2;
    }
    (sign < 0 ? lo : hi)[axis] = h;
  }
  return { lo, hi };
}

/** solidExtent of a geometry and the field it was meshed from, kept on the geometry (meshes are shared per shape). */
export function extentOf(geometry, sdf) {
  if (!geometry.userData.extent) geometry.userData.extent = solidExtent(sdf, geometry.attributes.position.array);
  return geometry.userData.extent;
}

/**
 * Geometry for a shape in its own space, with its distance field and bounds.
 * @returns {{ geometry: THREE.BufferGeometry, sdf: Function, bounds: {lo:number[],hi:number[]} } | null}
 */
export function shapeGeometry(s, { quality = 'high', limit = 1.6 } = {}) {
  const key = `${quality}:${limit}:${JSON.stringify(s)}`;
  let hit = CACHE.get(key);
  if (!hit) {
    const sdf = compileShape(s), bounds = shapeBounds(s);
    if (!bounds) return null;
    let geometry = plain(s);
    if (geometry) place(geometry, s);
    else {
      const m = meshField(sdf, bounds, { cells: CELLS[quality] || CELLS.high, limit, fit: true });
      if (!m.indices.length) return null;
      geometry = fromArrays(m);
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    hit = { geometry, sdf, bounds };
    CACHE.set(key, hit);
    if (CACHE.size > 400) CACHE.delete(CACHE.keys().next().value);
  }
  return { geometry: hit.geometry, sdf: hit.sdf, bounds: hit.bounds };
}

/**
 * How far each point (x, y) of a patch's plane moves along its +z to meet the surface (SPEC A.9): the root of
 * g(t) = field(B + t·n) − field(origin) nearest 0 within 0.25, or where |g| is least when there is none. `field` is the
 * surface's field in the space the patch is placed in, and `matrix` places the patch's own space there, its +z along
 * the normal. Found by stepping out from 0 on both sides and halving the steps that cross, so two roots closer than a
 * step on one side are missed; without a crossing, by a golden section search about the least step.
 */
export function patchDepth(field, matrix) {
  const e = matrix.elements, o = [e[12], e[13], e[14]], ax = [e[0], e[1], e[2]], ay = [e[4], e[5], e[6]];
  const n = new THREE.Vector3(e[8], e[9], e[10]).normalize().toArray(), level = field(...o);
  const REACH = .25, H = .02, K = Math.ceil(REACH / H);
  return (x, y) => {
    const b = [0, 1, 2].map(i => o[i] + x * ax[i] + y * ay[i]);
    const g = t => field(b[0] + t * n[0], b[1] + t * n[1], b[2] + t * n[2]) - level;
    const g0 = g(0), last = { 1: g0, [-1]: g0 };
    if (g0 === 0) return 0;
    let best = 0, least = Math.abs(g0);
    for (let k = 1; k <= K; k++) {
      let root = null;
      for (const side of [1, -1]) {
        const t = side * Math.min(k * H, REACH), v = g(t);
        if (Math.sign(v) !== Math.sign(last[side])) {
          let a = side * (k - 1) * H, fa = last[side], c = t;
          for (let i = 0; i < 14; i++) { const m = (a + c) / 2, fm = g(m); if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else c = m; }
          if (root === null || Math.abs((a + c) / 2) < Math.abs(root)) root = (a + c) / 2;
        }
        last[side] = v;
        if (Math.abs(v) < least) { least = Math.abs(v); best = t; }
      }
      if (root !== null) return root;
    }
    let a = Math.max(-REACH, best - H), c = Math.min(REACH, best + H);
    for (let i = 0; i < 24; i++) {
      const m1 = c - .618 * (c - a), m2 = a + .618 * (c - a);
      if (Math.abs(g(m1)) < Math.abs(g(m2))) c = m2; else a = m1;
    }
    return (a + c) / 2;
  };
}

/**
 * A geometry bent onto a surface by the rule of SPEC A.9: each point moves along +z by the depth under it, so the
 * geometry's z = 0 follows the surface at the height of its origin and its thickness rides along. `field` and `matrix`
 * are as for patchDepth. Returns a new geometry (the caller disposes of it) and the depth `at(x, y)` it used.
 */
export function bendGeometry(geometry, field, matrix) {
  const depth = patchDepth(field, matrix);
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  // The depth on a grid over the geometry, about 0.015 apart, read between the points by bilinear interpolation.
  const bb = geometry.boundingBox, x0 = bb.min.x, y0 = bb.min.y;
  const nx = Math.min(64, Math.max(6, Math.ceil((bb.max.x - x0) / .015) + 1)), ny = Math.min(64, Math.max(6, Math.ceil((bb.max.y - y0) / .015) + 1));
  const dx = (bb.max.x - x0) / (nx - 1) || 1, dy = (bb.max.y - y0) / (ny - 1) || 1, grid = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) grid[j * nx + i] = depth(x0 + i * dx, y0 + j * dy);
  const at = (x, y) => {
    const u = Math.min(nx - 1, Math.max(0, (x - x0) / dx)), v = Math.min(ny - 1, Math.max(0, (y - y0) / dy));
    const i = Math.min(nx - 2, Math.floor(u)), j = Math.min(ny - 2, Math.floor(v)), fu = u - i, fv = v - j, k = j * nx + i;
    return (grid[k] * (1 - fu) + grid[k + 1] * fu) * (1 - fv) + (grid[k + nx] * (1 - fu) + grid[k + nx + 1] * fu) * fv;
  };
  const g = geometry.clone(), pos = g.attributes.position, nrm = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, pos.getZ(i) + at(x, y));
    if (!nrm) continue;
    // The bent field f(x, y, z - depth) has the gradient (fx - fz·∂x depth, fy - fz·∂y depth, fz).
    const tx = (at(x + dx, y) - at(x - dx, y)) / (2 * dx), ty = (at(x, y + dy) - at(x, y - dy)) / (2 * dy);
    v.fromBufferAttribute(nrm, i);
    nrm.setXYZ(i, ...v.set(v.x - v.z * tx, v.y - v.z * ty, v.z).normalize().toArray());
  }
  g.computeBoundingBox(); g.computeBoundingSphere();
  return { geometry: g, at };
}

/**
 * A patch bent onto a surface (SPEC 9.3, A.9). `geo` is the flat patch from shapeGeometry; `field` and `matrix` are as
 * for patchDepth. Returns a new geometry (the caller disposes of it) and the bent field.
 */
export function bentPatch(geo, field, matrix) {
  const { geometry, at } = bendGeometry(geo.geometry, field, matrix), flat = geo.sdf;
  return { geometry, sdf: (x, y, z) => flat(x, y, z - at(x, y)) };
}

// Whole bodies, which are big: only the few used last are kept, since an editor's sliders make a new one at each step.
const BODIES = new Map(), MAX_BODIES = 8;

/**
 * A body mesh made once under `key` and kept while it is among the few used last: `make` returns { geometry, ...what
 * to keep with it }. The geometry is shared, so whoever uses it must not dispose of it.
 */
export function cachedBody(key, make) {
  let hit = BODIES.get(key);
  if (hit) BODIES.delete(key);
  else hit = make();
  BODIES.set(key, hit);
  // A body that drops out may still be on screen, so it is left to the garbage collector rather than disposed.
  if (BODIES.size > MAX_BODIES) BODIES.delete(BODIES.keys().next().value);
  return hit;
}

/** Frees every cached mesh (for example when a page closes its last avatar). */
export function clearGeometryCache() {
  for (const { geometry } of [...CACHE.values(), ...BODIES.values()]) geometry.dispose();
  CACHE.clear(); BODIES.clear();
}

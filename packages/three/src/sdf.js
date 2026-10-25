// The shape language (SPEC 5) compiled to signed distance functions, and a
// conservative bounding box for each shape. Pure math with no three.js, so it
// runs in workers and in Node. Input shapes are normalized documents' shapes
// (the @openavatar/core package's normalize()), so members are in range.
//
// Deformed, scaled and smoothly blended fields are not exact distances; the
// mesher and the ray casts below only need the sign and a field whose slope
// stays near 1, which these keep.

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const len2 = (x, y) => Math.sqrt(x * x + y * y);
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const DEG = Math.PI / 180;

// Polynomial smooth min and max (k is about the size of the fillet).
export const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = clamp(.5 + .5 * (b - a) / k); return b + (a - b) * h - k * h * (1 - h); };
export const smax = (a, b, k) => -smin(-a, -b, k);

// ---------- 2D outlines (5.4) ----------
function sdPolygon(P, x, y) {
  let d = (x - P[0][0]) ** 2 + (y - P[0][1]) ** 2, s = 1;
  for (let i = 0, j = P.length - 1; i < P.length; j = i, i++) {
    const ex = P[j][0] - P[i][0], ey = P[j][1] - P[i][1], wx = x - P[i][0], wy = y - P[i][1];
    const h = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey || 1e-12));
    const bx = wx - ex * h, by = wy - ey * h;
    d = Math.min(d, bx * bx + by * by);
    const c1 = y >= P[i][1], c2 = y < P[j][1], c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}
// Rounded corners (A.4): each vertex moves inward along its corner's bisector, so that both of its edges sit r inside
// (a miter inset), and the outline is that polygon grown back by r. r is first lowered to the largest inset that
// turns no edge around, so a polygon thinner than its rounding rounds by what it can hold. Returns the field.
function roundedPolygon(P, r) {
  const n = P.length;
  let area = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const o = area > 0 ? 1 : -1;
  // Each vertex's move for an inset of 1.
  const A = P.map((p, i) => {
    const a = P[(i + n - 1) % n], b = P[(i + 1) % n];
    let e1x = p[0] - a[0], e1y = p[1] - a[1], e2x = b[0] - p[0], e2y = b[1] - p[1];
    const l1 = len2(e1x, e1y) || 1, l2 = len2(e2x, e2y) || 1; e1x /= l1; e1y /= l1; e2x /= l2; e2y /= l2;
    // Inward normals of both edges (zero for an edge of no length); the move is along their bisector.
    const n1x = -e1y * o, n1y = e1x * o, n2x = -e2y * o, n2y = e2x * o;
    let mx = n1x + n2x, my = n1y + n2y; const ml = len2(mx, my);
    if (ml < 1e-6) return [0, 0];
    mx /= ml; my /= ml;
    const c = Math.max(mx * n1x + my * n1y, mx * n2x + my * n2y);
    return [mx / c, my / c];
  });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ex = P[j][0] - P[i][0], ey = P[j][1] - P[i][1], s = (A[i][0] - A[j][0]) * ex + (A[i][1] - A[j][1]) * ey;
    if (s > 0) r = Math.min(r, (ex * ex + ey * ey) / s);
  }
  const Q = P.map((p, i) => [p[0] + A[i][0] * r, p[1] + A[i][1] * r]);
  // Cut to the polygon itself, where a narrow neck makes the inset cross itself.
  return (x, y) => Math.max(sdPolygon(Q, x, y) - r, sdPolygon(P, x, y));
}
function sdHeart(x, y) {
  x = Math.abs(x);
  if (y + x > 1) return len2(x - .25, y - .75) - Math.SQRT2 / 4;
  const m = .5 * Math.max(x + y, 0);
  return Math.sqrt(Math.min((x) ** 2 + (y - 1) ** 2, (x - m) ** 2 + (y - m) ** 2)) * Math.sign(x - y);
}
const starPoints = (n, R, r, cx, cy) => Array.from({ length: n * 2 }, (_, i) => {
  const a = Math.PI / 2 + i * Math.PI / n, k = i % 2 ? r : R;
  return [cx + k * Math.cos(a), cy + k * Math.sin(a)];
});

/** Compiles an outline to (x, y) => distance. */
export function compileOutline(o) {
  const [cx, cy] = o.center || [0, 0];
  let f;
  switch (o.type) {
    case 'circle': { const r = o.radius; f = (x, y) => len2(x - cx, y - cy) - r; break; }
    case 'ellipse': {
      const [a, b] = o.radii;
      f = (x, y) => { const px = x - cx, py = y - cy, k0 = len2(px / a, py / b), k1 = len2(px / (a * a), py / (b * b)); return k1 < 1e-9 ? -Math.min(a, b) : k0 * (k0 - 1) / k1; };
      break;
    }
    case 'rect': {
      const hx = o.size[0] / 2, hy = o.size[1] / 2, r = Math.min(o.rounding || 0, hx, hy);
      f = (x, y) => { const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r; return len2(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };
      break;
    }
    case 'polygon': { const P = o.points; f = o.rounding > 0 ? roundedPolygon(P, o.rounding) : (x, y) => sdPolygon(P, x, y); break; }
    case 'star': { const P = starPoints(o.points, o.radius, Math.min(o.innerRadius, o.radius), cx, cy); f = (x, y) => sdPolygon(P, x, y); break; }
    case 'heart': { const s = o.size; f = (x, y) => sdHeart((x - cx) / s, (y - cy) / s + .5) * s; break; }
    case 'stroke': {
      const P = o.points, w0 = o.width / 2, w1 = (o.widthTo ?? o.width) / 2;
      const acc = [0]; for (let i = 1; i < P.length; i++) acc.push(acc[i - 1] + len2(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      const total = acc[acc.length - 1] || 1;
      f = (x, y) => {
        let d = Infinity;
        for (let i = 1; i < P.length; i++) {
          const ax = P[i - 1][0], ay = P[i - 1][1], ex = P[i][0] - ax, ey = P[i][1] - ay;
          const h = clamp(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1e-12));
          const r = mix(w0, w1, (acc[i - 1] + h * (acc[i] - acc[i - 1])) / total);
          d = Math.min(d, len2(x - ax - ex * h, y - ay - ey * h) - r);
        }
        return d;
      };
      break;
    }
    case 'union': case 'subtract': case 'intersect': f = combine(o.type, o.children.map(compileOutline), o.smooth || 0); break;
    default: return () => Infinity;
  }
  return transform2(f, o);
}
function transform2(f, o) {
  const s = o.scale ?? 1, sx = Array.isArray(s) ? s[0] : s, sy = Array.isArray(s) ? s[1] : s, sm = Math.min(sx, sy);
  const a = -(o.rotation || 0) * DEG, c = Math.cos(a), si = Math.sin(a);
  let g = f;
  if (o.rotation || sx !== 1 || sy !== 1) g = (x, y) => f((c * x - si * y) / sx, (si * x + c * y) / sy) * sm;
  if (o.mirror === 'x') { const h = g; g = (x, y) => Math.min(h(x, y), h(-x, y)); }
  if (o.mirror === 'y') { const h = g; g = (x, y) => Math.min(h(x, y), h(x, -y)); }
  return g;
}
function combine(type, fs, k) {
  if (type === 'union') return fs.length === 1 ? fs[0] : (...p) => { let d = fs[0](...p); for (let i = 1; i < fs.length; i++) d = smin(d, fs[i](...p), k); return d; };
  if (type === 'intersect') return (...p) => { let d = fs[0](...p); for (let i = 1; i < fs.length; i++) d = smax(d, fs[i](...p), k); return d; };
  return (...p) => { let d = fs[0](...p); for (let i = 1; i < fs.length; i++) d = smax(d, -fs[i](...p), k); return d; };
}

// ---------- 3D primitives (5.2) ----------
function primitive(s) {
  switch (s.type) {
    case 'sphere': { const r = s.radius; return (x, y, z) => len3(x, y, z) - r; }
    case 'ellipsoid': {
      const [a, b, c] = s.radii;
      return (x, y, z) => { const k0 = len3(x / a, y / b, z / c), k1 = len3(x / (a * a), y / (b * b), z / (c * c)); return k1 < 1e-9 ? -Math.min(a, b, c) : k0 * (k0 - 1) / k1; };
    }
    case 'box': {
      const [bx, by, bz] = s.size.map(v => v / 2), r = Math.min(s.rounding || 0, bx, by, bz);
      return (x, y, z) => {
        const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r, qz = Math.abs(z) - bz + r;
        return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
      };
    }
    case 'superellipsoid': {
      const [a, b, c] = s.radii, n = s.exponent ?? 3, m = Math.min(a, b, c);
      return (x, y, z) => (Math.pow(Math.pow(Math.abs(x / a), n) + Math.pow(Math.abs(y / b), n) + Math.pow(Math.abs(z / c), n), 1 / n) - 1) * m;
    }
    case 'capsule': {
      const [ax, ay, az] = s.from, [bx, by, bz] = s.to, r1 = s.radius, r2 = s.radiusTo ?? s.radius;
      const ex = bx - ax, ey = by - ay, ez = bz - az, ee = ex * ex + ey * ey + ez * ez || 1e-12;
      return (x, y, z) => {
        const px = x - ax, py = y - ay, pz = z - az, h = clamp((px * ex + py * ey + pz * ez) / ee);
        return len3(px - ex * h, py - ey * h, pz - ez * h) - mix(r1, r2, h);
      };
    }
    case 'cylinder': {
      const R = s.radius, H = s.height / 2, r = Math.min(s.rounding || 0, R, H);
      return (x, y, z) => { const dx = len2(x, z) - R + r, dy = Math.abs(y) - H + r; return Math.min(Math.max(dx, dy), 0) + len2(Math.max(dx, 0), Math.max(dy, 0)) - r; };
    }
    case 'cone': {
      // iq's capped cone with radius r1 at the base (y = -h) and r2 at the top, rounded by shrinking and growing back.
      const rr = Math.min(s.rounding || 0, s.height / 2 * .9, s.radius * .9);
      const h = s.height / 2 - rr, r1 = Math.max(s.radius - rr, 1e-4), r2 = Math.max((s.radiusTop ?? 0) - rr, 0);
      const k2x = r2 - r1, k2y = 2 * h, kk = k2x * k2x + k2y * k2y;
      return (x, y, z) => {
        const qx = len2(x, z), qy = y;
        const cax = qx - Math.min(qx, qy < 0 ? r1 : r2), cay = Math.abs(qy) - h;
        const t = clamp(((r2 - qx) * k2x + (h - qy) * k2y) / kk);
        const cbx = qx - r2 + k2x * t, cby = qy - h + k2y * t;
        const sgn = cbx < 0 && cay < 0 ? -1 : 1;
        return sgn * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby)) - rr;
      };
    }
    case 'torus': { const R = s.radius, r = s.thickness; return (x, y, z) => len2(len2(x, z) - R, y) - r; }
    case 'extrusion': {
      const f2 = compileOutline(s.outline), half = s.depth / 2, r = Math.min(s.rounding || 0, half * .95), puff = s.puff || 0;
      return (x, y, z) => {
        const d2 = f2(x, y);
        // A pillow: the slab thins toward the outline's edge, over a band about three half-depths wide.
        const hz = (half - r) * (1 - puff * (1 - sstep(0, 3 * half, -d2)));
        const wx = d2 + r, wz = Math.abs(z) - hz;
        return Math.min(Math.max(wx, wz), 0) + len2(Math.max(wx, 0), Math.max(wz, 0)) - r;
      };
    }
    case 'halfspace': {
      let [nx, ny, nz] = s.normal; const l = len3(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; const o = s.offset || 0;
      return (x, y, z) => x * nx + y * ny + z * nz - o;
    }
  }
  return null;
}

// ---------- deformers (5.5) ----------
const AX = { x: 0, y: 1, z: 2 };
function deformer(d, f) {
  const a = AX[d.axis];
  const perp = [0, 1, 2].filter(i => i !== a);
  switch (d.type) {
    case 'taper': {
      const k = d.amount;
      return p => { const s = Math.max(.1, 1 + k * p[a]), q = [...p]; q[perp[0]] /= s; q[perp[1]] /= s; return f(q) * Math.min(s, 1); };
    }
    case 'twist': {
      const k = d.amount * DEG;
      return p => { const t = -k * p[a], c = Math.cos(t), s = Math.sin(t), q = [...p], u = p[perp[0]], v = p[perp[1]]; q[perp[0]] = c * u - s * v; q[perp[1]] = s * u + c * v; return f(q); };
    }
    case 'bend': {
      // The axis becomes an arc of radius R about (0, R) in the plane of the axis and `toward`; each point is read back
      // from it: its angle about that center gives how far along the axis it was, its distance how far off it.
      const b = AX[d.toward], k = d.amount * DEG;
      if (b === a || !k) return f;
      const R = 1 / k, sg = Math.sign(R);
      return p => { const q = [...p], u = p[a], v = R - p[b]; q[a] = Math.atan2(sg * u, sg * v) / k; q[b] = R - sg * Math.hypot(u, v); return f(q); };
    }
    case 'squash': {
      // One factor for both halves keeps the field continuous across the split, so the mesh has no seam there.
      const lo = d.below ?? 1, hi = d.above ?? 1, m = Math.min(lo, hi, 1);
      return p => { const q = [...p]; q[a] /= p[a] < 0 ? lo : hi; return f(q) * m; };
    }
    case 'ripple': {
      // Without a range the waves cover the whole axis; a range with equal ends holds none.
      const n = d.count, amp = d.amplitude, r0 = d.range && Math.min(...d.range), r1 = d.range && Math.max(...d.range), fade = d.range ? (r1 - r0) * .2 : 0;
      return p => {
        const w = !d.range ? 1 : fade > 0 ? sstep(r0, r0 + fade, p[a]) * sstep(r1, r1 - fade, p[a]) : 0;
        return f(p) + amp * w * Math.sin(n * Math.atan2(p[perp[1]], p[perp[0]]));
      };
    }
  }
  return f;
}

// Rotation by x, then y, then z degrees about the parent's axes, inverted (a row-major 3x3).
function inverseRotation([rx, ry, rz]) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx * DEG), Math.sin(rx * DEG), Math.cos(ry * DEG), Math.sin(ry * DEG), Math.cos(rz * DEG), Math.sin(rz * DEG)];
  // R = Rz * Ry * Rx; the inverse of a rotation is its transpose.
  const R = [
    cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
    sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
    -sy, cy * sx, cy * cx,
  ];
  return [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
}
export { inverseRotation };

/**
 * Compiles a shape to (x, y, z) => distance. Unknown shapes are empty
 * (distance Infinity).
 */
export function compileShape(s) {
  let f3;
  if (s.type === 'union' || s.type === 'subtract' || s.type === 'intersect') {
    const kids = s.children.map(compileShape);
    f3 = combine(s.type, kids, s.smooth || 0);
  } else {
    f3 = primitive(s);
    if (!f3) return () => Infinity;
  }
  // Deformers, innermost first, as array-point functions.
  let g = p => f3(p[0], p[1], p[2]);
  for (const d of s.deform || []) g = deformer(d, g);
  const inflate = s.inflate || 0;
  const [px, py, pz] = s.position || [0, 0, 0];
  const sc = s.scale ?? 1, [sx, sy, sz] = Array.isArray(sc) ? sc : [sc, sc, sc], sm = Math.min(sx, sy, sz);
  const M = s.rotation && s.rotation.some(Boolean) ? inverseRotation(s.rotation) : null;
  let f = (x, y, z) => {
    let u = x - px, v = y - py, w = z - pz;
    if (M) { const a = M[0] * u + M[1] * v + M[2] * w, b = M[3] * u + M[4] * v + M[5] * w, c = M[6] * u + M[7] * v + M[8] * w; u = a; v = b; w = c; }
    return g([u / sx, v / sy, w / sz]) * sm - inflate;
  };
  if (s.mirror) {
    const h = f, i = AX[s.mirror];
    f = i === 0 ? (x, y, z) => Math.min(h(x, y, z), h(-x, y, z)) : i === 1 ? (x, y, z) => Math.min(h(x, y, z), h(x, -y, z)) : (x, y, z) => Math.min(h(x, y, z), h(x, y, -z));
  }
  return f;
}

// ---------- bounds ----------
const EMPTY = null, HUGE = 5;
const box = (lo, hi) => ({ lo, hi });
const unionBox = (a, b) => !a ? b : !b ? a : box(a.lo.map((v, i) => Math.min(v, b.lo[i])), a.hi.map((v, i) => Math.max(v, b.hi[i])));
const interBox = (a, b) => {
  if (!a || !b) return EMPTY;
  const lo = a.lo.map((v, i) => Math.max(v, b.lo[i])), hi = a.hi.map((v, i) => Math.min(v, b.hi[i]));
  return lo.some((v, i) => v > hi[i]) ? EMPTY : box(lo, hi);
};
const grow = (b, d) => b && box(b.lo.map(v => v - d), b.hi.map(v => v + d));
function outlineBounds(o) {
  const [cx, cy] = o.center || [0, 0];
  let lo, hi;
  switch (o.type) {
    case 'circle': lo = [cx - o.radius, cy - o.radius]; hi = [cx + o.radius, cy + o.radius]; break;
    case 'ellipse': lo = [cx - o.radii[0], cy - o.radii[1]]; hi = [cx + o.radii[0], cy + o.radii[1]]; break;
    case 'rect': lo = [cx - o.size[0] / 2, cy - o.size[1] / 2]; hi = [cx + o.size[0] / 2, cy + o.size[1] / 2]; break;
    case 'star': lo = [cx - o.radius, cy - o.radius]; hi = [cx + o.radius, cy + o.radius]; break;
    // The lobes are circles of radius √2/4 · size about (±size/4, size/4): they reach 0.604 · size up and out.
    case 'heart': lo = [cx - .61 * o.size, cy - .51 * o.size]; hi = [cx + .61 * o.size, cy + .61 * o.size]; break;
    case 'polygon': case 'stroke': {
      const w = o.type === 'stroke' ? Math.max(o.width, o.widthTo ?? 0) / 2 : 0;
      lo = [Math.min(...o.points.map(p => p[0])) - w, Math.min(...o.points.map(p => p[1])) - w];
      hi = [Math.max(...o.points.map(p => p[0])) + w, Math.max(...o.points.map(p => p[1])) + w];
      break;
    }
    case 'union': case 'subtract': case 'intersect': {
      const bs = o.children.map(outlineBounds).filter(Boolean);
      if (!bs.length) return EMPTY;
      const pick = o.type === 'union' ? bs : [bs[0]];
      lo = [Math.min(...pick.map(b => b.lo[0])), Math.min(...pick.map(b => b.lo[1]))]; hi = [Math.max(...pick.map(b => b.hi[0])), Math.max(...pick.map(b => b.hi[1]))];
      break;
    }
    default: return EMPTY;
  }
  // Rotation and scale about the origin, then mirroring: the box of the turned corners.
  const s = o.scale ?? 1, sx = Array.isArray(s) ? s[0] : s, sy = Array.isArray(s) ? s[1] : s, a = (o.rotation || 0) * DEG, c = Math.cos(a), si = Math.sin(a);
  const pts = [[lo[0], lo[1]], [hi[0], lo[1]], [lo[0], hi[1]], [hi[0], hi[1]]].map(([x, y]) => [c * x * sx - si * y * sy, si * x * sx + c * y * sy]);
  if (o.mirror === 'x') pts.push(...pts.map(([x, y]) => [-x, y]));
  if (o.mirror === 'y') pts.push(...pts.map(([x, y]) => [x, -y]));
  const m = o.type === 'polygon' ? 0 : .01;
  return { lo: [Math.min(...pts.map(p => p[0])) - m, Math.min(...pts.map(p => p[1])) - m], hi: [Math.max(...pts.map(p => p[0])) + m, Math.max(...pts.map(p => p[1])) + m] };
}
function primitiveBounds(s) {
  const sym = (x, y, z) => box([-x, -y, -z], [x, y, z]);
  switch (s.type) {
    case 'sphere': return sym(s.radius, s.radius, s.radius);
    case 'ellipsoid': case 'superellipsoid': return sym(...s.radii);
    case 'box': return sym(...s.size.map(v => v / 2));
    case 'capsule': { const r = Math.max(s.radius, s.radiusTo ?? 0); return grow(box(s.from.map((v, i) => Math.min(v, s.to[i])), s.from.map((v, i) => Math.max(v, s.to[i]))), r); }
    case 'cylinder': return sym(s.radius, s.height / 2, s.radius);
    case 'cone': { const r = Math.max(s.radius, s.radiusTop ?? 0); return sym(r, s.height / 2, r); }
    case 'torus': return sym(s.radius + s.thickness, s.thickness, s.radius + s.thickness);
    case 'extrusion': { const b = outlineBounds(s.outline); return b && box([b.lo[0], b.lo[1], -s.depth / 2], [b.hi[0], b.hi[1], s.depth / 2]); }
    case 'halfspace': return sym(HUGE, HUGE, HUGE);
  }
  return EMPTY;
}
/** A box that holds the shape: { lo: vec3, hi: vec3 }, or null when it is empty. */
export function shapeBounds(s) {
  let b;
  if (s.type === 'union') b = s.children.map(shapeBounds).reduce(unionBox, EMPTY);
  else if (s.type === 'intersect') b = s.children.map(shapeBounds).reduce((a, c, i) => i ? interBox(a, c) : c, EMPTY);
  else if (s.type === 'subtract') b = shapeBounds(s.children[0]);
  else b = primitiveBounds(s);
  if (!b) return EMPTY;
  b = grow(b, (s.smooth || 0) * .25);
  // How much the deformers can shrink the distance (their factor, or 1 over their stretch), for `inflate` below.
  let slope = 1;
  for (const d of s.deform || []) {
    const a = AX[d.axis], ext = Math.max(...[0, 1, 2].filter(i => i !== a).map(i => Math.max(-b.lo[i], b.hi[i])));
    if (d.type === 'taper') {
      const lo = Math.max(.1, 1 + d.amount * b.lo[a]), hi = Math.max(.1, 1 + d.amount * b.hi[a]), k = Math.max(lo, hi, 1);
      slope *= Math.min(lo, hi, 1) / k;
      b = box(b.lo.map((v, i) => i === a ? v : v * k), b.hi.map((v, i) => i === a ? v : v * k));
    }
    else if (d.type === 'twist') b = box(b.lo.map((v, i) => i === a ? v : -ext * Math.SQRT2), b.hi.map((v, i) => i === a ? v : ext * Math.SQRT2));
    else if (d.type === 'bend' && AX[d.toward] !== a && d.amount) {
      // A point s along the axis and h toward `toward` goes to (0, R) + (R − h)·(sin κs, −cos κs): the box of the
      // annular sector, from the extremes of R − h and of sin and cos over the angles the axis reaches (at most a turn).
      const t = AX[d.toward], k = d.amount * DEG, R = 1 / k, r = [R - b.lo[t], R - b.hi[t]];
      const f0 = Math.max(-Math.PI, Math.min(k * b.lo[a], k * b.hi[a])), f1 = Math.min(Math.PI, Math.max(k * b.lo[a], k * b.hi[a]));
      const over = (fn, peaks) => { const v = [f0, f1, ...peaks.filter(x => x > f0 && x < f1)].map(fn); return [Math.min(...v), Math.max(...v)]; };
      const times = ([lo, hi]) => { const v = r.flatMap(x => [x * lo, x * hi]); return [Math.min(...v), Math.max(...v)]; };
      const [a0, a1] = times(over(Math.sin, [-Math.PI / 2, Math.PI / 2])), [c0, c1] = times(over(Math.cos, [0]));
      b = box(b.lo.map((v, i) => i === a ? a0 : i === t ? R - c1 : v), b.hi.map((v, i) => i === a ? a1 : i === t ? R - c0 : v));
      // Outside the arc the field stretches by the distance from the center over R.
      slope *= Math.min(1, Math.abs(R) / Math.max(...r.map(Math.abs)));
    }
    else if (d.type === 'squash') {
      const lo = d.below ?? 1, hi = d.above ?? 1;
      slope *= Math.min(lo, hi, 1) / Math.max(lo, hi, 1);
      b = box(b.lo.map((v, i) => i === a ? v * lo : v), b.hi.map((v, i) => i === a ? v * hi : v));
    }
    else if (d.type === 'ripple') b = grow(b, d.amplitude);
  }
  // `inflate` is taken off the distance after the scale and the deformers have shrunk it, so in local units it
  // reaches inflate / (min scale · slope).
  const sc = s.scale ?? 1, S = Array.isArray(sc) ? sc : [sc, sc, sc];
  if (s.inflate > 0) b = grow(b, s.inflate / (Math.min(...S) * slope));
  // Scale, rotation and position: the box of the eight moved corners.
  const M = s.rotation && s.rotation.some(Boolean) ? inverseRotation(s.rotation) : null;
  const P = s.position || [0, 0, 0];
  const corners = [];
  for (let i = 0; i < 8; i++) {
    let v = [i & 1 ? b.hi[0] : b.lo[0], i & 2 ? b.hi[1] : b.lo[1], i & 4 ? b.hi[2] : b.lo[2]].map((x, j) => x * S[j]);
    // M is the inverse rotation stored row-major; its transpose turns forward.
    if (M) v = [M[0] * v[0] + M[3] * v[1] + M[6] * v[2], M[1] * v[0] + M[4] * v[1] + M[7] * v[2], M[2] * v[0] + M[5] * v[1] + M[8] * v[2]];
    corners.push(v.map((x, j) => x + P[j]));
  }
  if (s.mirror) { const a = AX[s.mirror]; corners.push(...corners.map(c => c.map((x, j) => j === a ? -x : x))); }
  return box([0, 1, 2].map(j => Math.max(-HUGE, Math.min(...corners.map(c => c[j])))), [0, 1, 2].map(j => Math.min(HUGE, Math.max(...corners.map(c => c[j])))));
}

// ---------- probing the surface ----------
const EPS = .002;
/** The field's gradient at a point, normalized. */
export function normalAt(f, x, y, z) {
  const nx = f(x + EPS, y, z) - f(x - EPS, y, z), ny = f(x, y + EPS, z) - f(x, y - EPS, z), nz = f(x, y, z + EPS) - f(x, y, z - EPS);
  const l = len3(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
/**
 * The front point (SPEC 4, A.9): where the line from (x, y, +∞) toward -z
 * first meets the solid, with the surface normal there. Null when it misses.
 * The walk starts at z = 8, past any surface a part's own space can reach
 * (a position of 5 and a size of 3).
 */
export function frontPoint(f, x, y, zFar = 8, zNear = -8) {
  let z = zFar;
  for (let i = 0; i < 400 && z > zNear; i++) {
    const d = f(x, y, z);
    if (d < 1e-4) {
      // Refine the crossing between the last outside step and here.
      let a = z + Math.max(.004, -d), b = z;
      for (let k = 0; k < 24; k++) { const m = (a + b) / 2; if (f(x, y, m) < 0) b = m; else a = m; }
      const zz = (a + b) / 2;
      return { p: [x, y, zz], n: normalAt(f, x, y, zz) };
    }
    z -= Math.max(d * .6, .004);
  }
  return null;
}
/**
 * Where the ray from `from` along `dir` leaves the solid (SPEC 9.1
 * `direction`), with the normal. Starts outside and walks in when `from` is
 * outside the solid.
 */
export function surfaceAlong(f, from, dir, reach = 8) {
  const l = len3(...dir) || 1, d = dir.map(v => v / l);
  const at = t => [from[0] + d[0] * t, from[1] + d[1] * t, from[2] + d[2] * t];
  // Walk back from far out along the ray to the outermost crossing.
  let t = reach;
  for (let i = 0; i < 400 && t > 0; i++) {
    const v = f(...at(t));
    if (v < 1e-4) {
      let a = t + Math.max(.004, -v), b = t;
      for (let k = 0; k < 24; k++) { const m = (a + b) / 2; if (f(...at(m)) < 0) b = m; else a = m; }
      const p = at((a + b) / 2);
      return { p, n: normalAt(f, ...p) };
    }
    t -= Math.max(v * .6, .004);
  }
  return null;
}

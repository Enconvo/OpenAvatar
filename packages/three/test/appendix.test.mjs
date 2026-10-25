// SPEC Appendix A written out a second time, straight from its text and in another style (matrices, a crossing count
// for inside), and compared with the reference fields in src/sdf.js on random shapes. A change to either that the
// other doesn't make fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../../core/src/index.js';
import { compileShape } from '../src/sdf.js';

// A.1
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const norm = v => Math.hypot(...v);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const scale = (a, k) => a.map(x => x * k);
const maxv = v => v.map(x => Math.max(x, 0));
const rad = d => d * Math.PI / 180;

// A.2
const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b);
  const h = clamp(.5 + .5 * (b - a) / k);
  return b + (a - b) * h - k * h * (1 - h);
};
const smax = (a, b, k) => -smin(-a, -b, k);
function fold(type, ds, k) {
  let d = ds[0];
  for (const di of ds.slice(1)) d = type === 'union' ? smin(d, di, k) : type === 'intersect' ? smax(d, di, k) : smax(d, -di, k);
  return d;
}

// A.4
function P(V, q) {
  let dist = Infinity, inside = false;
  for (let i = 0; i < V.length; i++) {
    const a = V[i], b = V[(i + 1) % V.length], e = sub(b, a), ee = dot(e, e);
    const h = ee ? clamp(dot(sub(q, a), e) / ee) : 0;
    dist = Math.min(dist, norm(sub(sub(q, a), scale(e, h))));
    // Even-odd: count the edges a ray toward +x crosses.
    if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < a[0] + (q[1] - a[1]) / (b[1] - a[1]) * (b[0] - a[0])) inside = !inside;
  }
  return inside ? -dist : dist;
}
const unit = v => { const l = norm(v); return l ? scale(v, 1 / l) : [0, 0]; };
function rounded(V, r, q) {
  const n = V.length;
  let area = 0; for (let i = 0; i < n; i++) area += V[i][0] * V[(i + 1) % n][1] - V[(i + 1) % n][0] * V[i][1];
  const o = area > 0 ? 1 : -1;
  const A = V.map((v, i) => {
    const e1 = unit(sub(v, V[(i + n - 1) % n])), e2 = unit(sub(V[(i + 1) % n], v));
    const n1 = [-o * e1[1], o * e1[0]], n2 = [-o * e2[1], o * e2[0]], m = [n1[0] + n2[0], n1[1] + n2[1]];
    if (norm(m) < 1e-6) return [0, 0];
    const u = scale(m, 1 / norm(m));
    return scale(u, 1 / Math.max(dot(u, n1), dot(u, n2)));
  });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, e = sub(V[j], V[i]), s = dot(sub(A[i], A[j]), e);
    if (s > 0) r = Math.min(r, dot(e, e) / s);
  }
  const Q = V.map((v, i) => [v[0] + r * A[i][0], v[1] + r * A[i][1]]);
  return Math.max(P(Q, q) - r, P(V, q));
}
function heart(x, y) {
  x = Math.abs(x);
  if (x + y > 1) return norm([x - .25, y - .75]) - Math.SQRT2 / 4;
  const m = .5 * Math.max(x + y, 0);
  return Math.sqrt(Math.min(x * x + (y - 1) ** 2, (x - m) ** 2 + (y - m) ** 2)) * Math.sign(x - y);
}
function outline(o, [x, y]) {
  const c = o.center ?? [0, 0], s = o.scale ?? 1, [sx, sy] = Array.isArray(s) ? s : [s, s], t = rad(o.rotation ?? 0);
  const g = (x, y) => {
    const q = [(Math.cos(t) * x + Math.sin(t) * y) / sx, (-Math.sin(t) * x + Math.cos(t) * y) / sy];
    return own(o, q, c) * Math.min(sx, sy);
  };
  if (o.mirror === 'x') return Math.min(g(x, y), g(-x, y));
  if (o.mirror === 'y') return Math.min(g(x, y), g(x, -y));
  return g(x, y);
}
function own(o, q, c) {
  const p = sub(q, c);
  switch (o.type) {
    case 'circle': return norm(p) - o.radius;
    case 'ellipse': {
      const [a, b] = o.radii, k0 = norm([p[0] / a, p[1] / b]), k1 = norm([p[0] / (a * a), p[1] / (b * b)]);
      return k1 < 1e-9 ? -Math.min(a, b) : k0 * (k0 - 1) / k1;
    }
    case 'rect': {
      const b = o.size.map(v => v / 2), r = Math.min(o.rounding ?? 0, ...b), w = p.map((v, i) => Math.abs(v) - b[i] + r);
      return norm(maxv(w)) + Math.min(Math.max(...w), 0) - r;
    }
    case 'polygon': return o.rounding > 0 ? rounded(o.points, o.rounding, q) : P(o.points, q);
    case 'star': {
      const S = Array.from({ length: 2 * o.points }, (_, i) => {
        const a = rad(90 + i * 180 / o.points), R = i % 2 ? Math.min(o.innerRadius, o.radius) : o.radius;
        return [c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)];
      });
      return P(S, q);
    }
    case 'heart': return heart(p[0] / o.size, p[1] / o.size + .5) * o.size;
    case 'stroke': {
      const L = [0]; for (let i = 1; i < o.points.length; i++) L.push(L[i - 1] + norm(sub(o.points[i], o.points[i - 1])));
      const total = L.at(-1) || 1, w0 = o.width / 2, w1 = (o.widthTo ?? o.width) / 2;
      let d = Infinity;
      for (let i = 1; i < o.points.length; i++) {
        const a = o.points[i - 1], e = sub(o.points[i], a), ee = dot(e, e), h = ee ? clamp(dot(sub(q, a), e) / ee) : 0;
        d = Math.min(d, norm(sub(sub(q, a), scale(e, h))) - mix(w0, w1, (L[i - 1] + h * (L[i] - L[i - 1])) / total));
      }
      return d;
    }
    case 'union': case 'subtract': case 'intersect': return fold(o.type, o.children.map(ch => outline(ch, q)), o.smooth ?? 0);
  }
  return Infinity;
}

// A.3
function primitive(s, p) {
  const [x, y, z] = p;
  switch (s.type) {
    case 'sphere': return norm(p) - s.radius;
    case 'ellipsoid': {
      const r = s.radii, k0 = norm(p.map((v, i) => v / r[i])), k1 = norm(p.map((v, i) => v / (r[i] * r[i])));
      return k1 < 1e-9 ? -Math.min(...r) : k0 * (k0 - 1) / k1;
    }
    case 'box': {
      const b = s.size.map(v => v / 2), r = Math.min(s.rounding ?? 0, ...b), q = p.map((v, i) => Math.abs(v) - b[i] + r);
      return norm(maxv(q)) + Math.min(Math.max(...q), 0) - r;
    }
    case 'superellipsoid': {
      const r = s.radii, n = s.exponent ?? 3;
      return (Math.pow(p.reduce((t, v, i) => t + Math.abs(v / r[i]) ** n, 0), 1 / n) - 1) * Math.min(...r);
    }
    case 'capsule': {
      const a = s.from, e = sub(s.to, a), ee = dot(e, e), h = ee ? clamp(dot(sub(p, a), e) / ee) : 0;
      return norm(sub(sub(p, a), scale(e, h))) - mix(s.radius, s.radiusTo ?? s.radius, h);
    }
    case 'cylinder': {
      const H = s.height / 2, r = Math.min(s.rounding ?? 0, s.radius, H), w = [norm([x, z]) - s.radius + r, Math.abs(y) - H + r];
      return Math.min(Math.max(...w), 0) + norm(maxv(w)) - r;
    }
    case 'cone': {
      const r = Math.min(s.rounding ?? 0, .45 * s.height, .9 * s.radius), h = s.height / 2 - r;
      const r1 = Math.max(s.radius - r, 1e-4), r2 = Math.max((s.radiusTop ?? 0) - r, 0), k = [r2 - r1, 2 * h], q = [norm([x, z]), y];
      const ca = [q[0] - Math.min(q[0], q[1] < 0 ? r1 : r2), Math.abs(q[1]) - h];
      const t = clamp(((r2 - q[0]) * k[0] + (h - q[1]) * k[1]) / dot(k, k)), cb = [q[0] - r2 + k[0] * t, q[1] - h + k[1] * t];
      return (cb[0] < 0 && ca[1] < 0 ? -1 : 1) * Math.sqrt(Math.min(dot(ca, ca), dot(cb, cb))) - r;
    }
    case 'torus': return norm([norm([x, z]) - s.radius, y]) - s.thickness;
    case 'extrusion': {
      const o = outline(s.outline, [x, y]), half = s.depth / 2, r = Math.min(s.rounding ?? 0, .95 * half);
      const hz = (half - r) * (1 - (s.puff ?? 0) * (1 - smoothstep(0, 3 * half, -o))), w = [o + r, Math.abs(z) - hz];
      return Math.min(Math.max(...w), 0) + norm(maxv(w)) - r;
    }
    case 'halfspace': { const l = norm(s.normal), n = l ? scale(s.normal, 1 / l) : [0, 0, 0]; return dot(p, n) - (s.offset ?? 0); }
  }
  return Infinity;
}

// A.5
const AXES = { x: 0, y: 1, z: 2 }, OTHER = { x: [1, 2], y: [0, 2], z: [0, 1] };
function deformed(d, f) {
  const a = AXES[d.axis], [u, v] = OTHER[d.axis], k = d.amount;
  const turn = (p, i, j, t) => { const q = [...p]; q[i] = p[i] * Math.cos(t) - p[j] * Math.sin(t); q[j] = p[i] * Math.sin(t) + p[j] * Math.cos(t); return q; };
  switch (d.type) {
    case 'taper': return p => { const s = Math.max(.1, 1 + k * p[a]), q = [...p]; q[u] /= s; q[v] /= s; return f(q) * Math.min(s, 1); };
    case 'twist': return p => f(turn(p, u, v, rad(-k * p[a])));
    case 'bend': {
      const b = AXES[d.toward], K = rad(k), R = 1 / K, s = Math.sign(R);
      if (b === a || k === 0) return f;
      return p => { const q = [...p]; q[a] = Math.atan2(s * p[a], s * (R - p[b])) / K; q[b] = R - s * Math.sqrt(p[a] ** 2 + (R - p[b]) ** 2); return f(q); };
    }
    case 'squash': return p => { const j = p[a] < 0 ? d.below ?? 1 : d.above ?? 1, q = [...p]; q[a] /= j; return f(q) * Math.min(d.below ?? 1, d.above ?? 1, 1); };
    case 'ripple': return p => {
      let w = 1;
      if (d.range) {
        const r0 = Math.min(...d.range), r1 = Math.max(...d.range), l = .2 * (r1 - r0);
        w = l > 0 ? smoothstep(r0, r0 + l, p[a]) * smoothstep(r1, r1 - l, p[a]) : 0;
      }
      return f(p) + d.amplitude * w * Math.sin(d.count * Math.atan2(p[v], p[u]));
    };
  }
  return f;
}

// A.6
const mul = (A, B) => A.map(row => B[0].map((_, j) => row.reduce((s, x, k) => s + x * B[k][j], 0)));
const Rx = t => [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]];
const Ry = t => [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]];
const Rz = t => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]];
function field(s, p) {
  const at = p => {
    const r = (s.rotation ?? [0, 0, 0]).map(rad), R = mul(Rz(r[2]), mul(Ry(r[1]), Rx(r[0])));
    let u = sub(p, s.position ?? [0, 0, 0]);
    u = [0, 1, 2].map(i => R[0][i] * u[0] + R[1][i] * u[1] + R[2][i] * u[2]);
    const sc = Array.isArray(s.scale) ? s.scale : [s.scale ?? 1, s.scale ?? 1, s.scale ?? 1];
    u = u.map((x, i) => x / sc[i]);
    let F = ['union', 'subtract', 'intersect'].includes(s.type) ? q => fold(s.type, s.children.map(c => field(c, q)), s.smooth ?? 0) : q => primitive(s, q);
    for (const d of s.deform ?? []) F = deformed(d, F);
    return F(u) * Math.min(...sc) - (s.inflate ?? 0);
  };
  if (!s.mirror) return at(p);
  const i = AXES[s.mirror], m = [...p]; m[i] = -m[i];
  return Math.min(at(p), at(m));
}

// Random shapes, run through normalize so they are what a renderer gets.
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }
function shapes(r) {
  const n = (a, b) => a + (b - a) * r(), v3 = (a, b) => [n(a, b), n(a, b), n(a, b)], v2 = (a, b) => [n(a, b), n(a, b)], pick = a => a[Math.floor(r() * a.length)];
  const ax = () => pick(['x', 'y', 'z']);
  const outlineOf = depth => {
    const t = pick(depth > 1 ? ['circle', 'ellipse', 'rect', 'polygon', 'star', 'heart', 'stroke'] : ['circle', 'ellipse', 'rect', 'polygon', 'star', 'heart', 'stroke', 'union', 'subtract', 'intersect']);
    const o = {
      circle: () => ({ radius: n(.1, .8), center: v2(-.3, .3) }), ellipse: () => ({ radii: v2(.1, .8), center: v2(-.3, .3) }),
      rect: () => ({ size: v2(.2, 1.4), rounding: n(0, .4), center: v2(-.3, .3) }),
      polygon: () => { const k = 3 + Math.floor(r() * 5); return { points: Array.from({ length: k }, (_, i) => { const t = i / k * 2 * Math.PI, R = n(.2, .9); return [R * Math.cos(t), R * Math.sin(t)]; }), rounding: pick([0, n(0, .3)]) }; },
      star: () => ({ points: 3 + Math.floor(r() * 8), radius: n(.3, .9), innerRadius: n(.1, .9), center: v2(-.2, .2) }),
      heart: () => ({ size: n(.2, 1.5), center: v2(-.2, .2) }),
      stroke: () => ({ points: Array.from({ length: 2 + Math.floor(r() * 4) }, () => v2(-.8, .8)), width: n(.02, .4), widthTo: n(.02, .4) }),
      union: () => ({ children: [outlineOf(depth + 1), outlineOf(depth + 1)], smooth: pick([0, n(0, .3)]) }),
      subtract: () => ({ children: [outlineOf(depth + 1), outlineOf(depth + 1)], smooth: pick([0, n(0, .3)]) }),
      intersect: () => ({ children: [outlineOf(depth + 1), outlineOf(depth + 1)], smooth: pick([0, n(0, .3)]) }),
    }[t]();
    if (r() < .3) o.rotation = n(-180, 180);
    if (r() < .3) o.scale = pick([n(.5, 2), v2(.5, 2)]);
    if (r() < .2) o.mirror = pick(['x', 'y']);
    return { type: t, ...o };
  };
  const shapeOf = depth => {
    const t = pick(depth > 1 ? ['sphere', 'ellipsoid', 'box', 'superellipsoid', 'capsule', 'cylinder', 'cone', 'torus', 'extrusion', 'halfspace'] : ['sphere', 'ellipsoid', 'box', 'superellipsoid', 'capsule', 'cylinder', 'cone', 'torus', 'extrusion', 'halfspace', 'union', 'subtract', 'intersect']);
    const s = {
      sphere: () => ({ radius: n(.1, 1) }), ellipsoid: () => ({ radii: v3(.1, 1) }), box: () => ({ size: v3(.2, 1.5), rounding: n(0, .3) }),
      superellipsoid: () => ({ radii: v3(.1, 1), exponent: n(1, 8) }), capsule: () => ({ from: v3(-.5, .5), to: v3(-.5, .5), radius: n(.05, .4), radiusTo: n(.05, .4) }),
      cylinder: () => ({ radius: n(.1, .8), height: n(.2, 1.6), rounding: n(0, .2) }), cone: () => ({ radius: n(.1, .8), radiusTop: n(0, .8), height: n(.2, 1.6), rounding: n(0, .2) }),
      torus: () => ({ radius: n(.2, .8), thickness: n(.02, .3) }), extrusion: () => ({ outline: outlineOf(0), depth: n(.05, 1), rounding: n(0, .2), puff: n(0, 1) }),
      halfspace: () => ({ normal: pick([v3(-1, 1), [0, 0, 0]]), offset: n(-.5, .5) }),
      union: () => ({ children: [shapeOf(depth + 1), shapeOf(depth + 1), shapeOf(depth + 1)], smooth: pick([0, n(0, .4)]) }),
      subtract: () => ({ children: [shapeOf(depth + 1), shapeOf(depth + 1)], smooth: pick([0, n(0, .4)]) }),
      intersect: () => ({ children: [shapeOf(depth + 1), shapeOf(depth + 1)], smooth: pick([0, n(0, .4)]) }),
    }[t]();
    if (r() < .4) s.position = v3(-.4, .4);
    if (r() < .4) s.rotation = v3(-180, 180);
    if (r() < .3) s.scale = pick([n(.5, 1.5), v3(.5, 1.5)]);
    if (r() < .2) s.mirror = ax();
    if (r() < .2) s.inflate = n(-.1, .1);
    if (r() < .4) s.deform = Array.from({ length: 1 + Math.floor(r() * 3) }, () => {
      const type = pick(['taper', 'twist', 'bend', 'squash', 'ripple']), axis = ax();
      return {
        taper: { type, axis, amount: n(-1, 1) }, twist: { type, axis, amount: n(-180, 180) }, bend: { type, axis, toward: ax(), amount: n(-180, 180) },
        squash: { type, axis, below: n(.2, 3), above: n(.2, 3) },
        ripple: { type, axis, count: 2 + Math.floor(r() * 12), amplitude: n(0, .2), ...(r() < .5 ? { range: pick([v2(-1, 1), [.3, .3]]) } : {}) },
      }[type];
    });
    return { type: t, ...s };
  };
  return shapeOf;
}

test('the reference fields are the fields of SPEC Appendix A', () => {
  const r = rng(20261025), make = shapes(r);
  let compared = 0;
  for (let i = 0; i < 400; i++) {
    const raw = make(0);
    const { document: d } = normalize({ openavatar: '0.1', id: 'org.openavatar.test.appendix', name: 'Appendix', body: { shape: raw, material: 'm' }, materials: { m: { type: 'felt', color: '#888888' } } });
    const s = d.body.shape, f = compileShape(s);
    for (let j = 0; j < 40; j++) {
      const p = [r() * 3 - 1.5, r() * 3 - 1.5, r() * 3 - 1.5], want = field(s, p), got = f(...p);
      if (!Number.isFinite(want) && want === got) continue;
      // Points on an outline's edge or a polygon's vertex row can flip inside/outside between two correct tests.
      if (Math.abs(want) < 1e-9 && Math.abs(got) < 1e-9) continue;
      assert.ok(Math.abs(want - got) <= 1e-6 * Math.max(1, Math.abs(want)), `${JSON.stringify(s)} at ${p}: Appendix A ${want}, reference ${got}`);
      compared++;
    }
  }
  assert.ok(compared > 15000, `compared ${compared} points`);
});

// A.7
const E = (u, a, b, c) => primitive({ type: 'ellipsoid', radii: [a, b, c] }, u);
const Sx = (u, a, b, c, n) => primitive({ type: 'superellipsoid', radii: [a, b, c], exponent: n }, u);
function suitOf(P) {
  const hk = .8 + .4 * P.head, bk = .8 + .4 * P.body;
  let [hw, hh, hd] = [.7 * hk, .6 * hk, .62 * hk];
  if (P.headShape === 'wide') { hw *= 1.15; hh *= .92; }
  if (P.headShape === 'tall') { hh *= 1.15; hw *= .95; }
  let [bw, bh, bd] = [.56 * bk, .56 * bk, .5 * bk];
  if (P.bodyShape === 'round') { bw = bh = Math.max(bw, bh); bd *= 1.08; }
  if (P.bodyShape === 'slim') { bw *= .8; bd *= .85; }
  let by = -.36, hy = by + .672 * (bh + hh);
  const legged = P.legs > .02, L = .14 + .4 * P.legs;
  let bottom = legged ? by - .54 * bh - L : by - .9 * bh;
  const s = -1 - bottom; by += s; hy += s; bottom = -1;
  const head = p => { const u = sub(p, [0, hy, 0]); return P.headShape === 'square' ? Sx(u, hw, hh, hd, 3.2) : E(u, hw, hh, hd); };
  const torso = p => {
    const u = sub(p, [0, by, 0]);
    if (P.bodyShape === 'square') return Sx(u, bw, bh, bd, 3.2);
    if (P.bodyShape === 'pear') return E(u, bw * (1 + .12 * clamp(-u[1] / bh, -1, 1)), bh, bd);
    return E(u, bw, bh, bd);
  };
  const lx = .48 * bw, r = .19 * (.85 + .3 * P.body), a = by - .3 * bh, e = bottom + .6 * r;
  const leg = p => { const h = clamp((p[1] - a) / (e - a)); return norm([Math.abs(p[0]) - lx, p[1] - mix(a, e, h), p[2] - .04 * h]) - r * (1 + .08 * h); };
  const suit = p => { let d = smin(head(p), torso(p), .2); if (legged) d = smin(d, leg(p), .1); return smax(d, -(p[1] - bottom), .06); };
  const k = Math.min(1, 2.05 / (hy + hh + 1));
  return {
    f: p => k * suit([p[0] / k, (p[1] + 1) / k - 1, p[2] / k]),
    head: { center: [0, -1 + (hy + 1) * k, 0], radii: [hw * k, hh * k, hd * k] }, torso: { center: [0, -1 + (by + 1) * k, 0], radii: [bw * k, bh * k, bd * k] },
  };
}

test('the biped suit is the suit of SPEC A.7', async () => {
  const { bipedSuit } = await import('../src/avatar.js');
  const r = rng(7), pick = a => a[Math.floor(r() * a.length)];
  let scaled = 0;
  for (let i = 0; i < 120; i++) {
    const P = { head: pick([0, 1, r()]), body: r(), legs: pick([0, .01, 1, r()]), arms: r(), headShape: pick(['round', 'wide', 'tall', 'square']), bodyShape: pick(['pear', 'round', 'slim', 'square']) };
    const want = suitOf(P), got = bipedSuit(P);
    if (want.head.center[1] < .9 * (.42192 + 1) - 1) scaled++;
    for (const key of ['head', 'torso']) for (const m of ['center', 'radii']) want[key][m].forEach((v, j) => assert.ok(Math.abs(v - got[key][m][j]) < 1e-9, `${key} ${m} of ${JSON.stringify(P)}`));
    for (let j = 0; j < 60; j++) {
      const p = [r() * 2.4 - 1.2, r() * 2.4 - 1.2, r() * 2.4 - 1.2];
      assert.ok(Math.abs(want.f(p) - got.sdf(...p)) < 1e-9, `${JSON.stringify(P)} at ${p}: A.7 ${want.f(p)}, reference ${got.sdf(...p)}`);
    }
  }
  assert.ok(scaled > 0, 'some suits were scaled down');
});

// A.8
test('the hands sit at the arm tips of SPEC A.8', async () => {
  const THREE = await import('three');
  const { OpenAvatar } = await import('../src/index.js');
  const r = rng(11);
  for (let i = 0; i < 12; i++) {
    const style = ['nub', 'paw', 'none'][i % 3], length = r(), thickness = r(), P = { head: r(), body: r(), legs: r(), arms: r() };
    const doc = { openavatar: '0.1', id: 'org.openavatar.test.arms', name: 'Arms', materials: { main: { type: 'felt', color: '#888888' } },
      body: { rig: 'biped', proportions: P, arms: { style, ...(i % 2 ? { length } : {}), thickness } } };
    const a = new OpenAvatar(doc, { quality: 'low' });
    a.object.updateMatrixWorld(true);
    const L = .26 + .4 * (i % 2 ? length : P.arms), rr = .08 + .14 * thickness, t = style === 'paw' ? -L + .3 * rr : -L;
    const T = suitOf({ headShape: 'round', bodyShape: 'pear', ...P }).torso, shoulder = [.9 * T.radii[0], T.center[1] + .5 * T.radii[1], .04];
    const want = [shoulder[0] - t * Math.sin(.42), shoulder[1] + t * Math.cos(.42), shoulder[2]];
    const got = a.bodyMesh.worldToLocal(a.targets['left-hand'].groups[0].getWorldPosition(new THREE.Vector3())).toArray();
    want.forEach((v, j) => assert.ok(Math.abs(v - got[j]) < 1e-6, `${style} hand ${got} != ${want}`));
    const right = a.bodyMesh.worldToLocal(a.targets['right-hand'].groups[0].getWorldPosition(new THREE.Vector3())).toArray();
    assert.ok(Math.abs(right[0] + got[0]) < 1e-6 && Math.abs(right[1] - got[1]) < 1e-6, 'the right hand mirrors the left');
    a.dispose();
  }
});

// A.9, patches
test('a patch moves onto the surface by the root nearest its plane, as SPEC A.9 says', async () => {
  const { patchDepth } = await import('../src/geometry.js');
  const r = rng(29), add = (a, b) => a.map((x, i) => x + b[i]), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = v => scale(v, 1 / norm(v));
  let roots = 0, rootless = 0, skipped = 0;
  for (let i = 0; i < 24; i++) {
    // A lumpy surface, an ellipsoid with a ball grown out of its front, so some lines from the patch cross folds and
    // some pass its sides.
    const raw = { type: 'union', smooth: .15, children: [
      { type: 'ellipsoid', radii: [.5 + .4 * r(), .5 + .4 * r(), .4 + .4 * r()] },
      { type: 'sphere', radius: .15 + .2 * r(), position: [r() - .5, r() - .5, .35 + .2 * r()] }] };
    const { document: d } = normalize({ openavatar: '0.1', id: 'org.openavatar.test.patch', name: 'Patch', body: { shape: raw, material: 'm' }, materials: { m: { type: 'felt', color: '#888888' } } });
    const f = compileShape(d.body.shape), F = p => f(...p);
    // The origin a little off the surface on a random ray from the middle, and its +z tilted off the normal as a
    // `rotation` would; the x axis is negated on a mirrored copy.
    const u = unit([r() - .5, r() - .5, r() * .8 + .2]);
    let lo = 0, hi = 2; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (F(scale(u, m)) < 0) lo = m; else hi = m; }
    const O = scale(u, lo + .01), e = 1e-4;
    const grad = unit([0, 1, 2].map(j => { const a = [...O], b = [...O]; a[j] += e; b[j] -= e; return F(a) - F(b); }));
    const n = unit(add(grad, [(r() - .5) * .4, (r() - .5) * .4, (r() - .5) * .4]));
    const X0 = unit(cross([0, 1, 0], n)), X = i % 2 ? scale(X0, -1) : X0, Y = cross(n, X0), L = F(O);
    const matrix = { elements: [...X, 0, ...Y, 0, ...n, 0, ...O, 1] };
    const got = patchDepth(f, matrix);
    for (let j = 0; j < 40; j++) {
      const x = (r() - .5) * 1.2, y = (r() - .5) * 1.2, B = add(add(O, scale(X, x)), scale(Y, y));
      const g = t => F(add(B, scale(n, t))) - L;
      // Every root in [-0.25, 0.25], from a scan 0.0005 apart.
      const ts = Array.from({ length: 1001 }, (_, k) => -.25 + k * .0005), gs = ts.map(g), found = [];
      for (let k = 1; k < ts.length; k++) if (gs[k] === 0 || Math.sign(gs[k]) !== Math.sign(gs[k - 1])) {
        let a = ts[k - 1], c = ts[k];
        for (let m = 0; m < 50; m++) { const mid = (a + c) / 2; if (Math.sign(g(mid)) === Math.sign(g(a))) a = mid; else c = mid; }
        found.push((a + c) / 2);
      }
      const t = got(x, y);
      if (!found.length) {
        // No root: the least abs(g) in the range.
        const least = Math.min(...gs.map(Math.abs));
        assert.ok(Math.abs(t) <= .25 && Math.abs(g(t)) <= least + 1e-6, `rootless at ${x}, ${y}: depth ${t}, abs(g) ${Math.abs(g(t))} > ${least}`);
        rootless++; continue;
      }
      // A step of 0.02 can't see two roots closer than it; the rule still names the nearest, so those are left out.
      if (found.some((v, k) => k && v - found[k - 1] < .021)) { skipped++; continue; }
      const want = found.reduce((a, b) => Math.abs(b) < Math.abs(a) || (Math.abs(b) === Math.abs(a) && b > a) ? b : a);
      assert.ok(Math.abs(t - want) < 1e-5, `at ${x}, ${y}: depth ${t}, A.9 ${want} (roots ${found})`);
      roots++;
    }
  }
  assert.ok(roots > 500 && rootless > 20 && skipped < roots / 10, `${roots} with a root, ${rootless} without, ${skipped} skipped`);
  // Roots on both sides within one step: the nearer wins, whichever side it is on. The surface here is a slab whose
  // level through the origin is 0.004 off its middle plane, which tilts across the patch.
  const slab = (x, y, z) => Math.abs(z - (.004 - .006 * x)) - .015, depth = patchDepth(slab, { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] });
  for (const x of [.3, .5, .8, 1]) {
    const s = .004 - .006 * x, want = s > 0 ? s - .004 : s + .004;
    assert.ok(Math.abs(depth(x, 0) - want) < 1e-6, `slab at ${x}: depth ${depth(x, 0)}, A.9 ${want}`);
  }
});

// The conformance suite's geometry vectors (SPEC 17.2), against the fields above.
test('the geometry vectors hold the fields of Appendix A', async () => {
  const fs = await import('node:fs');
  const root = new URL('../../../conformance/', import.meta.url), read = rel => fs.readFileSync(new URL(rel, root), 'utf8');
  const manifest = JSON.parse(read('manifest.json'));
  let bodies = 0, parts = 0;
  const check = (points, f, what) => {
    for (const [x, y, z, d] of points) assert.ok(Math.abs(f([x, y, z]) - d) <= 1e-6, `${what} at ${[x, y, z]}: Appendix A ${f([x, y, z])}, vector ${d}`);
  };
  for (const c of manifest.render) {
    const { document: d } = normalize(JSON.parse(read(c.file))), v = JSON.parse(read(c.geometry));
    if (d.body.rig === 'biped') {
      if (!d.body.shape) { check(v.body.points, suitOf({ head: .5, body: .5, legs: .5, arms: .5, headShape: 'round', bodyShape: 'pear', ...d.body.proportions }).f, `${c.id} body`); bodies++; }
    } else { check(v.body.points, p => field(d.body.shape, p), `${c.id} body`); bodies++; }
    for (const p of v.parts) {
      if (p.patch) continue;
      check(p.points, q => field(d.parts.find(x => x.id === p.id).shape, q), `${c.id} part ${p.id}`); parts++;
    }
  }
  assert.ok(bodies > 60 && parts > 60, `${bodies} bodies, ${parts} parts`);
});

// A.9, a solid's center: halfway between its lowest and highest points, found on its field whatever the mesh.
test('a solid\'s extent is its field\'s, at every quality', async () => {
  const { shapeGeometry, solidExtent } = await import('../src/geometry.js');
  const extent = (s, quality) => { const g = shapeGeometry(s, { quality, limit: 5 }); return solidExtent(g.sdf, g.geometry.attributes.position.array); };
  // A turned ellipsoid reaches sqrt(sum of (R·r)²) along each axis.
  const r = [.6, .3, .2], t = [30, 50, 20], R = mul(Rz(rad(t[2])), mul(Ry(rad(t[1])), Rx(rad(t[0])))), pos = [.1, -.2, .05];
  const reach = [0, 1, 2].map(i => Math.hypot(...r.map((v, j) => R[i][j] * v)));
  for (const quality of ['low', 'high']) {
    const { lo, hi } = extent({ type: 'ellipsoid', radii: r, rotation: t, position: pos }, quality);
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(hi[i] - (pos[i] + reach[i])) < 2e-6 && Math.abs(lo[i] - (pos[i] - reach[i])) < 2e-6, `${quality} axis ${i}: ${lo[i]}..${hi[i]}`);
    }
  }
  // A subtract's box is its first child's, but its extent is what is left; a puffed star's top runs along a ridge.
  const bite = { type: 'subtract', children: [{ type: 'sphere', radius: .5 }, { type: 'box', size: [2, 1, 2], position: [0, .5, 0] }] };
  const b = extent(bite, 'low');
  assert.ok(Math.abs(b.hi[1]) < 2e-6 && Math.abs(b.lo[1] + .5) < 2e-6, `bite: ${b.lo[1]}..${b.hi[1]}`);
  const star = { type: 'extrusion', outline: { type: 'star', points: 5, radius: .6, innerRadius: .3 }, depth: .2, rounding: .05, puff: .8, rotation: [0, 0, 17] };
  const [low, high] = ['low', 'high'].map(q => extent(star, q));
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(low.lo[i] - high.lo[i]) < 2e-6 && Math.abs(low.hi[i] - high.hi[i]) < 2e-6, `star axis ${i}: ${low.lo[i]}..${low.hi[i]} vs ${high.lo[i]}..${high.hi[i]}`);
});

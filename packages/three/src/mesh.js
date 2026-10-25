// Dual contouring of a signed distance field on a grid, returning plain
// arrays (positions, normals, uvs, indices) so it runs in a worker or in Node.
// Adapted from Enconvo's plush renderer. Away from the surface only the
// field's sign matters, so the grid goes in blocks of BLK cells: a block whose
// center is farther from the surface than `lip` times its half-diagonal cannot
// hold a crossing, costs that one sample, and its cells are skipped. `lip`
// bounds the field's slope and is generous because smooth unions, deformers
// and ellipsoids are not exact distances.
const BLK = 4;

/**
 * @param {(x: number, y: number, z: number) => number} sdf
 * @param {number[]} lo the grid's lower corner
 * @param {number[]} hi its upper corner
 * @param {number} h the cell size
 * @returns {{ positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: Uint32Array }}
 */
export function contour(sdf, lo, hi, h, { uvk = .25, lip = 2 } = {}) {
  const nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1, nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
  const cx = nx - 1, cy = ny - 1, cz = nz - 1, bx = Math.ceil(cx / BLK), by = Math.ceil(cy / BLK), bz = Math.ceil(cz / BLK);
  const F = new Float32Array(nx * ny * nz).fill(NaN), far = new Uint8Array(bx * by * bz), fv = new Float32Array(bx * by * bz);
  for (let pass = 0; pass < 2; pass++) for (let bk = 0, b = 0; bk < bz; bk++) for (let bj = 0; bj < by; bj++) for (let bi = 0; bi < bx; bi++, b++) {
    const i0 = bi * BLK, i1 = Math.min(i0 + BLK, cx), j0 = bj * BLK, j1 = Math.min(j0 + BLK, cy), k0 = bk * BLK, k1 = Math.min(k0 + BLK, cz);
    if (pass === 0) {
      const d = sdf(lo[0] + (i0 + i1) * .5 * h, lo[1] + (j0 + j1) * .5 * h, lo[2] + (k0 + k1) * .5 * h);
      if (Math.abs(d) > lip * .5 * h * Math.hypot(i1 - i0, j1 - j0, k1 - k0)) { far[b] = 1; fv[b] = d; continue; }
    } else if (!far[b]) continue;
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0, q = i0 + nx * (j + ny * k); i <= i1; i++, q++)
      if (F[q] !== F[q]) F[q] = pass ? fv[b] : sdf(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h);
  }
  const cell = new Int32Array(cx * cy * cz).fill(-1);
  const OFF = [0, 1, nx, nx + 1, nx * ny, nx * ny + 1, nx * ny + nx, nx * ny + nx + 1];
  const CO = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const ED = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const P = [], N = [], UV = [], I = [], v = new Float32Array(8), e = h * .5;
  const near = fn => {
    for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) {
      const row = bx * (((j / BLK) | 0) + by * ((k / BLK) | 0));
      for (let bi = 0; bi < bx; bi++) if (!far[row + bi]) for (let i = bi * BLK, i1 = Math.min(i + BLK, cx); i < i1; i++) fn(i, j, k);
    }
  };
  near((i, j, k) => {
    const b = i + nx * (j + ny * k); let m = 0;
    for (let c = 0; c < 8; c++) { v[c] = F[b + OFF[c]]; if (v[c] < 0) m |= 1 << c; }
    if (m === 0 || m === 255) return;
    // The cell's vertex: the mean of its edge crossings, then pulled onto the surface.
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, c] of ED) {
      if ((v[a] < 0) !== (v[c] < 0)) {
        const t = v[a] / (v[a] - v[c]);
        sx += CO[a][0] + (CO[c][0] - CO[a][0]) * t; sy += CO[a][1] + (CO[c][1] - CO[a][1]) * t; sz += CO[a][2] + (CO[c][2] - CO[a][2]) * t; n++;
      }
    }
    let x = lo[0] + (i + sx / n) * h, y = lo[1] + (j + sy / n) * h, z = lo[2] + (k + sz / n) * h;
    let gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
    const d = Math.min(h, Math.max(-h, sdf(x, y, z))); x -= gx * d; y -= gy * d; z -= gz * d;
    cell[i + cx * (j + cy * k)] = P.length / 3; P.push(x, y, z); N.push(gx, gy, gz); UV.push(x * uvk + .5, y * uvk + .5);
  });
  const C = (i, j, k) => cell[i + cx * (j + cy * k)];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I.push(a, c, b, a, d, c); else I.push(a, b, c, a, c, d); };
  near((i, j, k) => {
    const q = i + nx * (j + ny * k), in0 = F[q] < 0;
    if (j > 0 && k > 0 && in0 !== (F[q + 1] < 0)) quad(C(i, j - 1, k - 1), C(i, j, k - 1), C(i, j, k), C(i, j - 1, k), !in0);
    if (i > 0 && k > 0 && in0 !== (F[q + nx] < 0)) quad(C(i - 1, j, k - 1), C(i - 1, j, k), C(i, j, k), C(i, j, k - 1), !in0);
    if (i > 0 && j > 0 && in0 !== (F[q + nx * ny] < 0)) quad(C(i - 1, j - 1, k), C(i, j - 1, k), C(i, j, k), C(i - 1, j, k), !in0);
  });
  return { positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array(I) };
}

// Moves out, in steps, each face of the box (lo, hi) that the solid still crosses, probed on an n × n grid, up to the
// limit: a shape's box (sdf.js shapeBounds) is worked out from its members and can fall short where deformers and
// inflate stretch the field together.
function fitBox(sdf, lo, hi, limit, n = 24, step = .05) {
  const p = [0, 0, 0];
  for (let round = 0; round < 64; round++) {
    let moved = false;
    for (let a = 0; a < 3; a++) for (const box of [lo, hi]) {
      if (Math.abs(box[a]) >= limit) continue;
      const [u, v] = a === 0 ? [1, 2] : a === 1 ? [0, 2] : [0, 1];
      let hit = false;
      p[a] = box[a];
      for (let i = 0; i <= n && !hit; i++) for (let j = 0; j <= n && !hit; j++) {
        p[u] = lo[u] + (hi[u] - lo[u]) * i / n; p[v] = lo[v] + (hi[v] - lo[v]) * j / n;
        hit = sdf(p[0], p[1], p[2]) < 0;
      }
      if (hit) { box[a] = box === hi ? Math.min(limit, box[a] + step) : Math.max(-limit, box[a] - step); moved = true; }
    }
    if (!moved) return;
  }
}

/**
 * Meshes a shape inside its bounds with about `cells` cells along the longest
 * side, finer for a thin shape so it keeps at least four cells across, and
 * never more than `maxNodes` grid nodes, so the time spent is bounded
 * (SPEC 16.1). The bounds are clipped to `limit` on every axis. With `fit`, a
 * box the solid reaches past is first grown to hold it; leave it off for a
 * field the box is meant to cut.
 */
export function meshField(sdf, bounds, { cells = 110, minStep = .004, limit = 1.6, pad = .03, maxNodes = 3e6, fit = false } = {}) {
  const lo = bounds.lo.map(v => Math.max(-limit, v - pad)), hi = bounds.hi.map(v => Math.min(limit, v + pad));
  if (fit) fitBox(sdf, lo, hi, limit);
  const ext = hi.map((v, i) => v - lo[i]), span = Math.max(...ext), thin = Math.min(...bounds.hi.map((v, i) => v - bounds.lo[i]));
  let h = Math.max(minStep, Math.min(span / cells, thin / 4));
  while (ext.reduce((n, e) => n * (Math.ceil(e / h) + 1), 1) > maxNodes) h *= 1.15;
  return contour(sdf, lo, hi, h);
}

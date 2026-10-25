// The geometry vectors of the conformance suite (SPEC 17.2). For a document, the reference renderer's avatar at rest
// gives: the body's field at sample points, each placed part copy's placement and its own field at sample points, and
// where the arms, the hands and the face features sit. An implementation compares its own fields and placements with
// these numbers, whatever it draws with.
import * as THREE from 'three';
import { OpenAvatar } from '@openavatar/three';

const r6 = x => Math.round(x * 1e6) / 1e6 + 0;
const seedOf = id => [...id].reduce((h, c) => (Math.imul(h, 31) + c.codePointAt(0)) >>> 0, 7);
function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; }

// `n` points spread over the box and `n` more within `near` of the surface, each [x, y, z, value]. The point is rounded
// before the field is read, so the value is exactly the field's at the written point.
function samples(f, lo, hi, r, n, near) {
  const pick = () => [0, 1, 2].map(i => r6(lo[i] + (hi[i] - lo[i]) * r()));
  const out = [];
  for (let i = 0; i < n; i++) { const p = pick(); out.push([...p, r6(f(...p))]); }
  for (let tries = 0, k = 0; k < n && tries < n * 2000; tries++) {
    const p = pick(), d = f(...p);
    if (Math.abs(d) < near) { out.push([...p, r6(d)]); k++; }
  }
  return out;
}

/** Writes a geometry vector file's object for one document. */
export function geometryVectors(doc, id, { quality = 'high' } = {}) {
  const a = new OpenAvatar(doc, { quality });
  try {
    const r = rng(seedOf(id));
    a.object.updateMatrixWorld(true);
    const body = new THREE.Matrix4().copy(a.bodyMesh.matrixWorld).invert();
    // An object's placement in the body's space, as the top three rows of its 4×4 matrix.
    const rows = o => {
      const m = new THREE.Matrix4().multiplyMatrices(body, o.matrixWorld).elements;
      return [0, 1, 2].map(i => [m[i], m[4 + i], m[8 + i], m[12 + i]].map(r6));
    };
    const toBody = new THREE.Matrix4().multiplyMatrices(body, a.face.group.matrixWorld);
    const point = p => p.clone().applyMatrix4(toBody).toArray().map(r6);
    const normal = n => n.clone().transformDirection(toBody).toArray().map(r6);
    const out = { $comment: `Geometry vectors for ${id} (SPEC 17.2); see ../README.md.` };
    const { lo, hi } = a.bodyBounds;
    out.body = { points: samples(a.bodySdf, lo.map(v => v - .15), hi.map(v => v + .15), r, 40, .08) };
    out.parts = [];
    for (const [pid, entry] of a.parts) {
      entry.copies.forEach((c, copy) => {
        const g = c.mesh.geometry; if (!g.boundingBox) g.computeBoundingBox();
        const b = g.boundingBox;
        out.parts.push({ id: pid, copy, ...(c.mesh.userData.restsHidden ? { hidden: true } : {}), ...(entry.part.patch ? { patch: true } : {}), matrix: rows(c.mesh),
          points: samples(c.sdf, b.min.toArray().map(v => v - .08), b.max.toArray().map(v => v + .08), r, 12, .05) });
      });
    }
    out.arms = a.arms.map(arm => ({ side: arm.side > 0 ? 'left' : 'right', matrix: rows(arm.group) }));
    out.hands = { left: rows(a.targets['left-hand'].groups[0]), right: rows(a.targets['right-hand'].groups[0]) };
    const f = a.face, frame = fr => ({ p: point(fr.p), n: normal(fr.n) });
    const placed = g => ({ p: point(g.position), n: normal(new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion)) });
    out.face = f.type === 'none' ? null : {
      eyes: f.eyes.map(e => frame(e.frame)),
      mouth: f.mouth ? frame(f.mouth.frame) : null,
      brows: f.brows ? f.brows.map(b => placed(b.a)) : null,
      cheeks: f.cheeks ? f.cheeks.map(placed) : null,
    };
    return out;
  } finally { a.dispose(); }
}

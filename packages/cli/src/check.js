// Checks a file the way SPEC 14.1 and 15 ask, then builds it with the
// reference renderer to measure it against the size rule of SPEC 4. Errors
// are what a writer got wrong (a reader repairs or rejects them); warnings
// are SHOULDs.
import { validate, normalize, OpenAvatarError, LIMITS } from '@openavatar/core';

export const MAX_BYTES = LIMITS.fileBytes ?? 256 * 1024;
const SHOULD_FIT = 1.5, MUST_FIT = 2;

/**
 * @param {Uint8Array} bytes the file's contents
 * @param {{ geometry?: boolean }} [options] geometry: build the avatar to measure it
 * @returns {Promise<{ ok: boolean, fatal: {code: string, message: string} | null, errors: {path: string, message: string}[],
 *   warnings: string[], document: object | null, value: unknown, bounds: {min: number[], max: number[]} | null,
 *   body: {min: number[], max: number[]} | null, buildMs: number | null }>}
 */
export async function checkBytes(bytes, { geometry = true } = {}) {
  const r = { ok: false, fatal: null, errors: [], warnings: [], document: null, value: undefined, bounds: null, body: null, buildMs: null };
  const fail = (code, message) => { r.fatal = { code, message }; return r; };
  if (bytes.length > MAX_BYTES) return fail('limit', `the file is ${kb(bytes.length)}; it must not be larger than ${kb(MAX_BYTES)} (SPEC 14.1)`);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { return fail('not-utf8', 'the file is not UTF-8 text (SPEC 14.1)'); }
  if (text.charCodeAt(0) === 0xfeff) { r.errors.push({ path: '', message: 'the file starts with a byte order mark (SPEC 14.1)' }); text = text.slice(1); }
  try { r.value = JSON.parse(text); } catch (e) { return fail('json', `the file is not JSON: ${e.message}`); }
  const v = validate(r.value);
  const rejected = v.errors.find(e => e.code);
  if (rejected) return fail(rejected.code, rejected.path ? `${rejected.path}: ${rejected.message}` : rejected.message);
  r.errors.push(...v.errors);
  try { r.document = normalize(r.value).document; } catch (e) {
    if (e instanceof OpenAvatarError) return fail(e.code, e.message);
    throw e;
  }
  // An `x-` expression the document names but doesn't define shows neutral (SPEC 8.5, 13.4).
  const own = r.document.face?.expressions || {};
  for (const [kind, map] of Object.entries(r.document.behavior?.reactions || {})) for (const [id, reaction] of Object.entries(map || {})) {
    const e = reaction?.expression;
    if (typeof e === 'string' && e.startsWith('x-') && !own[e]) r.warnings.push(`behavior.reactions.${kind}.${id}.expression "${e}" is not defined in face.expressions, so it shows neutral; define its poses there`);
  }
  if (geometry) Object.assign(r, await measure(r.document, r.warnings, r.errors));
  r.ok = !r.fatal && r.errors.length === 0;
  return r;
}

/** Builds the document in Node (no WebGL needed) and checks its size. */
export async function measure(document, warnings = [], errors = []) {
  const { OpenAvatar } = await import('@openavatar/three');
  const t0 = performance.now();
  let a;
  try { a = new OpenAvatar(document, { quality: 'low' }); } catch (e) {
    errors.push({ path: '', message: `the reference renderer could not build it: ${e.message}` });
    return { bounds: null, buildMs: null };
  }
  const buildMs = Math.round(performance.now() - t0);
  const min = a.bounds.min.toArray().map(round), max = a.bounds.max.toArray().map(round);
  const g = a.bodyMesh.geometry; if (!g.boundingBox) g.computeBoundingBox();
  const body = [...g.boundingBox.min.toArray(), ...g.boundingBox.max.toArray()].map(round);
  for (const [i, id, host] of hiddenParts(a)) warnings.push(`parts[${i}] "${id}" is hidden inside ${host}; move it out or raise its lift`);
  // A front point or ray that meets no surface puts the part or feature at a fallback spot (SPEC A.9).
  for (const m of a.misses) warnings.push(`${m.path} ${JSON.stringify(m.value)} misses ${m.target}, so it sits ${m.path.endsWith('.direction') ? 'at its center' : 'at z = 0 there'}; move it onto the surface`);
  a.dispose();
  const far = list => Math.max(...list.map(Math.abs));
  const reach = far([...min, ...max]), bodyReach = far(body);
  if (!Number.isFinite(reach)) { errors.push({ path: 'body', message: 'the avatar has no visible shape' }); return { bounds: null, buildMs }; }
  // The renderer meshes a body inside ±1.6 only, so a larger one measures 1.6.
  if (bodyReach >= 1.59) errors.push({ path: 'body', message: `the body reaches past 1.6, where the renderer cuts it off; it must fit inside ±${SHOULD_FIT} (SPEC 4)` });
  else if (bodyReach > SHOULD_FIT) errors.push({ path: 'body', message: `the body reaches ${bodyReach}; it must fit inside ±${SHOULD_FIT} (SPEC 4)` });
  else if (bodyReach > 1.05) warnings.push(`the body reaches ${bodyReach}; it should fit inside ±1 (SPEC 4)`);
  if (reach > MUST_FIT) errors.push({ path: 'parts', message: `the avatar reaches ${reach}; with its parts it must fit inside ±${MUST_FIT} (SPEC 4)` });
  else if (reach > SHOULD_FIT) warnings.push(`the avatar reaches ${reach}; with its parts it should fit inside ±${SHOULD_FIT} (SPEC 4)`);
  const tall = round(max[1] - min[1]);
  if (tall < 1.2) warnings.push(`the avatar is ${tall} tall; a body about two units tall is the normal size (SPEC 4)`);
  return { bounds: { min, max }, body: { min: body.slice(0, 3), max: body.slice(3) }, buildMs };
}

// Parts whose every copy lies almost wholly inside the body solid, or inside another part, where nothing of them
// shows. Glass shows them only as a haze, so a glass body counts too; a glass part shows what it holds. What counts
// is surface area, sampled across each triangle: a mesh's vertices can all sit in a hidden end (a capsule's caps)
// while its visible side has none.
const SAMPLES = [[1 / 3, 1 / 3, 1 / 3], [2 / 3, 1 / 6, 1 / 6], [1 / 6, 2 / 3, 1 / 6], [1 / 6, 1 / 6, 2 / 3]];
function hiddenParts(a) {
  const hidden = [], inv = a.bodyMesh.matrixWorld.clone().invert();
  const [p, q, A, B, C, ab, ac] = Array.from({ length: 7 }, () => a.bounds.min.clone());
  // A part hidden at rest (one that appears only in some situations) neither hides nor is hidden at rest.
  const solids = [...a.parts.values()].filter(e => !e.part.patch && e.made.spec?.type !== 'glass')
    .flatMap(e => e.copies.filter(c => !c.mesh.userData.restsHidden).map(c => ({ id: e.part.id, f: e.sdf, inv: c.mesh.matrixWorld.clone().invert() })));
  (a.document.parts || []).forEach((part, i) => {
    const entry = a.parts.get(part.id);
    if (!entry || part.patch || entry.copies.every(c => c.mesh.userData.restsHidden)) return;
    const by = new Map();
    // The solid a point lies deepest in, if any: where the body and a part overlap, the one that holds it.
    const hostAt = point => {
      q.copy(point).applyMatrix4(inv);
      let depth = a.bodySdf(q.x, q.y, q.z), host = 'the body';
      for (const s of solids) {
        if (s.id === part.id) continue;
        q.copy(point).applyMatrix4(s.inv);
        const d = s.f(q.x, q.y, q.z);
        if (d < depth) { depth = d; host = `part "${s.id}"`; }
      }
      return depth < -.005 ? host : null;
    };
    const inside = entry.copies.every(c => {
      const { matrixWorld } = c.mesh, pos = c.mesh.geometry.attributes.position, index = c.mesh.geometry.index;
      const vertex = k => (index ? index.getX(k) : k), tris = Math.floor((index ? index.count : pos.count) / 3);
      const step = Math.max(1, Math.floor(tris / 200));
      let total = 0, under = 0;
      for (let t = 0; t < tris; t += step) {
        A.fromBufferAttribute(pos, vertex(3 * t)).applyMatrix4(matrixWorld);
        B.fromBufferAttribute(pos, vertex(3 * t + 1)).applyMatrix4(matrixWorld);
        C.fromBufferAttribute(pos, vertex(3 * t + 2)).applyMatrix4(matrixWorld);
        const area = ab.subVectors(B, A).cross(ac.subVectors(C, A)).length() / 2 / SAMPLES.length;
        if (!(area > 0)) continue;
        for (const [u, v, w] of SAMPLES) {
          p.set(0, 0, 0).addScaledVector(A, u).addScaledVector(B, v).addScaledVector(C, w);
          total += area;
          const host = hostAt(p);
          if (host) { under += area; by.set(host, (by.get(host) || 0) + area); }
        }
      }
      return total > 0 && under / total > .9;
    });
    if (!inside) return;
    // Name every host that holds a good share of it: an antenna can be half in the body and half in its bulb.
    const hosts = [...by].sort((x, y) => y[1] - x[1]);
    const sum = hosts.reduce((n, [, v]) => n + v, 0);
    hidden.push([i, part.id, hosts.filter(([, v]) => v >= sum / 4).map(([h]) => h).join(' and ')]);
  });
  return hidden;
}

const round = x => Math.round(x * 100) / 100;
export const kb = n => `${Math.round(n / 102.4) / 10} KB`;

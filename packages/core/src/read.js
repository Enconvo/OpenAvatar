// Reading documents (SPEC 15, 17.1). validate() reports everything a writer
// got wrong; normalize() repairs the same things the way a reader must and
// says what it changed. Both walk model.js. A document is rejected only for
// what section 15 lists: not an object, no openavatar/id/name/body, a higher
// major version, or a limit of 5.6 or 14.1.
import {
  DOCUMENT, SHAPES, SHAPE_COMMON, OUTLINES, OUTLINE_COMMON, DEFORMERS, PLACEMENTS, LIMITS, XID, ID,
} from './model.js';
import V from './vocabulary.js';

export const SPEC_VERSION = '0.1';
const MAJOR = 0;

export class OpenAvatarError extends Error {
  /** @param {string} code @param {string} message @param {string} [path] */
  constructor(code, message, path = '') {
    super(path ? `${path}: ${message}` : message);
    this.name = 'OpenAvatarError'; this.code = code; this.path = path;
  }
}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const join = (path, key) => typeof key === 'number' ? `${path}[${key}]` : path ? `${path}.${key}` : key;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Code point order (SPEC B.1), which is also the byte order of UTF-8. Up to
// the first difference both strings hold the same code units, so it falls on
// the start of a code point in both, or on two low surrogates after one high.
export function byCodePoint(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a.codePointAt(i), y = b.codePointAt(i);
    if (x !== y) return x - y;
  }
  return a.length - b.length;
}

const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/;
/**
 * The instant an RFC 3339 date-time names, in milliseconds since 1970 UTC
 * with the digits past the millisecond ignored, or NaN when the text is not
 * a real date-time (SPEC B.2).
 * @param {unknown} text
 */
export function instant(text) {
  const m = typeof text === 'string' ? DATE_TIME.exec(text) : null;
  if (!m) return NaN;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number), oh = +(m[9] || 0), om = +(m[10] || 0);
  const feb = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28;
  if (mo < 1 || mo > 12 || d < 1 || d > [31, feb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1] || h > 23 || mi > 59 || s > 60 || oh > 23 || om > 59) return NaN;
  const t = new Date(0);
  t.setUTCFullYear(y, mo - 1, d); t.setUTCHours(h, mi, s, +(m[7] || '').padEnd(3, '0').slice(0, 3));
  const at = t.getTime() - (m[8] === '-' ? -1 : 1) * (oh * 60 + om) * 60000;
  // A leap second is 23:59:60 in UTC and counts as the start of the next minute.
  if (s === 60) { const u = new Date(at - 60000); if (u.getUTCHours() !== 23 || u.getUTCMinutes() !== 59) return NaN; }
  return at;
}

/**
 * Which of two files holding the same id a reader of the shared folder shows
 * (SPEC 14.2): > 0 when a wins. Each copy is { updated, mtime, file }: its
 * meta.updated as written, the file's modification time in milliseconds and
 * the file's name (or its path; the files share a folder).
 */
export function compareCopies(a, b) {
  const ta = instant(a.updated), tb = instant(b.updated);
  if (Number.isNaN(ta) !== Number.isNaN(tb)) return Number.isNaN(tb) ? 1 : -1;
  if (ta !== tb && !Number.isNaN(ta)) return ta - tb;
  if (a.mtime !== b.mtime) return a.mtime - b.mtime;
  return -byCodePoint(String(a.file), String(b.file));
}

class Reader {
  constructor() { this.issues = []; this.shapes = 0; this.points = 0; }
  issue(path, message) { this.issues.push({ path, message }); }
  fatal(code, path, message) { throw new OpenAvatarError(code, message, path); }

  // Returns the repaired value, or undefined to drop the member.
  walk(d, v, path, depth = 0) {
    if (v === null && d.nullable) return null;
    switch (d.k) {
      case 'any': return isObj(v) ? v : this.drop(path, 'must be an object');
      case 'num': case 'int': {
        if (typeof v !== 'number' || !Number.isFinite(v)) return this.drop(path, 'must be a number');
        let x = d.k === 'int' ? Math.round(v) : v;
        if (d.k === 'int' && x !== v) this.issue(path, 'must be a whole number');
        if (x < d.min || x > d.max) { this.issue(path, `must be from ${d.min} to ${d.max}`); x = clamp(x, d.min, d.max); }
        return x;
      }
      case 'bool': return typeof v === 'boolean' ? v : this.drop(path, 'must be true or false');
      case 'str': {
        if (typeof v !== 'string') return this.drop(path, 'must be a string');
        let s = v;
        // Lengths count code points, as JSON Schema does, and a cut never splits one.
        if (s.length > d.max) { const cps = [...s]; if (cps.length > d.max) { this.issue(path, `must be at most ${d.max} characters`); s = cps.slice(0, d.max).join(''); } }
        if (s.length < (d.min ?? 0)) return this.drop(path, 'must not be empty');
        if (d.pattern && !d.pattern.test(s)) return this.drop(path, 'has the wrong form');
        if (d.date && Number.isNaN(instant(s))) return this.drop(path, 'is not a real date and time');
        return s;
      }
      case 'color': {
        if (typeof v !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return this.drop(path, 'must be a color #RRGGBB');
        const h = v.length === 4 ? v.slice(1).split('').map(c => c + c).join('') : v.slice(1);
        return '#' + h.toUpperCase();
      }
      case 'vec': {
        if (!Array.isArray(v) || v.length !== d.n || v.some(x => typeof x !== 'number' || !Number.isFinite(x))) return this.drop(path, `must be ${d.n} numbers`);
        if (v.some(x => x < d.min || x > d.max)) this.issue(path, `numbers must be from ${d.min} to ${d.max}`);
        return v.map(x => clamp(x, d.min, d.max));
      }
      case 'enum': {
        if (d.values.includes(v) || (d.x && typeof v === 'string' && XID.test(v))) return v;
        this.issue(path, `is not a known value${typeof v === 'string' ? ` (${JSON.stringify(v.slice(0, 40))})` : ''}`);
        return d.fallback === undefined ? undefined : d.fallback;
      }
      case 'either': {
        // The first alternative that takes the value without complaint, else the first that repairs it.
        for (const alt of d.alts) { const r = new Reader(); const out = r.walk(alt, v, path, depth); if (out !== undefined && !r.issues.length) return this.adopt(r, alt, v, path, depth); }
        for (const alt of d.alts) { const r = new Reader(); if (r.walk(alt, v, path, depth) !== undefined) return this.adopt(r, alt, v, path, depth); }
        return this.drop(path, 'has the wrong type');
      }
      case 'obj': return this.object(d, v, path, depth);
      case 'arr': {
        if (!Array.isArray(v)) return this.drop(path, 'must be an array');
        let items = v;
        if (items.length > d.max) { this.issue(path, `must have at most ${d.max} items`); items = items.slice(0, d.max); }
        let out = [];
        items.forEach((x, i) => { const y = this.walk(d.of, x, join(path, i), depth); if (y !== undefined) out.push([i, y]); });
        if (d.unique) {
          const seen = new Set();
          out = out.filter(([i, y]) => seen.has(y) ? (this.issue(join(path, i), 'repeats an earlier item'), false) : seen.add(y));
        }
        if (out.length < (d.min ?? 0)) return this.drop(path, `must have at least ${d.min} items`);
        return out.map(([, y]) => y);
      }
      case 'map': {
        if (!isObj(v)) return this.drop(path, 'must be an object');
        const kept = [];
        for (const [key, x] of Object.entries(v)) {
          const p = join(path, key);
          if (this.walkKey(d.key, key, p) === undefined) continue;
          const y = this.walk(d.of, x, p, depth); if (y !== undefined) kept.push([key, y]);
        }
        // JSON parsers disagree on the order of members, so over the limit the keys that sort first stay.
        if (kept.length > d.max) {
          const stay = new Set(kept.map(([key]) => key).sort(byCodePoint).slice(0, d.max));
          for (const [key] of kept) if (!stay.has(key)) this.issue(join(path, key), `is over the limit of ${d.max} entries`);
          return Object.fromEntries(kept.filter(([key]) => stay.has(key)));
        }
        return Object.fromEntries(kept);
      }
      case 'shape': return this.shape(v, path, depth + 1, false);
      case 'outline': return this.shape(v, path, depth + 1, true);
      case 'children': {
        if (!Array.isArray(v)) return this.drop(path, 'must be an array of shapes');
        let items = v;
        if (items.length > d.max) { this.issue(path, `must have at most ${d.max} children`); items = items.slice(0, d.max); }
        // Keeps each child's place (a dropped one is null) so subtract knows whether its base survived.
        return items.map((x, i) => this.walk(d.of, x, join(path, i), depth) ?? null);
      }
      case 'points': {
        if (!Array.isArray(v)) return this.drop(path, 'must be an array of points');
        this.points += v.length;
        if (this.points > LIMITS.points) this.fatal('limit', path, `the document has more than ${LIMITS.points} points`);
        const pts = v.slice(0, d.max).filter(p => Array.isArray(p) && p.length === 2 && p.every(x => typeof x === 'number' && Number.isFinite(x)));
        if (pts.length !== v.length) this.issue(path, `must be ${d.min} to ${d.max} points [x, y]`);
        if (pts.length < d.min) return undefined;
        return pts.map(p => p.map(x => clamp(x, -3, 3)));
      }
      case 'deformer': {
        if (!isObj(v) || !DEFORMERS[v.type]) return this.drop(path, 'is not a known deformer');
        return this.object({ k: 'obj', members: { type: { k: 'str', max: 16 }, ...DEFORMERS[v.type].members }, required: ['type', ...DEFORMERS[v.type].required] }, v, path, depth);
      }
    }
    throw new Error(`model kind ${d.k}`);
  }
  adopt(r, alt, v, path, depth) { return this.walk(alt, v, path, depth); }
  walkKey(d, key, path) {
    const r = new Reader(); const out = r.walk(d, key, path);
    if (out === undefined || out !== key) { this.issue(path, 'is not a known key'); return undefined; }
    return key;
  }
  drop(path, message) { this.issue(path, message); return undefined; }

  object(d, v, path, depth) {
    if (!isObj(v)) return this.drop(path, 'must be an object');
    const out = {};
    for (const [key, x] of Object.entries(v)) {
      const m = d.members[key], p = join(path, key);
      if (!m) { this.issue(p, 'is not a member of OpenAvatar 0.1'); continue; }
      const y = this.walk(m, x, p, depth);
      if (y !== undefined) out[key] = y;
    }
    for (const key of d.required || []) if (out[key] === undefined) return this.drop(join(path, key), 'is required');
    if (d.exclusive) {
      const used = d.exclusive.filter(k => out[k] !== undefined);
      // SPEC 9.1 lists one way to place a part; the first of position, at, direction wins.
      for (const k of used.slice(1)) { this.issue(join(path, k), `cannot be used with ${used[0]}`); delete out[k]; }
    }
    if (d.oneOfRequired) {
      const used = d.oneOfRequired.filter(k => out[k] !== undefined);
      if (!used.length) return this.drop(path, `needs one of ${d.oneOfRequired.join(', ')}`);
      for (const k of used.slice(1)) { this.issue(join(path, k), `cannot be used with ${used[0]}`); delete out[k]; }
    }
    return out;
  }

  // A shape or an outline (SPEC 5). Undefined means empty.
  shape(v, path, depth, outline) {
    const table = outline ? OUTLINES : SHAPES, what = outline ? 'outline' : 'shape';
    if (!isObj(v)) return this.drop(path, `must be a${outline ? 'n outline' : ' shape'}`);
    if (depth > LIMITS.depth) this.fatal('limit', path, `shapes are nested more than ${LIMITS.depth} deep`);
    if (++this.shapes > LIMITS.shapes) this.fatal('limit', path, `the document has more than ${LIMITS.shapes} shapes and outlines`);
    const t = table[v.type];
    if (!t) return this.drop(path, `is not a known ${what} type${typeof v.type === 'string' ? ` (${JSON.stringify(v.type.slice(0, 40))})` : ''}`);
    const d = { k: 'obj', members: { type: { k: 'str', max: 16 }, ...(outline ? OUTLINE_COMMON : SHAPE_COMMON), ...t.members }, required: ['type', ...t.required] };
    const out = this.object(d, v, path, depth);
    if (!out || !out.children) return out;
    // Combinators after their children were read: a subtract whose base is gone is empty; one child left is a union of it.
    const kids = out.children, live = kids.filter(Boolean);
    if (out.type === 'subtract' && !kids[0]) return this.drop(join(path, 'children[0]'), 'the base of a subtract is empty, so the subtract is empty');
    if (!live.length) return this.drop(path, `has no ${what}s left`);
    out.children = live;
    if (out.type !== 'union' && live.length < 2) { this.issue(path, `a ${out.type} needs two ${what}s`); out.type = 'union'; }
    return out;
  }
}

// ---------- checks beyond the shape of the data (SPEC 17.1) ----------
function crossCheck(r, doc) {
  const parts = doc.parts || [], seen = new Set();
  parts.forEach((p, i) => {
    if (seen.has(p.id)) {
      // <id>-<n> with the smallest n from 2 that no earlier part has, the id cut so it stays within 32 characters.
      let n = 2, id;
      do { const tail = `-${n++}`; id = p.id.slice(0, 32 - tail.length) + tail; } while (seen.has(id));
      r.issue(`parts[${i}].id`, `repeats an earlier part id, renamed ${id}`); p.id = id;
    }
    seen.add(p.id);
    const to = p.attach?.to;
    if (to && !V.attachTargets.includes(to) && !parts.slice(0, i).some(q => q.id === to)) {
      r.issue(`parts[${i}].attach.to`, `names no part listed earlier (${to}), so it is attached to the body`); p.attach.to = 'body';
    }
  });
  const known = new Set(Object.keys(doc.materials || {}));
  const ref = (m, path) => { if (typeof m === 'string' && !known.has(m) && !(m === 'main' && path === 'body.material')) r.issue(path, `names no material (${m}); the body's material is used`); };
  ref(doc.body?.material, 'body.material');
  ref(doc.body?.arms?.material, 'body.arms.material');
  parts.forEach((p, i) => ref(p.material, `parts[${i}].material`));
}

function header(r, v) {
  if (!isObj(v)) r.fatal('not-object', '', 'an OpenAvatar document must be a JSON object');
  for (const key of ['openavatar', 'id', 'name', 'body']) if (v[key] === undefined) r.fatal('missing', key, 'is required');
  const m = typeof v.openavatar === 'string' && /^(\d+)\.(\d+)$/.exec(v.openavatar);
  if (!m) r.fatal('version', 'openavatar', 'must be a version such as "0.1"');
  if (+m[1] > MAJOR) r.fatal('version', 'openavatar', `this reader reads OpenAvatar ${MAJOR}.x; the document is ${v.openavatar}`);
  if (typeof v.name !== 'string' || !v.name.trim()) r.fatal('missing', 'name', 'must be a non-empty string');
  if (typeof v.id !== 'string' || !v.id) r.fatal('missing', 'id', 'must be a non-empty string');
}

function read(v) {
  const r = new Reader();
  header(r, v);
  // The members a document cannot lack are repaired before the walk, which would otherwise drop the document.
  const id = v.id.replace(/[^A-Za-z0-9._-]/gu, '-');
  if (id !== v.id) { r.issue('id', `may hold only A-Z a-z 0-9 . _ -, so it is read as ${JSON.stringify(id.slice(0, 40))}`); v.id = id; }
  if (!isObj(v.body)) { r.issue('body', 'must be an object; a blob with no shape is used'); v.body = {}; }
  const doc = r.walk(DOCUMENT, v, '');
  if (!doc || !ID.test(doc.id)) r.fatal('invalid', '', 'the document could not be read');
  if (doc.openavatar !== SPEC_VERSION) { r.issue('openavatar', `is ${v.openavatar}; this reader follows ${SPEC_VERSION}`); doc.openavatar = SPEC_VERSION; }
  const rig = doc.body.rig || 'blob';
  if (rig === 'blob' && !doc.body.shape) {
    r.issue('body.shape', 'a blob needs a shape; a sphere is used');
    doc.body.shape = { type: 'sphere', radius: 0.9 };
  }
  crossCheck(r, doc);
  return { doc, issues: r.issues };
}

/**
 * Checks a document against OpenAvatar 0.1 the way a writer must meet it.
 * @param {unknown} value a parsed JSON value
 * @returns {{ valid: boolean, errors: { path: string, message: string, code?: string }[] }}
 */
export function validate(value) {
  try {
    const { issues } = read(structuredClone(value));
    return { valid: issues.length === 0, errors: issues };
  } catch (e) {
    if (e instanceof OpenAvatarError) return { valid: false, errors: [{ path: e.path, message: e.message.replace(`${e.path}: `, ''), code: e.code }] };
    throw e;
  }
}

/**
 * Repairs a document the way SPEC 15 tells a reader to: drops unknown
 * members, clamps numbers, puts fallbacks in place of unknown ids. Throws
 * OpenAvatarError for a document a reader must reject.
 * @param {unknown} value a parsed JSON value
 * @returns {{ document: object, repairs: { path: string, message: string }[] }}
 */
export function normalize(value) {
  const { doc, issues } = read(structuredClone(value));
  return { document: doc, repairs: issues };
}

/**
 * Parses the text of a .openavatar file (UTF-8 JSON, at most 256 KB) and
 * normalizes it.
 * @param {string} text
 */
export function parse(text) {
  if (typeof text !== 'string') throw new OpenAvatarError('not-text', 'expected the text of a .openavatar file');
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > LIMITS.fileBytes) throw new OpenAvatarError('limit', `the file is ${bytes} bytes; OpenAvatar files are at most ${LIMITS.fileBytes}`);
  let value;
  try { value = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { throw new OpenAvatarError('json', `not valid JSON: ${e.message}`); }
  return normalize(value);
}

/** Serializes a document as a .openavatar file. */
export function stringify(doc) {
  return JSON.stringify(doc, null, 2) + '\n';
}

/** A new random id (SPEC 3.1). */
export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = new Uint8Array(16); globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export { PLACEMENTS };

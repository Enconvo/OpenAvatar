// The OpenAvatar 0.1 document as data: every member, its type, its range and
// what a reader does when a writer gets it wrong. validate() and normalize()
// (read.js) both walk this one description, so they always agree, and the
// tests check it against the JSON Schema. Section numbers refer to SPEC.md.
import V from './vocabulary.js';

const ids = key => V[key].map(x => x.id);

// ---------- member kinds ----------
// num: a number clamped to [min, max]. int: the same, rounded. str: a string
// up to `max` characters, optionally matching `pattern` and, with `date`,
// naming a real date and time. color: #RGB or #RRGGBB. bool. vec: n numbers,
// each clamped. enum: one of `values`; `x` also allows x- vendor ids;
// `fallback` is what a reader puts in place of an unknown value (omitted: the
// member is dropped). obj: `members`, with `required` ones. arr: items of one
// kind, at most `max`. map: keys matching `key`, values of one kind. either:
// the first alternative that fits. shape and outline are the shape language
// (section 5). Appendix B of SPEC.md says exactly what a reader does with each.
const num = (min, max) => ({ k: 'num', min, max });
const int = (min, max) => ({ k: 'int', min, max });
const str = (max, o = {}) => ({ k: 'str', max, ...o });
const color = { k: 'color' };
const bool = { k: 'bool' };
const vec = (n, min, max) => ({ k: 'vec', n, min, max });
const oneOf = (values, o = {}) => ({ k: 'enum', values, ...o });
const obj = (members, o = {}) => ({ k: 'obj', members, ...o });
const arr = (of, max, o = {}) => ({ k: 'arr', of, max, ...o });
const map = (key, of, max = Infinity) => ({ k: 'map', key, of, max });
const either = (...alts) => ({ k: 'either', alts });
const nullable = d => ({ ...d, nullable: true });
export const SHAPE = { k: 'shape' }, OUTLINE = { k: 'outline' };

export const ID = /^[A-Za-z0-9._-]{1,128}$/;
export const SLUG = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const XID = /^x-[a-z0-9][a-z0-9-]{0,39}$/;
const axis = oneOf(['x', 'y', 'z']);
const p01 = num(0, 1);
const y = num(-1.2, 1.2);
const vec3 = vec(3, -5, 5), rot3 = vec(3, -360, 360), front = vec(2, -1.5, 1.5);

// Vocabulary ids, each with the fallback section 13 gives an unknown one.
export const EXPRESSIONS = ids('expressions'), MOTIONS = ids('motions'), PROPS = ids('props'),
  EFFECTS = ids('effects'), OUTFITS = ids('outfits'), STATES = ids('states'),
  ACTIVITIES = ids('activities'), USER_ACTIVITIES = ids('userActivities');
const expression = oneOf(EXPRESSIONS, { x: true, fallback: 'neutral' });
const motion = oneOf(MOTIONS, { x: true, fallback: 'nod' });
const prop = oneOf(PROPS, { x: true, fallback: null });
const effect = oneOf(EFFECTS, { x: true, fallback: null });
const outfit = oneOf(OUTFITS, { x: true });
export const DRIVERS = [...V.drivers, ...STATES, ...ACTIVITIES, ...USER_ACTIVITIES, ...EXPRESSIONS];
const driver = oneOf(DRIVERS, { x: true, fallback: 'always' });

// ---------- shapes (5) ----------
export const SHAPE_COMMON = {
  position: vec3, rotation: rot3, scale: either(num(0.05, 20), vec(3, 0.05, 20)), mirror: axis,
  inflate: num(-0.3, 0.3),
  deform: arr({ k: 'deformer' }, 4),
};
const kids = min => ({ k: 'children', of: SHAPE, min, max: 32 });
export const SHAPES = {
  sphere: { members: { radius: num(0.01, 1.5) }, required: ['radius'] },
  ellipsoid: { members: { radii: vec(3, 0.01, 1.5) }, required: ['radii'] },
  box: { members: { size: vec(3, 0.01, 3), rounding: num(0, 1.5) }, required: ['size'] },
  superellipsoid: { members: { radii: vec(3, 0.01, 1.5), exponent: num(1, 10) }, required: ['radii'] },
  capsule: { members: { from: vec(3, -3, 3), to: vec(3, -3, 3), radius: num(0.005, 1), radiusTo: num(0.005, 1) }, required: ['from', 'to', 'radius'] },
  cylinder: { members: { radius: num(0.01, 1.5), height: num(0.01, 3), rounding: num(0, 1.5) }, required: ['radius', 'height'] },
  cone: { members: { radius: num(0.01, 1.5), radiusTop: num(0, 1.5), height: num(0.01, 3), rounding: num(0, 1.5) }, required: ['radius', 'height'] },
  torus: { members: { radius: num(0.02, 1.5), thickness: num(0.005, 0.75) }, required: ['radius', 'thickness'] },
  extrusion: { members: { outline: OUTLINE, depth: num(0.005, 3), rounding: num(0, 1.5), puff: p01 }, required: ['outline', 'depth'] },
  halfspace: { members: { normal: vec(3, -1, 1), offset: num(-3, 3) }, required: ['normal'] },
  union: { members: { children: kids(1), smooth: p01 }, required: ['children'] },
  subtract: { members: { children: kids(2), smooth: p01 }, required: ['children'] },
  intersect: { members: { children: kids(2), smooth: p01 }, required: ['children'] },
};
export const OUTLINE_COMMON = { rotation: num(-360, 360), scale: either(num(0.05, 20), vec(2, 0.05, 20)), mirror: oneOf(['x', 'y']) };
const c2 = vec(2, -3, 3), points = min => ({ k: 'points', min, max: 64 });
const okids = min => ({ k: 'children', of: OUTLINE, min, max: 32 });
export const OUTLINES = {
  circle: { members: { radius: num(0.005, 3), center: c2 }, required: ['radius'] },
  ellipse: { members: { radii: vec(2, 0.005, 3), center: c2 }, required: ['radii'] },
  rect: { members: { size: vec(2, 0.005, 6), center: c2, rounding: num(0, 3) }, required: ['size'] },
  polygon: { members: { points: points(3), rounding: num(0, 1) }, required: ['points'] },
  star: { members: { points: int(3, 12), radius: num(0.005, 3), innerRadius: num(0.001, 3), center: c2 }, required: ['points', 'radius', 'innerRadius'] },
  heart: { members: { size: num(0.01, 3), center: c2 }, required: ['size'] },
  stroke: { members: { points: points(2), width: num(0.002, 1), widthTo: num(0.002, 1) }, required: ['points', 'width'] },
  union: { members: { children: okids(1), smooth: p01 }, required: ['children'] },
  subtract: { members: { children: okids(2), smooth: p01 }, required: ['children'] },
  intersect: { members: { children: okids(2), smooth: p01 }, required: ['children'] },
};
export const DEFORMERS = {
  taper: { members: { axis, amount: num(-1, 1) }, required: ['axis', 'amount'] },
  twist: { members: { axis, amount: num(-180, 180) }, required: ['axis', 'amount'] },
  bend: { members: { axis, toward: axis, amount: num(-180, 180) }, required: ['axis', 'toward', 'amount'] },
  squash: { members: { axis, below: num(0.2, 5), above: num(0.2, 5) }, required: ['axis'] },
  ripple: { members: { axis, count: int(2, 32), amplitude: num(0, 0.2), range: vec(2, -3, 3) }, required: ['axis', 'count', 'amplitude'] },
};

// ---------- materials (7) ----------
export const MATERIAL = obj({
  type: oneOf(V.materialTypes, { fallback: 'felt' }), color, sheen: color, roughness: p01,
  pattern: obj({ type: oneOf(V.patternTypes), colors: arr(color, 4, { min: 1 }), axis, scale: num(0.05, 4), angle: num(-360, 360) }, { required: ['type', 'colors'] }),
  glow: obj({ color, intensity: num(0, 4), base: p01, driver }),
  fur: obj({ length: p01, density: p01, droop: p01, tip: color }),
  opacity: p01,
});
const materialRef = either(str(32, { pattern: SLUG }), MATERIAL);

// ---------- face (8) ----------
const FACE = obj({
  type: oneOf(V.faceTypes),
  eyes: obj({ shape: oneOf(V.eyeShapes), size: num(0.02, 0.3), spacing: num(0, 0.6), height: y, color, highlight: bool, blink: bool, gaze: bool }),
  mouth: obj({ shape: oneOf(V.mouthShapes), width: num(0.02, 0.6), height: y, color, speaks: bool }),
  cheeks: obj({ color, size: num(0.02, 0.4), spacing: num(0, 0.8), height: y, show: oneOf(V.cheekShows) }),
  brows: obj({ color, thickness: num(0.005, 0.1), length: num(0.02, 0.4), height: y }),
  nose: obj({ shape: oneOf(V.noseShapes), color, size: num(0.01, 0.3), height: y }),
  color,
  expressions: map(expression, obj({ eyes: oneOf(V.eyePoses), mouth: oneOf(V.mouthPoses), cheeks: bool, effect: oneOf(EFFECTS, { x: true }) })),
});

// ---------- parts (9) and animations (10) ----------
const ANIMATION = obj({ type: oneOf(Object.keys(V.animationTypes)), driver, axis, amount: num(-360, 360), speed: num(0, 8), phase: p01 }, { required: ['type'] });
export const PLACEMENTS = ['position', 'at', 'direction'];
const ATTACH = obj({
  to: str(32, { pattern: /^(body|head|[a-z0-9][a-z0-9-]{0,31})$/ }),
  position: vec3, at: front, direction: vec(3, -1, 1),
  lift: num(-0.5, 0.5), align: oneOf(['surface', 'upright', 'none']), rotation: rot3,
}, { exclusive: PLACEMENTS });
const PART = obj({
  id: str(32, { pattern: SLUG }), role: oneOf(V.partRoles, { fallback: 'detail' }),
  shape: SHAPE, patch: OUTLINE, material: materialRef, attach: ATTACH,
  mirror: oneOf(['x']), pivot: vec3, animations: arr(ANIMATION, 4),
}, { required: ['id'], oneOfRequired: ['shape', 'patch'] });

// ---------- body (6) ----------
const BODY = obj({
  rig: oneOf(V.rigs, { fallback: 'blob' }), shape: SHAPE, material: materialRef, anchor: oneOf(V.anchors),
  proportions: obj({ head: p01, headShape: oneOf(V.headShapes), body: p01, bodyShape: oneOf(V.bodyShapes), legs: p01, arms: p01 }),
  arms: obj({ style: oneOf(V.armStyles), length: p01, thickness: p01, at: front, material: materialRef }),
});

// ---------- behavior (11) ----------
const REACTION = obj({
  expression: nullable(expression), motion: nullable(motion), prop: nullable(prop), effect: nullable(effect),
  gaze: nullable(oneOf(V.gazes)), intensity: nullable(p01),
});
const reactions = keys => map(oneOf(keys, { x: true }), nullable(REACTION));
const BEHAVIOR = obj({
  temperament: obj({ energy: p01, bounce: p01, sway: p01, blink: p01 }),
  reactions: obj({ states: reactions(STATES), activities: reactions(ACTIVITIES), userActivities: reactions(USER_ACTIVITIES) }),
  idleMotions: arr(motion, 8, { unique: true }),
});

// ---------- the document (3) ----------
const https = /^https:\/\//;
// An RFC 3339 date-time on a real calendar day (SPEC B.2).
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i;
const dateTime = str(64, { pattern: DATE_TIME, date: true });
const META = obj({
  description: str(500),
  authors: arr(obj({ name: str(64, { min: 1 }), url: str(500) }, { required: ['name'] }), 8),
  license: str(200, { min: 1 }),
  version: str(64, { pattern: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/ }),
  tags: arr(str(32, { pattern: SLUG }), 12, { unique: true }),
  created: dateTime,
  updated: dateTime,
  source: str(500, { pattern: https }),
  derivedFrom: obj({ id: str(128, { pattern: ID }), name: str(64), url: str(500, { pattern: https }) }, { required: ['id'] }),
  generator: obj({ name: str(64, { min: 1 }), version: str(32), model: str(100) }, { required: ['name'] }),
});
export const DOCUMENT = obj({
  $schema: str(500),
  openavatar: str(16),
  id: str(128, { pattern: ID }),
  name: str(64, { min: 1 }),
  meta: META,
  preview: obj({ image: str(131100, { pattern: /^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/ }), background: color }, { required: ['image'] }),
  body: BODY,
  materials: map(str(32, { pattern: SLUG }), MATERIAL, 16),
  face: FACE,
  parts: arr(PART, 32),
  outfit,
  behavior: BEHAVIOR,
  extensions: map(str(253, { pattern: /^[a-z0-9-]+(\.[a-z0-9-]+)+$/ }), { k: 'any' }),
}, { required: ['openavatar', 'id', 'name', 'body'] });

export const LIMITS = V.limits;

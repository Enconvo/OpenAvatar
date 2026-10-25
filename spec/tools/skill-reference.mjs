// Writes skills/openavatar/reference.md, the member reference of the
// OpenAvatar skill, from the core package's document model (types, ranges,
// ids) and the meanings below (from SPEC.md). Run from openavatar/:
//   node spec/tools/skill-reference.mjs           write it
//   node spec/tools/skill-reference.mjs --check   fail if it is out of date
// Every member must have a meaning here, so a member added to the model
// cannot reach the skill undocumented.
import fs from 'node:fs';
import path from 'node:path';
import { DOCUMENT, SHAPES, SHAPE_COMMON, OUTLINES, OUTLINE_COMMON, DEFORMERS, EXPRESSIONS, MOTIONS, PROPS, EFFECTS, OUTFITS, STATES, ACTIVITIES, USER_ACTIVITIES, DRIVERS, LIMITS } from '../../packages/core/src/model.js';
import V from '../../packages/core/src/vocabulary.js';

const NOTES = {
  // 3. The document
  $schema: 'The JSON Schema URL, for editors; readers ignore it',
  openavatar: 'The spec version: `"0.1"`',
  id: 'Stable id of the character, 1 to 128 of `A-Z a-z 0-9 . _ -`; a lowercase UUID v4. Keep it when editing; a new character gets a new one',
  name: 'Display name',
  meta: 'Description, authors, license, provenance',
  'meta.description': 'One or two sentences',
  'meta.authors': 'Who made it',
  'meta.authors[].name': 'Author name',
  'meta.authors[].url': 'Author link',
  'meta.license': 'An SPDX license expression; without one the character is all rights reserved',
  'meta.version': 'The character\'s own semantic version',
  'meta.tags': 'Lowercase keywords',
  'meta.created': 'RFC 3339 date-time in the form `YYYY-MM-DDTHH:MM:SSZ`, on a real calendar day',
  'meta.updated': 'RFC 3339 date-time; in the shared folder the copy of an id with the later one wins',
  'meta.source': 'Where it is published',
  'meta.derivedFrom': 'The character this one was remixed from',
  'meta.derivedFrom.id': 'Its id',
  'meta.derivedFrom.name': 'Its name',
  'meta.derivedFrom.url': 'Its page',
  'meta.generator': 'The tool that wrote it, and the AI model if one did',
  'meta.generator.name': 'Tool name',
  'meta.generator.version': 'Tool version',
  'meta.generator.model': 'The AI model id',
  preview: 'A picture for hosts that cannot render. Never write it: tools add it after rendering',
  'preview.image': 'A PNG or WebP data URI, at most 96 KB decoded',
  'preview.background': 'Its background',
  body: 'The main solid and its rig',
  materials: 'Named materials, at most 16; ids are 1 to 32 of `a-z 0-9 -`',
  face: 'Eyes, mouth, cheeks, brows, nose',
  parts: 'Pieces attached to the body, at most 32',
  outfit: 'A standard outfit the avatar wears by default (see Outfits)',
  behavior: 'Temperament and reactions',
  extensions: 'Vendor data under reverse-DNS keys; readers ignore keys they do not know',
  // 6. Body
  'body.rig': '`blob` (default): one solid that moves as a whole. `biped`: a plush suit with head, body, legs and arms built from `proportions`',
  'body.shape': 'The solid; required for a blob. On a biped it is joined to the suit (smooth 0.06) in the body\'s space, so it does not move with the head when `proportions` change; put what belongs on the head on parts attached `to: "head"`',
  'body.material': 'An id from `materials`, or a material written in place; default `"main"`',
  'body.anchor': '`ground` (default): its lowest resting point, of the body, arms and parts that show at rest, stands on the floor. `float`: hovers and bobs',
  'body.proportions': 'Biped only; every number 0 to 1, default 0.5',
  'body.proportions.head': 'Head size relative to the body',
  'body.proportions.headShape': 'Default `round`',
  'body.proportions.body': 'Body size',
  'body.proportions.bodyShape': 'Default `pear`',
  'body.proportions.legs': 'Leg length; 0 hides the legs',
  'body.proportions.arms': 'Arm length',
  'body.arms': 'Arms the renderer animates; a biped always has them',
  'body.arms.style': 'Default `none` on a blob, `nub` on a biped',
  'body.arms.length': 'Default 0.5',
  'body.arms.thickness': 'Default 0.5',
  'body.arms.at': 'Blob only: the front point of the shoulder at +x; the other mirrors it',
  'body.arms.material': 'An id from `materials`, or a material written in place; default the body\'s',
  // 7. Materials
  'materials.*.type': 'Default `felt`. A renderer that cannot draw a type draws felt',
  'materials.*.color': 'Base color, default `#9AA4B2`',
  'materials.*.sheen': 'Soft highlight at grazing angles (felt, fur, velvet); default a lighter version of the color under it, so a pattern keeps its colors. A named sheen is one color over the whole pattern',
  'materials.*.roughness': 'How blurred reflections are. Default by type: felt and fur 1, velvet 0.9, clay 0.92, rubber 0.8, plastic 0.32, metal 0.28, ceramic 0.12, glass 0.05 + 0.5 × opacity; toon ignores it',
  'materials.*.pattern': 'Painted in the object\'s own space',
  'materials.*.pattern.type': '`gradient` blends along `axis` from one end of the part (or body) to the other; the others repeat',
  'materials.*.pattern.colors': '1 to 4 colors that join the base color',
  'materials.*.pattern.axis': 'Default `y`',
  'materials.*.pattern.scale': 'Size of one stripe, spot or check, in avatar units; smaller repeats more often. Default 0.3',
  'materials.*.pattern.angle': 'Stripes\' angle in degrees: tilts them toward x (toward y when `axis` is `x`). Stripes start at 0 on the axis: the base color covers 0 to `scale`, then each of `colors` in turn, repeating both ways',
  'materials.*.glow': 'Gives off light: `intensity` times `base` plus the rest of the way to full with the driver\'s weight',
  'materials.*.glow.color': 'Default the base color',
  'materials.*.glow.intensity': 'Default 1; high values wash the color out toward white',
  'materials.*.glow.base': 'How much it glows when the driver\'s weight is 0, so it can glow always and brighten in a situation; default 0',
  'materials.*.glow.driver': 'Default `always` (see Drivers)',
  'materials.*.fur': 'Fur only',
  'materials.*.fur.length': 'Strand length: 0.015 + 0.085 × length units long. Default 0.5',
  'materials.*.fur.density': 'How thick the pile is: more and finer strands. Default 0.5',
  'materials.*.fur.droop': 'How much strands hang. Default 0.3',
  'materials.*.fur.tip': 'Strand tip color. Default the color under it, a quarter of the way to white',
  'materials.*.opacity': 'Glass only: 0 clear, 1 frosted, default 0.2. Glass shows what is behind it, the host\'s background too; parts inside it show only as a haze',
  // 8. Face
  'face.type': '`bead` (default): glossy bead eyes. `sewn`: felt cut-outs that change shape per expression. `drawn`: flat painted features. `none`: no face',
  'face.eyes': 'At the front points [-spacing, height] and [spacing, height]',
  'face.eyes.shape': 'Default `round`',
  'face.eyes.size': 'Eye radius, default 0.09',
  'face.eyes.spacing': 'From the middle to each eye\'s center, default 0.3',
  'face.eyes.height': 'The y of the eyes, default 0.15',
  'face.eyes.color': 'Default `#040406` on bead eyes, the face\'s `color` on sewn and drawn ones',
  'face.eyes.highlight': 'A catchlight on bead eyes, default true',
  'face.eyes.blink': 'Default true',
  'face.eyes.gaze': 'Eyes follow what it looks at, default true',
  'face.mouth': 'At the front point [0, height]',
  'face.mouth.shape': 'Default `oval`, which shows only while speaking; the others always show',
  'face.mouth.width': 'Default 0.17',
  'face.mouth.height': 'Default -0.1',
  'face.mouth.color': 'Default `#2A0E17`',
  'face.mouth.speaks': 'Opens with the voice, default true',
  'face.cheeks': 'Two round blush patches',
  'face.cheeks.color': 'Default `#FF9DB2`',
  'face.cheeks.size': 'Default 0.12',
  'face.cheeks.spacing': 'Default 0.5',
  'face.cheeks.height': 'Default -0.02',
  'face.cheeks.show': '`happy` (the default) flushes with happy, laugh, love and relaxed',
  'face.brows': 'Two brows that tilt with expressions; omit for none',
  'face.brows.color': 'Default the ink color',
  'face.brows.thickness': 'Default 0.035; under about 0.03 they vanish at small sizes',
  'face.brows.length': 'Default 0.12',
  'face.brows.height': 'How far above the eyes, default 0.12; unlike the other heights it is not a y',
  'face.nose': 'Omit for none',
  'face.nose.shape': 'Default `button`; `snout` is a muzzle in the body\'s material',
  'face.nose.color': 'Default the ink color',
  'face.nose.size': 'Default 0.05',
  'face.nose.height': 'Default halfway between eyes and mouth',
  'face.color': 'Ink for sewn and drawn eyes, brows and nose that have no color of their own, default `#1C1E23`. Drawn features are unlit and show their exact colors',
  'face.expressions': 'Overrides the poses of an expression (see Expressions)',
  'face.expressions.*.eyes': 'Eye pose',
  'face.expressions.*.mouth': 'Mouth pose',
  'face.expressions.*.cheeks': 'Flush or not while this pose shows, whatever `face.cheeks.show` says; needs `face.cheeks` with a `show` other than `never`',
  'face.expressions.*.effect': 'An effect shown with it',
  // 9. Parts
  'parts[].id': 'Unique in the document',
  'parts[].role': 'What it is; hosts hide `hat` parts while a hat outfit is on. Default `detail`',
  'parts[].shape': 'Its solid, modeled around its own origin',
  'parts[].patch': 'Instead of `shape`: a cut-out 0.02 thick bent onto the surface around its attach point, 0.006 above it unless `attach.lift` says otherwise',
  'parts[].material': 'An id from `materials`, or a material written in place; default the body\'s',
  'parts[].attach': 'Where it sits: `to`, then one of `position`, `at`, `direction`',
  'parts[].attach.to': '`body` (default), `head`, `left-hand`, `right-hand`, or the id of a part listed earlier; the part moves, mirrors and hides with it (see Attach targets)',
  'parts[].attach.position': 'A point in the target\'s space (a part\'s own space when `to` names one); the part is not turned to a surface',
  'parts[].attach.at': 'A front point on the target; the part sits on the surface there',
  'parts[].attach.direction': 'From the target\'s center along this direction to where it leaves the surface for the last time; `[0,1,0]` is the top. The body\'s center is at x 0, z 0, halfway up the body, so on a blob with its head off that center use `at` for the head',
  'parts[].attach.lift': 'With `at` or `direction`: out along the normal; negative sinks it in. Default 0',
  'parts[].attach.align': 'With `at` or `direction`: `surface` (default) turns +z along the normal; `upright` and `none` only move it',
  'parts[].attach.rotation': 'An extra turn in degrees, with any way of placing: first about x, then y, then z, about the part\'s axes after `align`',
  'parts[].mirror': '`x` adds a copy mirrored across x = 0 of the target\'s space. A part attached to a mirrored part is already on both copies',
  'parts[].pivot': 'The point it turns and scales about, in its own space; default its origin',
  'parts[].animations': 'Up to 4',
  'parts[].animations[].type': 'See Animation types',
  'parts[].animations[].driver': 'When it plays and how strongly; default `always` (see Drivers)',
  'parts[].animations[].axis': 'Default by type',
  'parts[].animations[].amount': 'Degrees, units or a factor, by type (see Animation types)',
  'parts[].animations[].speed': 'Cycles per second, default 1 (3 for `wiggle`)',
  'parts[].animations[].phase': 'Offset within the cycle, default 0',
  // 11. Behavior
  'behavior.temperament': 'Every member 0 to 1, default 0.5',
  'behavior.temperament.energy': 'Calm and slow to quick and lively',
  'behavior.temperament.bounce': 'Stiff to squashy',
  'behavior.temperament.sway': 'Still to swaying when idle',
  'behavior.temperament.blink': 'Rare to frequent blinks',
  'behavior.reactions': 'Replace the default reaction of a situation member by member (see the vocabulary lists); `null` turns a default off',
  'behavior.reactions.states': 'Keyed by conversation state',
  'behavior.reactions.activities': 'Keyed by agent activity',
  'behavior.reactions.userActivities': 'Keyed by user activity',
  'reaction.expression': 'Set it, or `null` to turn the default off',
  'reaction.motion': 'Looping motions loop while the situation lasts; others play once',
  'reaction.prop': 'Held or sat at',
  'reaction.effect': 'Shown beside it',
  'reaction.gaze': '`user` looks out at the person, `work` at its prop',
  'reaction.intensity': 'The expression\'s strength, default 1; motions play at full strength',
  'behavior.idleMotions': 'Played now and then while nothing happens; different ids',
};

const fmtNum = x => String(x);
const lists = new Map([[MOTIONS, 'a motion id'], [EXPRESSIONS, 'an expression id'], [PROPS, 'a prop id'], [EFFECTS, 'an effect id'], [OUTFITS, 'an outfit id'], [DRIVERS, 'a driver'], [STATES, 'a state'], [ACTIVITIES, 'an agent activity'], [USER_ACTIVITIES, 'a user activity']]);

function type(d) {
  let t;
  switch (d.k) {
    case 'num': t = `number ${fmtNum(d.min)} to ${fmtNum(d.max)}`; break;
    case 'int': t = `integer ${d.min} to ${d.max}`; break;
    case 'str': t = d.pattern?.source === '^[a-z0-9][a-z0-9-]{0,31}$' ? 'id (`a-z 0-9 -`, up to 32)' : `text up to ${d.max}`; break;
    case 'color': t = 'color `#RRGGBB`'; break;
    case 'bool': t = 'true or false'; break;
    case 'vec': t = `${d.n === 3 ? '[x, y, z]' : '[x, y]'}, each ${fmtNum(d.min)} to ${fmtNum(d.max)}`; break;
    case 'enum': t = lists.get(d.values) ? `${lists.get(d.values)}${d.x ? ' or an `x-` id' : ''}` : `${d.values.map(v => `\`${v}\``).join(', ')}${d.x ? ', or an `x-` id' : ''}`; break;
    case 'obj': t = 'object'; break;
    case 'arr': t = `list of up to ${d.max}: ${type(d.of)}`; break;
    case 'map': t = 'object'; break;
    case 'either': t = d.alts.map(type).join(', or '); break;
    case 'shape': t = 'shape'; break;
    case 'outline': t = 'outline'; break;
    case 'deformer': t = 'deformer'; break;
    case 'children': t = `list of ${d.min} to ${d.max} ${d.of.k === 'outline' ? 'outlines' : 'shapes'}`; break;
    case 'points': t = `list of ${d.min} to ${d.max} points [x, y]`; break;
    case 'any': t = 'object'; break;
    default: throw new Error(`no type for ${d.k}`);
  }
  return d.nullable ? `${t}, or null` : t;
}

const missing = [];
const note = key => { if (!(key in NOTES)) missing.push(key); return NOTES[key] ?? ''; };
const out = [];
const sections = [];

// Objects become sections, keyed by their members so one met again (a reaction, a material) points back to its section.
const seen = new Map();
function section(title, key, d) {
  const name = `\`${title}\``;
  seen.set(d.members, name);
  const rows = [];
  sections.push({ name, key, rows });
  for (const [m, md] of Object.entries(d.members)) {
    const k = key ? `${key}.${m}` : m, dot = title ? `${title}.` : '';
    // An object member, a list of objects or a map to objects gets its own section.
    const [sub, subTitle, subKey] = md.k === 'obj' ? [md, `${dot}${m}`, k]
      : md.k === 'arr' && md.of.k === 'obj' ? [md.of, `${dot}${m}[]`, `${k}[]`]
      : md.k === 'map' && md.of.k === 'obj' ? [md.of, `${dot}${m}.<id>`, `${k}.*`] : [];
    let t = type(md);
    if (sub) {
      const n = seen.get(sub.members) ?? section(subTitle, subKey, sub);
      t = md.k === 'map' ? `object of ${type(md.key)} to ${n}${md.of.nullable ? ' or null' : ''}` : t.replace('object', `object, see ${n}`);
    }
    rows.push({ m, k, t, required: (d.required || []).includes(m) });
  }
  return name;
}

// The reaction object appears under three maps; it is described once, at the end.
const REACTION = DOCUMENT.members.behavior.members.reactions.members.states.of;
seen.set(REACTION.members, '`reaction`');
section('', '', DOCUMENT);
sections.push({ name: '`reaction`', key: 'reaction', rows: Object.entries(REACTION.members).map(([m, md]) => ({ m, k: `reaction.${m}`, t: type(md), required: false })) });
for (const s of sections) for (const r of s.rows) note(r.k);
if (missing.length) { console.error(`members without a meaning in skill-reference.mjs:\n${missing.join('\n')}`); process.exit(1); }

const cell = s => String(s).replace(/\|/g, '\\|');
out.push('# OpenAvatar 0.1 reference', '',
  'Every member a document can have, with its type, range and meaning. Generated from the',
  '`openavatar` package by `spec/tools/skill-reference.mjs`; [SPEC.md](https://github.com/Enconvo/OpenAvatar/blob/main/spec/SPEC.md) is the full text.',
  'Lengths are avatar units (a body is about 2 tall), angles are degrees, `[x, y]` positions on the',
  'surface are front points, and a number outside its range is clamped. A front point is where the line',
  'through `[x, y]` along z first meets the solid from the front; one that misses the solid floats at',
  'z = 0, and `validate` warns about it.', '');
for (const s of sections) {
  out.push(`## ${s.name === '``' ? 'The document' : s.name}`, '', '| Member | Type | Meaning |', '|---|---|---|');
  for (const r of s.rows) out.push(`| \`${r.m}\`${r.required ? ' (required)' : ''} | ${cell(r.t)} | ${cell(NOTES[r.k])} |`);
  out.push('');
}

const memberList = (members, required = []) => Object.entries(members).map(([m, md]) => `\`${m}\`${required.includes(m) ? '' : '?'} (${type(md)})`).join('; ');
const SOLIDS = {
  sphere: 'A ball', ellipsoid: 'An egg stretched to three radii', box: 'A box with rounded edges; `size` is the full extent',
  superellipsoid: 'Between an ellipsoid (exponent 2) and a box (high values); 1 gives a diamond; default 3',
  capsule: 'A rod with round ends from `from` to `to`, tapering to `radiusTo`', cylinder: 'Upright on the y axis, from -height/2 to height/2', cone: 'Upright on y, base down at -height/2; `radiusTop` makes a frustum',
  torus: 'A ring lying in the xz plane: a tube of radius `thickness` around a circle of radius `radius`; rotate it [90, 0, 0] to stand it up', extrusion: 'The outline pushed out along z, centered on z = 0; `puff` swells the middle like a pillow',
  halfspace: 'Every point whose distance along `normal` (any length; it is normalized) is below `offset`; use it inside intersect or subtract to cut',
  union: 'All children; `smooth` blends the seams like a soft toy (0.1 to 0.4)', subtract: 'The first child with the others cut away', intersect: 'Only where every child is',
};
out.push('## Shapes', '', 'Every shape has `type` and may have the common members:', '', memberList(SHAPE_COMMON) + '.', '',
  'Every primitive is centered on its own origin. A shape\'s deformers act in its own space, before its `scale`, then `rotation` (first about x, then y, then z, about the parent\'s axes), then `position`. `rounding` never grows a solid. `mirror` adds the reflection across the plane through the origin. `inflate` grows (or, negative, shrinks) the surface.', '',
  '| `type` | Members | Solid |', '|---|---|---|');
for (const [t, s] of Object.entries(SHAPES)) out.push(`| \`${t}\` | ${cell(memberList(s.members, s.required))} | ${SOLIDS[t]} |`);
const FLATS = {
  circle: 'A disk', ellipse: 'An oval', rect: 'A rounded rectangle', polygon: 'A simple polygon, either winding; `rounding` rounds its convex corners, and a polygon thinner than its rounding rounds only as much as it can hold', star: 'A star with one point up', heart: 'A heart, point down: the point is `size`/2 below `center`, and the lobes reach 0.6 × `size` above it and to either side',
  stroke: 'A polyline drawn with a round pen, tapering from `width` to `widthTo`', union: 'As for shapes, in 2D', subtract: 'As for shapes, in 2D', intersect: 'As for shapes, in 2D',
};
out.push('', '## Outlines', '', 'Flat shapes in the xy plane, for `extrusion` and `patch`. Common members: ' + memberList(OUTLINE_COMMON) + '. `rotation`, `scale` and `mirror` act about `[0, 0]`, not about `center`: the scale first, then the rotation, then the mirror.', '',
  '| `type` | Members | Outline |', '|---|---|---|');
for (const [t, s] of Object.entries(OUTLINES)) out.push(`| \`${t}\` | ${cell(memberList(s.members, s.required))} | ${FLATS[t]} |`);
const BENDS = {
  taper: 'The cross-section grows by `amount` per unit along the axis; negative narrows toward +axis', twist: 'Turns the cross-section `amount` degrees per unit along the axis',
  bend: 'Curves the axis into a circular arc toward `toward`: its direction turns `amount` degrees per unit of length, so a piece of length L turns `amount`·L degrees, and keeps its thickness. Both sides of the origin curve the same way (a positive amount toward +`toward`), so put the origin where the curve starts, such as a capsule\'s `from` at `[0, 0, 0]`', squash: 'Scales the half below 0 on the axis by `below` and the half above by `above`, each default 1',
  ripple: '`count` bumps around the axis, like a skirt\'s hem or petals, not waves along it; `range` limits them to a stretch of the axis',
};
out.push('', '## Deformers', '', 'Up to 4 per shape in `deform`, applied in order.', '', '| `type` | Members | Effect |', '|---|---|---|');
for (const [t, s] of Object.entries(DEFORMERS)) out.push(`| \`${t}\` | ${cell(memberList(s.members, s.required))} | ${BENDS[t]} |`);

// The vocabulary.
const pick = (r = {}) => Object.entries(r).map(([k, v]) => `${k} ${v}`).join(', ');
out.push('', '## Vocabulary', '', 'An unknown id falls back: an expression to `neutral`, a motion along its fallbacks to a base motion, else `nod`, and a prop, effect or outfit to none. `x-` ids are for hosts that know them.', '');
const table = (title, head, rows, intro) => { out.push(`### ${title}`, '', ...(intro ? [intro, ''] : []), `| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.map(cell).join(' | ')} |`), ''); };
table('Conversation states', ['Id', 'Meaning', 'Default reaction'], V.states.map(s => [`\`${s.id}\``, s.description, pick(s.reaction)]));
table('Agent activities', ['Id', 'Meaning', 'Default reaction'], V.activities.map(s => [`\`${s.id}\``, s.description, pick(s.reaction)]));
table('User activities', ['Id', 'Meaning', 'Default reaction'], V.userActivities.map(s => [`\`${s.id}\``, s.description, pick(s.reaction)]));
table('Expressions', ['Id', 'Eyes', 'Mouth', 'Fallback'], V.expressions.map(e => [`\`${e.id}\``, e.eyes, e.mouth, e.fallback || '']));
table('Motions', ['Id', 'Movement', 'Needs', 'Loops', 'Fallback'], V.motions.map(m => [`\`${m.id}\``, m.description, m.needs || '', m.loops ? 'yes' : '', m.fallback || '']));
table('Props', ['Id', 'What'], V.props.map(p => [`\`${p.id}\``, p.description]));
table('Effects', ['Id', 'What'], V.effects.map(p => [`\`${p.id}\``, p.description]), 'Placed beside and above the head, clear of the body and the parts on it.');
out.push('### Outfits', '', 'Hats are marked; a hat outfit hides `hat` parts.', '', V.outfits.map(o => `\`${o.id}\`${o.hat ? ' (hat)' : ''}`).join(', ') + '.', '');
out.push('### Drivers', '', 'A driver is a weight from 0 to 1 that eases over about 0.3 s: `always`; `active` (not idle); `voice` (speech level while speaking); `mic` (the user\'s voice while listening); `pointer` (the pointer near the middle of the avatar\'s frame); any state, agent activity, user activity or expression id. `thinking` is both a state and an expression; as a driver it is the state.', '');
const MOVES = {
  sway: 'Turns back and forth about the pivot, around the axis, by up to `amount` degrees', spin: 'Turns on and on about the pivot, around the axis, `speed` turns per second; it settles when the weight falls',
  bob: 'Moves back and forth along the axis by up to `amount` units', pulse: 'Scales by up to 1 + `amount`', wiggle: 'A quick shake of up to `amount` degrees',
  flap: 'Flaps up and back by up to `amount` degrees, twice a cycle; the mirrored copy flaps the mirror way', appear: 'Grows from nothing with the weight, hidden at 0',
  drift: 'Moves `amount` units along the axis each cycle from where the part is, fading in and out, then starts again; it shrinks away as the weight falls', glow: 'Adds up to `amount` to the part\'s glow intensity, on top of its material\'s glow',
};
for (const t of Object.keys(V.animationTypes)) if (!MOVES[t]) { console.error(`no note for animation type ${t}`); process.exit(1); }
out.push('### Attach targets', '',
  '`body`: the body\'s space. `head`: on a biped, a space with its origin at the head\'s center, which moves with the head when the proportions change; on a blob, the body\'s space. `left-hand` and `right-hand`: a space at the tip of that arm (the avatar\'s left is +x), with its origin inside the arm\'s round end, whose radius is 0.08 + 0.14 × the arms\' `thickness` (so model a held item\'s grip at least that far out, or the hand hides it), turning with it as it waves or holds a prop; while the arm rests, +y is up, +z forward and +x away from the body in both, so a part modeled upright is held upright and reads the same in either hand, and `mirror: "x"` puts its copy in the other hand. Without arms, the hands are where the arms would hang. A part id never shadows these names.', '');
out.push('### Animation types', '', 'The axis is in the part\'s own space, so it turns with the part\'s `rotation` and with the part it is attached `to`. Several animations on one part apply in order: turns follow each other, moves add, scales multiply.', '', '| `type` | Defaults | Movement |', '|---|---|---|', ...Object.entries(V.animationTypes).map(([t, d]) => `| \`${t}\` | ${pick(d) || '—'} | ${MOVES[t]} |`), '');
const POSES = {
  open: 'the eye shape at rest', arc: 'closed and curved up, pleased', chevron: 'closed and pointing in, laughing', heart: 'hearts', wide: 'large and round',
  sad: 'drooping at the outer corners', mad: 'lids slanting down toward the middle', shut: 'closed lines', squint: 'nearly closed, content',
  'wink-left': 'the avatar\'s left eye closed', 'wink-right': 'the avatar\'s right eye closed',
  smile: 'a closed smile', grin: 'an open smile', o: 'a small round opening', flat: 'a straight line', frown: 'curved down', hmm: 'a small crooked line',
};
for (const id of [...V.eyePoses, ...V.mouthPoses]) if (!POSES[id]) { console.error(`no note for pose ${id}`); process.exit(1); }
const poses = list => list.map(x => `\`${x}\` (${POSES[x]})`).join(', ');
out.push('### Poses and gazes', '', `What \`face.expressions\` can set. Eye poses: ${poses(V.eyePoses)}. Mouth poses: ${poses(V.mouthPoses)}.`, '',
  `Gazes: ${V.gazes.map(x => `\`${x}\``).join(', ')}.`, '');
out.push('## Limits', '', `At most ${LIMITS.shapes} shapes and outlines in all, nested at most ${LIMITS.depth} deep, ${LIMITS.points} polygon and stroke points, ${LIMITS.parts} parts, ${LIMITS.materials} materials, ${LIMITS.animationsPerPart} animations per part, ${LIMITS.deformersPerShape} deformers per shape, ${LIMITS.children} children per combinator and ${LIMITS.idleMotions} idle motions. A file is at most ${LIMITS.fileBytes / 1024} KB. A reader rejects a document over the shape, depth, point or file limits; it cuts the other lists.`, '');

const text = out.join('\n');
const file = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../skills/openavatar/reference.md');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { console.error('skills/openavatar/reference.md is out of date; run node spec/tools/skill-reference.mjs'); process.exit(1); }
  console.log('reference.md is current');
} else {
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text);
  console.log(`wrote ${path.relative(process.cwd(), file)}: ${sections.length} sections, ${Math.round(text.length / 1024)} KB`);
}

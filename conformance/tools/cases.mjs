// The cases of the conformance suite. Render cases cover every shape,
// outline, deformer, rig, face, material, pattern, part role and animation
// of OpenAvatar 0.1; covers() lists what a document uses, so the suite's
// coverage is checked rather than claimed.

const felt = (color, sheen = '#FFFFFF') => ({ type: 'felt', color, sheen });
const FACE = { type: 'bead', eyes: { size: 0.08, spacing: 0.3, height: 0.15 }, mouth: { shape: 'smile', width: 0.14, height: -0.08 } };

function avatar(id, name, body, { face = FACE, materials, color = '#F2C9A0', ...rest } = {}) {
  return {
    openavatar: '0.1',
    id: `org.openavatar.conformance.${id}`,
    name,
    meta: { license: 'CC0-1.0', authors: [{ name: 'OpenAvatar' }], tags: ['conformance'] },
    body: { material: 'main', ...body },
    materials: materials ?? { main: felt(color) },
    face,
    ...rest,
  };
}
const blob = shape => ({ shape });
const render = (id, name, shows, document, cells) => ({ id, shows, document: { ...document, name }, cells });

const hexagon = [...Array(6)].map((_, i) => [Math.round(Math.sin(i * Math.PI / 3) * 95) / 100, Math.round(Math.cos(i * Math.PI / 3) * 95) / 100]);
const extrude = outline => ({ type: 'extrusion', outline, depth: 0.8, rounding: 0.28, puff: 0.45 });

export const RENDER = [
  // Primitives and combinators (SPEC 5.1–5.3).
  render('shape-sphere', 'Sphere', 'A round body', avatar('shape-sphere', '', blob({ type: 'sphere', radius: 0.9 }))),
  render('shape-ellipsoid', 'Ellipsoid', 'A body wider than it is tall', avatar('shape-ellipsoid', '', blob({ type: 'ellipsoid', radii: [1, 0.76, 0.8] }), { color: '#A8D8B9' })),
  render('shape-box', 'Box', 'A rounded cube', avatar('shape-box', '', blob({ type: 'box', size: [1.6, 1.5, 1.3], rounding: 0.3 }), { color: '#F7D774' })),
  render('shape-superellipsoid', 'Superellipsoid', 'A squircle body between a sphere and a box', avatar('shape-superellipsoid', '', blob({ type: 'superellipsoid', radii: [0.95, 0.85, 0.8], exponent: 3.2 }), { color: '#9EC5F8' })),
  render('shape-capsule', 'Capsule', 'A rod with round ends, wider at the bottom', avatar('shape-capsule', '', blob({ type: 'capsule', from: [0, -0.4, 0], to: [0, 0.4, 0], radius: 0.58, radiusTo: 0.46 }), { color: '#F4A6B8' })),
  render('shape-cylinder', 'Cylinder', 'An upright rounded cylinder', avatar('shape-cylinder', '', blob({ type: 'cylinder', radius: 0.78, height: 1.5, rounding: 0.25 }), { color: '#C9B6F2' })),
  render('shape-cone', 'Cone', 'A frustum, wide at the base', avatar('shape-cone', '', blob({ type: 'cone', radius: 0.92, radiusTop: 0.38, height: 1.7, rounding: 0.2 }), { color: '#FFB27A', face: { ...FACE, eyes: { ...FACE.eyes, height: 0.05 }, mouth: { ...FACE.mouth, height: -0.18 } } })),
  render('shape-torus', 'Torus', 'A ring floating above the head', avatar('shape-torus', '', blob({ type: 'sphere', radius: 0.85 }), {
    materials: { main: felt('#B8E0F0'), gold: felt('#FFD23C', '#FFF3C0') },
    parts: [{ id: 'halo', role: 'accessory', material: 'gold', shape: { type: 'torus', radius: 0.48, thickness: 0.07 }, attach: { position: [0, 1.08, 0] } }],
  })),
  render('shape-halfspace', 'Dome', 'A sphere cut flat at the bottom by a halfspace, through intersect', avatar('shape-halfspace', '', blob({ type: 'intersect', children: [{ type: 'sphere', radius: 0.95 }, { type: 'halfspace', normal: [0, -1, 0], offset: 0.35 }] }), { color: '#FF9AA2' })),
  render('shape-union', 'Snowman', 'Two spheres in a smooth union', avatar('shape-union', '', blob({ type: 'union', smooth: 0.25, children: [{ type: 'sphere', radius: 0.56, position: [0, 0.42, 0] }, { type: 'sphere', radius: 0.72, position: [0, -0.27, 0] }] }), { color: '#F5F1E6', face: { ...FACE, eyes: { ...FACE.eyes, height: 0.5 }, mouth: { ...FACE.mouth, height: 0.3 } } })),
  render('shape-subtract', 'Bitten', 'A sphere with a bite taken out of its top right', avatar('shape-subtract', '', blob({ type: 'subtract', smooth: 0.05, children: [{ type: 'sphere', radius: 0.9 }, { type: 'sphere', radius: 0.42, position: [0.58, 0.58, 0.5] }] }), { color: '#E85D5D' })),
  // Outlines through extrusion (SPEC 5.4).
  render('outline-circle', 'Coin', 'A puffed disc', avatar('outline-circle', '', blob(extrude({ type: 'circle', radius: 0.9 })), { color: '#FFD23C' })),
  render('outline-ellipse', 'Pebble', 'A puffed ellipse', avatar('outline-ellipse', '', blob(extrude({ type: 'ellipse', radii: [1, 0.74] })), { color: '#B0B7C3' })),
  render('outline-rect', 'Tile', 'A puffed rounded rectangle', avatar('outline-rect', '', blob(extrude({ type: 'rect', size: [1.6, 1.4], rounding: 0.35 })), { color: '#7FD1C7' })),
  render('outline-polygon', 'Hexagon', 'A puffed hexagon with rounded corners', avatar('outline-polygon', '', blob(extrude({ type: 'polygon', points: hexagon, rounding: 0.2 })), { color: '#F7B267' })),
  render('outline-star', 'Six-point star', 'A puffed six-pointed star', avatar('outline-star', '', blob(extrude({ type: 'star', points: 6, radius: 1, innerRadius: 0.64 })), { color: '#FFCF56' })),
  render('outline-heart', 'Heart', 'A puffed heart, point down', avatar('outline-heart', '', blob(extrude({ type: 'heart', size: 1.7 })), { color: '#FF6F91', face: { ...FACE, eyes: { ...FACE.eyes, height: 0.2 }, mouth: { ...FACE.mouth, height: 0 } } })),
  render('outline-stroke', 'Arch', 'A thick stroke along a bent line, like a rainbow', avatar('outline-stroke', '', blob(extrude({ type: 'stroke', points: [[-0.55, -0.45], [0, 0.2], [0.55, -0.45]], width: 0.82 })), { color: '#8BC34A', face: { ...FACE, eyes: { ...FACE.eyes, height: 0.16 }, mouth: { ...FACE.mouth, height: 0 } } })),
  render('outline-union', 'Peanut', 'Two circles in a smooth 2D union', avatar('outline-union', '', blob(extrude({ type: 'union', smooth: 0.2, children: [{ type: 'circle', radius: 0.5, center: [0, 0.45] }, { type: 'circle', radius: 0.58, center: [0, -0.38] }] })), { color: '#D7A86E', face: { ...FACE, eyes: { ...FACE.eyes, height: 0.5 }, mouth: { ...FACE.mouth, height: 0.32 } } })),
  render('outline-subtract', 'Crescent', 'A circle with a circle cut from its top right', avatar('outline-subtract', '', blob(extrude({ type: 'subtract', children: [{ type: 'circle', radius: 0.9 }, { type: 'circle', radius: 0.45, center: [0.68, 0.7] }] })), { color: '#9FA8DA' })),
  render('outline-intersect', 'Lens', 'Two overlapping circles intersected into a lens', avatar('outline-intersect', '', blob(extrude({ type: 'intersect', children: [{ type: 'circle', radius: 0.95, center: [-0.35, 0] }, { type: 'circle', radius: 0.95, center: [0.35, 0] }] })), { color: '#AED581' })),
  // Deformers (SPEC 5.5).
  render('deform-taper', 'Pear', 'A capsule that narrows toward the top', avatar('deform-taper', '', blob({ type: 'capsule', from: [0, -0.4, 0], to: [0, 0.4, 0], radius: 0.56, deform: [{ type: 'taper', axis: 'y', amount: -0.35 }] }), { color: '#C5E1A5' })),
  render('deform-twist', 'Twist', 'A rounded box twisted about y', avatar('deform-twist', '', blob({ type: 'box', size: [1.2, 1.6, 1.2], rounding: 0.2, deform: [{ type: 'twist', axis: 'y', amount: 40 }] }), { color: '#80DEEA' })),
  render('deform-bend', 'Banana', 'A capsule bent toward +x', avatar('deform-bend', '', blob({ type: 'capsule', from: [0, -0.55, 0], to: [0, 0.55, 0], radius: 0.42, deform: [{ type: 'bend', axis: 'y', toward: 'x', amount: 62 }] }), { color: '#FFE082' })),
  render('deform-squash', 'Mochi', 'A sphere squashed below its middle', avatar('deform-squash', '', blob({ type: 'sphere', radius: 0.9, deform: [{ type: 'squash', axis: 'y', below: 0.6, above: 1.05 }] }), { color: '#F8BBD0' })),
  render('deform-ripple', 'Jellyfish', 'An ellipsoid with waves around its lower half', avatar('deform-ripple', '', blob({ type: 'ellipsoid', radii: [0.9, 0.85, 0.85], deform: [{ type: 'ripple', axis: 'y', count: 8, amplitude: 0.07, range: [-0.85, 0] }] }), { color: '#CE93D8' })),
  // The biped rig (SPEC 6.2).
  ...[['round', 'pear', 'nub', '#8FB8E8'], ['wide', 'round', 'paw', '#F2A65A'], ['tall', 'slim', 'nub', '#9CCC65'], ['square', 'square', 'none', '#B39DDB']].map(([head, bodyShape, arms, color], i) => render(
    `biped-${head}-${bodyShape}`, `Biped ${head} ${bodyShape}`, `A biped with a ${head} head, a ${bodyShape} body and ${arms === 'none' ? 'no' : arms} arms`,
    avatar(`biped-${head}-${bodyShape}`, '', {
      rig: 'biped', proportions: { head: [0.6, 0.55, 0.5, 0.6][i], headShape: head, body: 0.5, bodyShape, legs: [0.4, 0.3, 0.7, 0.4][i], arms: 0.5 }, arms: { style: arms },
    }, { color, face: { type: 'sewn', eyes: { size: 0.09, spacing: 0.24, height: 0.42 }, mouth: { shape: 'smile', width: 0.13, height: 0.24 } } }),
    [{ label: 'front' }, { label: 'three-quarter', view: 35 }, { label: 'wave', play: 'wave', room: true }])),
  // Faces (SPEC 8).
  ...[
    ['bead', 'round', 'smile', 'button', true],
    ['bead', 'oval', 'oval', null, false],
    ['sewn', 'tall', 'line', null, true],
    ['sewn', 'wide', 'cat', 'triangle', false],
    ['drawn', 'dot', 'beak', null, false],
    ['drawn', 'almond', 'none', 'snout', true],
  ].map(([type, eyes, mouth, nose, brows]) => render(
    `face-${type}-${eyes}`, `Face ${type} ${eyes}`, `A ${type} face: ${eyes} eyes, mouth ${mouth}${nose ? `, a ${nose} nose` : ''}${brows ? ', brows' : ''}, cheeks when happy`,
    avatar(`face-${type}-${eyes}`, '', blob({ type: 'ellipsoid', radii: [0.92, 0.86, 0.84] }), {
      color: { bead: '#FFE0B2', sewn: '#D1C4E9', drawn: '#FFF9C4' }[type],
      face: {
        type, eyes: { shape: eyes, size: 0.09, spacing: 0.32, height: 0.16 }, mouth: { shape: mouth, width: 0.16, height: -0.1 },
        cheeks: { color: '#FF9DB2', size: 0.1, spacing: 0.5, height: -0.04, show: 'happy' },
        ...(nose ? { nose: { shape: nose, size: 0.08, height: 0.02 } } : {}),
        ...(brows ? { brows: { color: '#4E342E', thickness: 0.02, length: 0.12, height: 0.32 } } : {}),
      },
    }),
    [{ label: 'front' }, { label: 'happy', input: { expression: 'happy' } }, { label: 'speaking', input: { state: 'speaking', voice: 0.8 } }])),
  render('face-none', 'No face', 'A body with no face at all', avatar('face-none', '', blob({ type: 'sphere', radius: 0.9 }), { color: '#90A4AE', face: { type: 'none' } })),
  // Materials (SPEC 7.1).
  ...[
    ['felt', { type: 'felt', color: '#F2C9A0', sheen: '#FFFFFF' }],
    ['fur', { type: 'fur', color: '#C7A27A', fur: { length: 0.6, density: 0.7, droop: 0.3, tip: '#EBD5B8' } }],
    ['velvet', { type: 'velvet', color: '#7A3FA0', sheen: '#E3B8FF' }],
    ['plastic', { type: 'plastic', color: '#2E9BFF' }],
    ['rubber', { type: 'rubber', color: '#FF6B57' }],
    ['clay', { type: 'clay', color: '#D98C5F' }],
    ['ceramic', { type: 'ceramic', color: '#F5F1E6' }],
    ['glass', { type: 'glass', color: '#8FD3FF', opacity: 0.5 }],
    ['metal', { type: 'metal', color: '#C0C6CF', roughness: 0.3 }],
    ['toon', { type: 'toon', color: '#FFD23C' }],
  ].map(([type, main]) => render(`material-${type}`, `${type[0].toUpperCase()}${type.slice(1)}`, `A body of ${type}`, avatar(`material-${type}`, '', blob({ type: 'superellipsoid', radii: [0.92, 0.86, 0.84], exponent: 2.4 }), { materials: { main } }))),
  // Patterns and glow (SPEC 7.2, 7.3).
  ...[
    ['gradient', '#FF9AA2', { type: 'gradient', colors: ['#FFDAC1', '#B5EAD7'], axis: 'y' }],
    ['stripes', '#4FC3F7', { type: 'stripes', colors: ['#FFFFFF'], scale: 0.25, angle: 20 }],
    ['spots', '#FFE0B2', { type: 'spots', colors: ['#6D4C41'], scale: 0.35 }],
    ['checks', '#E57373', { type: 'checks', colors: ['#FFFFFF'], scale: 0.4 }],
  ].map(([type, color, pattern]) => render(`pattern-${type}`, `Pattern ${type}`, `A felt body with ${type}`, avatar(`pattern-${type}`, '', blob({ type: 'sphere', radius: 0.9 }), { materials: { main: { type: 'felt', color, pattern } } }))),
  render('glow', 'Lantern', 'A body that glows all the time, with a glowing bulb that lights while speaking', avatar('glow', '', blob({ type: 'superellipsoid', radii: [0.85, 0.9, 0.8], exponent: 2.6 }), {
    materials: { main: { type: 'felt', color: '#FFCC80', glow: { color: '#FFB74D', intensity: 0.8, driver: 'always' } }, bulb: { type: 'felt', color: '#FFF59D', glow: { color: '#FFEB3B', intensity: 1.6, driver: 'speaking' } } },
    parts: [{ id: 'bulb', role: 'antenna', material: 'bulb', shape: { type: 'sphere', radius: 0.14 }, attach: { direction: [0, 1, 0], lift: 0.06 } }],
  }), [{ label: 'front' }, { label: 'speaking', input: { state: 'speaking', voice: 0.8 } }]),
  // Parts (SPEC 9).
  render('parts-attach', 'Attach', 'Ears by direction standing upright and mirrored, an antenna by direction with a bulb on it, a bow by front point on the surface, and a tail by position behind', avatar('parts-attach', '', blob({ type: 'ellipsoid', radii: [0.9, 0.82, 0.8] }), {
    materials: { main: felt('#BCAAA4'), inner: felt('#F8BBD0'), dark: felt('#4E342E'), bow: felt('#E53935', '#FFCDD2') },
    parts: [
      { id: 'ears', role: 'ear', material: 'main', mirror: 'x', shape: { type: 'ellipsoid', radii: [0.14, 0.2, 0.07] }, attach: { direction: [0.55, 0.83, 0], lift: -0.04, align: 'upright' } },
      { id: 'antenna', role: 'antenna', material: 'dark', shape: { type: 'capsule', from: [0, 0, 0], to: [0, 0.26, 0], radius: 0.025 }, attach: { direction: [0, 1, 0], lift: -0.03, align: 'upright' } },
      { id: 'bulb', role: 'detail', material: 'bow', shape: { type: 'sphere', radius: 0.07 }, attach: { to: 'antenna', position: [0, 0.3, 0] } },
      { id: 'bow', role: 'accessory', material: 'bow', shape: { type: 'union', children: [{ type: 'ellipsoid', radii: [0.11, 0.07, 0.04], position: [0.1, 0, 0], rotation: [0, 0, -15], mirror: 'x' }, { type: 'sphere', radius: 0.045 }] }, attach: { at: [0, -0.42], lift: 0.02 } },
      { id: 'tail', role: 'tail', material: 'inner', shape: { type: 'sphere', radius: 0.16 }, attach: { position: [0, -0.5, -0.78], align: 'none' } },
    ],
  }), [{ label: 'front' }, { label: 'three-quarter', view: 35 }, { label: 'back', view: 180 }]),
  render('parts-patch', 'Patches', 'A belly patch and two cheek spots laid flat on the surface', avatar('parts-patch', '', blob({ type: 'ellipsoid', radii: [0.88, 0.9, 0.82] }), {
    materials: { main: felt('#4DB6AC'), belly: felt('#E0F2F1'), spot: felt('#00796B') },
    face: { ...FACE, eyes: { ...FACE.eyes, height: 0.3 }, mouth: { ...FACE.mouth, height: 0.1 } },
    parts: [
      { id: 'belly', role: 'detail', material: 'belly', patch: { type: 'ellipse', radii: [0.38, 0.3] }, attach: { at: [0, -0.38] } },
      { id: 'spots', role: 'detail', material: 'spot', mirror: 'x', patch: { type: 'circle', radius: 0.09 }, attach: { at: [0.5, 0.36] } },
    ],
  })),
  render('parts-roles', 'Roles', 'Wings, horns, a fin, a hair tuft, a hat, glasses, a leaf and a held flower, each with its role', avatar('parts-roles', '', blob({ type: 'sphere', radius: 0.82 }), {
    materials: { main: felt('#FFAB91'), wing: felt('#FFFFFF'), horn: felt('#FFF8E1'), dark: felt('#3E2723'), leaf: felt('#66BB6A'), hat: felt('#5C6BC0'), petal: felt('#F06292') },
    face: { ...FACE, eyes: { ...FACE.eyes, height: 0.1 }, mouth: { ...FACE.mouth, height: -0.14 } },
    parts: [
      { id: 'wings', role: 'wing', material: 'wing', mirror: 'x', shape: { type: 'extrusion', outline: { type: 'ellipse', radii: [0.34, 0.2] }, depth: 0.06, rounding: 0.03, rotation: [0, 70, 20] }, attach: { direction: [0.9, 0.1, -0.4], lift: -0.05 }, animations: [{ type: 'flap', axis: 'y', amount: 18, speed: 1.2 }] },
      { id: 'horns', role: 'horn', material: 'horn', mirror: 'x', shape: { type: 'cone', radius: 0.07, height: 0.24, rounding: 0.02 }, attach: { direction: [0.42, 0.9, 0.1], lift: -0.03, align: 'upright' } },
      { id: 'fin', role: 'fin', material: 'wing', shape: { type: 'extrusion', outline: { type: 'polygon', points: [[0, 0], [-0.3, 0], [0, 0.34]], rounding: 0.05 }, depth: 0.05, rounding: 0.02, rotation: [0, -90, 0] }, attach: { direction: [0, 0.2, -1], lift: -0.05, align: 'upright' } },
      { id: 'tuft', role: 'hair', material: 'dark', shape: { type: 'capsule', from: [0, 0, 0], to: [0.06, 0.18, 0], radius: 0.035, radiusTo: 0.015 }, attach: { direction: [0, 1, 0], lift: -0.02, align: 'upright' } },
      { id: 'hat', role: 'hat', material: 'hat', shape: { type: 'cylinder', radius: 0.18, height: 0.08, rounding: 0.03 }, attach: { direction: [-0.25, 0.97, 0], lift: -0.01, align: 'upright' } },
      { id: 'glasses', role: 'glasses', material: 'dark', shape: { type: 'torus', radius: 0.1, thickness: 0.018, position: [0.15, 0, 0], rotation: [90, 0, 0], mirror: 'x' }, attach: { at: [0, 0.1], lift: 0.06 } },
      { id: 'leaf', role: 'leaf', material: 'leaf', shape: { type: 'extrusion', outline: { type: 'intersect', children: [{ type: 'circle', radius: 0.14, center: [-0.07, 0] }, { type: 'circle', radius: 0.14, center: [0.07, 0] }] }, depth: 0.03, rounding: 0.01 }, attach: { to: 'hat', position: [0.08, 0.12, 0] } },
      { id: 'flower', role: 'prop', material: 'petal', shape: { type: 'extrusion', outline: { type: 'star', points: 5, radius: 0.12, innerRadius: 0.07 }, depth: 0.04, rounding: 0.02 }, attach: { at: [0.62, -0.45], lift: 0.04 } },
    ],
  }), [{ label: 'front' }, { label: 'three-quarter', view: 35 }, { label: 'side', view: 90 }]),
  render('parts-held', 'Held', 'A biped with a helmet in the head\'s own space, a shield in its left hand and a star wand in its right, which rise with its arms as it cheers; a gem on the helmet glows a little always and fully while speaking', avatar('parts-held', '', { rig: 'biped' }, {
    materials: { main: felt('#F6C28B'), steel: { type: 'metal', color: '#E6EAF0', roughness: 0.3 }, red: { type: 'plastic', color: '#D84A4A' }, gold: { type: 'plastic', color: '#FFCF4A' },
      gem: { type: 'plastic', color: '#7FD8FF', glow: { color: '#7FD8FF', intensity: 1.6, base: 0.3, driver: 'speaking' } } },
    face: { type: 'bead', eyes: { size: 0.09, spacing: 0.24, height: 0.4 }, mouth: { shape: 'smile', width: 0.13, height: 0.22 } },
    parts: [
      { id: 'helmet', role: 'hat', material: 'steel', shape: { type: 'subtract', children: [{ type: 'intersect', children: [{ type: 'ellipsoid', radii: [0.76, 0.68, 0.7] }, { type: 'halfspace', normal: [0, -1, 0], offset: -0.12 }] }, { type: 'ellipsoid', radii: [0.7, 0.62, 0.64] }] }, attach: { to: 'head', position: [0, 0, 0] } },
      { id: 'gem', role: 'detail', material: 'gem', shape: { type: 'sphere', radius: 0.07 }, attach: { to: 'head', direction: [0, 0.55, 1], lift: 0.06 } },
      { id: 'shield', role: 'prop', material: 'red', shape: { type: 'cylinder', radius: 0.26, height: 0.05, rounding: 0.02, rotation: [90, 25, 0] }, attach: { to: 'left-hand', position: [0.08, 0, 0.1] } },
      { id: 'wand', role: 'prop', material: 'gold', shape: { type: 'union', smooth: 0.02, children: [{ type: 'capsule', from: [0, -0.06, 0.04], to: [0, -0.06, 0.34], radius: 0.022 }, { type: 'extrusion', outline: { type: 'star', points: 5, radius: 0.12, innerRadius: 0.055 }, depth: 0.05, rounding: 0.015, position: [0, -0.06, 0.42] }] }, attach: { to: 'right-hand', position: [0, 0, 0] } },
    ],
  }), [{ label: 'front' }, { label: 'three-quarter', view: 35 }, { label: 'cheer', play: 'cheer' }, { label: 'speaking', input: { state: 'speaking', voice: 0.8 }, room: true }]),
  render('parts-animations', 'Animations', 'One part for each animation type, driven by always, speaking, voice, thinking and pointer', avatar('parts-animations', '', blob({ type: 'sphere', radius: 0.8 }), {
    materials: { main: felt('#B2DFDB'), a: felt('#FF8A65'), b: felt('#BA68C8'), c: { type: 'felt', color: '#FFF176', glow: { color: '#FFEB3B', intensity: 1, driver: 'speaking' } } },
    parts: [
      { id: 'sway', role: 'antenna', material: 'a', shape: { type: 'capsule', from: [0, 0, 0], to: [0, 0.24, 0], radius: 0.03 }, attach: { direction: [-0.35, 0.94, 0], lift: -0.02, align: 'upright' }, animations: [{ type: 'sway', axis: 'z', amount: 12, speed: 0.5 }] },
      { id: 'spin', role: 'detail', material: 'b', shape: { type: 'extrusion', outline: { type: 'star', points: 4, radius: 0.12, innerRadius: 0.05 }, depth: 0.04 }, attach: { direction: [0.35, 0.94, 0], lift: 0.1 }, animations: [{ type: 'spin', axis: 'y', speed: 0.5 }] },
      { id: 'bob', role: 'detail', material: 'a', shape: { type: 'sphere', radius: 0.07 }, attach: { position: [0.98, 0.3, 0] }, animations: [{ type: 'bob', axis: 'y', amount: 0.06, speed: 1 }] },
      { id: 'pulse', role: 'detail', material: 'b', shape: { type: 'sphere', radius: 0.07 }, attach: { position: [-0.98, 0.3, 0] }, animations: [{ type: 'pulse', amount: 0.2, driver: 'voice' }] },
      { id: 'wiggle', role: 'tail', material: 'a', shape: { type: 'capsule', from: [0, 0, 0], to: [0, -0.2, -0.12], radius: 0.05 }, attach: { position: [0, -0.5, -0.66], align: 'none' }, animations: [{ type: 'wiggle', axis: 'z', amount: 15, speed: 2 }] },
      { id: 'flap', role: 'ear', material: 'b', mirror: 'x', shape: { type: 'ellipsoid', radii: [0.12, 0.08, 0.04] }, attach: { direction: [0.9, 0.3, 0], lift: -0.02 }, animations: [{ type: 'flap', axis: 'z', amount: 20, speed: 1.5, driver: 'speaking' }] },
      { id: 'appear', role: 'detail', material: 'a', shape: { type: 'sphere', radius: 0.06 }, attach: { at: [0, -0.5], lift: 0.04 }, animations: [{ type: 'appear', driver: 'thinking' }] },
      { id: 'drift', role: 'detail', material: 'b', shape: { type: 'sphere', radius: 0.05 }, attach: { position: [0.6, -0.4, 0.5] }, animations: [{ type: 'drift', axis: 'y', amount: 0.5, speed: 0.6 }] },
      { id: 'glow', role: 'detail', material: 'c', shape: { type: 'sphere', radius: 0.06 }, attach: { position: [-0.6, -0.4, 0.5] }, animations: [{ type: 'glow', amount: 1.5, driver: 'pointer' }] },
    ],
  }), [{ label: 'front' }, { label: 'speaking', input: { state: 'speaking', voice: 0.8 } }, { label: 'thinking', input: { state: 'thinking' } }]),
  render('anchor-float', 'Ghost', 'A floating body whose shadow sits below it', avatar('anchor-float', '', { shape: { type: 'capsule', from: [0, -0.3, 0], to: [0, 0.3, 0], radius: 0.62, deform: [{ type: 'ripple', axis: 'y', count: 6, amplitude: 0.06, range: [-0.95, -0.55] }] }, anchor: 'float' }, { color: '#F5F5F5' })),
];

// Repair cases: documents a reader repairs (SPEC 15). `checks` says what the expected document shows.
const base = (id, more = {}) => ({ openavatar: '0.1', id: `org.openavatar.conformance.repair-${id}`, name: `Repair ${id}`, body: { shape: { type: 'sphere', radius: 0.9 }, material: 'main' }, materials: { main: felt('#F2C9A0') }, ...more });
export const REPAIR = [
  { id: 'unknown-members', checks: 'Members OpenAvatar 0.1 does not define are dropped, at the top, in the body and in the face', input: { ...base('unknown-members', { face: { type: 'bead', glitter: true } }), wobble: true, body: { shape: { type: 'sphere', radius: 0.9, fuzz: 2 }, material: 'main', color: '#FF0000' } } },
  { id: 'clamp-numbers', checks: 'Numbers outside their ranges are clamped to the nearest bound (SPEC 4)', input: base('clamp-numbers', { body: { shape: { type: 'sphere', radius: 4 }, material: 'main' }, face: { eyes: { size: 9, spacing: -1 } }, behavior: { temperament: { energy: 3, bounce: -2 } } }) },
  { id: 'whole-numbers', checks: 'Integer members are rounded', input: base('whole-numbers', { body: { shape: extrude({ type: 'star', points: 5.4, radius: 1, innerRadius: 0.6 }), material: 'main' } }) },
  { id: 'colors', checks: 'Short and lowercase colors become #RRGGBB; a malformed color is dropped', input: base('colors', { materials: { main: { type: 'felt', color: '#f80', sheen: '#ffeedd' }, bad: { type: 'felt', color: 'orange' } } }) },
  { id: 'unknown-shape-type', checks: 'A body shape of an unknown type is empty, so the body becomes a sphere of radius 0.9', input: base('unknown-shape-type', { body: { shape: { type: 'metaball', radius: 1 }, material: 'main' } }) },
  { id: 'empty-children', checks: 'Unknown children are dropped; a combinator left with one child becomes a union; a subtract whose base is gone is empty', input: base('empty-children', { body: { shape: { type: 'intersect', children: [{ type: 'sphere', radius: 0.9 }, { type: 'blob' }] }, material: 'main' }, parts: [{ id: 'gone', shape: { type: 'subtract', children: [{ type: 'nothing' }, { type: 'sphere', radius: 0.1 }] } }] }) },
  { id: 'unknown-ids', checks: 'Unknown standard ids take their fallback or are dropped: an expression, a motion, a prop, an effect, an outfit, a material type, a face type', input: base('unknown-ids', { materials: { main: { type: 'tweed', color: '#F2C9A0' } }, face: { type: 'pixel' }, outfit: 'tuxedo', behavior: { idleMotions: ['moonwalk', 'nod'], reactions: { states: { thinking: { expression: 'smug', motion: 'moonwalk', prop: 'abacus', effect: 'fireworks' } } } } }) },
  { id: 'vendor-ids', kept: true, checks: 'x- ids and extensions are kept for the app that knows them', input: base('vendor-ids', { outfit: 'x-acme-cape', behavior: { idleMotions: ['x-acme-dab'], reactions: { activities: { done: { motion: 'x-acme-dab', effect: 'x-acme-fireworks' } } } }, extensions: { 'com.acme': { aura: 'blue' } } }) },
  { id: 'bad-part', checks: 'A part whose shape is invalid is dropped and the rest renders', input: base('bad-part', { parts: [{ id: 'ok', shape: { type: 'sphere', radius: 0.15 }, attach: { direction: [0, 1, 0] } }, { id: 'broken', shape: { type: 'sphere' } }] }) },
  { id: 'duplicate-part-ids', checks: 'A repeated part id is renamed', input: base('duplicate-part-ids', { parts: [{ id: 'ear', shape: { type: 'sphere', radius: 0.15 }, attach: { direction: [0.6, 0.8, 0] } }, { id: 'ear', shape: { type: 'sphere', radius: 0.15 }, attach: { direction: [-0.6, 0.8, 0] } }] }) },
  { id: 'attach-later-part', checks: 'A part attached to a part listed after it, or to no part, is attached to the body, so attachments never form a cycle', input: base('attach-later-part', { parts: [{ id: 'a', shape: { type: 'sphere', radius: 0.1 }, attach: { to: 'b', position: [0, 0.2, 0] } }, { id: 'b', shape: { type: 'sphere', radius: 0.1 }, attach: { to: 'a', position: [0, 0.2, 0] } }] }) },
  { id: 'two-placements', checks: 'A part placed two ways keeps the first of position, at and direction', input: base('two-placements', { parts: [{ id: 'nose', shape: { type: 'sphere', radius: 0.08 }, attach: { at: [0, 0], direction: [0, 0, 1] } }] }) },
  { id: 'missing-material', checks: 'A material id that names nothing is reported; renderers draw the body material in its place', input: base('missing-material', { parts: [{ id: 'ear', material: 'nope', shape: { type: 'sphere', radius: 0.15 }, attach: { direction: [0, 1, 0] } }] }) },
  { id: 'over-counts', checks: 'Lists over their limits are cut: parts beyond 32 and tags beyond 12', input: base('over-counts', { meta: { tags: [...Array(14)].map((_, i) => `tag${i}`) }, parts: [...Array(34)].map((_, i) => ({ id: `dot${i}`, shape: { type: 'sphere', radius: 0.03 }, attach: { at: [((i % 7) - 3) * 0.18, Math.floor(i / 7) * 0.15 - 0.3] } })) }) },
  { id: 'newer-minor', checks: 'A document of a newer minor version is read as 0.1', input: { ...base('newer-minor'), openavatar: '0.7' } },
  { id: 'bad-preview', checks: 'A preview that is not a PNG or WebP data URI is dropped', input: base('bad-preview', { preview: { image: 'https://example.com/me.png' } }) },
  { id: 'byte-order-mark', checks: 'A UTF-8 byte order mark before the JSON is ignored', input: '﻿' + JSON.stringify(base('byte-order-mark', { wobble: 1 }), null, 2) + '\n' },
  { id: 'id-and-body', checks: 'Each code point of the id outside A-Z a-z 0-9 . _ - becomes -, and a body that is not an object becomes a blob, so a sphere (SPEC B.1)', input: { ...base('id-and-body'), id: 'org.openavatar.conformance.repair id&body \u{1F9F8}', body: 'round' } },
  { id: 'repeats-keep-first', checks: 'In idleMotions and tags an item equal to an earlier one is removed, and the first keeps its place; an unknown idle motion turns into nod first (SPEC B.2)', input: base('repeats-keep-first', { meta: { tags: ['plush', 'round', 'plush', 'soft', 'round'] }, behavior: { idleMotions: ['wave', 'moonwalk', 'look-around', 'nod', 'wave'] } }) },
  { id: 'code-points', checks: 'Lengths count code points, so a name of 70 emoji is cut to its first 64 and no emoji is split (SPEC B.1)', input: { ...base('code-points'), name: '\u{1F9F8}'.repeat(70) } },
  { id: 'long-part-ids', checks: 'A repeated 32-character part id is renamed within 32 characters; a later part attached to that id hangs on the first part that had it (SPEC B.5)', input: base('long-part-ids', { parts: [0.3, -0.3, 0].map(x => ({ id: 'a-very-long-part-id-for-a-button', shape: { type: 'sphere', radius: 0.08 }, attach: { at: [x, 0] } })).concat([{ id: 'thread', shape: { type: 'sphere', radius: 0.03 }, attach: { to: 'a-very-long-part-id-for-a-button', position: [0, 0, 0.08] } }]) }) },
  { id: 'dates', checks: 'A date-time that names no real instant is dropped; lowercase t and z and a leap second at 23:59:60 UTC are kept (SPEC B.2)', input: base('dates', { meta: { created: '2016-12-31t23:59:60z', updated: '2026-02-30T12:00:00Z' } }) },
  { id: 'many-materials', checks: 'Over 16 materials, the ids that come first in code point order stay, whatever order the file lists them in (SPEC B.2)', input: base('many-materials', { materials: Object.fromEntries(['main', ...[...Array(17)].map((_, i) => `z${String(17 - i).padStart(2, '0')}`)].map(k => [k, felt('#F2C9A0')])) }) },
];

// Reject cases: documents a reader must refuse with an error (SPEC 15). `code` is the reference reader's error code.
const nest = n => n === 0 ? { type: 'sphere', radius: 0.5 } : { type: 'union', children: [nest(n - 1)] };
export const REJECT = [
  { id: 'not-an-object', code: 'not-object', because: 'The document is a JSON array', input: [base('not-an-object')] },
  { id: 'no-openavatar', code: 'missing', because: 'It has no openavatar version', input: (({ openavatar, ...d }) => d)(base('no-openavatar')) },
  { id: 'no-id', code: 'missing', because: 'It has no id', input: (({ id, ...d }) => d)(base('no-id')) },
  { id: 'empty-name', code: 'missing', because: 'Its name is empty', input: { ...base('empty-name'), name: '  ' } },
  { id: 'no-body', code: 'missing', because: 'It has no body', input: (({ body, ...d }) => d)(base('no-body')) },
  { id: 'major-version', code: 'version', because: 'It is OpenAvatar 1.0, a higher major version', input: { ...base('major-version'), openavatar: '1.0' } },
  { id: 'bad-version', code: 'version', because: 'Its version is not <major>.<minor>', input: { ...base('bad-version'), openavatar: 'latest' } },
  { id: 'too-many-shapes', code: 'limit', because: 'It has more than 512 shapes and outlines (SPEC 5.6)', input: base('too-many-shapes', { parts: [...Array(32)].map((_, i) => ({ id: `p${i}`, shape: { type: 'union', children: [...Array(16)].map(() => ({ type: 'sphere', radius: 0.01 })) }, attach: { direction: [0, 1, 0] } })) }) },
  { id: 'too-deep', code: 'limit', because: 'Its shapes are nested more than 16 deep (SPEC 5.6)', input: base('too-deep', { body: { shape: nest(17), material: 'main' } }) },
  { id: 'too-many-points', code: 'limit', because: 'It has more than 1024 polygon and stroke points (SPEC 5.6)', input: base('too-many-points', { parts: [...Array(17)].map((_, i) => ({ id: `p${i}`, shape: extrude({ type: 'polygon', points: [...Array(64)].map((_, k) => [Math.cos(k / 10) * 0.1, Math.sin(k / 10) * 0.1]) }), attach: { direction: [0, 1, 0] } })) }) },
  { id: 'too-large', code: 'limit', because: 'The file is larger than 256 KB (SPEC 14.1)', input: JSON.stringify(base('too-large'), null, 2).replace(/\n}$/, ',\n  "meta": {"description": "big"}' + ' '.repeat(270 * 1024) + '\n}') },
];

// Behavior cases (SPEC 11.3, 13). Each names a document and the host's input.
const reacting = avatar('behavior-reactions', 'Reactions', blob({ type: 'sphere', radius: 0.9 }), {
  behavior: {
    reactions: {
      states: { thinking: { expression: 'relaxed', effect: 'sparkles' } },
      activities: { done: { motion: 'x-acme-dab', effect: 'confetti' }, error: null },
      userActivities: { coding: { prop: 'notebook' }, 'listening-music': { prop: null }, reading: { expression: 'x-shy', gaze: 'down' }, writing: { expression: 'x-smug' } },
    },
  },
  face: { ...FACE, expressions: { 'x-shy': { eyes: 'wide', mouth: 'o' } } },
});
reacting.name = 'Reactions';
export const BEHAVIOR = {
  documents: [
    { id: 'blob', example: 'mochi.openavatar' },
    { id: 'biped', example: 'matcha.openavatar' },
    { id: 'reactions', document: reacting },
  ],
  cases: [
    { id: 'idle', document: 'blob', input: {}, checks: 'At rest only the gaze is set' },
    ...['listening', 'thinking', 'speaking'].map(state => ({ id: `state-${state}`, document: 'blob', input: { state }, checks: `The default reaction to ${state} (SPEC 13.1)` })),
    ...['searching', 'working', 'waiting', 'error', 'done', 'sleeping'].map(activity => ({ id: `activity-${activity}`, document: 'blob', input: { activity }, checks: `The default reaction to ${activity} (SPEC 13.2)` })),
    ...['coding', 'writing', 'reading', 'browsing', 'designing', 'form-filling', 'chatting', 'meeting', 'watching', 'listening-music', 'gaming', 'away'].map(userActivity => ({ id: `user-${userActivity}`, document: 'biped', input: { userActivity }, checks: `The default reaction to ${userActivity} (SPEC 13.3), on a biped with arms` })),
    { id: 'armless-coding', document: 'blob', input: { userActivity: 'coding' }, checks: 'An armless avatar falls back from motions that need arms (SPEC 13.5)' },
    { id: 'coding-while-thinking', document: 'biped', input: { userActivity: 'coding', state: 'thinking' }, checks: 'The prop stays from the user activity; thinking sets the expression (SPEC 11.3)' },
    { id: 'coding-searching-speaking', document: 'biped', input: { userActivity: 'coding', activity: 'searching', state: 'speaking' }, checks: 'Speaking outranks the activity, which outranks the user activity, channel by channel' },
    { id: 'meeting-is-quiet', document: 'biped', input: { userActivity: 'meeting', state: 'idle' }, checks: 'During a meeting the avatar is quiet: no idle motions or effects' },
    { id: 'host-expression', document: 'blob', input: { state: 'thinking', expression: 'love', expressionIntensity: 0.6 }, checks: 'An expression from the host takes the expression channel at layer 2' },
    { id: 'host-expression-unknown', document: 'blob', input: { expression: 'smug' }, checks: 'An unknown expression from the host takes its fallback' },
    { id: 'host-expression-while-speaking', document: 'blob', input: { state: 'speaking', expression: 'sad', expressionIntensity: 0.5 }, checks: 'An expression from the host outranks speaking\'s own (SPEC 11.3)' },
    { id: 'done-then-coding', document: 'biped', input: { activity: 'done', userActivity: 'coding', finished: ['activity'] }, checks: 'Once the activity\'s motion has played to its end, the user activity\'s motion takes the channel; the other channels stay (SPEC 11.3)' },
    { id: 'command-on-armless', document: 'blob', input: { command: 'clap' }, checks: 'A commanded motion that needs arms falls back on an armless avatar' },
    { id: 'command-on-biped', document: 'biped', input: { command: 'clap', state: 'speaking' }, checks: 'A commanded motion outranks every layer' },
    { id: 'reaction-overrides', document: 'reactions', input: { state: 'thinking' }, checks: 'A document reaction replaces the default for the channels it sets' },
    { id: 'reaction-null', document: 'reactions', input: { activity: 'error' }, checks: 'A null reaction turns the default off' },
    { id: 'reaction-vendor-motion', document: 'reactions', input: { activity: 'done' }, checks: 'A renderer that does not know an x- motion plays nod (SPEC 13); one that knows it plays it' },
    { id: 'reaction-prop', document: 'reactions', input: { userActivity: 'coding' }, checks: 'A document can swap the prop of a user activity' },
    { id: 'reaction-prop-off', document: 'reactions', input: { userActivity: 'listening-music' }, checks: 'A document can turn the prop of a user activity off' },
    { id: 'reaction-own-expression', document: 'reactions', input: { userActivity: 'reading' }, checks: 'An x- expression the document defines in face.expressions is shown as it is (SPEC 8.5)' },
    { id: 'reaction-undefined-expression', document: 'reactions', input: { userActivity: 'writing' }, checks: 'An x- expression the document does not define takes the fallback, neutral (SPEC 13)' },
    { id: 'host-own-expression', document: 'reactions', input: { expression: 'x-shy', expressionIntensity: 0.8 }, checks: 'The host can ask for an expression the document defines (SPEC 8.5)' },
  ],
};

/** What a document uses, as kind:value tags: the coverage the suite checks. */
export function covers(doc) {
  const tags = new Set(), add = t => tags.add(t);
  const shape = s => {
    if (!s || typeof s !== 'object') return;
    add(`shape:${s.type}`);
    for (const d of s.deform || []) add(`deformer:${d.type}`);
    if (s.outline) outline(s.outline);
    for (const c of s.children || []) shape(c);
  };
  const outline = o => { add(`outline:${o.type}`); for (const c of o.children || []) outline(c); };
  const b = doc.body || {};
  add(`rig:${b.rig || 'blob'}`); add(`anchor:${b.anchor || 'ground'}`);
  if (b.shape) shape(b.shape);
  if (b.rig === 'biped') { const p = b.proportions || {}; add(`headShape:${p.headShape || 'round'}`); add(`bodyShape:${p.bodyShape || 'pear'}`); add(`armStyle:${b.arms?.style || 'nub'}`); }
  for (const m of Object.values(doc.materials || {})) { add(`material:${m.type || 'felt'}`); if (m.pattern) add(`pattern:${m.pattern.type}`); if (m.glow) add(m.glow.base ? 'glow:base' : 'glow'); }
  const f = doc.face || {};
  add(`face:${f.type || 'bead'}`);
  if (f.type !== 'none') { add(`eyes:${f.eyes?.shape || 'round'}`); add(`mouth:${f.mouth?.shape || 'oval'}`); }
  if (f.nose) add(`nose:${f.nose.shape || 'button'}`);
  if (f.brows) add('brows');
  if (f.cheeks) add('cheeks');
  for (const p of doc.parts || []) {
    if (p.role) add(`role:${p.role}`);
    if (p.shape) shape(p.shape);
    if (p.patch) { add('patch'); outline(p.patch); }
    if (p.mirror) add('mirror');
    const a = p.attach || {};
    for (const k of ['position', 'at', 'direction']) if (a[k]) add(`attach:${k}`);
    if (a.to && a.to !== 'body') add(['head', 'left-hand', 'right-hand'].includes(a.to) ? `target:${a.to}` : 'attach:to');
    add(`align:${a.align || 'surface'}`);
    for (const an of p.animations || []) add(`animation:${an.type}`);
  }
  if (doc.outfit) add('outfit');
  if (doc.behavior?.reactions) add('reactions');
  return [...tags].sort();
}

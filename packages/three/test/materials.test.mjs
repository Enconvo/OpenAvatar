// SPEC 7.1's tables, read from SPEC.md, against the reference renderer's materials, pile and face lifts. A change to
// either that the other doesn't make fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { OpenAvatar, makeMaterial, addShells, pileHeight, featureLift } from '../src/index.js';

const spec = fs.readFileSync(new URL('../../../spec/SPEC.md', import.meta.url), 'utf8');
const section = spec.slice(spec.indexOf('### 7.1 Types'), spec.indexOf('### 7.2 Patterns'));
// The rows of the table whose header starts with `start`, as { type: [cells] }.
function table(start) {
  const lines = section.slice(section.indexOf(start)).split('\n');
  const rows = {};
  for (const line of lines.slice(2)) {
    if (!line.startsWith('|')) break;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    rows[cells[0].replace(/`/g, '')] = cells.slice(1);
  }
  return rows;
}
// A cell such as `0.05 + 0.5·opacity` or `70 + 140·\`density\`` as a function of the material's values; null for none.
const formula = cell => {
  if (cell === 'none') return () => null;
  const js = cell.replace(/`/g, '').replace(/·/g, '*').replace(/−/g, '-');
  return new Function('v', `with (v) return ${js};`);
};
const close = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);

const PARAMS = table('| `type` | Roughness |');
const PILE = table('| `type` | Fibres per unit f |');
const TYPES = ['felt', 'fur', 'velvet', 'plastic', 'rubber', 'clay', 'ceramic', 'glass', 'metal', 'toon'];

test('SPEC 7.1 lists every type once in its parameter table', () => {
  assert.deepEqual(Object.keys(PARAMS), TYPES);
  assert.deepEqual(Object.keys(PILE), ['felt', 'velvet', 'fur']);
});

for (const fur of [{}, { length: .3, density: .7, droop: .1 }]) for (const opacity of [undefined, .45]) {
  test(`each type has SPEC 7.1's parameters (fur ${JSON.stringify(fur)}, opacity ${opacity})`, () => {
    const v = { L: .015 + .085 * (fur.length ?? .5), opacity: opacity ?? .2, density: fur.density ?? .5 };
    for (const type of TYPES) {
      const doc = { type, color: '#80A0C0', fur, opacity };
      const { material: m, shells } = makeMaterial(doc);
      const [rough, metal, coat, sheen, pile, lift] = PARAMS[type].map(formula);
      if (type === 'toon') assert.ok(m.isMeshToonMaterial);
      else {
        close(m.roughness, rough(v), `${type} roughness`);
        close(m.metalness, metal(v), `${type} metallic`);
        const c = PARAMS[type][2] === 'none' ? [0, 0] : PARAMS[type][2].split(';').map(Number);
        close(m.clearcoat, c[0], `${type} clearcoat`);
        if (c[0]) close(m.clearcoatRoughness, c[1], `${type} clearcoat roughness`);
        const sh = PARAMS[type][3] === 'none' ? null : PARAMS[type][3].split(';').map(Number);
        close(m.sheen, sh ? 1 : 0, `${type} sheen`);
        if (sh) {
          close(m.sheenRoughness, sh[0], `${type} sheen roughness`);
          close(m.userData.oa.sheenK, sh[1], `${type} lightening`);
          const want = new THREE.Color('#80A0C0').lerp(new THREE.Color(1, 1, 1), sh[1]);
          assert.ok(m.sheenColor.equals(want), `${type} sheen color`);
        }
        // A document's roughness replaces the type's.
        close(makeMaterial({ ...doc, roughness: .55 }).material.roughness, .55, `${type} document roughness`);
      }
      close(pileHeight(doc), pile(v), `${type} pile`);
      assert.equal(shells?.length ?? 0, pileHeight(doc), `${type} shells`);
      close(featureLift(doc).feature, lift(v), `${type} feature lift`);
      assert.equal(featureLift(doc).ink, type === 'felt' ? .032 : null);
    }
  });
}

test('glass, toon and a type this version doesn\'t know are drawn as 7.1 says', () => {
  const glass = makeMaterial({ type: 'glass', color: '#3A6FD8', opacity: .45 }).material;
  close(glass.transmission, 1 - .6 * .45, 'transmission'); close(glass.ior, 1.45, 'ior'); close(glass.thickness, .3, 'thickness');
  close(glass.attenuationDistance, .8, 'attenuation'); assert.ok(glass.attenuationColor.equals(new THREE.Color('#3A6FD8')));
  close(makeMaterial({ type: 'glass' }).material.transmission, 1 - .6 * .2, 'default opacity');
  const ramp = makeMaterial({ type: 'toon' }).material.gradientMap.image.data;
  assert.deepEqual([ramp[0], ramp[4], ramp[8]].map(x => +(x / 255).toFixed(3)), [.353, .706, 1]);
  const toon = new OpenAvatar({ openavatar: '0.1', id: 'toon-test', name: 'Toon', materials: { main: { type: 'toon', color: '#F7C531' } }, body: { shape: { type: 'sphere', radius: .8 } } }, { quality: 'low' });
  const outline = toon.bodyMesh.children.find(c => c.material?.side === THREE.BackSide);
  assert.equal(outline.material.color.getHexString(), '15161a');
  const sh = { vertexShader: THREE.ShaderLib.basic.vertexShader };
  outline.material.onBeforeCompile(sh);
  assert.match(sh.vertexShader, /transformed\+=normalize\(normal\)\*\.022;/);
  toon.dispose();
  const odd = { type: 'silk', color: '#80A0C0' }, felt = makeMaterial({ type: 'felt', color: '#80A0C0' });
  assert.equal(makeMaterial(odd).material.roughness, felt.material.roughness);
  assert.equal(makeMaterial(odd).shells.length, .034);
  assert.deepEqual(featureLift(odd), featureLift({ type: 'felt' }));
});

// The uniforms one shell's shader gets.
const uniforms = m => { const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader }; m.onBeforeCompile(sh); return { u: sh.uniforms, fs: sh.fragmentShader }; };

test('the pile has SPEC 7.1\'s fibres, coverage, color and sag', () => {
  const docs = { felt: { type: 'felt', color: '#80A0C0' }, velvet: { type: 'velvet', color: '#80A0C0' }, fur: { type: 'fur', color: '#80A0C0', fur: { length: .4, density: .7 } }, tipped: { type: 'fur', color: '#80A0C0', fur: { tip: '#FFEEDD', droop: .6 } } };
  for (const [name, doc] of Object.entries(docs)) {
    const type = doc.type, row = PILE[type], v = { density: doc.fur?.density ?? .5 };
    for (const quality of ['high', 'low']) {
      const { material, shells } = makeMaterial(doc, { quality });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1), material), out = addShells(mesh, material, shells);
      const n = (quality === 'low' ? { felt: 2, velvet: 2, fur: 4 } : { felt: 4, velvet: 3, fur: 8 })[type];
      assert.equal(out.length, n, `${name} ${quality} shells`);
      const P = pileHeight(doc), D = formula(row[1])(v), droop = row[3] === '0' ? 0 : doc.fur?.droop ?? .3;
      out.forEach((m, j) => {
        const k = (j + 1) / n, { u, fs } = uniforms(m);
        close(u.uShell.value, k * P, `${name} height`);
        close(u.uFreq.value, formula(row[0])(v), `${name} fibres per unit`);
        close(u.uThr.value, Math.min(.97, .35 + .6 * k - .25 * D * (1 - k)), `${name} coverage`);
        close(u.uTipK.value, .6 * k * k, `${name} tip blend`);
        close(u.uAO.value, .84 + .16 * k, `${name} darkening`);
        close(u.uDroop.value, droop, `${name} droop`);
        // Fibre cells use 7.2's hash with key 5, and the sag is 6·droop·h².
        assert.match(fs, /if\(oaH\(ivec3\(floor\(vOAP\*uFreq\)\),5u\)<uThr\)discard;/);
      });
      const tip = row[2];
      if (doc.fur?.tip) assert.ok(shells.tip.equals(new THREE.Color(doc.fur.tip)) && shells.lighten === null, `${name} tip`);
      else assert.equal(shells.lighten, tip === 'the surface color' ? 0 : .25, `${name} tip: ${tip}`);
    }
  }
  const { u } = uniforms(addShells(new THREE.Mesh(new THREE.SphereGeometry(1)), makeMaterial(docs.tipped).material, makeMaterial(docs.tipped).shells)[0]);
  assert.ok(u.uTip.value.equals(new THREE.Color('#FFEEDD')));
});

test('the face sits at the lifts C.1 gives for the body\'s material', () => {
  const face = { mouth: { shape: 'smile' }, brows: {}, cheeks: { show: 'always' } };
  for (const main of [{ type: 'felt' }, { type: 'fur', fur: { length: .3 } }, { type: 'clay' }, { type: 'velvet' }]) {
    const doc = { openavatar: '0.1', id: 'lift-test', name: 'Lift test', materials: { main: { ...main, color: '#F7C531' } }, body: { shape: { type: 'sphere', radius: .9 } }, face };
    const a = new OpenAvatar(doc, { quality: 'low' }), above = p => a.bodySdf(p.x, p.y, p.z);
    const { feature: F, ink } = featureLift(main), at = (p, want, what) => assert.ok(Math.abs(above(p) - want) < 5e-4, `${main.type} ${what}: ${above(p)} vs ${want}`);
    for (const eye of a.face.eyes) at(eye.frame.p, F, 'eye');
    at(a.face.mouth.frame.p, ink ?? .8 * F, 'mouth');
    for (const b of a.face.brows) at(b.a.position, ink ?? F, 'brow');
    for (const c of a.face.cheeks) at(c.position, .7 * F, 'cheek');
    a.dispose();
  }
});

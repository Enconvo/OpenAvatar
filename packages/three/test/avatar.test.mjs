// Builds every example with the reference renderer in Node (no WebGL needed to
// build the scene) and runs it through every situation the vocabulary names.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { VOCABULARY } from '@openavatar/core';
import { OpenAvatar, SUPPORTED_MOTIONS, makeMaterial, addShells } from '../src/index.js';

const dir = new URL('../../../examples/', import.meta.url).pathname;
const examples = fs.readdirSync(dir).filter(f => f.endsWith('.openavatar')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const finite = o => { let ok = true; o.traverse(n => { for (const v of [...n.position.toArray(), ...n.quaternion.toArray(), ...n.scale.toArray()]) if (!Number.isFinite(v)) ok = false; }); return ok; };

test('every example builds, fits in the box and has no repairs', () => {
  for (const doc of examples) {
    const a = new OpenAvatar(doc, { quality: 'low' });
    assert.equal(a.repairs.length, 0, `${doc.name}: ${JSON.stringify(a.repairs)}`);
    for (const v of [...a.bounds.min.toArray(), ...a.bounds.max.toArray()]) assert.ok(Math.abs(v) <= 1.5, `${doc.name} bounds ${v}`);
    assert.ok(a.bounds.max.y - a.bounds.min.y > .8, `${doc.name} is too small`);
    a.dispose();
  }
});

test('every situation, expression and motion runs without breaking the scene', () => {
  const V = VOCABULARY;
  for (const doc of examples) {
    const a = new OpenAvatar(doc, { quality: 'low' });
    const step = (n = 20) => { for (let i = 0; i < n; i++) a.update(1 / 30); };
    for (const s of V.states) { a.setInput({ state: s.id, voice: .7, mic: .5 }); step(); }
    a.setInput({ state: 'idle' });
    for (const x of V.activities) { a.setInput({ activity: x.id }); step(); }
    a.setInput({ activity: null });
    for (const x of V.userActivities) { a.setInput({ userActivity: x.id }); step(); }
    a.setInput({ userActivity: null });
    for (const e of V.expressions) { a.setInput({ expression: e.id }); step(10); }
    a.setInput({ expression: null });
    for (const m of V.motions) { const len = a.play(m.id); assert.ok(len > 0); step(Math.ceil(len * 30) + 2); }
    assert.ok(finite(a.object), `${doc.name}: a transform went NaN`);
    a.dispose();
  }
});

test('the renderer has a pose for every standard motion', () => {
  for (const m of VOCABULARY.motions) assert.ok(SUPPORTED_MOTIONS.includes(m.id), m.id);
});

test('a host command plays once and then clears', () => {
  const a = new OpenAvatar(examples.find(d => d.body.rig === 'biped'), { quality: 'low' });
  const len = a.play('wave');
  a.update(1 / 30);
  assert.equal(a.behavior.motion, 'wave');
  assert.equal(a.behavior.layers.motion, 'command');
  for (let t = 0; t < len + .2; t += 1 / 30) a.update(1 / 30);
  assert.equal(a.motion.commanded, null);
  a.dispose();
});

test('mirrored parts and eyes are symmetric across x = 0', () => {
  for (const doc of examples) {
    const a = new OpenAvatar(doc, { quality: 'low' });
    for (const [id, e] of a.parts) if (e.copies.length === 2) {
      const [p, q] = e.copies.map(c => c.anchor.position);
      assert.ok(Math.abs(p.x + q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6 && Math.abs(p.z - q.z) < 1e-6, `${doc.name}/${id}`);
    }
    // Eyes mirror on a surface that is itself symmetric: the body and the patches laid on it, which a bent bean
    // or Duet's two different speech bubbles are not.
    if (a.face.eyes) {
      const [l, r] = a.face.eyes.map(e => e.anchor.position), sdf = a.faceSdf || a.bodySdf;
      const near = [-.04, 0, .04].flatMap(d => [[l.x + d, l.y, l.z], [l.x, l.y + d, l.z - .02]]);
      const symmetric = [[.3, .2, .5], [.5, -.3, .2], [.2, .6, .4], ...near].every(([x, y, z]) => Math.abs(sdf(x, y, z) - sdf(-x, y, z)) < 1e-9);
      if (symmetric) assert.ok(Math.abs(l.x + r.x) < 1e-6, `${doc.name} eyes`);
    }
    a.dispose();
  }
});

test('a biped stands on y = -1 and its arms reach out of the suit', () => {
  const a = new OpenAvatar(examples.find(d => d.body.rig === 'biped'), { quality: 'low' });
  assert.ok(Math.abs(a.suit.bottom + 1) < 1e-9);
  assert.equal(a.arms.length, 2);
  for (const arm of a.arms) {
    const tip = new THREE.Vector3(0, -arm.length, 0).applyMatrix4(arm.group.matrix);
    assert.ok(a.bodySdf(tip.x, tip.y, tip.z) > 0, `arm ${arm.side} ends inside the body`);
  }
  a.dispose();
});

test('what body.shape adds past a biped\'s suit is meshed too, while the suit still stands on y = -1', () => {
  const doc = structuredClone(examples.find(d => d.body.rig === 'biped'));
  doc.body.shape = { type: 'cone', radius: .16, radiusTop: .02, height: .5, position: [.36, 1.15, 0], mirror: 'x' };
  const a = new OpenAvatar(doc, { quality: 'low' });
  const top = new THREE.Box3().setFromBufferAttribute(a.bodyMesh.geometry.attributes.position).max.y;
  assert.ok(top > 1.3, `the ears reach ${top}`);
  assert.ok(Math.abs(a.suit.bottom + 1) < 1e-9);
  a.dispose();
});

test('a broken document still renders something', () => {
  const a = new OpenAvatar({ openavatar: '0.1', id: 'x', name: 'Empty', body: { shape: { type: 'union', children: [] } }, parts: [{ id: 'p', shape: { type: 'nope' } }] }, { quality: 'low' });
  assert.ok(a.repairs.length > 0);
  assert.ok(a.bounds.max.y > .5);
  a.update(1 / 30);
  a.dispose();
});

test('every standard prop and effect has a builder', async () => {
  const { SUPPORTED_PROPS, SUPPORTED_EFFECTS } = await import('../src/index.js');
  for (const p of VOCABULARY.props) assert.ok(SUPPORTED_PROPS.includes(p.id), p.id);
  for (const e of VOCABULARY.effects) assert.ok(SUPPORTED_EFFECTS.includes(e.id), e.id);
});

test('a user activity brings its prop and effect in, and they leave after it', () => {
  for (const doc of examples) {
    const a = new OpenAvatar(doc, { quality: 'low' });
    const step = (n = 30) => { for (let i = 0; i < n; i++) a.update(1 / 30); };
    a.setInput({ userActivity: 'listening-music' }); step();
    // The document may turn the prop off (Mochi already wears headphones).
    const prop = a.behavior.prop, effect = a.behavior.effect;
    const shown = [prop && a.props.built.get(prop), effect && a.effects.built.get(effect)].filter(Boolean);
    assert.equal(shown.length, Number(Boolean(prop)) + Number(Boolean(effect)), `${doc.name}: ${prop} ${effect} not built`);
    for (const e of shown) assert.ok(e.holder.visible && e.v > .9, `${doc.name} ${e.id}`);
    a.setInput({ userActivity: null }); step();
    for (const e of shown) assert.ok(!e.holder.visible, `${doc.name} kept ${e.id}`);
    // A meeting is quiet: no effects even when a state asks for one.
    a.setInput({ userActivity: 'meeting', state: 'thinking' }); step();
    assert.ok(![...a.effects.built.values()].some(e => e?.holder.visible), `${doc.name} showed an effect in a meeting`);
    a.dispose();
  }
});

test('every prop and effect builds on every example and stays out of the bounds', () => {
  for (const doc of examples) {
    const a = new OpenAvatar(doc, { quality: 'low' });
    const before = a.bounds.clone();
    for (const p of VOCABULARY.props) assert.ok(a.props.build(p.id), `${doc.name} ${p.id}`);
    for (const e of VOCABULARY.effects) assert.ok(a.effects.build(e.id), `${doc.name} ${e.id}`);
    a.computeBounds();
    assert.ok(a.bounds.equals(before), `${doc.name}: props changed the framing bounds`);
    a.dispose();
  }
});

test('every standard outfit builds on every example without moving the frame', async () => {
  const { SUPPORTED_OUTFITS } = await import('../src/index.js');
  for (const o of VOCABULARY.outfits) assert.ok(SUPPORTED_OUTFITS.includes(o.id), o.id);
  for (const doc of examples) {
    const a = new OpenAvatar(doc, { quality: 'low' });
    for (const o of VOCABULARY.outfits) {
      a.setInput({ outfit: o.id }); a.update(1 / 30); a.update(.2);
      const e = a.outfits.built.get(o.id);
      assert.ok(e && e.g.visible, `${doc.name} ${o.id}`);
      assert.ok(finite(e.g), `${doc.name} ${o.id} went NaN`);
    }
    // Same pose, with and without the outfit showing.
    a.computeBounds(); const worn = a.bounds.clone();
    a.outfits.group.visible = false; a.computeBounds(); a.outfits.group.visible = true;
    assert.ok(a.bounds.equals(worn), `${doc.name}: an outfit moved the framing bounds`);
    a.setInput({ outfit: null }); for (let i = 0; i < 10; i++) a.update(.1);
    assert.ok([...a.outfits.built.values()].every(e => !e.g.visible), `${doc.name}: outfit stayed on`);
    a.dispose();
  }
});

test('an unknown outfit shows nothing, and a hat outfit hides the document\'s hats', () => {
  const doc = { openavatar: '0.1', id: 'hat-test', name: 'Hat test', body: { shape: { type: 'sphere', radius: .9 } },
    parts: [{ id: 'cap', role: 'hat', shape: { type: 'cylinder', radius: .3, height: .2 }, attach: { direction: [0, 1, 0], align: 'upright' } },
      { id: 'ear', role: 'ear', mirror: 'x', shape: { type: 'sphere', radius: .15 }, attach: { direction: [.6, .8, 0] } }] };
  const a = new OpenAvatar(doc, { quality: 'low' });
  a.setInput({ outfit: 'x-nonexistent' }); a.update(.1);
  assert.equal(a.outfits.current, null);
  a.setInput({ outfit: 'top-hat' }); a.update(.1);
  assert.equal(a.parts.get('cap').copies[0].anchor.visible, false);
  assert.ok(a.parts.get('ear').copies.every(c => c.anchor.visible));
  a.setInput({ outfit: 'scarf' }); a.update(.1);
  assert.equal(a.parts.get('cap').copies[0].anchor.visible, true);
  a.dispose();
});

test('a part on a mirrored part goes on both copies and hides with it', () => {
  const doc = { openavatar: '0.1', id: 'stack-test', name: 'Stack test', body: { shape: { type: 'sphere', radius: .9 } },
    parts: [{ id: 'ear', role: 'hat', mirror: 'x', shape: { type: 'cone', radius: .15, height: .3 }, attach: { direction: [.6, .8, 0], align: 'upright' } },
      { id: 'inner', shape: { type: 'sphere', radius: .05 }, attach: { to: 'ear', position: [.05, 0, .1] } }] };
  const a = new OpenAvatar(doc, { quality: 'low' });
  a.object.updateMatrixWorld(true);
  const at = c => new THREE.Vector3().setFromMatrixPosition(c.mesh.matrixWorld);
  const [p, q] = a.parts.get('inner').copies.map(at);
  assert.ok(Math.abs(p.x + q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6 && p.x > .3, 'one on each ear, mirrored');
  a.setInput({ outfit: 'top-hat' }); a.update(.1);
  const shown = c => { let v = true; for (let o = c.mesh; o; o = o.parent) v &&= o.visible; return v; };
  assert.ok(a.parts.get('inner').copies.every(c => !shown(c)));
  a.dispose();
});

test('a part turns first about x, then y, then z, as shapes do', () => {
  const doc = { openavatar: '0.1', id: 'turn-test', name: 'Turn test', body: { shape: { type: 'sphere', radius: .9 } },
    parts: [{ id: 'p', shape: { type: 'box', size: [.1, .1, .1] }, attach: { position: [0, 0, 0], rotation: [90, 90, 0] } }] };
  const a = new OpenAvatar(doc, { quality: 'low' });
  // +y turned 90 about x goes to +z, then 90 about y goes to +x.
  const v = new THREE.Vector3(0, 1, 0).applyQuaternion(a.parts.get('p').copies[0].anchor.quaternion);
  assert.ok(v.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-6, v.toArray().join());
  a.dispose();
});

test('an armless avatar\'s lap props stand on its lowest point, parts included', () => {
  const doc = { openavatar: '0.1', id: 'pot-test', name: 'Pot test', body: { shape: { type: 'sphere', radius: .6 } },
    parts: [{ id: 'pot', shape: { type: 'cylinder', radius: .5, height: .6 }, attach: { position: [0, -.8, 0] } }] };
  const a = new OpenAvatar(doc, { quality: 'low' });
  assert.ok(Math.abs(a.props.anchors.lap[1] - (a.bounds.min.y + .03)) < 1e-6);
  a.dispose();
});

const worldOf = c => new THREE.Vector3().setFromMatrixPosition(c.mesh.matrixWorld);

test('a biped\'s head target is centered on the head and follows the proportions', () => {
  for (const proportions of [{}, { legs: 1, head: .2 }]) {
    const doc = { openavatar: '0.1', id: 'head-test', name: 'Head test', body: { rig: 'biped', proportions },
      parts: [{ id: 'dot', shape: { type: 'sphere', radius: .02 }, attach: { to: 'head', position: [0, 0, 0] } }] };
    const a = new OpenAvatar(doc, { quality: 'low' });
    a.object.updateMatrixWorld(true);
    const p = worldOf(a.parts.get('dot').copies[0]), c = new THREE.Vector3(...a.suit.head.center).applyMatrix4(a.bodyMesh.matrixWorld);
    assert.ok(p.distanceTo(c) < 1e-6, JSON.stringify(proportions));
    a.dispose();
  }
});

test('a part in a hand moves with the arm, and its mirror goes in the other hand', () => {
  const doc = { openavatar: '0.1', id: 'hand-test', name: 'Hand test', body: { rig: 'biped' },
    parts: [{ id: 'pom', mirror: 'x', shape: { type: 'sphere', radius: .06 }, attach: { to: 'left-hand', position: [.05, 0, .05] } }] };
  const a = new OpenAvatar(doc, { quality: 'low' });
  a.object.updateMatrixWorld(true);
  const [l, r] = a.parts.get('pom').copies.map(worldOf);
  assert.ok(l.x > .3 && Math.abs(l.x + r.x) < 1e-6 && Math.abs(l.y - r.y) < 1e-6 && Math.abs(l.z - r.z) < 1e-6, 'one in each hand, mirrored');
  a.play('cheer'); for (let i = 0; i < 20; i++) a.update(1 / 30);
  a.object.updateMatrixWorld(true);
  assert.ok(worldOf(a.parts.get('pom').copies[0]).y > l.y + .2, 'raised with the arm');
  a.dispose();
  // Without arms the hands stay where the arms would hang.
  const blob = { openavatar: '0.1', id: 'hand-blob', name: 'Hand blob', body: { shape: { type: 'sphere', radius: .8 } },
    parts: [{ id: 'wand', shape: { type: 'sphere', radius: .05 }, attach: { to: 'right-hand', position: [0, 0, 0] } }] };
  const b = new OpenAvatar(blob, { quality: 'low' });
  b.object.updateMatrixWorld(true);
  assert.ok(worldOf(b.parts.get('wand').copies[0]).x < -.5);
  b.dispose();
});

test('a part named like a target does not take its place', () => {
  const doc = { openavatar: '0.1', id: 'shadow-test', name: 'Shadow test', body: { rig: 'biped' },
    parts: [{ id: 'head', shape: { type: 'sphere', radius: .05 }, attach: { position: [0, -.9, 0] } },
      { id: 'dot', shape: { type: 'sphere', radius: .02 }, attach: { to: 'head', position: [0, 0, 0] } }] };
  const a = new OpenAvatar(doc, { quality: 'low' });
  a.object.updateMatrixWorld(true);
  assert.ok(worldOf(a.parts.get('dot').copies[0]).y > 0, 'still on the real head');
  a.dispose();
});

test('a glow keeps its base and brightens with its driver', () => {
  const doc = { openavatar: '0.1', id: 'glow-test', name: 'Glow test', materials: { main: { glow: { intensity: 2, base: .4, driver: 'speaking' } } },
    body: { shape: { type: 'sphere', radius: .8 } } };
  const a = new OpenAvatar(doc, { quality: 'low' });
  a.setInput({ state: 'idle' }); for (let i = 0; i < 30; i++) a.update(1 / 30);
  const m = a.bodyMesh.material;
  assert.ok(Math.abs(m.emissiveIntensity - .8) < 1e-3, `idle ${m.emissiveIntensity}`);
  a.setInput({ state: 'speaking' }); for (let i = 0; i < 90; i++) a.update(1 / 30);
  assert.ok(m.emissiveIntensity > 1.95, `speaking ${m.emissiveIntensity}`);
  a.dispose();
});

test('the document\'s own outfit is worn from the start', () => {
  const doc = examples.find(d => d.outfit);
  const a = new OpenAvatar(doc, { quality: 'low' });
  for (let i = 0; i < 10; i++) a.update(1 / 30);
  assert.equal(a.outfits.current, doc.outfit);
  assert.ok(a.outfits.built.get(doc.outfit).g.visible);
  a.dispose();
});

test('the face sits on a patch laid under it, and sewn and drawn eyes take the ink', () => {
  const doc = { openavatar: '0.1', id: 'screen-test', name: 'Screen test', materials: { main: { type: 'toon', color: '#7EDDB6' }, screen: { type: 'toon', color: '#1B2329' } },
    body: { shape: { type: 'box', size: [1.4, 1.1, .8], rounding: .2 } }, face: { type: 'drawn', color: '#FFFFFF' },
    parts: [{ id: 'screen', patch: { type: 'rect', size: [1, .8], rounding: .1 }, material: 'screen', attach: { at: [0, .05] } }] };
  const a = new OpenAvatar(doc, { quality: 'low' });
  for (const eye of a.face.eyes) {
    const bare = a.bodySdf(eye.frame.p.x, eye.frame.p.y, eye.frame.p.z);
    assert.ok(bare > .015, `eye ${eye.side} above the patch: ${bare}`);
  }
  assert.equal('#' + a.face.eyeMat.color.getHexString(), '#ffffff');
  assert.equal(a.face.eyeMat.toneMapped, false);
  a.dispose();
});

test('a part held in a hand is upright while the arm rests', () => {
  const doc = { openavatar: '0.1', id: 'staff-test', name: 'Staff test', body: { rig: 'biped' },
    parts: [{ id: 'staff', mirror: 'x', shape: { type: 'capsule', from: [0, -.3, 0], to: [0, .5, 0], radius: .02 }, attach: { to: 'right-hand', position: [0, 0, 0] } }] };
  const a = new OpenAvatar(doc, { quality: 'low' });
  a.object.updateMatrixWorld(true);
  for (const c of a.parts.get('staff').copies) {
    const up = new THREE.Vector3(0, 1, 0).transformDirection(c.mesh.matrixWorld);
    assert.ok(up.y > .999, `upright: ${up.toArray()}`);
  }
  a.dispose();
});

test('thinking drives with the state, not the thinking face', () => {
  const doc = { openavatar: '0.1', id: 'think-test', name: 'Think test', body: { shape: { type: 'sphere', radius: .8 } },
    parts: [{ id: 'bulb', shape: { type: 'sphere', radius: .1 }, attach: { direction: [0, 1, 0] }, animations: [{ type: 'appear', driver: 'thinking' }] }] };
  const a = new OpenAvatar(doc, { quality: 'low' });
  const shown = () => a.parts.get('bulb').copies[0].mesh.visible;
  a.setInput({ state: 'idle', expression: { id: 'thinking', strength: 1 } }); for (let i = 0; i < 30; i++) a.update(1 / 30);
  assert.equal(shown(), false, 'the face alone');
  a.setInput({ state: 'thinking', expression: null }); for (let i = 0; i < 30; i++) a.update(1 / 30);
  assert.equal(shown(), true, 'the state');
  a.dispose();
});

test('effects rise clear of a part floating where they would (SPEC 13.7)', () => {
  const ball = { openavatar: '0.1', id: 'moon-test', name: 'Moon test', body: { shape: { type: 'sphere', radius: .8 } } };
  const bare = new OpenAvatar(ball, { quality: 'low' }), { anchor, k } = bare.effects;
  // A moon behind the middle of the path the signs rise along, and one far to the other side.
  const at = [anchor.x + .1 * k, anchor.y + .22 * k, 0];
  const mooned = new OpenAvatar({ ...ball, parts: [{ id: 'moon', shape: { type: 'sphere', radius: .12 }, attach: { position: at } }] }, { quality: 'low' });
  const path = a => [0, .25, .5, .75, 1].map(s => [a.x + .2 * k * s, a.y + .45 * k * s]);
  for (const [x, y] of path(mooned.effects.anchor)) assert.ok(Math.hypot(x - at[0], y - at[1]) > .12 + .08 * k - 1e-3, `the signs cross the moon at ${x}, ${y}`);
  assert.ok(mooned.effects.anchor.x > anchor.x && mooned.effects.anchor.y > anchor.y, 'they move further out the same way');
  const far = new OpenAvatar({ ...ball, parts: [{ id: 'moon', shape: { type: 'sphere', radius: .12 }, attach: { position: [-1.1, .6, 0] } }] }, { quality: 'low' });
  assert.ok(far.effects.anchor.distanceTo(anchor) < 1e-9, 'a part elsewhere leaves them where they were');
  bare.dispose(); mooned.dispose(); far.dispose();
});

test('effects clear a big cap, and parts that appear later do not move the frame', () => {
  const stem = { openavatar: '0.1', id: 'stem-test', name: 'Stem test', body: { shape: { type: 'capsule', from: [0, -.5, 0], to: [0, .1, 0], radius: .45 } } };
  const capped = { ...stem, parts: [{ id: 'cap', role: 'detail', shape: { type: 'ellipsoid', radii: [.9, .45, .9] }, attach: { position: [0, .55, 0] } },
    { id: 'spark', shape: { type: 'sphere', radius: .1 }, attach: { position: [1.3, .2, 0] }, animations: [{ type: 'appear', driver: 'thinking' }] }] };
  const bare = new OpenAvatar(stem, { quality: 'low' }), a = new OpenAvatar(capped, { quality: 'low' });
  assert.ok(a.effects.top.y > .95, `above the cap: ${a.effects.top.y}`);
  assert.ok(a.effects.anchor.x > .9, `beside the cap: ${a.effects.anchor.x}`);
  assert.ok(a.bounds.max.x < 1, `the hidden spark is not framed: ${a.bounds.max.x}`);
  assert.ok(Math.abs(bare.effects.top.y - .55) < .02, `a bare stem keeps its own top: ${bare.effects.top.y}`);
  a.dispose(); bare.dispose();
});

// The physical material's fragment shader after the material's onBeforeCompile.
const compiled = m => { const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader }; m.onBeforeCompile(sh); return sh.fragmentShader; };

test('a sheen the document doesn\'t name follows the pattern under it, a named one is kept', () => {
  const pattern = { type: 'stripes', colors: ['#1E1A17'] };
  for (const [type, k] of [['felt', .45], ['fur', .45], ['velvet', .6]]) {
    const { material, shells } = makeMaterial({ type, color: '#F7C531', pattern });
    assert.equal(material.userData.oa.sheenK, k, type);
    assert.match(compiled(material), new RegExp(`material\\.sheenColor=mix\\(oaC,vec3\\(1\\.\\),${k.toFixed(3).replace('.', '\\.')}\\)`), type);
    // The fuzz on a dark stripe takes the stripe's sheen too.
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1), material);
    for (const s of addShells(mesh, material, shells, { pattern })) assert.match(compiled(s), /material\.sheenColor=mix\(oaC/, `${type} shell`);
  }
  // A named sheen is the document's choice, on velvet too; plastic has none to follow.
  const named = makeMaterial({ type: 'velvet', color: '#F7C531', sheen: '#FF0000', pattern }).material;
  assert.equal(named.userData.oa.sheenK, null);
  assert.equal('#' + named.sheenColor.getHexString(), '#ff0000');
  assert.doesNotMatch(compiled(named), /sheenColor=mix/);
  assert.doesNotMatch(compiled(makeMaterial({ type: 'plastic', color: '#F7C531', pattern }).material), /sheenColor=mix/);
});

test('on felt a face\'s ink strokes sit above the fuzz, its beads stay in it', () => {
  const doc = { openavatar: '0.1', id: 'ink-test', name: 'Ink test', materials: { main: { type: 'felt', color: '#F7C531' } },
    body: { shape: { type: 'sphere', radius: .9 } }, face: { mouth: { shape: 'smile' }, brows: {} } };
  const a = new OpenAvatar(doc, { quality: 'low' });
  const above = p => a.bodySdf(p.x, p.y, p.z);
  // Felt's fuzz reaches .034 out; most of it is below .032.
  assert.ok(Math.abs(above(a.face.mouth.frame.p) - .032) < .003, `mouth at ${above(a.face.mouth.frame.p)}`);
  for (const brow of a.face.brows) assert.ok(above(brow.a.position) > .029, `brow at ${above(brow.a.position)}`);
  for (const eye of a.face.eyes) {
    assert.ok(Math.abs(above(eye.frame.p) - .018) < .003, `bead at ${above(eye.frame.p)}`);
    const arc = a.face.eyeMesh(eye, 'arc');
    assert.ok(Math.abs(arc.position.z - .014) < 1e-9, `arc lifted by ${arc.position.z}`);
  }
  a.dispose();
  // Other materials keep one lift for the whole face.
  const clay = new OpenAvatar({ ...doc, materials: { main: { type: 'clay', color: '#F7C531' } } }, { quality: 'low' });
  assert.equal(clay.face.eyeMesh(clay.face.eyes[0], 'arc').position.z, 0);
  clay.dispose();
});

test('bipeds that differ only in face or color share one body mesh, and only the bodies used last are kept', () => {
  const doc = (proportions, face, color) => ({ openavatar: '0.1', id: 'body-test', name: 'Body test', body: { rig: 'biped', proportions, material: { type: 'fur', color } }, face });
  const a = new OpenAvatar(doc({ head: .5 }, { type: 'bead' }, '#E2A65E'), { quality: 'low' });
  const b = new OpenAvatar(doc({ head: .5 }, { type: 'sewn', mouth: { shape: 'smile' } }, '#8CCB9B'), { quality: 'low' });
  assert.equal(a.bodyMesh.geometry, b.bodyMesh.geometry);
  let freed = false;
  b.bodyMesh.geometry.addEventListener('dispose', () => { freed = true; });
  a.dispose();
  assert.equal(freed, false, 'disposing one avatar leaves the shared body to the other');
  const c = new OpenAvatar(doc({ head: .9 }, { type: 'bead' }, '#E2A65E'), { quality: 'low' });
  assert.notEqual(c.bodyMesh.geometry, b.bodyMesh.geometry, 'other proportions are another body');
  assert.ok(c.bodyMesh.geometry.boundingBox.max.y > b.bodyMesh.geometry.boundingBox.max.y, 'the bigger head is meshed');
  // Eight other bodies later, the first is meshed again.
  for (let i = 0; i < 8; i++) new OpenAvatar(doc({ head: i / 10 + .01 }, { type: 'bead' }, '#E2A65E'), { quality: 'low' }).dispose();
  const d = new OpenAvatar(doc({ head: .5 }, { type: 'bead' }, '#E2A65E'), { quality: 'low' });
  assert.notEqual(d.bodyMesh.geometry, b.bodyMesh.geometry);
  for (const x of [b, c, d]) x.dispose();
});

test('a front point or a ray that misses lands by one rule, unturned, and is reported once', () => {
  // A ring body: the line at x = 1.5 misses it, and the eyes' lines and the ray forward from its center go through
  // the hole.
  const doc = {
    openavatar: '0.1', id: 'org.openavatar.test.miss', name: 'Ring', materials: { main: { type: 'felt', color: '#88AACC' } },
    body: { shape: { type: 'torus', radius: .6, thickness: .25, rotation: [90, 0, 0], position: [0, .3, 0] } },
    face: { type: 'bead' },
    parts: [
      { id: 'side', shape: { type: 'sphere', radius: .1 }, attach: { at: [1.5, .2] }, mirror: 'x' },
      { id: 'up', shape: { type: 'sphere', radius: .1 }, attach: { direction: [0, 0, 1] } },
      { id: 'on', shape: { type: 'sphere', radius: .1 }, attach: { at: [.6, .3] } },
    ],
  };
  const a = new OpenAvatar(doc, { quality: 'low' });
  const anchor = id => a.parts.get(id).copies.map(c => c.anchor);
  const [side, mirrored] = anchor('side');
  assert.deepEqual(side.position.toArray(), [1.5, .2, 0]); assert.deepEqual(mirrored.position.toArray(), [-1.5, .2, 0]);
  assert.ok(side.quaternion.equals(new THREE.Quaternion()), 'unturned');
  assert.deepEqual(anchor('up')[0].position.toArray().map(v => Math.round(v * 1e3) / 1e3), a.targets.body.center.map(v => Math.round(v * 1e3) / 1e3), 'at the center');
  assert.ok(Math.abs(a.targets.body.center[1] - .3) < .03, 'which is not the origin');
  assert.ok(anchor('on')[0].position.z > .2, 'a point that meets the ring is on its front');
  assert.deepEqual(a.misses.map(m => [m.path, m.target]), [['parts[0].attach.at', 'the body'], ['parts[1].attach.direction', 'the body'], ['face.eyes', 'the body']]);
  a.dispose();
});

test('the body\'s center is halfway between its lowest and highest points, and it squashes about its lowest', () => {
  // The top half of a ball: its box, worked out from the subtract's first child, is the whole ball.
  const doc = {
    openavatar: '0.1', id: 'org.openavatar.test.center', name: 'Dome', materials: { main: { type: 'felt', color: '#88AACC' } },
    body: { shape: { type: 'subtract', children: [{ type: 'sphere', radius: .9 }, { type: 'box', size: [2, 1, 2], position: [0, -.5, 0] }] } },
    parts: [{ id: 'knob', shape: { type: 'sphere', radius: .1 }, attach: { direction: [1, 0, 0] } }],
  };
  const a = new OpenAvatar(doc, { quality: 'low' });
  assert.ok(Math.abs(a.targets.body.center[1] - .45) < .03, `center ${a.targets.body.center[1]}`);
  assert.ok(Math.abs(a.parts.get('knob').copies[0].anchor.position.y - .45) < .03, 'a direction leaves from it');
  assert.ok(Math.abs(a.pivotY) < .03, `squashes about ${a.pivotY}`);
  a.dispose();
  const floating = new OpenAvatar({ ...doc, body: { ...doc.body, anchor: 'float' } }, { quality: 'low' });
  assert.ok(Math.abs(floating.pivotY - .45) < .03, 'a floating body about its center');
  floating.dispose();
});

test('a patch is bent onto the surface, each copy onto its own, and the face sits on the bent patch', async () => {
  const { shapeGeometry } = await import('../src/geometry.js');
  // A ball with a bump on its left: the mirrored spots land on surfaces that differ.
  const doc = {
    openavatar: '0.1', id: 'org.openavatar.test.patch', name: 'Patches', materials: { main: { type: 'felt', color: '#4DB6AC' }, belly: { type: 'felt', color: '#E0F2F1' } },
    body: { shape: { type: 'union', smooth: .3, children: [{ type: 'ellipsoid', radii: [.88, .9, .82] }, { type: 'sphere', radius: .35, position: [.55, .35, .35] }] } },
    face: { type: 'bead', eyes: { height: -.3, spacing: .1 } },
    parts: [
      { id: 'belly', material: 'belly', patch: { type: 'ellipse', radii: [.38, .3] }, attach: { at: [0, -.38] } },
      { id: 'spots', material: 'belly', mirror: 'x', patch: { type: 'circle', radius: .14 }, attach: { at: [.5, .36] } },
      { id: 'tag', material: 'belly', patch: { type: 'circle', radius: .1 }, attach: { position: [0, .5, .9] } },
    ],
  };
  const a = new OpenAvatar(doc, { quality: 'low' });
  a.object.updateMatrixWorld(true);
  const toBody = a.bodyMesh.matrixWorld.clone().invert(), F = a.bodySdf, rest = a.restingSdf(e => e.part.patch);
  const flat = patch => shapeGeometry({ type: 'extrusion', depth: .02, rounding: .008, puff: .4, outline: patch }, { quality: 'low', limit: 5 }).geometry;
  for (const id of ['belly', 'spots']) {
    const { part, copies } = a.parts.get(id), plain = flat(part.patch).attributes.position;
    for (const c of copies) {
      // The patch's middle follows the surface at its origin's height (A.9): the felt's fuzz is cleared by about
      // 0.026, and the rim is no farther out than the middle.
      const m = toBody.clone().multiply(c.mesh.matrixWorld), pos = c.mesh.geometry.attributes.position, v = new THREE.Vector3();
      const L = F(...c.anchor.position.toArray());
      assert.ok(Math.abs(L - .026) < .004, `${id} sits ${L} off the surface`);
      let worst = 0;
      for (let i = 0; i < pos.count; i += 3) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i) - plain.getZ(i)).applyMatrix4(m);
        worst = Math.max(worst, Math.abs(F(v.x, v.y, v.z) - L));
      }
      assert.ok(worst < .003, `${id}${c.mirrored ? ' (mirrored)' : ''}: the middle strays ${worst} from the surface's level`);
      // The face's surface is this copy's bent patch: zero on its mesh.
      let off = 0;
      for (let i = 0; i < pos.count; i += 3) { v.fromBufferAttribute(pos, i).applyMatrix4(m); off = Math.max(off, Math.abs(rest(v.x, v.y, v.z))); }
      assert.ok(off < .004, `${id}${c.mirrored ? ' (mirrored)' : ''}: the resting surface is ${off} off its mesh`);
    }
  }
  const [left, right] = a.parts.get('spots').copies.map(c => c.anchor.position);
  assert.ok(Math.abs(left.z - right.z) > .02, 'the spots landed on surfaces that differ');
  // The eyes on the belly sit on it, not under it.
  for (const eye of a.face.eyes) { const p = eye.anchor.position; assert.ok(rest(p.x, p.y, p.z) > .01, `an eye is ${rest(p.x, p.y, p.z)} off the belly`); }
  // A patch placed by position stays flat.
  assert.equal(a.parts.get('tag').copies[0].mesh.geometry, flat(doc.parts[2].patch));
  a.dispose();
});

test('a motion played once gives the channel back: after the done motion, the avatar types again', () => {
  const doc = JSON.parse(fs.readFileSync(path.join(dir, 'matcha.openavatar'), 'utf8'));
  const a = new OpenAvatar(doc, { quality: 'low' });
  const step = s => { for (let i = 0; i < s * 30; i++) a.update(1 / 30); };
  a.setInput({ userActivity: 'coding' }); step(1);
  assert.equal(a.behavior.motion, 'typing');
  a.setInput({ activity: 'done' }); step(.1);
  const done = a.behavior.motion;
  assert.deepEqual([a.behavior.layers.motion, a.behavior.motionLoops], ['activity', false], `${done} plays once`);
  step(3);
  assert.deepEqual([a.behavior.motion, a.behavior.layers.motion], ['typing', 'userActivity'], 'typing again once the done motion ended');
  assert.ok(a.motion.loop?.id === 'typing' && a.motion.loop.target > 0, 'and the typing loop plays');
  // A new situation on that layer plays its motion again.
  a.setInput({ activity: 'error' }); step(.1);
  assert.equal(a.behavior.layers.motion, 'activity');
  a.setInput({ activity: 'done' }); step(.1);
  assert.deepEqual([a.behavior.motion, a.behavior.layers.motion], [done, 'activity'], 'done again plays again');
  a.dispose();
});

test('part animations follow the curves of SPEC 10.1', () => {
  const part = (id, a, extra = {}) => ({ id, material: 'main', shape: { type: 'sphere', radius: .08 }, attach: { position: [0, 0, .9] }, animations: [a], ...extra });
  const doc = {
    openavatar: '0.1', id: 'org.openavatar.test.curves', name: 'Curves', materials: { main: { type: 'plastic', color: '#88AACC' } },
    body: { shape: { type: 'sphere', radius: .8 } }, face: { type: 'none' },
    parts: [
      part('sway', { type: 'sway', amount: 20, speed: .7, phase: .1 }),
      part('bob', { type: 'bob', axis: 'x', amount: .1, speed: 1.3 }),
      part('pulse', { type: 'pulse', amount: .3, speed: .9, phase: .4 }),
      part('wiggle', { type: 'wiggle', amount: 12, phase: .2 }),
      part('flap', { type: 'flap', amount: 30, speed: .8 }),
      part('appear', { type: 'appear', driver: 'thinking' }),
      part('drift', { type: 'drift', amount: -.5, speed: .6, phase: .3, driver: 'thinking' }),
      part('glow', { type: 'glow', amount: 2, driver: 'thinking' }),
      part('spin', { type: 'spin', speed: .37, driver: 'thinking' }),
    ],
  };
  const a = new OpenAvatar(doc, { quality: 'low' });
  const step = s => { for (let i = 0; i < Math.round(s * 30); i++) a.update(1 / 30); };
  a.setInput({ state: 'thinking' }); step(.2);
  const w = a.drive('thinking'), t = a.time, u = (speed, phase = 0) => speed * t + phase;
  assert.ok(w > .2 && w < .9, `mid-fade: thinking weight ${w}`);
  const copy = id => a.parts.get(id).copies[0];
  const angle = (id, axis) => { const q = copy(id).pivot.quaternion, s = Math.hypot(q.x, q.y, q.z); return 2 * Math.atan2(s, q.w) * Math.sign(q[axis] || 1) * 180 / Math.PI; };
  const near = (got, want, what) => assert.ok(Math.abs(got - want) < 1e-6, `${what}: ${got}, SPEC 10.1 ${want}`);
  near(angle('sway', 'z'), 20 * Math.sin(2 * Math.PI * u(.7, .1)), 'sway');
  near(copy('bob').pivot.position.x, .1 * Math.sin(2 * Math.PI * u(1.3)), 'bob');
  near(copy('pulse').pivot.scale.x, 1 + .3 * (1 + Math.sin(2 * Math.PI * u(.9, .4))) / 2, 'pulse');
  near(angle('wiggle', 'z'), 12 * (.6 * Math.sin(2 * Math.PI * (1.2 * 3 * t + .2)) + .4 * Math.sin(2 * Math.PI * (2 * 3 * t + .4))), 'wiggle at its default speed of 3');
  near(angle('flap', 'z'), 30 * Math.abs(Math.sin(2 * Math.PI * u(.8))), 'flap');
  near(copy('appear').pivot.scale.x, 1 + 2.4 * (w - 1) ** 3 + 1.4 * (w - 1) ** 2, 'appear');
  const k = u(.6, .3) % 1;
  near(copy('drift').pivot.position.y, -.5 * k, 'drift moves');
  near(copy('drift').pivot.scale.x, w * Math.sqrt(Math.sin(Math.PI * k)), 'drift shrinks with the weight');
  near(copy('glow').mesh.material.emissiveIntensity, 2 * w, 'glow');
  // When the driver lets go, the drift hides and the spin, past a quarter turn by then, settles back to rest on a
  // whole turn.
  step(1.6);
  const spun = a.spins.get('spin:spin:0');
  assert.ok(spun > Math.PI / 2 && spun < 3 * Math.PI / 2, `spun ${spun} rad`);
  a.setInput({ state: 'idle' }); step(4);
  assert.equal(copy('drift').mesh.visible, false, 'a drift at weight 0 is hidden');
  const rest = ((angle('spin', 'y') % 360) + 360) % 360;
  assert.ok(Math.min(rest, 360 - rest) < .5, `the spin rests ${rest} degrees from where it started`);
  a.dispose();
});

test('cheeks without a show flush with happy and clear without it (SPEC 8.4)', () => {
  const doc = { openavatar: '0.1', id: 'cheek-test', name: 'Cheek test', body: { shape: { type: 'sphere', radius: .9 } }, face: { cheeks: { color: '#FF9DB2' } } };
  const a = new OpenAvatar(doc, { quality: 'low' }), shown = () => a.face.cheeks.every(c => c.visible);
  const run = s => { for (let i = 0; i < s * 30; i++) a.update(1 / 30); };
  a.setInput({ state: 'idle', expression: null }); run(2);
  assert.equal(shown(), false, 'calm cheeks stay clear');
  a.setInput({ expression: { id: 'happy', strength: 1 } }); run(2);
  assert.equal(shown(), true, 'happy cheeks flush');
  a.dispose();
});

test('a spin stops a full turn round instead of unwinding (D.4)', () => {
  const a = new OpenAvatar({ openavatar: '0.1', id: 'spin-test', name: 'Spin test', body: { shape: { type: 'sphere', radius: .9 } } }, { quality: 'low' });
  a.update(0); a.play('spin');
  const wrap = d => d - 2 * Math.PI * Math.round(d / (2 * Math.PI));
  let ry = a.motion.pose.ry, forward = 0, back = 0;
  for (let i = 0; i < 120; i++) {
    a.update(1 / 60);
    const d = wrap(a.motion.pose.ry - ry); ry = a.motion.pose.ry;
    if (d > 0) forward += d; else back -= d;
  }
  assert.ok(Math.abs(forward - 2 * Math.PI) < .1, `turned ${forward}`);
  assert.ok(back < .05, `turned back ${back}`);
  assert.ok(Math.abs(a.motion.pose.ry) < .05, 'and rests facing front');
  a.dispose();
});

test('a part\'s animations compose as 10.1\'s formula says: turns in order about its own axes, moves unturned', () => {
  const anims = [{ type: 'bob', axis: 'x', amount: .1, speed: .3 }, { type: 'sway', axis: 'z', amount: 30, speed: .2 }, { type: 'sway', axis: 'x', amount: 20, speed: .2, phase: .25 }];
  const doc = { openavatar: '0.1', id: 'anim-test', name: 'Anim test', body: { shape: { type: 'sphere', radius: .8 } },
    parts: [{ id: 'stick', shape: { type: 'capsule', from: [0, 0, 0], to: [0, .5, 0], radius: .04 }, pivot: [0, .2, 0], attach: { position: [0, 1, 0], rotation: [0, 0, 40] }, animations: anims }] };
  const a = new OpenAvatar(doc, { quality: 'low' });
  for (let i = 0; i < 40; i++) a.update(1 / 30);
  const t = a.time, c = new THREE.Vector3(0, .2, 0), copy = a.parts.get('stick').copies[0];
  const sin = an => Math.sin(2 * Math.PI * (an.speed * t + (an.phase || 0)));
  const m = new THREE.Vector3(.1 * sin(anims[0]), 0, 0);
  const R = new THREE.Matrix4().makeRotationZ(30 * sin(anims[1]) * Math.PI / 180).multiply(new THREE.Matrix4().makeRotationX(20 * sin(anims[2]) * Math.PI / 180));
  copy.anchor.updateMatrix(); copy.anchor.updateMatrixWorld(true);
  const toAnchorParent = new THREE.Matrix4().copy(copy.anchor.parent.matrixWorld).invert().multiply(copy.mesh.matrixWorld);
  for (const q of [[0, 0, 0], [0, .5, 0], [.03, .3, .02]].map(v => new THREE.Vector3(...v))) {
    const want = q.clone().sub(c).applyMatrix4(R).add(c).add(m).applyMatrix4(copy.anchor.matrix);
    const got = q.clone().applyMatrix4(toAnchorParent);
    assert.ok(got.distanceTo(want) < 1e-9, `${q.toArray()}: ${got.toArray()} vs ${want.toArray()}`);
  }
  a.dispose();
});

test('a direction of length 0 misses, and a glow animation is clamped to 4 in the base color (A.9, 10.1)', () => {
  const doc = { openavatar: '0.1', id: 'miss-test', name: 'Miss test', body: { shape: { type: 'sphere', radius: .8, position: [0, .3, 0] } },
    materials: { main: { color: '#F7C531' }, bulb: { type: 'plastic' } },
    parts: [{ id: 'p', shape: { type: 'sphere', radius: .1 }, attach: { direction: [0, 0, 0] } },
      { id: 'bulb', shape: { type: 'sphere', radius: .1 }, material: 'bulb', attach: { position: [0, 1.4, 0] }, animations: [{ type: 'glow', amount: 9 }] }] };
  const a = new OpenAvatar(doc, { quality: 'low' });
  a.update(1 / 30);
  const anchor = a.parts.get('p').copies[0].anchor;
  assert.ok(anchor.position.distanceTo(new THREE.Vector3(0, .3, 0)) < .01, `at the body's center: ${anchor.position.toArray()}`);
  assert.deepEqual(a.misses.map(m => m.path), ['parts[0].attach.direction']);
  const m = a.parts.get('bulb').made.material;
  assert.equal(m.emissiveIntensity, 4);
  assert.ok(m.emissive.equals(new THREE.Color('#9AA4B2')), 'the default base color');
  a.dispose();
});

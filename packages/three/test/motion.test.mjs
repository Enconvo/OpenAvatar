// SPEC Appendix D, read from SPEC.md, against the reference renderer's whole-body motion: every motion's pose and
// length, the pose at rest and in each situation, how motions play, and how the pose moves the avatar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { VOCABULARY } from '@openavatar/core';
import { OpenAvatar } from '../src/index.js';
import { MOTION_POSES, situationPose } from '../src/motion.js';

const spec = fs.readFileSync(new URL('../../../spec/SPEC.md', import.meta.url), 'utf8');
const D = spec.slice(spec.indexOf('## Appendix D.'), spec.indexOf('## Change log'));
const sub = (from, to) => D.slice(D.indexOf(from), to ? D.indexOf(to) : undefined);

// D.1's functions, written again from the spec.
const clamp = p => Math.min(1, Math.max(0, p));
const bell = p => Math.sin(Math.PI * clamp(p));
const osc = (p, n) => Math.sin(2 * Math.PI * n * p);
const smooth = p => { const c = clamp(p); return c * c * (3 - 2 * c); };
const hold = p => smooth(p / .2) * (1 - smooth((p - .8) / .2));
const jump = (p, h) => {
  const a = clamp((p - .2) / .6), e = p < .2 ? .1 * bell(p / .2) : p > .8 ? .1 * bell((p - .8) / .2) : 0;
  return { y: h * Math.sin(Math.PI * a), sq: e - .06 * bell(a) };
};
const HELPERS = { clamp, bell, osc, smooth, hold, jump, abs: Math.abs, max: Math.max, min: Math.min, sin: Math.sin };
// A formula of the spec as a function of the named variables.
const js = text => text.replace(/·/g, '*').replace(/−/g, '-').replace(/(\d)π/g, '$1*Math.PI').replace(/π/g, 'Math.PI');
const formula = (text, names) => new Function(...Object.keys(HELPERS), ...names, `return ${js(text)};`).bind(null, ...Object.values(HELPERS));
const CHANNELS = ['x', 'y', 'rx', 'ry', 'rz', 'sq', 'la', 'ra', 'lf', 'rf', 'gx', 'gy', 'mouth'];

// D.3's table: { id: { L, pose(p) } }.
function motionTable() {
  const rows = {};
  for (const line of sub('| Motion | `L` (s) | Pose |', '### D.4').split('\n').slice(2)) {
    if (!line.startsWith('|')) break;
    const [id, L, pose] = line.split('|').slice(1, -1).map(c => c.trim());
    const terms = [...pose.matchAll(/`([^`]+)`/g)].map(m => m[1]);
    const parts = terms.map(term => {
      const set = term.match(/^([a-z, ]+?) = (.+)$/);
      if (!set) { const f = formula(term, ['p']); return p => f(p); }
      const keys = set[1].split(',').map(k => k.trim()), f = formula(set[2], ['p']);
      return p => Object.fromEntries(keys.map(k => [k, f(p)]));
    });
    rows[id.replace(/`/g, '')] = { L: Number(L), pose: p => Object.assign({}, ...parts.map(f => f(p))) };
  }
  return rows;
}

test('every motion of 13.5 has D.3\'s length and pose', () => {
  const table = motionTable();
  assert.deepEqual(Object.keys(table), VOCABULARY.motions.map(m => m.id), 'D.3 lists the motions of 13.5 in order');
  assert.deepEqual(Object.keys(MOTION_POSES).sort(), Object.keys(table).sort());
  for (const [id, row] of Object.entries(table)) {
    assert.equal(MOTION_POSES[id].dur, row.L, `${id} length`);
    for (let i = 0; i <= 200; i++) {
      const p = i / 200, want = row.pose(p), got = MOTION_POSES[id].f(p);
      for (const k of CHANNELS) assert.ok(Math.abs((want[k] ?? 0) - (got[k] ?? 0)) < 1e-12, `${id} ${k} at ${p}: D.3 ${want[k] ?? 0}, renderer ${got[k] ?? 0}`);
      for (const k of Object.keys(got)) assert.ok(CHANNELS.includes(k), `${id} sets ${k}, which D.1 doesn't have`);
    }
  }
});

test('the pose at rest and in each situation is D.2\'s', () => {
  const block = sub('### D.2', '### D.3').match(/```\n([\s\S]*?)```/)[1].split('\n');
  const defs = Object.fromEntries(block[0].trim().split(/\s{2,}/).map(d => d.split(' = ')));
  const lines = Object.fromEntries(block.filter(l => /^[a-z]+:/.test(l)).map(l => [l.split(':')[0], l.slice(l.indexOf(':') + 1).split(';').map(x => x.trim())]));
  assert.deepEqual(Object.keys(lines), ['always', 'floating', 'listening', 'thinking', 'speaking', 'sleeping']);
  const names = ['t', 'φ', 'v', 'S', 'B', 'wl', 'wt', 'ws', 'voice', 'mic'];
  const terms = Object.fromEntries(Object.entries(lines).map(([k, list]) => [k, list.map(term => {
    const [, ch, op, expr] = term.match(/^(\w+)\s+([+−-])= (.+)$/), f = formula(expr, names);
    return { ch, sign: op === '+' ? 1 : -1, f };
  })]));
  const r = (() => { let s = 3; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < 300; i++) {
    const temperament = { energy: r(), sway: r(), bounce: r() }, float = r() < .5, phase = r() * 6.28, t = r() * 100;
    const w = { listening: r(), thinking: r(), sleeping: r(), voice: r(), mic: r() };
    const env = { energy: temperament.energy, sway: temperament.sway, bounce: temperament.bounce };
    const vars = { t, φ: phase, v: formula(defs.v, Object.keys(env))(...Object.values(env)), S: formula(defs.S, Object.keys(env))(...Object.values(env)),
      B: formula(defs.B, Object.keys(env))(...Object.values(env)), wl: w.listening, wt: w.thinking, ws: w.sleeping, voice: w.voice, mic: w.mic };
    const want = {};
    for (const [k, list] of Object.entries(terms)) {
      if (k === 'floating' && !float) continue;
      for (const { ch, sign, f } of list) want[ch] = (want[ch] ?? 0) + sign * f(...names.map(n => vars[n]));
    }
    const got = situationPose(t, { phase, temperament, float, w });
    for (const k of CHANNELS) assert.ok(Math.abs((want[k] ?? 0) - (got[k] ?? 0)) < 1e-12, `${k}: D.2 ${want[k] ?? 0}, renderer ${got[k] ?? 0}`);
  }
});

const doc = (extra = {}) => ({ openavatar: '0.1', id: 'org.openavatar.test.motion', name: 'Motion', materials: { main: { type: 'felt', color: '#888888' } }, body: { rig: 'biped' }, ...extra });

test('the phase comes from the id as D.2 says', () => {
  for (const id of ['org.openavatar.test.motion', 'com.example.a', 'x']) {
    let h = 7n; for (const c of id) h = (31n * h + BigInt(c.charCodeAt(0))) % (1n << 32n);
    const a = new OpenAvatar(doc({ id }), { quality: 'low' });
    assert.ok(Math.abs(a.phase - 2 * Math.PI * Number(h % 1000n) / 1000) < 1e-12, id);
    a.dispose();
  }
});

test('motions play as D.3 says', () => {
  const run = (a, s) => { for (let i = 0; i < Math.round(s * 60); i++) a.update(1 / 60); };
  // The host's play: once at its own pace, or until stopped.
  const a = new OpenAvatar(doc({ behavior: { temperament: { energy: 1 } } }), { quality: 'low' });
  assert.equal(a.play('nod'), .9);
  run(a, .85); assert.equal(a.motion.commanded, 'nod', 'energy does not speed up a motion the host plays');
  run(a, .1); assert.equal(a.motion.commanded, null);
  a.play('nod', { loop: true }); run(a, 3); assert.equal(a.motion.commanded, 'nod', 'a looped play goes on');
  a.stop(); assert.equal(a.motion.commanded, null);
  a.dispose();
  // A looping idle motion eases toward 0.8 and lets go after one cycle; the default idle motions are D.3's.
  const b = new OpenAvatar(doc({ behavior: { idleMotions: ['look-around'] } }), { quality: 'low' });
  run(b, 1); b.motion.idleAt = 0; run(b, 1 / 60);
  assert.equal(b.motion.loop?.id, 'look-around'); assert.equal(b.motion.loop.target, .8);
  run(b, 3 / (.7 + .6 * .5) - .1); assert.equal(b.motion.loop.target, .8);
  run(b, .2); assert.equal(b.motion.loop.target, 0, 'it lets go after one cycle');
  b.dispose();
  const c = new OpenAvatar(doc(), { quality: 'low' }), seen = new Set(), random = Math.random;
  run(c, 1);
  try {
    for (const r of [0, .4, .9]) {
      Math.random = () => r; c.motion.oneShot = null; c.motion.loop = null; c.motion.idleAt = 0; run(c, 1 / 60);
      seen.add(c.motion.oneShot?.id ?? c.motion.loop?.id);
      if (c.motion.oneShot) assert.equal(c.motion.oneShot.k, .8, 'an idle motion plays at 0.8');
    }
  } finally { Math.random = random; }
  assert.deepEqual([...seen], ['nod', 'wiggle', 'look-around']);
  // While idle motions can't play, the next waits at least 4 seconds.
  c.motion.oneShot = null; c.motion.loop = null; c.motion.idleAt = 0; c.setInput({ activity: 'searching' }); run(c, 1 / 60);
  assert.ok(Math.abs(c.motion.idleAt - (c.time + 4)) < 1e-9, `${c.motion.idleAt} vs ${c.time + 4}`);
  c.dispose();
});

test('the pose moves the avatar and its arms as D.4 says', () => {
  for (const anchor of ['ground', 'float']) {
    const a = new OpenAvatar(doc({ body: { rig: 'biped', anchor } }), { quality: 'low' });
    const pose = { x: .05, y: -.03, rx: .3, ry: -.5, rz: .2, sq: .4, la: .5, ra: 2.5, lf: .3, rf: -.2, gx: 0, gy: 0, mouth: 0 };
    a.motion.apply(pose); a.root.updateMatrixWorld(true);
    const { lo, hi } = a.bodyExtent, yp = anchor === 'float' ? (lo[1] + hi[1]) / 2 : lo[1];
    const P = new THREE.Vector3(0, yp, 0), s = Math.min(.3, Math.max(-.25, pose.sq));
    const R = new THREE.Matrix4().makeRotationY(pose.ry).multiply(new THREE.Matrix4().makeRotationX(pose.rx)).multiply(new THREE.Matrix4().makeRotationZ(pose.rz));
    for (const q of [[0, 0, 0], [.3, .5, .2], [-.4, -.6, .1]].map(v => new THREE.Vector3(...v))) {
      const want = q.clone().sub(P).multiply(new THREE.Vector3(1 + .5 * s, 1 - s, 1 + .5 * s)).applyMatrix4(R).add(P).add(new THREE.Vector3(pose.x, pose.y, 0));
      const got = a.root.worldToLocal(a.bodyMesh.localToWorld(q.clone()));
      assert.ok(got.distanceTo(want) < 1e-9, `${anchor} ${q.toArray()}: ${got.toArray()} vs ${want.toArray()}`);
    }
    for (const arm of a.arms) {
      const left = arm.side > 0, raise = left ? pose.la : pose.ra, f = left ? pose.lf : pose.rf;
      const want = new THREE.Matrix4().makeRotationX(-f).multiply(new THREE.Matrix4().makeRotationZ(arm.side * Math.max(-.4, Math.min(2.4, .42 + raise))));
      const got = new THREE.Matrix4().makeRotationFromQuaternion(arm.group.quaternion);
      want.elements.forEach((v, i) => assert.ok(Math.abs(v - got.elements[i]) < 1e-12, `${left ? 'left' : 'right'} arm`));
    }
    a.dispose();
  }
});

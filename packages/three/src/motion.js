// Whole-body movement (SPEC 11, 13.5, Appendix D): breathing and the
// temperament at rest, the lean of each conversation state, the motion the
// layers resolve to, idle motions now and then, a command from the host, gaze
// and the arms. Each motion is a pose over its progress p (0 to 1); the
// avatar's groups take the sum of the poses every frame.
import { resolveMotion, motionLoops, hasArms, VOCABULARY } from 'openavatar';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const bell = p => Math.sin(Math.PI * clamp(p));
const osc = (p, n) => Math.sin(Math.PI * 2 * n * p);
const smooth = p => { p = clamp(p); return p * p * (3 - 2 * p); };
// Up over the first fifth, held, down over the last fifth.
const hold = p => smooth(p / .2) * (1 - smooth((p - .8) / .2));
// A jump: up and down with a squash before take-off and on landing.
const jump = (p, h) => {
  const air = clamp((p - .2) / .6);
  return { y: h * Math.sin(Math.PI * air), sq: .1 * (bell(p / .2) * (p < .2) + bell((p - .8) / .2) * (p > .8)) - .06 * bell(air) };
};

// Each motion: its length in seconds and its pose at progress p. Poses use
// y (lift), x, rx (lean toward the viewer), ry (turn), rz (tilt), sq
// (squash, negative stretches) and, with arms, la and ra (raise, radians added
// to the rest angle), lf and rf (swing toward the viewer). l is the avatar's
// left arm, at +x. gx and gy move the gaze; mouth opens the mouth.
const MOTIONS = {
  nod: { dur: .9, f: p => ({ rx: .16 * Math.max(0, osc(p, 2)) * bell(p) }) },
  hop: { dur: .75, f: p => jump(p, .14) },
  spin: { dur: 1.1, f: p => ({ ry: Math.PI * 2 * smooth(p), y: .05 * bell(p) }) },
  wiggle: { dur: 1, f: p => ({ rz: .14 * osc(p, 3) * bell(p), x: .02 * osc(p, 3) * bell(p) }) },
  shake: { dur: 1, f: p => ({ ry: .32 * osc(p, 3) * bell(p) }) },
  bow: { dur: 1.6, f: p => ({ rx: .45 * smooth(p / .35) * (1 - smooth((p - .65) / .35)) }) },
  jump: { dur: 1, f: p => ({ ...jump(p, .36), la: 1.4 * bell(p), ra: 1.4 * bell(p) }) },
  bounce: { dur: .5, f: p => jump(p, .07) },
  'nod-beat': { dur: .5, f: p => ({ rx: .1 * Math.max(0, osc(p, 1)), y: .01 * bell(p) }) },
  'look-around': { dur: 3, f: p => ({ ry: .45 * osc(p, 1), rx: -.04 * bell(p), gx: osc(p, 1) }) },
  'lean-in': { dur: 1.8, f: p => ({ rx: .2 * bell(p), sq: -.02 * bell(p) }) },
  shiver: { dur: 1.2, f: p => ({ x: .012 * osc(p, 19) * bell(p), sq: .03 * bell(p), la: .2 * bell(p), ra: .2 * bell(p) }) },
  stretch: { dur: 2, f: p => ({ sq: -.14 * bell(p), y: .03 * bell(p), la: 1.9 * bell(p), ra: 1.9 * bell(p), lf: -.25 * bell(p), rf: -.25 * bell(p) }) },
  yawn: { dur: 2.4, f: p => ({ rx: -.14 * bell(p), sq: -.05 * bell(p), mouth: bell(p), la: .8 * bell(p), ra: .8 * bell(p) }) },
  sleep: { dur: 4, f: p => ({ rx: .14, rz: .1, sq: .04 + .03 * osc(p, 1), y: -.02 }) },
  peek: { dur: 2.2, f: p => ({ x: .25 * bell(p), rz: -.2 * bell(p), ry: -.2 * bell(p), gx: -bell(p) }) },
  groove: { dur: 1, f: p => ({ rz: .1 * osc(p, 1), x: .03 * osc(p, 1), y: .025 * Math.abs(osc(p, 1)), la: .3 + .25 * osc(p, 1), ra: .3 - .25 * osc(p, 1) }) },
  dance: { dur: 1.2, f: p => ({ ry: .5 * osc(p, 1), y: .06 * Math.abs(osc(p, 2)), rz: .12 * osc(p, 2), la: 1.1 + .75 * osc(p, 2), ra: 1.1 - .75 * osc(p, 2), lf: -.2, rf: -.2 }) },
  celebrate: { dur: 1.6, f: p => ({ ...jump(clamp(p * 1.4), .3), ry: Math.PI * 2 * smooth((p - .1) / .6), la: 1.9 * bell(p), ra: 1.9 * bell(p), lf: -.25 * bell(p), rf: -.25 * bell(p) }) },
  wave: { dur: 1.8, f: p => ({ la: hold(p) * (1.65 + .3 * osc(p, 3)), lf: -.35 * hold(p), rz: -.05 * hold(p) }) },
  clap: { dur: 1.4, f: p => ({ la: -(.075 + .225 * osc(p, 4)) * bell(p), ra: -(.075 + .225 * osc(p, 4)) * bell(p), lf: 1.35 * bell(p), rf: 1.35 * bell(p), y: .02 * Math.abs(osc(p, 4)) * bell(p) }) },
  cheer: { dur: 1.4, f: p => ({ la: 1.9 * bell(p), ra: 1.9 * bell(p), lf: -.25 * bell(p), rf: -.25 * bell(p), y: .06 * Math.abs(osc(p, 2)) * bell(p), sq: -.04 * bell(p) }) },
  shrug: { dur: 1.4, f: p => ({ la: .55 * bell(p), ra: .55 * bell(p), lf: .5 * bell(p), rf: .5 * bell(p), rz: .06 * bell(p), sq: -.03 * bell(p) }) },
  point: { dur: 1.6, f: p => ({ ra: 1.15 * bell(p), rf: .3 * bell(p), ry: .25 * bell(p), gx: -bell(p) }) },
  think: { dur: 2.6, f: p => ({ la: -.1 * bell(p), lf: 1.75 * bell(p), rz: .08 * bell(p), gy: .7 * bell(p) }) },
  typing: { dur: .8, f: p => ({ la: -.3 + .08 * osc(p, 3), ra: -.3 - .08 * osc(p, 3), lf: 1.3 + .12 * osc(p, 3), rf: 1.3 - .12 * osc(p, 3), rx: .07, gy: -1 }) },
  writing: { dur: 1.2, f: p => ({ ra: -.25 + .08 * osc(p, 4), rf: 1.3, la: -.2, lf: 1, rx: .1, rz: .03 * osc(p, 1), gy: -1 }) },
  reading: { dur: 4, f: p => ({ la: -.2, ra: -.2, lf: 1.25, rf: 1.25, rx: .08, ry: .05 * osc(p, 1), gy: -.8 }) },
  facepalm: { dur: 1.8, f: p => ({ ra: -.15 * bell(p), rf: 1.95 * bell(p), rx: .12 * bell(p), ry: .1 * bell(p) }) },
  'heart-hands': { dur: 1.8, f: p => ({ la: 1.85 * bell(p), ra: 1.85 * bell(p), lf: -.5 * bell(p), rf: -.5 * bell(p), sq: -.02 * bell(p) }) },
};
const KEYS = ['y', 'x', 'rx', 'ry', 'rz', 'sq', 'la', 'ra', 'lf', 'rf', 'gx', 'gy', 'mouth'];
// The turns, in radians: they ease the short way round (D.4).
const TURNS = new Set(['rx', 'ry', 'rz']);
const wrap = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
const SUPPORTED = Object.keys(MOTIONS);

/**
 * The pose of SPEC D.2 at time t: breathing and the temperament at rest, and the lean of each situation. `w` holds
 * the weights of listening, thinking and sleeping and the voice and mic drivers.
 */
export function situationPose(t, { phase = 0, temperament = {}, float = false, w = {} } = {}) {
  const v = .7 + .6 * (temperament.energy ?? .5), S = .3 + 1.4 * (temperament.sway ?? .5), B = .4 + 1.2 * (temperament.bounce ?? .5);
  const { listening: wl = 0, thinking: wt = 0, sleeping: ws = 0, voice = 0, mic = 0 } = w;
  return {
    y: (float ? .035 * Math.sin(1.3 * t + phase) : 0) + .022 * B * voice - .02 * ws,
    rx: .07 * wl - .03 * wt + .03 * Math.sin(7 * t) * voice + .1 * ws,
    ry: .03 * S * Math.sin(.31 * t + phase) - .06 * wt,
    rz: .018 * S * Math.sin(.55 * v * t + phase) + .04 * wl - .07 * wt,
    sq: .012 * Math.sin(1.9 * t + phase) - .035 * mic * wl - .04 * voice + .06 * ws,
  };
}

// The default reactions' gaze (11.1) as eye and body offsets.
function gazeTarget(gaze, t, pointer) {
  switch (gaze) {
    case 'down': return { x: 0, y: -.8 };
    case 'up': return { x: .2, y: .8 };
    case 'side': return { x: Math.sin(t * .35) > 0 ? .8 : -.8, y: 0 };
    case 'around': return { x: Math.sin(t * .7) * .9, y: Math.sin(t * 1.1) * .3 };
    case 'work': return { x: -.4, y: -.6 };
    case 'pointer': return pointer ? { x: clamp(pointer[0] ?? pointer.x ?? 0, -1, 1), y: clamp(pointer[1] ?? pointer.y ?? 0, -1, 1) } : { x: 0, y: 0 };
    default: return { x: 0, y: 0 };
  }
}

export class Motion {
  constructor(avatar) {
    this.avatar = avatar; this.arms = hasArms(avatar.document);
    this.commanded = null; this.command_ = null; this.oneShot = null; this.loop = null; this.lastResolved = null;
    this.idleAt = 6 + Math.random() * 6; this.pose = {}; this.gaze = { x: 0, y: 0 };
    for (const k of KEYS) this.pose[k] = 0;
  }
  resolve(id) { return resolveMotion(id, { arms: this.arms, supported: SUPPORTED }); }
  /**
   * Plays a motion on top of everything (SPEC 12.2), once or, with `loop`, until stopped; no id stops the one
   * playing. Returns how long one play lasts, in seconds.
   */
  command(id, { loop = false } = {}) {
    if (!id) { this.command_ = null; this.commanded = null; return 0; }
    const m = this.resolve(id);
    this.command_ = { id: m, t: 0, dur: MOTIONS[m].dur, k: 1, loop }; this.commanded = id;
    return MOTIONS[m].dur;
  }

  update(t, dt, b) {
    const av = this.avatar, W = av.weights, temper = av.document.behavior?.temperament || {};
    const energy = temper.energy ?? .5, speed = .7 + .6 * energy;
    const target = {}; for (const k of KEYS) target[k] = 0;
    const add = (pose, k = 1) => { for (const key in pose) target[key] += pose[key] * k; };
    // At rest, and the lean of each situation (D.2).
    const w = { listening: W.get('listening'), thinking: W.get('thinking'), sleeping: W.get('sleeping'), voice: W.get('voice'), mic: W.get('mic') };
    add(situationPose(t, { phase: av.phase, temperament: temper, float: av.float, w }));
    // The motion the layers resolve to: a loop while it holds, or once each time it takes the channel (11.3).
    const resolved = b.motion || null, from = b.layers.motion || null, key = resolved && `${from}:${resolved}`;
    if (key !== this.lastResolved) {
      this.lastResolved = key;
      if (resolved && !b.motionLoops && from !== 'command') this.oneShot = { id: resolved, t: 0, dur: MOTIONS[resolved]?.dur ?? 1, k: 1, layer: from };
      this.loop = resolved && b.motionLoops ? { id: resolved, t: 0, k: 0, target: 1 } : this.loop && { ...this.loop, target: 0 };
    }
    if (this.loop) {
      const L = this.loop; L.k += (L.target - L.k) * (1 - Math.exp(-dt / .35)); L.t += dt * speed;
      // A looping idle motion loops once, then fades.
      if (L.once && L.t >= MOTIONS[L.id].dur) { L.target = 0; L.once = false; }
      const M = MOTIONS[L.id]; if (M) add(M.f((L.t / M.dur) % 1), L.k);
      if (L.target === 0 && L.k < .01) this.loop = null;
    }
    // Idle motions now and then (11.2, D.3): only at rest, never while quiet.
    const idle = W.get('idle') > .9 && !b.quiet && !this.loop && !this.oneShot && !this.command_ && !av.input.activity;
    const list = av.document.behavior?.idleMotions;
    if (idle && t > this.idleAt) {
      const pool = list?.length ? list : ['nod', 'wiggle', 'look-around'];
      const id = this.resolve(pool[Math.floor(Math.random() * pool.length)]);
      if (motionLoops(id)) this.loop = { id, t: 0, k: 0, target: .8, once: true };
      else this.oneShot = { id, t: 0, dur: MOTIONS[id].dur, k: .8 };
      this.idleAt = t + (7 + Math.random() * 9) / (.6 + .8 * energy);
    } else if (!idle) this.idleAt = Math.max(this.idleAt, t + 4);
    for (const key of ['oneShot', 'command_']) {
      const o = this[key]; if (!o) continue;
      o.t += dt * (key === 'command_' ? 1 : speed);
      const M = MOTIONS[o.id];
      if (M) add(M.f(o.loop ? (o.t / o.dur) % 1 : o.t / o.dur), o.k);
      if (o.t >= o.dur && !o.loop) {
        this[key] = null;
        if (key === 'command_') this.commanded = null;
        // Its layer lets the channel go to the next one down until its situation changes (11.3).
        else if (o.layer) av.finish(o.layer);
      }
    }
    // Gaze: the eyes lead, the body follows a little.
    const g = gazeTarget(b.gaze, t, av.input.pointer);
    g.x = clamp(g.x + target.gx, -1, 1); g.y = clamp(g.y + target.gy, -1, 1);
    this.gaze.x += (g.x - this.gaze.x) * (1 - Math.exp(-dt / .2)); this.gaze.y += (g.y - this.gaze.y) * (1 - Math.exp(-dt / .2));
    av.gaze = this.gaze;
    target.ry += this.gaze.x * .14; target.rx -= this.gaze.y * .06;
    // Ease toward the target so layers blend instead of jumping. A turn moves the short way round and stays within
    // half a turn, so a spin that ends a full turn round stops there instead of unwinding.
    for (const k of KEYS) {
      if (!TURNS.has(k)) { this.pose[k] += (target[k] - this.pose[k]) * (1 - Math.exp(-dt / .06)); continue; }
      this.pose[k] = wrap(this.pose[k] + wrap(target[k] - this.pose[k]) * (1 - Math.exp(-dt / .06)));
    }
    this.apply(this.pose);
  }

  apply(p) {
    const av = this.avatar, mg = av.motionGroup, sq = av.squash;
    mg.position.set(p.x, av.pivotY + p.y, 0);
    mg.rotation.set(p.rx, p.ry, p.rz, 'YXZ');
    const s = clamp(p.sq, -.25, .3);
    sq.scale.set(1 + s * .5, 1 - s, 1 + s * .5);
    for (const arm of av.arms) {
      const left = arm.side > 0;
      const raise = left ? p.la : p.ra, fwd = left ? p.lf : p.rf;
      // Out from hanging, then forward; never straight up, where the arm would hide in the head.
      arm.group.rotation.set(-fwd, 0, arm.side * clamp(arm.rest + raise, -.4, 2.4), 'XZY');
    }
    av.mouthOpen = clamp(p.mouth);
  }
}

export const SUPPORTED_MOTIONS = Object.freeze(SUPPORTED);
/** Each motion's length in seconds and its pose at progress p (SPEC D.3), for tests and tools. */
export const MOTION_POSES = Object.freeze(MOTIONS);
// Every standard motion is covered here; a missing one would fall back (13.5).
if (VOCABULARY?.motions) for (const m of VOCABULARY.motions) if (!MOTIONS[m.id]) console.warn(`[openavatar] motion ${m.id} has no pose; it falls back`);

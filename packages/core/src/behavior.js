// How an avatar reacts (SPEC 11, 13): the reaction for one situation, the
// channels the layers of 11.3 resolve to, and the fallback chains for motions
// and expressions. Renderers call resolveBehavior() whenever the host's
// inputs change and play what it returns.
import V from './vocabulary.js';
import { XID } from './model.js';

const byId = key => Object.fromEntries(V[key].map(x => [x.id, x]));
const STATE = byId('states'), ACTIVITY = byId('activities'), USER = byId('userActivities');
const EXPRESSION = byId('expressions'), MOTION = byId('motions');
const KINDS = { states: STATE, activities: ACTIVITY, userActivities: USER };
export const CHANNELS = Object.freeze(['expression', 'motion', 'prop', 'effect', 'gaze']);
export const BASE_MOTIONS = Object.freeze([...V.baseMotions]);

/** True when the avatar has arms, so motions that need them play as written (SPEC 6.3, 13.5). */
export function hasArms(doc) {
  const style = doc?.body?.arms?.style;
  return doc?.body?.rig === 'biped' ? style !== 'none' : Boolean(style && style !== 'none');
}

/**
 * The reaction for one situation: the vocabulary default with the document's
 * override laid over it member by member (SPEC 11.2). Null when the document
 * turns the default off, or when the id is unknown and has no default.
 * @param {object} doc a normalized document
 * @param {'states'|'activities'|'userActivities'} kind
 * @param {string} id
 */
export function reactionFor(doc, kind, id) {
  const base = KINDS[kind]?.[id]?.reaction;
  const overrides = doc?.behavior?.reactions?.[kind];
  const own = overrides && Object.prototype.hasOwnProperty.call(overrides, id) ? overrides[id] : undefined;
  if (own === null) return null;
  if (!base && !own) return null;
  const out = { ...(base || {}) };
  delete out.quiet;
  for (const [k, v] of Object.entries(own || {})) { if (v === null) delete out[k]; else out[k] = v; }
  return out;
}

/** Whether a user activity is quiet (SPEC 13.3): no effects and no idle motions while it holds. */
export const isQuiet = userActivity => Boolean(USER[userActivity]?.reaction?.quiet);

/**
 * Follows a motion's fallback chain (SPEC 13.5) to one the renderer plays.
 * @param {string} id a motion id, standard or x-
 * @param {{ arms?: boolean, supported?: Iterable<string> }} [o] `supported`
 *   lists what the renderer plays beyond the base motions; by default every
 *   standard motion, less those that need arms when the avatar has none.
 */
export function resolveMotion(id, { arms = false, supported } = {}) {
  const can = supported ? new Set([...supported, ...BASE_MOTIONS]) : null;
  const plays = m => can ? can.has(m) && (MOTION[m]?.needs !== 'arms' || arms || XID.test(m)) : Boolean(MOTION[m]) && (MOTION[m].needs !== 'arms' || arms);
  let m = id;
  for (let hop = 0; hop < 16 && m; hop++) {
    if (plays(m)) return m;
    m = MOTION[m]?.fallback;
  }
  return 'nod';
}

/** Whether a motion repeats until its situation ends. */
export const motionLoops = id => Boolean(MOTION[id]?.loops);

/**
 * Follows an expression's fallback chain (SPEC 13.4) to one the renderer shows.
 * @param {string} id
 * @param {Iterable<string>} [supported] by default every standard expression
 */
export function resolveExpression(id, supported) {
  const can = supported ? new Set([...supported, 'neutral']) : null;
  let e = id;
  for (let hop = 0; hop < 16 && e; hop++) {
    if (can ? can.has(e) : EXPRESSION[e]) return e;
    e = EXPRESSION[e]?.fallback;
  }
  return 'neutral';
}

/** The eye and mouth poses for an expression (SPEC 8.5, 13.4): the document's override, else the standard ones. */
export function expressionPoses(doc, id) {
  const e = EXPRESSION[resolveExpression(id)];
  const own = doc?.face?.expressions?.[id] || {};
  return { eyes: own.eyes ?? e.eyes, mouth: own.mouth ?? (e.mouth === 'rest' ? null : e.mouth), cheeks: own.cheeks, effect: own.effect ?? null };
}

/**
 * What the avatar does now (SPEC 11.3): for each channel, the highest layer
 * whose reaction sets it. Speaking always drives the mouth, which is not a
 * channel here. `finished` names the layers whose motion played once and
 * ended while their situation lasts: they set no motion, so the next layer
 * down takes the channel.
 * @param {object} doc a normalized document
 * @param {{ state?: string, activity?: string|null, userActivity?: string|null,
 *   expression?: string|null, expressionIntensity?: number, command?: string|null,
 *   finished?: string[] }} input
 * @returns {{ expression: string|null, expressionIntensity: number, motion: string|null,
 *   motionLoops: boolean, prop: string|null, effect: string|null,
 *   gaze: string|null, quiet: boolean, layers: Record<string, string> }}
 */
export function resolveBehavior(doc, input = {}) {
  const { state = 'idle', activity = null, userActivity = null, expression = null, expressionIntensity = 1, command = null, finished = [] } = input;
  const layers = [];
  if (command) layers.push(['command', { motion: command }]);
  if (expression) layers.push(['host', { expression, intensity: expressionIntensity }]);
  if (state === 'speaking') layers.push(['speaking', reactionFor(doc, 'states', 'speaking')]);
  if (state === 'listening' || state === 'thinking') layers.push([state, reactionFor(doc, 'states', state)]);
  if (activity) layers.push(['activity', reactionFor(doc, 'activities', activity)]);
  if (userActivity) layers.push(['userActivity', reactionFor(doc, 'userActivities', userActivity)]);
  layers.push(['idle', reactionFor(doc, 'states', 'idle')]);
  const out = { expression: null, expressionIntensity: 1, motion: null, motionLoops: false, prop: null, effect: null, gaze: null, quiet: isQuiet(userActivity), layers: {} };
  for (const ch of CHANNELS) {
    for (const [name, r] of layers) {
      if (!r || r[ch] === undefined || (ch === 'motion' && finished.includes(name))) continue;
      out[ch] = r[ch]; out.layers[ch] = name;
      if (ch === 'expression') out.expressionIntensity = r.intensity ?? 1;
      break;
    }
  }
  // An expression the document defines for itself (an `x-` id in face.expressions, SPEC 8.5) needs no fallback.
  if (out.expression && !doc?.face?.expressions?.[out.expression]) out.expression = resolveExpression(out.expression);
  if (out.motion) { out.motion = resolveMotion(out.motion, { arms: hasArms(doc) }); out.motionLoops = motionLoops(out.motion) && out.layers.motion !== 'command'; }
  // A quiet user activity (a meeting) shows no effects; the renderer also skips idle motions while `quiet` holds.
  if (out.quiet) out.effect = null;
  return out;
}

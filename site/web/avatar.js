// An avatar's page: the avatar live, and the host inputs of SPEC 12.1 and 12.2 to try on it. The code under the
// choices is what an app sends for the same situation.
import { documentOf, reduceMotion, run, startStage } from '/host.js';

const entry = JSON.parse(document.getElementById('avatar').textContent);
const figure = document.querySelector('.avatar-stage');
const status = figure.querySelector('.stage-status');
const panel = document.querySelector('.try');
const form = panel.querySelector('.try-form');
const code = panel.querySelector('[data-code]');
const labelOf = button => button.textContent.trim();

let stage = null, lastOnce = '', clearExpression = null, statusTimer = null;

function chosen() {
  const data = new FormData(form);
  return { state: data.get('state'), activity: data.get('activity') || null, userActivity: data.get('userActivity') || null };
}

const quote = value => (value == null ? 'null' : `'${value}'`);

// The loudness an app samples from speech (voice) or the microphone (mic) every frame, shown at a typical level.
const level = state => (state === 'speaking' ? ', voice: 0.6' : state === 'listening' ? ', mic: 0.6' : '');

function showCode() {
  const { state, activity, userActivity } = chosen();
  code.textContent = `stage.setInput({ state: ${quote(state)}${level(state)}, activity: ${quote(activity)}, userActivity: ${quote(userActivity)} });${lastOnce ? `\n${lastOnce}` : ''}`;
}

function say(text) {
  clearTimeout(statusTimer);
  status.textContent = text;
  status.hidden = !text;
  if (text) statusTimer = setTimeout(() => say(''), 4000);
}

function apply() {
  const input = chosen();
  const still = reduceMotion.matches ? .6 : 0;
  stage.setInput({ ...input, voice: input.state === 'speaking' ? still : 0, mic: input.state === 'listening' ? still : 0 });
  showCode();
  if (reduceMotion.matches) run(stage);
}

// Speech, and a voice to listen to, rise and fall (apply holds them at one level when motion is unwelcome).
let pulse = 0;
function loudness(now) {
  const { state } = chosen();
  const t = now / 1000;
  if (state === 'speaking') stage.setInput({ voice: Math.max(0, .45 + .4 * Math.sin(t * 11) * Math.sin(t * 2.7) + .15 * Math.sin(t * 23)) });
  if (state === 'listening') stage.setInput({ mic: Math.max(0, .35 + .35 * Math.sin(t * 7) * Math.sin(t * 1.9)) });
  pulse = requestAnimationFrame(loudness);
}

function feel(button) {
  const id = button.dataset.expression;
  clearTimeout(clearExpression);
  stage.setInput({ expression: { id, strength: 1 } });
  lastOnce = `stage.setInput({ expression: { id: '${id}', strength: 1 } });`;
  clearExpression = setTimeout(() => { stage.setInput({ expression: null }); if (reduceMotion.matches) run(stage); }, 2500);
  showCode();
  if (reduceMotion.matches) run(stage);
}

function move(button) {
  const id = button.dataset.motion;
  stage.play(id);
  lastOnce = `stage.play('${id}');`;
  showCode();
  // The renderer plays the nearest motion this avatar can (SPEC 13.5), such as a nod for a wave without arms.
  const played = stage.avatar?.motion?.command_?.id;
  if (played && played !== id) {
    const why = stage.avatar.motion.arms ? '' : `${entry.name} has no arms, so `;
    say(`${why}${labelOf(button)} plays as ${played.replace(/-/g, ' ')}`.replace(/^./, c => c.toUpperCase()));
  } else say('');
  if (reduceMotion.matches) run(stage);
}

async function start() {
  stage = await startStage(figure);
  stage.load(await documentOf(entry));
  figure.classList.add('is-live');
  panel.hidden = false;
  apply();
  run(stage);
  if (!reduceMotion.matches) pulse = requestAnimationFrame(loudness);
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('change', apply);
  form.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.dataset.expression) feel(button);
    else if (button?.dataset.motion) move(button);
  });
}

start().catch(error => {
  // Without WebGL, or if the file can't be read, the picture stays and there is nothing to try.
  console.warn('OpenAvatar stage:', error);
  cancelAnimationFrame(pulse);
  figure.classList.remove('is-live');
  panel.hidden = true;
});

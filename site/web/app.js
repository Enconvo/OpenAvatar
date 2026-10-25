// The home page: the gallery's search and tag filters, and the host in the hero, a live avatar that reacts to them
// the way an app's avatar reacts to its person (SPEC 12): it follows the pointer, listens while someone types in the
// search, thinks, then shows how the search went.
import { documentOf, reduceMotion, run, startStage } from '/host.js';

const catalog = JSON.parse(document.getElementById('catalog').textContent);
const bySlug = new Map(catalog.map(e => [e.slug, e]));

// Gallery
const search = document.querySelector('.search input');
const chips = [...document.querySelectorAll('.chip')];
const patches = [...document.querySelectorAll('.patch')];
const count = document.querySelector('[data-count]');
const empty = document.querySelector('.gallery-empty');
let tag = '';

function matches(patch, words) {
  const entry = bySlug.get(patch.dataset.slug);
  const text = `${entry.name} ${entry.description} ${entry.tags.join(' ')}`.toLowerCase();
  return (!tag || entry.tags.includes(tag)) && words.every(w => text.includes(w));
}

/** Shows the avatars that match; returns how many. */
function filter() {
  const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const patch of patches) {
    const show = matches(patch, words);
    patch.hidden = !show;
    if (show) shown++;
  }
  count.textContent = shown;
  empty.hidden = shown > 0;
  return shown;
}

for (const chip of chips) {
  chip.addEventListener('click', () => {
    tag = chip.dataset.tag;
    for (const c of chips) c.setAttribute('aria-pressed', String(c === chip));
    const shown = filter();
    if (host.stage) host.found(shown);
  });
}

// The host
const figure = document.querySelector('.stage');
const still = figure.querySelector('.stage-still');
const status = figure.querySelector('.stage-status');
const next = figure.querySelector('.stage-next');

const host = {
  stage: null, entry: bySlug.get(figure.dataset.host), timers: [],
  say(text) { status.textContent = text; },
  input(input) { this.stage?.setInput(input); if (reduceMotion.matches && this.stage) run(this.stage); },
  later(ms, fn) { this.timers.push(setTimeout(fn, ms)); },
  calm() { for (const t of this.timers) clearTimeout(t); this.timers = []; },
  /** Someone is typing: listen, with the typing as the voice it hears, then think, then tell how many it found. */
  listening(shown) {
    this.calm();
    this.input({ state: 'listening', mic: .55 + Math.random() * .3, expression: null });
    this.say(`${this.entry.name} is listening`);
    this.later(250, () => this.input({ mic: .1 }));
    this.later(700, () => {
      this.input({ state: 'thinking', mic: 0 });
      this.say(`${this.entry.name} is thinking`);
      this.later(600, () => this.found(shown));
    });
  },
  /** How the search went. */
  found(n) {
    this.calm();
    const name = this.entry.name;
    this.input({ state: 'idle', expression: n ? { id: 'happy', strength: 1 } : { id: 'sad', strength: .8 } });
    this.say(n ? `${name} found ${n === 1 ? 'one avatar' : `${n} avatars`}` : `${name} found nothing for that`);
    this.later(2400, () => { this.input({ expression: null }); });
  },
};

async function show(entry) {
  const doc = await documentOf(entry);
  host.calm();
  host.entry = entry;
  host.stage.load(doc);
  still.src = `/avatars/${entry.slug}.webp?v=${entry.revision}`;
  still.alt = `${entry.name}. ${entry.description}`;
  host.input({ state: 'idle', expression: null });
  if (!reduceMotion.matches) host.stage.play('wave');
  host.say(`${entry.name} says hello`);
}

async function start() {
  host.stage = await startStage(figure);
  await show(host.entry);
  figure.classList.add('is-live');
  run(host.stage);
  next.hidden = catalog.length < 2;
  next.addEventListener('click', () => {
    const i = catalog.indexOf(host.entry);
    show(catalog[(i + 1) % catalog.length]).catch(fail);
  });
}

function fail(error) {
  // Without WebGL, or if a file can't be read, the picture stays and the gallery still works.
  console.warn('OpenAvatar host:', error);
  figure.classList.remove('is-live');
  next.hidden = true;
  host.stage = null;
}

// The gallery filters at once; the host's reaction runs beside it.
search.addEventListener('input', () => {
  const shown = filter();
  if (host.stage) host.listening(shown);
});
start().catch(fail);

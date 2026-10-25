// The submit page: reads the chosen file, checks it the way the Worker will (submission.js), shows the avatar live,
// and sends it for review. Text from the file only ever goes into the page as text.
import { checkDocument, checkSubmission } from '/submission.js';
import { reduceMotion, run, startStage } from '/host.js';

const form = document.querySelector('.submit-form');
const input = form.querySelector('input[type=file]');
const drop = form.querySelector('.drop');
const check = form.querySelector('.submit-check');
const details = form.querySelector('.submit-details');
const send = details.querySelector('button[type=submit]');
const result = form.querySelector('.submit-result');
const figure = document.querySelector('.submit-stage');
const empty = figure.querySelector('.submit-empty');
const dropTitle = drop.querySelector('.drop-title');

const REASONS = {
  not_text: "That file couldn't be read.",
  too_large: 'That file is larger than 256 KB, the most an OpenAvatar file may be.',
  not_json: "That isn't an OpenAvatar file: it isn't JSON.",
  invalid: 'Fix these in the file, then choose it again.',
  author: 'The credit can be at most 60 characters, on one line, without angle brackets.',
  license: 'Choose a license.',
  consent: 'Confirm that you may share this avatar.',
  already_sent: 'This avatar is already in the gallery or waiting for review.',
  too_many: 'Too many avatars sent from here just now. Try again in a minute.',
  too_large_request: 'That file is larger than 256 KB, the most an OpenAvatar file may be.',
  closed: "The gallery isn't taking avatars right now. Try again later.",
};

let chosen = null, stage = null;

/** A message, and the problems under it, as text. */
function show(where, message, problems = []) {
  where.replaceChildren();
  if (!message) return;
  const p = document.createElement('p');
  p.textContent = message;
  where.append(p);
  if (!problems.length) return;
  const list = document.createElement('ul');
  list.className = 'problems';
  for (const { path, message: what } of problems) {
    const item = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = path;
    item.append(code, ` ${what}`);
    list.append(item);
  }
  where.append(list);
}

function closeDetails() {
  chosen = null;
  details.disabled = true;
  details.hidden = true;
}

async function preview(text) {
  try {
    const { parse } = await import('@openavatar/core');
    stage ??= await startStage(figure);
    stage.load(parse(text).document);
    figure.classList.add('is-live');
    empty.hidden = true;
    run(stage);
    if (!reduceMotion.matches) stage.play('wave');
  } catch (error) {
    console.warn('OpenAvatar preview:', error);
    figure.classList.remove('is-live');
    empty.hidden = false;
    empty.textContent = 'The preview needs WebGL. You can still send the file.';
  }
}

async function choose(file) {
  show(result, '');
  closeDetails();
  dropTitle.textContent = file ? 'Choose another file' : 'Choose a file';
  if (!file) return show(check, '');
  // Too big to be one, so don't read it.
  if (file.size > 256 * 1024) return show(check, REASONS.too_large);
  const checked = checkDocument(await file.text());
  if (!checked.ok) {
    figure.classList.remove('is-live');
    empty.hidden = false;
    empty.textContent = 'Your avatar shows here.';
    return show(check, REASONS[checked.error], checked.problems);
  }
  chosen = checked.value;
  show(check, `${chosen.name}, ${Math.max(1, Math.round(chosen.bytes / 1024))} KB. Ready to send.`);
  const author = form.elements.author;
  if (!author.value) {
    try { author.value = JSON.parse(chosen.text).meta?.authors?.[0]?.name?.slice(0, 60) ?? ''; } catch { /* checked above */ }
  }
  details.hidden = false;
  details.disabled = false;
  await preview(chosen.text);
}

input.addEventListener('change', () => choose(input.files[0]));
for (const type of ['dragenter', 'dragover']) drop.addEventListener(type, event => { event.preventDefault(); drop.classList.add('is-over'); });
for (const type of ['dragleave', 'drop']) drop.addEventListener(type, () => drop.classList.remove('is-over'));
drop.addEventListener('drop', event => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) choose(file);
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!chosen) return;
  const data = new FormData(form);
  const submission = { document: chosen.text, author: String(data.get('author') ?? ''), license: data.get('license'), consent: data.get('consent') === 'on' };
  const local = checkSubmission(submission);
  if (!local.ok) {
    show(result, REASONS[local.error], local.problems);
    form.elements[local.error === 'consent' ? 'consent' : local.error === 'author' ? 'author' : 'file']?.focus?.();
    return;
  }
  send.disabled = true;
  send.textContent = 'Sending…';
  try {
    const response = await fetch('/api/submissions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(submission) });
    const reply = await response.json().catch(() => ({}));
    if (response.status === 201) {
      const name = chosen.name;
      form.reset();
      closeDetails();
      dropTitle.textContent = 'Choose a file';
      show(check, '');
      show(result, `Sent. ${name} is waiting for review, and appears in the gallery once it's approved.`);
      return;
    }
    const reason = response.status === 413 ? REASONS.too_large_request : REASONS[reply.error];
    show(result, reason ?? `The gallery couldn't take it (error ${response.status}). Try again later.`, reply.problems ?? []);
  } catch {
    show(result, "The gallery couldn't be reached. Check your connection and try again.");
  } finally {
    send.disabled = false;
    send.textContent = 'Send for review';
  }
});

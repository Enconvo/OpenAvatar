// Runs inside the headless browser: draws jobs with the reference renderer
// and hands back data URLs. render.js serves this file and the packages it
// imports.
import { OpenAvatarStage } from '@openavatar/three';

let stage = null, key = '';
const canvas = document.createElement('canvas');

// Mulberry32: a small seeded generator, so what the renderer times at random draws the same numbers on every run.
const seeded = seed => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

function stageFor(width, height, background) {
  const k = `${width}x${height}|${background}`;
  if (k === key) return stage;
  stage?.dispose();
  canvas.width = width; canvas.height = height;
  stage = new OpenAvatarStage(canvas, { background, preserveDrawingBuffer: true, pixelRatio: 1 });
  stage.resize(width, height); key = k;
  return stage;
}

/** Draws one job and leaves it on the shared canvas. */
function draw(doc, job) {
  const s = stageFor(job.width, job.height, job.background ?? null);
  s.roomForEffects = !!job.room; s.yaw = (job.view || 0) * Math.PI / 180;
  // A picture is the same on every run: blinks and idle motions are timed at random, so each draw starts from one
  // seed, and the first blink waits until after the picture is taken.
  Math.random = seeded(1);
  const a = s.load(doc);
  a.setInput(job.input || {});
  let T = job.time ?? 1.2;
  if (job.play) { const len = a.play(job.play); if (job.time == null) T = len * .45; }
  if (a.face) a.face.blinkAt = Math.max(a.face.blinkAt, T + 1);
  // The motion it plays in place of one it cannot (an armless avatar's wave), for the label.
  const played = job.play ? a.motion.command_?.id : null;
  for (let t = 0; t < T; t += 1 / 30) a.update(1 / 30);
  s.render(0);
  return { a, played };
}

const encode = (c, format, quality) => c.toDataURL(format === 'webp' ? 'image/webp' : format === 'jpeg' ? 'image/jpeg' : 'image/png', quality);

window.openavatarRender = (doc, job) => {
  const { a } = draw(doc, job);
  return { image: encode(canvas, job.format, job.quality), repairs: a.repairs.length, behavior: a.behavior };
};

/** Draws cells into one labelled contact sheet. */
window.openavatarSheet = (doc, { cells, cell = 256, columns = 4, background = '#F4F1EC', format, quality }) => {
  const label = 24, rows = Math.ceil(cells.length / columns);
  const sheet = document.createElement('canvas');
  sheet.width = columns * cell; sheet.height = rows * (cell + label);
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = background; ctx.fillRect(0, 0, sheet.width, sheet.height);
  const [r, g, b] = [1, 3, 5].map(i => parseInt(background.slice(i, i + 2), 16));
  ctx.font = '13px system-ui, -apple-system, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = .299 * r + .587 * g + .114 * b < 110 ? '#A7AFB9' : '#6B6259';
  cells.forEach((c, i) => {
    const { played } = draw(doc, { ...c, width: cell, height: cell, background });
    const x = (i % columns) * cell, y = Math.floor(i / columns) * (cell + label);
    ctx.drawImage(canvas, x, y);
    ctx.fillText(played && played !== c.play ? `${c.label} (plays ${played})` : c.label || '', x + cell / 2, y + cell + 16);
  });
  return { image: encode(sheet, format, quality) };
};

window.openavatarReady = true;

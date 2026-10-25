// Renders documents with the reference renderer in a headless Chrome, Edge or
// Chromium that playwright-core drives (it downloads no browser). The page and
// its modules are served from disk through request interception, so no port
// is opened.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'http://openavatar.localhost';
const dirOf = spec => path.dirname(fileURLToPath(import.meta.resolve(spec)));
const MOUNTS = {
  '/three/': () => dirOf('three'),
  '/openavatar/': () => dirOf('@openavatar/core'),
  '/renderer/': () => dirOf('@openavatar/three'),
  '/cli/': () => path.dirname(fileURLToPath(import.meta.url)),
};
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/three/three.module.js","@openavatar/core":"/openavatar/index.js","@openavatar/three":"/renderer/index.js"}}</script>
</head><body><script type="module">
import('/cli/page.js').catch(e => { window.openavatarError = String(e && e.stack || e); });
</script></body></html>`;
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };

/** The cells of a contact sheet: four views, then the situations a host shows most. */
export const SHEET = [
  { label: 'front' },
  { label: 'three-quarter', view: 35 },
  { label: 'side', view: 90 },
  { label: 'back', view: 180 },
  { label: 'happy', input: { expression: 'happy' }, room: true },
  { label: 'surprised', input: { expression: 'surprised' }, room: true },
  { label: 'listening', input: { state: 'listening', mic: .6 }, room: true },
  { label: 'thinking', input: { state: 'thinking' }, room: true },
  { label: 'speaking', input: { state: 'speaking', voice: .8 }, room: true },
  { label: 'sleeping', input: { activity: 'sleeping' }, time: 3, room: true },
  { label: 'coding', input: { userActivity: 'coding' }, time: 2, room: true },
  { label: 'wave', play: 'wave', room: true },
];

// Turns in degrees. The sheet's three-quarter and side views show the avatar's right side (-x); `left` and
// `right` are the avatar's own sides, as everywhere in the spec.
export const VIEWS = { front: 0, 'three-quarter': 35, side: 90, back: 180, left: -90, right: 90 };

function launchArgs() {
  const args = ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];
  if (process.platform === 'darwin') args.push('--use-angle=metal');
  return args;
}

/** Starts a headless Chromium-based browser (playwright-core), the one at `executablePath` or the first installed. */
export async function launch(executablePath) {
  const { chromium } = await import('playwright-core');
  const tries = executablePath ? [{ executablePath }] : [{ channel: 'chrome' }, { channel: 'msedge' }, { channel: 'chromium' }];
  const failures = [];
  for (const t of tries) {
    try { return await chromium.launch({ ...t, headless: true, args: launchArgs() }); } catch (e) { failures.push(e.message.split('\n')[0]); }
  }
  const err = new Error(executablePath
    ? `could not start the browser at ${executablePath}: ${failures[0]}`
    : 'no Chrome, Edge or Chromium was found. Install one, pass --browser <path>, or set OPENAVATAR_BROWSER');
  err.code = 'no-browser';
  throw err;
}

function serve(route) {
  const url = new URL(route.request().url());
  if (url.pathname === '/' || url.pathname === '/index.html') return route.fulfill({ contentType: 'text/html', body: PAGE });
  const prefix = Object.keys(MOUNTS).find(p => url.pathname.startsWith(p));
  if (!prefix) return route.fulfill({ status: 404, body: '' });
  const root = MOUNTS[prefix]();
  const file = path.join(root, decodeURIComponent(url.pathname.slice(prefix.length)));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
}

/**
 * Starts a browser with the renderer loaded. Close it when done.
 * @param {{ browser?: string }} [options] browser: the path of a Chromium-based browser to use
 */
export async function openRenderer({ browser: executablePath = process.env.OPENAVATAR_BROWSER } = {}) {
  const browser = await launch(executablePath);
  try {
    const page = await browser.newPage();
    const pageErrors = [], warnings = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    // WebGL reports shader compile failures on the console; a part that fails that way draws nothing.
    page.on('console', m => { if (m.type() === 'error' && !warnings.includes(m.text())) warnings.push(m.text()); });
    await page.route(`${ORIGIN}/**`, serve);
    await page.goto(`${ORIGIN}/index.html`);
    await page.waitForFunction(() => window.openavatarReady || window.openavatarError, null, { timeout: 30000 });
    const loadError = await page.evaluate(() => window.openavatarError);
    if (loadError) throw new Error(`the renderer did not load: ${loadError}`);
    const call = async (fn, ...args) => {
      try { return await page.evaluate(fn, args); } catch (e) {
        throw new Error(`the renderer failed: ${e.message.split('\n')[0]}${pageErrors.length ? ` (${pageErrors.at(-1)})` : ''}`);
      }
    };
    return {
      /** One picture. job: { width, height, view, input, play, time, background, room, format, quality } */
      render: async (doc, job) => {
        const r = await call(([d, j]) => window.openavatarRender(d, j), doc, job);
        return { ...r, image: decode(r.image) };
      },
      /** A labelled contact sheet of cells (SHEET by default). */
      sheet: async (doc, options = {}) => {
        const r = await call(([d, o]) => window.openavatarSheet(d, o), doc, { cells: SHEET, ...options });
        return { image: decode(r.image) };
      },
      /** Errors the browser printed while rendering, such as a shader that did not compile. */
      warnings,
      close: () => browser.close(),
    };
  } catch (e) { await browser.close(); throw e; }
}

const decode = dataUrl => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

export const PREVIEW_BYTES = 96 * 1024;

/** A front picture for `preview` (SPEC 3.3): transparent WebP, at most 96 KB decoded. */
export async function renderPreview(renderer, doc) {
  for (const size of [256, 192, 128]) for (const quality of [.9, .8, .65]) {
    const { image } = await renderer.render(doc, { width: size, height: size, format: 'webp', quality });
    if (image.length <= PREVIEW_BYTES) return { image: `data:image/webp;base64,${image.toString('base64')}`, bytes: image.length, size };
  }
  throw new Error('the preview picture stayed larger than 96 KB');
}

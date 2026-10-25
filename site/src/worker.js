// The gallery's Worker. Pages, pictures and scripts are static assets. An avatar file (`/avatars/<slug>.openavatar`)
// passes through here to carry the OpenAvatar media type (SPEC 14.1), and it and the list (`/api/avatars.json`) are
// made readable by any app or site, which an install link or another gallery needs. Submissions
// (`POST /api/submissions`) are checked and queued in D1 for a person to review; nothing is published from here.
// A Worker module may export only its handlers, so the constants stay private.
import { checkSubmission } from '../web/submission.js';

const MEDIA_TYPE = 'application/vnd.openavatar+json';
const LIST = '/api/avatars.json';
const SUBMISSIONS = '/api/submissions';
// A 256 KB document, as JSON text inside the request, plus the form's few fields.
const MAX_BODY = 600 * 1024;

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});

/** The request body as text, or null once it passes `max` bytes, whatever its Content-Length says. */
async function readCapped(request, max) {
  if (Number(request.headers.get('content-length')) > max) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.byteLength; }
  return new TextDecoder().decode(all);
}

async function submit(request, env) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405, { allow: 'POST' });
  if (!env.DB) return json({ error: 'closed' }, 503);
  if (!/^application\/json\b/i.test(request.headers.get('content-type') ?? '')) return json({ error: 'content_type' }, 415);
  // Several sends a minute from one address is a script, not a person.
  if (env.SUBMIT_LIMIT) {
    const { success } = await env.SUBMIT_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') ?? 'unknown' });
    if (!success) return json({ error: 'too_many' }, 429);
  }
  const text = await readCapped(request, MAX_BODY);
  if (text === null) return json({ error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'not_json' }, 400); }
  const checked = checkSubmission(body ?? {});
  if (!checked.ok) return json({ error: checked.error, problems: checked.problems }, 400);
  const { value } = checked;
  // One avatar (by its id) waits in the queue or sits in the gallery once.
  const known = await env.DB.prepare(`SELECT status FROM submissions WHERE avatar_id = ? AND status IN ('pending', 'approved') LIMIT 1`)
    .bind(value.id).first();
  if (known) return json({ error: 'already_sent', status: known.status }, 409);
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(`INSERT INTO submissions (id, avatar_id, name, author, license, document, bytes, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`)
      .bind(id, value.id, value.name, value.author || null, value.license, value.text, value.bytes, new Date().toISOString()).run();
  } catch (error) {
    // The same avatar sent twice at once: the second meets the unique index.
    if (/UNIQUE/i.test(String(error?.message))) return json({ error: 'already_sent', status: 'pending' }, 409);
    throw error;
  }
  return json({ id, status: 'pending' }, 201);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === SUBMISSIONS) return submit(request, env);
    const response = await env.ASSETS.fetch(request);
    const avatar = pathname.toLowerCase().endsWith('.openavatar');
    if (!(avatar || pathname === LIST) || !response.ok) return response;
    const headers = new Headers(response.headers);
    if (avatar) headers.set('content-type', `${MEDIA_TYPE}; charset=utf-8`);
    headers.set('access-control-allow-origin', '*');
    headers.set('x-content-type-options', 'nosniff');
    headers.set('cache-control', 'public, max-age=300');
    return new Response(response.body, { status: response.status, headers });
  },
};

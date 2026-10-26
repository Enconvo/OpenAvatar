// The OpenAvatar API (`/api/v1/…`): the gallery's categories, its avatars, and one avatar with its document, for
// apps that want to offer the gallery. Every call needs a token (`Authorization: Bearer oa_…`) and counts against
// the token's month (UTC): 1,000 calls free, a token without a limit (Enconvo's own) is never cut off. Anyone can
// make a token on /developers/; the gallery keeps only its SHA-256 and the name it was given. The avatar files,
// their pictures and install links stay free and need no token (SPEC 14.3).
import { CATEGORIES, OTHER } from './categories.js';

export const FREE_MONTHLY_CALLS = 1000;
/** Tokens one address may make in a day, and in a minute (the TOKEN_LIMIT binding), until accounts arrive. */
export const DAILY_TOKENS = 5;
const PREFIX = 'oa_', SHOWN = 10, MAX_NAME = 60, MAX_PAGE = 100;
const LIST = '/avatars.json';
// The catalogue is a file the build writes; read again at most this often.
const CATALOGUE_MS = 60_000;
const QUOTA_HEADERS = ['OpenAvatar-Quota-Limit', 'OpenAvatar-Quota-Remaining', 'OpenAvatar-Quota-Reset'];
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-expose-headers': QUOTA_HEADERS.join(', '),
  'access-control-max-age': '86400',
};

const MESSAGES = {
  token_required: 'This call needs an API token: Authorization: Bearer <token>. Make one, free, at /developers/.',
  token_invalid: 'This token is unknown or was revoked. Make a new one at /developers/.',
  quota_exceeded: 'This token has used its calls for this month. They start again on the date in OpenAvatar-Quota-Reset.',
  not_found: 'There is no such avatar or call.',
  method: 'This address does not take that method.',
  category: 'There is no such category. GET /api/v1/categories lists them.',
  name: 'A token name is at most 60 characters, on one line.',
  origin: 'Tokens are made on the gallery\'s own pages or by a program, not by another site.',
  too_many: 'Too many tokens made from here just now. Try again in a minute.',
  too_many_today: `At most ${DAILY_TOKENS} tokens can be made from one address a day. Try again tomorrow.`,
  closed: 'The API is not available right now. Try again later.',
  content_type: 'Send JSON (Content-Type: application/json).',
  not_json: 'The body is not JSON.',
};

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...CORS, ...headers },
});
const problem = (error, status, headers) => json({ error, message: MESSAGES[error] }, status, headers);

const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async text => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

/** A new token: `oa_` and 32 URL-safe characters (192 random bits). */
export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return PREFIX + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
}
/** What a token is shown as once it is made: its first characters. */
export const shownAs = token => `${token.slice(0, SHOWN)}…`;

/** The month a call counts in (UTC, `YYYY-MM`), and when the next one starts. */
export const monthOf = (now = new Date()) => now.toISOString().slice(0, 7);
export function resetOf(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().replace('.000Z', 'Z');
}

function bearer(request) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get('authorization') ?? '');
  return match && match[1].startsWith(PREFIX) && match[1].length <= 100 ? match[1] : null;
}

/** The token a request carries, from D1, or the problem with it. */
async function tokenOf(request, env) {
  const token = bearer(request);
  if (!token) return { failed: problem('token_required', 401, { 'www-authenticate': 'Bearer realm="OpenAvatar"' }) };
  const row = await env.DB.prepare('SELECT id, prefix, name, monthly_limit, created_at FROM api_tokens WHERE hash = ? AND revoked_at IS NULL')
    .bind(await sha256(token)).first();
  if (!row) return { failed: problem('token_invalid', 401, { 'www-authenticate': 'Bearer realm="OpenAvatar", error="invalid_token"' }) };
  return { row };
}

/**
 * Counts one call against the token's month, unless the month's calls are used up: one statement, so two calls at
 * once can't both take the last one. Returns the quota headers, or the 429.
 */
async function count(row, env, now) {
  const month = monthOf(now), reset = resetOf(now), limit = row.monthly_limit ?? null;
  const counted = await env.DB.prepare(`INSERT INTO api_usage (token_id, month, calls) VALUES (?1, ?2, 1)
    ON CONFLICT (token_id, month) DO UPDATE SET calls = calls + 1 WHERE ?3 IS NULL OR calls < ?3
    RETURNING calls`).bind(row.id, month, limit).first();
  if (limit === null) return { headers: { 'OpenAvatar-Quota-Limit': 'unlimited', 'OpenAvatar-Quota-Reset': reset } };
  const headers = { 'OpenAvatar-Quota-Limit': String(limit), 'OpenAvatar-Quota-Reset': reset };
  if (!counted) {
    const wait = Math.max(1, Math.ceil((Date.parse(reset) - now.getTime()) / 1000));
    return { failed: problem('quota_exceeded', 429, { ...headers, 'OpenAvatar-Quota-Remaining': '0', 'retry-after': String(wait) }) };
  }
  return { headers: { ...headers, 'OpenAvatar-Quota-Remaining': String(Math.max(0, limit - counted.calls)) } };
}

let cached = null;
/** The gallery's list, as the build wrote it (`dist/api/avatars.json`). The Worker reads it; nobody else can. */
async function catalogue(env, origin) {
  if (cached && Date.now() - cached.at < CATALOGUE_MS) return cached.list;
  const response = await env.ASSETS.fetch(new Request(`${origin}/api${LIST}`));
  if (!response.ok) throw new Error(`the catalogue answered ${response.status}`);
  const list = await response.json();
  cached = { at: Date.now(), list };
  return list;
}
/** Forgets the catalogue read before, for tests. */
export const forgetCatalogue = () => { cached = null; };

const intIn = (value, min, max, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function categories(list) {
  const counts = new Map();
  for (const a of list.avatars) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  const all = [...CATEGORIES, ...(counts.get(OTHER.id) ? [OTHER] : [])];
  return { categories: all.map(({ id, name, description }) => ({ id, name, description, count: counts.get(id) ?? 0 })) };
}

function avatars(list, params) {
  const category = params.get('category'), tag = params.get('tag')?.toLowerCase(), q = params.get('q')?.trim().toLowerCase();
  if (category && ![...CATEGORIES, OTHER].some(c => c.id === category)) return { failed: 'category' };
  const found = list.avatars.filter(a => (!category || a.category === category) && (!tag || a.tags.includes(tag))
    && (!q || [a.name, a.description, ...a.tags, ...a.authors].some(text => String(text).toLowerCase().includes(q))));
  const limit = intIn(params.get('limit'), 1, MAX_PAGE, MAX_PAGE), offset = intIn(params.get('offset'), 0, 1e6, 0);
  return { body: { openavatar: list.openavatar, total: found.length, offset, limit, avatars: found.slice(offset, offset + limit) } };
}

async function avatar(list, slug, env, origin) {
  const entry = /^[a-z0-9-]{1,48}$/.test(slug) && list.avatars.find(a => a.slug === slug);
  if (!entry) return null;
  const file = await env.ASSETS.fetch(new Request(`${origin}/avatars/${slug}.openavatar`));
  if (!file.ok) return null;
  return { ...entry, document: await file.json() };
}

/** POST /api/v1/tokens: a free token, shown this once. Body (optional): `{ "name": "what it's for" }`. */
async function createToken(request, env, now) {
  // Another site's page can't make tokens for its visitors; a program sends no Origin.
  const from = request.headers.get('origin');
  if (from && from !== new URL(request.url).origin) return problem('origin', 403);
  const type = request.headers.get('content-type') ?? '';
  let body = {};
  if (type) {
    if (!/^application\/json\b/i.test(type)) return problem('content_type', 415);
    const text = await request.text();
    if (text.length > 2048) return problem('name', 400);
    if (text.trim()) try { body = JSON.parse(text) ?? {}; } catch { return problem('not_json', 400); }
  }
  const name = body.name == null ? '' : String(body.name).trim();
  if (name.length > MAX_NAME || /[\u0000-\u001f\u007f]/.test(name)) return problem('name', 400);
  const address = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (env.TOKEN_LIMIT) {
    const { success } = await env.TOKEN_LIMIT.limit({ key: address });
    if (!success) return problem('too_many', 429, { 'retry-after': '60' });
  }
  // Today's count for this address, by a salted hash of it: the address itself is never kept, and the row goes tomorrow.
  const day = now.toISOString().slice(0, 10);
  const [, issued] = await env.DB.batch([
    env.DB.prepare('DELETE FROM token_issues WHERE day < ?').bind(day),
    env.DB.prepare(`INSERT INTO token_issues (address, day, count) VALUES (?1, ?2, 1)
      ON CONFLICT (address, day) DO UPDATE SET count = count + 1 WHERE count < ?3 RETURNING count`)
      .bind(await sha256(`${env.ADDRESS_SALT ?? ''}|${day}|${address}`), day, DAILY_TOKENS),
  ]);
  if (!issued.results?.length) return problem('too_many_today', 429);
  const token = newToken();
  await env.DB.prepare('INSERT INTO api_tokens (id, hash, prefix, name, monthly_limit, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), await sha256(token), shownAs(token), name || null, FREE_MONTHLY_CALLS, now.toISOString()).run();
  return json({ token, shown_as: shownAs(token), name: name || null, monthly_limit: FREE_MONTHLY_CALLS }, 201);
}

/** GET /api/v1/usage: the token's calls this month. Free: it doesn't count. */
async function usage(row, env, now) {
  const month = monthOf(now);
  const used = (await env.DB.prepare('SELECT calls FROM api_usage WHERE token_id = ? AND month = ?').bind(row.id, month).first())?.calls ?? 0;
  const limit = row.monthly_limit ?? null;
  return json({
    token: { shown_as: row.prefix, name: row.name ?? null, created: row.created_at },
    month, used, monthly_limit: limit, remaining: limit === null ? null : Math.max(0, limit - used), resets: resetOf(now),
  });
}

/** Answers `/api/v1/…` and the older list address (`/api/avatars.json`, now behind a token like the rest). */
export async function handleApi(request, env, now = new Date()) {
  const url = new URL(request.url);
  const path = url.pathname === `/api${LIST}` ? '/v1/avatars' : url.pathname.replace(/^\/api/, '').replace(/\/+$/, '');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!env.DB) return problem('closed', 503);

  if (path === '/v1/tokens') return request.method === 'POST' ? createToken(request, env, now) : problem('method', 405, { allow: 'POST' });

  const { row, failed } = await tokenOf(request, env);
  if (failed) return failed;
  if (path === '/v1/usage') return request.method === 'GET' ? usage(row, env, now) : problem('method', 405, { allow: 'GET' });
  if (path === '/v1/tokens/current') {
    if (request.method !== 'DELETE') return problem('method', 405, { allow: 'DELETE' });
    await env.DB.prepare('UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').bind(now.toISOString(), row.id).run();
    return json({ revoked: true });
  }

  const one = /^\/v1\/avatars\/([^/]+)$/.exec(path);
  if (path !== '/v1/categories' && path !== '/v1/avatars' && !one) return problem('not_found', 404);
  if (request.method !== 'GET') return problem('method', 405, { allow: 'GET' });
  const counted = await count(row, env, now);
  if (counted.failed) return counted.failed;
  const list = await catalogue(env, url.origin);
  if (path === '/v1/categories') return json(categories(list), 200, counted.headers);
  if (one) {
    const found = await avatar(list, decodeURIComponent(one[1]), env, url.origin);
    return found ? json(found, 200, counted.headers) : problem('not_found', 404, counted.headers);
  }
  const listed = avatars(list, url.searchParams);
  return listed.failed ? problem(listed.failed, 400, counted.headers) : json(listed.body, 200, counted.headers);
}

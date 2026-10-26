// The API (src/api.js) and the tokens script, on a real SQLite database with the gallery's migrations, so the
// counting statements run as D1 runs them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { catalogOf } from '../src/catalog.js';
import { CATEGORIES } from '../src/categories.js';
import { DAILY_TOKENS, FREE_MONTHLY_CALLS, forgetCatalogue, handleApi, resetOf, sha256 } from '../src/api.js';
import { developersPage } from '../src/pages.js';
import { listOf } from '../build.mjs';
import { tokens } from '../scripts/tokens.mjs';
import worker from '../src/worker.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://gallery.test';
const examples = path.join(here, '..', '..', 'examples');
const files = fs.readdirSync(examples).filter(n => n.endsWith('.openavatar')).sort()
  .map(fileName => ({ fileName, text: fs.readFileSync(path.join(examples, fileName), 'utf8') }));
const entries = catalogOf(files);
const listText = JSON.stringify(listOf(entries, ORIGIN));

/** D1's statement API over node:sqlite, with the gallery's migrations applied. */
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const dir = path.join(here, '..', 'migrations');
  for (const name of fs.readdirSync(dir).sort()) db.exec(fs.readFileSync(path.join(dir, name), 'utf8'));
  const statement = (query, params = []) => ({
    bind: (...values) => statement(query, values),
    first: async () => db.prepare(query).all(...params)[0] ?? null,
    all: async () => ({ results: db.prepare(query).all(...params) }),
    run: async () => ({ success: true, meta: { changes: Number(db.prepare(query).run(...params).changes) } }),
  });
  return {
    db,
    prepare: query => statement(query),
    batch: async statements => { const out = []; for (const s of statements) out.push(await s.all()); return out; },
  };
}

const assets = { fetch: async request => {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/avatars.json') return new Response(listText, { headers: { 'content-type': 'application/json' } });
  const file = /^\/avatars\/(.+)\.openavatar$/.exec(pathname);
  const entry = file && entries.find(e => e.slug === file[1]);
  if (entry) return new Response(files.find(f => catalogOf([f])[0].id === entry.id).text);
  return new Response('Not found', { status: 404 });
} };

function setup({ limiter = () => true } = {}) {
  forgetCatalogue();
  const DB = database();
  const env = { ASSETS: assets, DB, ADDRESS_SALT: 'salt', TOKEN_LIMIT: { limit: async ({ key }) => ({ success: limiter(key) }) } };
  const at = (now = new Date('2026-10-26T12:00:00Z')) => ({
    get: (p, token) => handleApi(new Request(`${ORIGIN}${p}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }), env, now),
    del: (p, token) => handleApi(new Request(`${ORIGIN}${p}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }), env, now),
    make: (body = {}, headers = {}) => handleApi(new Request(`${ORIGIN}/api/v1/tokens`, {
      method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7', ...headers },
    }), env, now),
  });
  return { env, DB, ...at(), at };
}

test('every gallery avatar is in a category the API names', () => {
  const ids = new Set([...CATEGORIES.map(c => c.id), 'other']);
  for (const e of entries) assert.ok(ids.has(e.category), `${e.slug} is in ${e.category}`);
  assert.equal(entries.find(e => e.slug === 'halo').category, 'abstract');
  assert.equal(entries.find(e => e.slug === 'ember').category, 'creatures', 'a plush fox is a creature first');
  assert.equal(entries.find(e => e.slug === 'matcha').category, 'plush');
  assert.equal(entries.find(e => e.slug === 'teapot').category, 'objects');
});

test('a token is made once, shown once and kept only as its hash', async () => {
  const { make, DB } = setup();
  const made = await make({ name: 'My app' });
  assert.equal(made.status, 201);
  const body = await made.json();
  assert.match(body.token, /^oa_[A-Za-z0-9_-]{32}$/);
  assert.equal(body.shown_as, `${body.token.slice(0, 10)}…`);
  assert.equal(body.monthly_limit, FREE_MONTHLY_CALLS);
  const [row] = DB.db.prepare('SELECT * FROM api_tokens').all();
  assert.equal(row.hash, await sha256(body.token));
  assert.equal(row.name, 'My app');
  assert.ok(!JSON.stringify(row).includes(body.token), 'the token itself is not stored');
  const other = await (await make()).json();
  assert.notEqual(other.token, body.token);
  assert.equal(other.name, null);
});

test('a token can\'t be made from another site, with a bad name, or too often', async () => {
  let minute = 0;
  const { make } = setup({ limiter: () => ++minute <= 3 });
  assert.equal((await make({}, { origin: 'https://elsewhere.test' })).status, 403);
  assert.equal((await make({}, { origin: ORIGIN })).status, 201, 'the gallery\'s own page');
  assert.equal((await make({ name: 'x'.repeat(61) })).status, 400);
  assert.equal((await make({ name: 'two\nlines' })).status, 400);
  assert.equal((await make('{nope')).status, 400);
  assert.equal((await make('name=x', { 'content-type': 'application/x-www-form-urlencoded' })).status, 415);
  minute = 0;
  const one = setup();
  for (let i = 0; i < DAILY_TOKENS; i++) assert.equal((await one.make()).status, 201);
  const refused = await one.make();
  assert.equal(refused.status, 429);
  assert.equal((await refused.json()).error, 'too_many_today');
  assert.equal((await one.make({}, { 'cf-connecting-ip': '198.51.100.2' })).status, 201, 'another address');
  assert.equal((await one.at(new Date('2026-10-27T00:00:01Z')).make()).status, 201, 'the next day');
  assert.equal(one.DB.db.prepare('SELECT COUNT(*) AS n FROM token_issues WHERE day < ?').get('2026-10-27').n, 0, 'yesterday is forgotten');
  assert.ok(!JSON.stringify(one.DB.db.prepare('SELECT * FROM token_issues').all()).includes('203.0.113.7'), 'the address is not kept');
  // The minute limit.
  minute = 0;
  const busy = setup({ limiter: () => ++minute <= 3 });
  for (let i = 0; i < 3; i++) assert.equal((await busy.make()).status, 201);
  assert.equal((await busy.make()).status, 429);
});

test('the data calls need a token and answer the gallery', async () => {
  const { make, get } = setup();
  const missing = await get('/api/v1/avatars');
  assert.equal(missing.status, 401);
  assert.equal((await missing.json()).error, 'token_required');
  assert.match(missing.headers.get('www-authenticate'), /^Bearer/);
  assert.equal((await (await get('/api/v1/avatars', 'oa_nonsense')).json()).error, 'token_invalid');
  assert.equal((await get('/api/avatars.json')).status, 401, 'the older list address needs one too');

  const { token } = await (await make()).json();
  const categories = await get('/api/v1/categories', token);
  assert.equal(categories.status, 200);
  assert.equal(categories.headers.get('access-control-allow-origin'), '*');
  const { categories: list } = await categories.json();
  assert.deepEqual(list.map(c => c.id), CATEGORIES.map(c => c.id), 'Other only when something is in it');
  assert.equal(list.reduce((n, c) => n + c.count, 0), entries.length);

  const all = await (await get('/api/v1/avatars', token)).json();
  assert.equal(all.total, entries.length);
  assert.equal(all.avatars[0].file, `${ORIGIN}/avatars/${all.avatars[0].slug}.openavatar`);
  assert.ok(all.avatars.every(a => a.category && a.picture && a.page));
  const plush = await (await get('/api/v1/avatars?category=plush', token)).json();
  assert.ok(plush.total > 0 && plush.avatars.every(a => a.category === 'plush'));
  assert.deepEqual((await (await get('/api/v1/avatars?q=TEAPOT', token)).json()).avatars.map(a => a.slug), ['teapot']);
  assert.ok((await (await get('/api/v1/avatars?tag=felt', token)).json()).avatars.every(a => a.tags.includes('felt')));
  const page = await (await get('/api/v1/avatars?limit=5&offset=20', token)).json();
  assert.equal(page.avatars.length, Math.min(5, entries.length - 20));
  assert.equal(page.avatars[0].slug, all.avatars[20].slug);
  assert.equal((await (await get('/api/v1/avatars?category=nope', token)).json()).error, 'category');
  const legacy = await (await get('/api/avatars.json', token)).json();
  assert.equal(legacy.avatars.length, entries.length);

  const teapot = await get('/api/v1/avatars/teapot', token);
  assert.equal(teapot.status, 200);
  const one = await teapot.json();
  assert.equal(one.slug, 'teapot');
  assert.equal(one.document.openavatar, '0.1');
  assert.equal(one.document.id, one.id);
  assert.equal((await get('/api/v1/avatars/no-such', token)).status, 404);
  assert.equal((await get('/api/v1/avatars/..%2Fsecret', token)).status, 404);
  assert.equal((await get('/api/v1/whatever', token)).status, 404);
});

test('a free token has its calls a month, and the next month starts again', async () => {
  const { make, get, at, DB } = setup();
  const { token } = await (await make()).json();
  DB.db.prepare('UPDATE api_tokens SET monthly_limit = 3').run();
  const first = await get('/api/v1/categories', token);
  assert.equal(first.headers.get('openavatar-quota-limit'), '3');
  assert.equal(first.headers.get('openavatar-quota-remaining'), '2');
  assert.equal(first.headers.get('openavatar-quota-reset'), '2026-11-01T00:00:00Z');
  await get('/api/v1/avatars', token);
  assert.equal((await get('/api/v1/avatars/teapot', token)).headers.get('openavatar-quota-remaining'), '0');
  const over = await get('/api/v1/avatars', token);
  assert.equal(over.status, 429);
  assert.equal((await over.json()).error, 'quota_exceeded');
  assert.equal(over.headers.get('retry-after'), String(Math.ceil((Date.parse('2026-11-01T00:00:00Z') - Date.parse('2026-10-26T12:00:00Z')) / 1000)));

  const used = await (await get('/api/v1/usage', token)).json();
  assert.deepEqual({ used: used.used, limit: used.monthly_limit, remaining: used.remaining, month: used.month, resets: used.resets },
    { used: 3, limit: 3, remaining: 0, month: '2026-10', resets: '2026-11-01T00:00:00Z' }, 'refused calls and checks are not counted');
  assert.equal((await get('/api/v1/usage', token)).headers.get('openavatar-quota-remaining'), null);

  const november = at(new Date('2026-11-01T00:00:00Z'));
  assert.equal((await november.get('/api/v1/avatars', token)).headers.get('openavatar-quota-remaining'), '2');
  assert.equal(resetOf(new Date('2026-12-31T23:59:59Z')), '2027-01-01T00:00:00Z');
});

test('two calls at once can\'t both take the last one', async () => {
  const { make, get, DB } = setup();
  const { token } = await (await make()).json();
  DB.db.prepare('UPDATE api_tokens SET monthly_limit = 5').run();
  const answers = await Promise.all(Array.from({ length: 12 }, () => get('/api/v1/categories', token)));
  assert.equal(answers.filter(r => r.status === 200).length, 5);
  assert.equal(answers.filter(r => r.status === 429).length, 7);
});

test('a token without a limit is never cut off, and a revoked token stops at once', async () => {
  const { make, get, del, DB } = setup();
  const { token } = await (await make()).json();
  DB.db.prepare('UPDATE api_tokens SET monthly_limit = NULL').run();
  DB.db.prepare("INSERT INTO api_usage (token_id, month, calls) SELECT id, '2026-10', 1000000 FROM api_tokens").run();
  const answer = await get('/api/v1/avatars', token);
  assert.equal(answer.status, 200);
  assert.equal(answer.headers.get('openavatar-quota-limit'), 'unlimited');
  assert.equal(answer.headers.get('openavatar-quota-remaining'), null);
  const used = await (await get('/api/v1/usage', token)).json();
  assert.equal(used.used, 1000001);
  assert.equal(used.monthly_limit, null);
  assert.equal(used.remaining, null);

  assert.equal((await del('/api/v1/tokens/current', token)).status, 200);
  assert.equal((await (await get('/api/v1/avatars', token)).json()).error, 'token_invalid');
});

test('the API answers browsers from any site, and says so before they ask', async () => {
  const { env } = setup();
  const preflight = await worker.fetch(new Request(`${ORIGIN}/api/v1/avatars`, { method: 'OPTIONS' }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  assert.match(preflight.headers.get('access-control-allow-headers'), /authorization/);
  assert.match(preflight.headers.get('access-control-expose-headers'), /OpenAvatar-Quota-Remaining/);
  assert.equal((await worker.fetch(new Request(`${ORIGIN}/api/v1/avatars`), { ...env, DB: undefined })).status, 503);
  assert.equal((await worker.fetch(new Request(`${ORIGIN}/api/v1/categories`, { method: 'POST' }), env)).status, 401, 'a token first');
});

test('the API page offers a token and lists every call', () => {
  const page = developersPage({ origin: ORIGIN, limit: FREE_MONTHLY_CALLS });
  assert.match(page, /1,000 calls a month/);
  assert.match(page, /<form class="token-form"/);
  for (const call of ['GET /api/v1/categories', 'GET /api/v1/avatars', 'GET /api/v1/avatars/{slug}', 'GET /api/v1/usage', 'DELETE /api/v1/tokens/current', 'POST /api/v1/tokens']) {
    assert.ok(page.includes(`<code>${call}</code>`), call);
  }
  assert.match(page, /href="\/developers\/" aria-current="page">API</);
});

test('the tokens script makes, lists and revokes tokens, and writes a new one only where it is told', async () => {
  const { DB } = setup();
  const run = async query => DB.db.prepare(query).all();
  const said = [], written = new Map();
  const deps = { run, out: t => said.push(t), write: (file, text) => written.set(file, text) };
  assert.equal(await tokens(['create', '--name', 'Enconvo', '--unlimited'], deps), 0);
  assert.match(said.pop(), /Would make a token named "Enconvo" with no limit/);
  assert.equal(DB.db.prepare('SELECT COUNT(*) AS n FROM api_tokens').get().n, 0, 'a dry run');
  assert.equal(await tokens(['create', '--name', 'Enconvo', '--unlimited', '--out', 'token.txt', '--yes'], deps), 0);
  const token = written.get('token.txt').trim();
  assert.match(token, /^oa_/);
  assert.ok(!said.join('\n').includes(token), 'the token is not printed');
  const [row] = DB.db.prepare('SELECT * FROM api_tokens').all();
  assert.equal(row.monthly_limit, null);
  assert.equal(row.hash, await sha256(token));
  assert.equal(await tokens(['create', '--name', 'Free', '--yes'], deps), 0);
  assert.match(said.pop(), /1,000 a month\)\. It is shown this once:\noa_/);
  assert.equal(await tokens(['create', '--name', 'x', '--limit', '0'], deps), 2);
  assert.equal(await tokens(['create'], deps), 2);

  assert.equal(await tokens(['list'], deps), 0);
  assert.match(said.at(-2), /oa_.{7}… {2}0 calls this month, no limit {2}Enconvo/);
  assert.equal(await tokens(['revoke', row.prefix], deps), 0);
  assert.match(said.pop(), /Would revoke/);
  assert.equal(await tokens(['revoke', row.id.slice(0, 8), '--yes'], deps), 0);
  assert.ok(DB.db.prepare('SELECT revoked_at FROM api_tokens WHERE id = ?').get(row.id).revoked_at);
  assert.equal(await tokens(['revoke', 'nothing'], deps), 1);
});

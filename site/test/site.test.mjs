// The gallery's catalogue, pages, list and Worker, without a browser or a build.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { catalogOf, entryFor, slugOf, tagCounts, TEXT } from '../src/catalog.js';
import { ACTIVITIES, EXPRESSIONS, MOTIONS, STATES, USER_ACTIVITIES } from 'openavatar';
import { avatarPage, enconvoLink, homePage, makePage, notFoundPage, specPage, submitPage, TRY } from '../src/pages.js';
import { headingId, renderSpec, SPEC_LINKS } from '../src/spec.js';
import { checkSubmission, LICENSES } from '../web/submission.js';
import { listOf } from '../build.mjs';
import worker from '../src/worker.js';

const examples = new URL('../../examples/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, examples), 'utf8');
const matchaText = read('matcha.openavatar');
const withMeta = (text, change) => {
  const doc = JSON.parse(text);
  change(doc);
  return JSON.stringify(doc);
};
const hostile = withMeta(matchaText, d => {
  d.name = '</script><img src=x onerror=alert(1)>';
  d.meta.description = '"><b>bold</b>';
  d.meta.tags = ['<i>tag</i>'];
  d.meta.authors = [{ name: "O'Brien & <Co>" }];
});

test('slugs are URL safe', () => {
  assert.equal(slugOf('Matcha.openavatar'), 'matcha');
  assert.equal(slugOf('Café  Bot_2.OPENAVATAR'), 'cafe-bot-2');
  assert.equal(slugOf('../../etc/passwd.openavatar'), 'etcpasswd');
  assert.equal(slugOf('???.openavatar'), 'avatar');
  assert.ok(slugOf(`${'a'.repeat(80)}.openavatar`).length <= 48);
});

test('an entry carries what a card shows, and its text only for the build', () => {
  const entry = entryFor('matcha.openavatar', matchaText);
  assert.equal(entry.slug, 'matcha');
  assert.equal(entry.name, 'Matcha');
  assert.deepEqual(entry.authors, ['Enconvo']);
  assert.equal(entry.license, 'CC-BY-4.0');
  assert.equal(entry.rig, 'biped');
  assert.equal(entry.bytes, Buffer.byteLength(matchaText));
  assert.match(entry.revision, /^[0-9a-f]{12}$/);
  assert.equal(entry[TEXT], matchaText);
  assert.ok(!JSON.stringify(entry).includes('"materials"'), 'the document text stays out of JSON');
  assert.notEqual(entryFor('matcha.openavatar', `${matchaText}\n`).revision, entry.revision);
});

test('a file that is not a document is refused', () => {
  assert.throws(() => entryFor('broken.openavatar', '{"openavatar":"0.1"'));
});

test('the catalogue sorts by name and keeps slugs unique', () => {
  const entries = catalogOf([
    { fileName: 'sugar.openavatar', text: read('sugar.openavatar') },
    { fileName: 'matcha.openavatar', text: matchaText },
    { fileName: 'Matcha.openavatar', text: withMeta(matchaText, d => { d.name = 'Matcha Two'; }) },
  ]);
  assert.deepEqual(entries.map(e => e.name), ['Matcha', 'Matcha Two', 'Sugar']);
  assert.deepEqual(entries.map(e => e.slug), ['matcha', 'matcha-2', 'sugar']);
  assert.equal(entries[1][TEXT].includes('Matcha Two'), true, 'a renamed entry keeps its own text');
});

test('tag filters skip tags on one avatar and tags on most of them', () => {
  const e = tags => ({ tags });
  const entries = [e(['felt', 'food']), e(['felt', 'food']), e(['felt', 'sea']), e(['felt']), e(['robot'])];
  assert.deepEqual(tagCounts(entries), [['food', 2]]);
});

test('pages escape what documents say', () => {
  const entry = entryFor('x.openavatar', hostile);
  const home = homePage([entry]);
  const page = avatarPage(entry, { origin: 'https://gallery.test' });
  for (const html of [home, page]) {
    assert.ok(!html.includes('<img src=x'), 'no markup from a name');
    assert.ok(!html.includes('<b>bold</b>'), 'no markup from a description');
    assert.ok(!html.includes('<i>tag</i>'), 'no markup from a tag');
  }
  // The catalogue's JSON can't close its <script> element.
  const json = home.slice(home.indexOf('id="catalog">'), home.indexOf('<script type="module"'));
  assert.equal((json.match(/<\/script>/g) ?? []).length, 1);
  assert.ok(home.includes('O&#39;Brien &amp; &lt;Co&gt;'));
});

test('an avatar page links to its file and installs it in Enconvo', () => {
  const entry = entryFor('matcha.openavatar', matchaText);
  const page = avatarPage(entry, { origin: 'https://gallery.test' });
  assert.equal(enconvoLink('https://gallery.test/avatars/matcha.openavatar'),
    'enconvo://avatar/install?url=https%3A%2F%2Fgallery.test%2Favatars%2Fmatcha.openavatar');
  assert.ok(page.includes('href="enconvo://avatar/install?url=https%3A%2F%2Fgallery.test%2Favatars%2Fmatcha.openavatar"'));
  assert.ok(page.includes('href="/avatars/matcha.openavatar" download="matcha.openavatar"'));
  assert.ok(page.includes('<title>Matcha, an OpenAvatar</title>'));
  assert.ok(notFoundPage().includes('<title>Not in the OpenAvatar gallery</title>'));
});

test('an avatar page offers the spec host inputs, all of each kind it lists', () => {
  const ids = list => list.map(([id]) => id);
  assert.deepEqual(ids(TRY.state), STATES);
  assert.deepEqual(ids(TRY.activity), ['', ...ACTIVITIES]);
  assert.deepEqual(ids(TRY.userActivity), ['', ...USER_ACTIVITIES]);
  for (const [id] of TRY.expression) assert.ok(EXPRESSIONS.includes(id), id);
  for (const [id] of TRY.motion) assert.ok(MOTIONS.includes(id), id);

  const page = avatarPage(entryFor('matcha.openavatar', matchaText), { origin: 'https://gallery.test' });
  for (const [name, list] of [['state', TRY.state], ['activity', TRY.activity], ['userActivity', TRY.userActivity]]) {
    assert.equal((page.match(new RegExp(`name="${name}"`, 'g')) ?? []).length, list.length);
    assert.equal((page.match(new RegExp(`name="${name}" value="[^"]*" checked`, 'g')) ?? []).length, 1, `one ${name} is chosen`);
  }
  assert.ok(page.includes('<section class="try" aria-labelledby="try-title" hidden>'), 'hidden until the avatar is live');
  assert.ok(page.includes('<script type="module" src="/avatar.js"></script>'));
});

test('the list gives each avatar its file, picture and page', () => {
  const [entry] = catalogOf([{ fileName: 'matcha.openavatar', text: matchaText }]);
  const list = JSON.parse(JSON.stringify(listOf([entry], 'https://gallery.test')));
  assert.equal(list.openavatar, '0.1');
  assert.equal(list.avatars[0].file, 'https://gallery.test/avatars/matcha.openavatar');
  assert.equal(list.avatars[0].picture, 'https://gallery.test/avatars/matcha.webp');
  assert.equal(list.avatars[0].page, 'https://gallery.test/a/matcha/');
  assert.equal(list.avatars[0].name, 'Matcha');
});

test('the Worker labels avatar files and opens them and the list to other sites', async () => {
  const assets = { fetch: async request => {
    const { pathname } = new URL(request.url);
    if (pathname === '/missing.openavatar') return new Response('Not found', { status: 404, headers: { 'content-type': 'text/html' } });
    return new Response('x', { headers: { 'content-type': pathname.endsWith('.json') ? 'application/json' : 'application/octet-stream' } });
  } };
  const get = path => worker.fetch(new Request(`https://gallery.test${path}`), { ASSETS: assets });

  const file = await get('/avatars/matcha.openavatar');
  assert.equal(file.headers.get('content-type'), 'application/vnd.openavatar+json; charset=utf-8');
  assert.equal(file.headers.get('access-control-allow-origin'), '*');
  assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await file.text(), 'x');

  const list = await get('/api/avatars.json');
  assert.equal(list.headers.get('content-type'), 'application/json');
  assert.equal(list.headers.get('access-control-allow-origin'), '*');

  const page = await get('/a/matcha/');
  assert.equal(page.headers.get('access-control-allow-origin'), null);

  const missing = await get('/missing.openavatar');
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('content-type'), 'text/html');
});

test('the spec page keeps the spec\'s own links working', () => {
  const markdown = fs.readFileSync(new URL('../../spec/SPEC.md', import.meta.url), 'utf8');
  const spec = renderSpec(markdown);
  assert.equal(spec.title, 'OpenAvatar 0.1');
  assert.deepEqual(spec.meta.map(([name]) => name), ['Status', 'Editors', 'License', 'Schema', 'Vocabulary']);
  assert.ok(!spec.body.includes('<h2 id="contents">'), 'the page draws its own contents');
  // Every section the spec's contents list links to has that id on the page.
  const ids = new Set([...spec.body.matchAll(/ id="([^"]+)"/g)].map(m => m[1]));
  const listed = [...markdown.matchAll(/\]\(#([^)]+)\)/g)].map(m => m[1]);
  assert.ok(listed.length >= 18);
  for (const id of listed) assert.ok(ids.has(id), id);
  assert.deepEqual(spec.sections.slice(0, 2).map(s => s.id), ['1-conventions', '2-concepts']);
  // Files beside the spec point at the site's copies; nothing relative is left.
  for (const [from, to] of Object.entries(SPEC_LINKS)) {
    assert.ok(!spec.body.includes(`href="${from}"`) && !spec.meta.some(([, v]) => v.includes(`href="${from}"`)), from);
    assert.ok(spec.body.includes(`href="${to}"`) || spec.meta.some(([, v]) => v.includes(`href="${to}"`)), to);
  }
  assert.ok(!/href="(?!https?:|#|\/)[^"]*"/.test(spec.body), 'no relative link left');
  assert.ok(spec.body.includes('<div class="table-scroll"><table>'));
  assert.ok(specPage(spec).includes('<a href="/spec/" aria-current="page">Spec</a>'));
});

test('headings get the ids GitHub gives them', () => {
  assert.equal(headingId('14.3 Galleries (informative)'), '143-galleries-informative');
  assert.equal(headingId('12. The host interface'), '12-the-host-interface');
  assert.equal(headingId('Change log'), 'change-log');
});

test('the Make page points agents at the skill on this site', () => {
  const page = makePage({ origin: 'https://gallery.test', sheet: { src: '/pictures/sheet.webp?v=1', name: 'Matcha', width: 960, height: 792 } });
  assert.ok(page.includes('<code>https://gallery.test/skill/SKILL.md</code>'));
  assert.ok(page.includes('href="/skill/reference.md"'));
  assert.ok(page.includes('src="/pictures/sheet.webp?v=1"'));
  assert.ok(page.includes('<a href="/make/" aria-current="page">Make one</a>'));
  assert.ok(!makePage({ origin: 'https://gallery.test', sheet: null }).includes('make-sheet'), 'no sheet, no figure');
});

const sendable = (change = () => {}) => {
  const doc = JSON.parse(matchaText);
  change(doc);
  return { document: JSON.stringify(doc), author: 'Ann', license: 'CC-BY-4.0', consent: true };
};

test('a submission is a valid document, a short credit, an offered license and consent', () => {
  const ok = checkSubmission(sendable());
  assert.equal(ok.ok, true);
  assert.equal(ok.value.name, 'Matcha');
  assert.equal(ok.value.author, 'Ann');
  assert.equal(checkSubmission({ ...sendable(), author: '  Ann  ' }).value.author, 'Ann');
  assert.equal(checkSubmission({ ...sendable(), author: '' }).ok, true, 'anonymous is fine');

  assert.equal(checkSubmission({ ...sendable(), document: '{' }).error, 'not_json');
  assert.equal(checkSubmission({ ...sendable(), document: 42 }).error, 'not_text');
  assert.equal(checkSubmission({ ...sendable(), document: `"${'x'.repeat(256 * 1024)}"` }).error, 'too_large');
  const invalid = checkSubmission(sendable(d => { delete d.name; }));
  assert.equal(invalid.error, 'invalid');
  assert.deepEqual(invalid.problems[0], { path: 'name', message: 'is required' });
  for (const author of ['a'.repeat(61), '<b>x</b>', 'two\nlines', 'zero​width', 7]) {
    assert.equal(checkSubmission({ ...sendable(), author }).error, 'author', JSON.stringify(author));
  }
  for (const license of ['MIT', '', undefined, 'toString']) assert.equal(checkSubmission({ ...sendable(), license }).error, 'license', String(license));
  for (const consent of [false, 'true', undefined]) assert.equal(checkSubmission({ ...sendable(), consent }).error, 'consent', String(consent));
});

test('the submit page offers the licenses the check accepts', () => {
  const page = submitPage({ licenses: LICENSES });
  for (const id of Object.keys(LICENSES)) assert.ok(page.includes(`name="license" value="${id}"`), id);
  assert.ok(page.includes('<script type="module" src="/submit.js"></script>'));
});

/** A D1 stand-in for the Worker's two statements, with the unique index on open submissions. */
function fakeDB() {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      return { bind: (...args) => ({
        first: async () => (sql.startsWith('SELECT') ? rows.find(r => r.avatar_id === args[0] && ['pending', 'approved'].includes(r.status)) ?? null : null),
        run: async () => {
          const [id, avatar_id, name, author, license, document, bytes, created_at] = args;
          if (rows.some(r => r.avatar_id === avatar_id && r.status !== 'declined')) throw new Error('D1_ERROR: UNIQUE constraint failed: submissions.avatar_id');
          rows.push({ id, avatar_id, name, author, license, document, bytes, status: 'pending', created_at });
        },
      }) };
    },
  };
}

test('the Worker queues a good submission once and refuses the rest', async () => {
  const DB = fakeDB();
  let sends = 0;
  const env = { ASSETS: { fetch: async () => new Response('page') }, DB, SUBMIT_LIMIT: { limit: async () => ({ success: ++sends <= 20 }) } };
  const post = (body, headers = { 'content-type': 'application/json' }) =>
    worker.fetch(new Request('https://gallery.test/api/submissions', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }), env);

  const first = await post(sendable());
  assert.equal(first.status, 201);
  const { id, status } = await first.json();
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.equal(status, 'pending');
  assert.equal(DB.rows.length, 1);
  assert.equal(DB.rows[0].author, 'Ann');
  assert.equal(DB.rows[0].document, sendable().document, 'the file is kept as sent');

  assert.equal((await post(sendable())).status, 409);
  assert.equal((await post(sendable(), { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await post('{nope')).status, 400);
  const bad = await post({ ...sendable(), consent: false });
  assert.deepEqual(await bad.json(), { error: 'consent' });
  assert.equal((await post(`{"document":"${'x'.repeat(700 * 1024)}"}`)).status, 413);
  assert.equal((await worker.fetch(new Request('https://gallery.test/api/submissions'), env)).status, 405);
  assert.equal((await worker.fetch(new Request('https://gallery.test/api/submissions', { method: 'POST' }), { ...env, DB: undefined })).status, 503);
  assert.equal(DB.rows.length, 1, 'nothing else was stored');

  sends = 100;
  assert.equal((await post(sendable(d => { d.id = '0f7b2c1e-5d4a-4b3c-8e9f-1a2b3c4d5e6f'; }))).status, 429);
});

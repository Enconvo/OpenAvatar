// The gallery's pages as HTML text. Everything that comes from a document (names, descriptions, tags, authors) is
// untrusted (SPEC 16.1) and goes through `esc`.
import { tagCounts } from './catalog.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// JSON inside a <script> element: `<` can't end it early.
const scriptJSON = value => JSON.stringify(value).replace(/</g, '\\u003c');

const FONTS = 'https://fonts.googleapis.com/css2?family=DynaPuff:wght@500;600&family=Hanken+Grotesk:wght@400;500;600&family=JetBrains+Mono&display=swap';

const IMPORT_MAP = { imports: {
  three: '/vendor/three/three.module.min.js',
  openavatar: '/vendor/openavatar/index.js',
  '@openavatar/three': '/vendor/renderer/index.js',
} };

/** The SPDX ids the gallery names in words. */
const LICENSES = { 'CC-BY-4.0': 'CC BY 4.0', 'CC0-1.0': 'CC0', 'CC-BY-SA-4.0': 'CC BY-SA 4.0', 'MIT': 'MIT', 'Apache-2.0': 'Apache 2.0' };
export const licenseName = id => LICENSES[id] ?? id;

/** Where the format's source lives. */
export const REPO = 'https://github.com/Enconvo/OpenAvatar';

/** The link that installs an avatar in Enconvo (SPEC 14.3). */
export const enconvoLink = fileUrl => `enconvo://avatar/install?url=${encodeURIComponent(fileUrl)}`;

function layout({ title, description, body, scripts = '', page = '' }) {
  const here = name => (name === page ? ' aria-current="page"' : '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/styles.css">
<script type="importmap">${JSON.stringify(IMPORT_MAP)}</script>
</head>
<body>
<header class="masthead">
  <a class="wordmark" href="/">OpenAvatar</a>
  <nav aria-label="Site">
    <a href="/#gallery"${here('gallery')}>Gallery</a>
    <a href="/make/"${here('make')}>Make one</a>
    <a href="/spec/"${here('spec')}>Spec</a>
  </nav>
</header>
${body}
<footer class="colophon">
  <p>OpenAvatar is an open format. The <a href="/spec/">spec</a> is CC BY 4.0, the <a href="${REPO}">code</a> Apache 2.0, and every avatar names its own license.</p>
</footer>
${scripts}
</body>
</html>
`;
}

function card(entry) {
  const by = entry.authors.length ? `by ${entry.authors.join(', ')}` : 'Maker not stated';
  return `<li class="patch" data-slug="${esc(entry.slug)}" data-name="${esc(entry.name.toLowerCase())}" data-tags="${esc(entry.tags.join(' '))}">
  <a class="patch-link" href="/a/${esc(entry.slug)}/">
    <img class="patch-picture" src="/avatars/${esc(entry.slug)}.webp?v=${esc(entry.revision)}" alt="" width="512" height="512" loading="lazy" decoding="async">
    <span class="patch-name">${esc(entry.name)}</span>
  </a>
  <p class="patch-description">${esc(entry.description)}</p>
  <p class="patch-credit"><span>${esc(by)}</span><span>${esc(licenseName(entry.license))}</span></p>
</li>`;
}

/** The home page: the live host, then the gallery and how to use the avatars. */
export function homePage(entries, { hero = 'matcha' } = {}) {
  const host = entries.find(e => e.slug === hero) ?? entries[0];
  const tags = tagCounts(entries);
  const body = `<main>
<section class="hero" aria-labelledby="hero-title">
  <div class="hero-text">
    <h1 id="hero-title">A face for your AI agent, in one small file.</h1>
    <p class="lede">OpenAvatar is an open format for 3D characters that react while an agent listens, thinks and talks, and while you work beside it. Pick one here, or describe your own and let AI build it.</p>
    <p class="hero-actions">
      <a class="button button-primary" href="#gallery">Browse avatars</a>
      <a class="button" href="/make/">Make your own</a>
    </p>
  </div>
  <figure class="stage" data-host="${esc(host.slug)}">
    <img class="stage-still" src="/avatars/${esc(host.slug)}.webp?v=${esc(host.revision)}" alt="${esc(`${host.name}. ${host.description}`)}" width="512" height="512">
    <canvas class="stage-canvas" aria-hidden="true"></canvas>
    <figcaption class="stage-status" aria-live="polite">${esc(host.name)} is waiting for you</figcaption>
    <button class="stage-next" type="button">Show another</button>
  </figure>
</section>

<section class="gallery" id="gallery" aria-labelledby="gallery-title">
  <div class="gallery-head">
    <h2 id="gallery-title">Gallery</h2>
    <p class="gallery-count" aria-live="polite"><span data-count>${entries.length}</span> avatars</p>
    <a class="gallery-add" href="/submit/">Add yours</a>
    <label class="search">
      <span class="visually-hidden">Search avatars</span>
      <input type="search" placeholder="Search by name, look or tag" autocomplete="off" spellcheck="false">
    </label>
  </div>
  ${tags.length >= 2 ? `<div class="filters" role="group" aria-label="Show">
    <button type="button" class="chip" aria-pressed="true" data-tag="">All</button>
    ${tags.map(([tag, n]) => `<button type="button" class="chip" aria-pressed="false" data-tag="${esc(tag)}">${esc(tag)} <span class="chip-count">${n}</span></button>`).join('\n    ')}
  </div>` : ''}
  <ul class="patches">
${entries.map(card).join('\n')}
  </ul>
  <p class="gallery-empty" hidden>No avatar matches that. Try a color, a shape or a tag.</p>
</section>

<section class="use" id="use" aria-labelledby="use-title">
  <h2 id="use-title">Use them in your app</h2>
  <div class="use-columns">
    <div class="use-text">
      <p>An avatar is one <code>.openavatar</code> file: JSON, at most 256 KB, with no code inside. Any app that reads the format shows the same character.</p>
      <p>In Enconvo, open an avatar's page and choose Open in Enconvo. Files in <code>~/.openavatar/avatars/</code> show up in every OpenAvatar app on the computer.</p>
      <p>To show one in your own app, load it into the reference renderer for three.js and tell it what your agent is doing. <a href="/spec/#12-the-host-interface">SPEC 12</a> lists what an app can send, and <a href="/spec/#17-conformance">SPEC 17</a> what it must do.</p>
    </div>
    <pre class="code"><code>import { OpenAvatarStage } from '@openavatar/three';

const stage = new OpenAvatarStage(canvas);
stage.load(avatar);   // a parsed .openavatar file
stage.start();
stage.setInput({ state: 'speaking', voice: 0.6 });</code></pre>
  </div>
</section>
</main>`;
  return layout({
    title: 'OpenAvatar: open avatars for AI agents',
    description: 'A gallery of open 3D avatars that react while an AI agent listens, thinks and talks. One small file each, free to use in any app.',
    body,
    page: 'gallery',
    scripts: `<script type="application/json" id="catalog">${scriptJSON(entries)}</script>\n<script type="module" src="/app.js"></script>`,
  });
}

/** What the avatar page lets someone try: the host inputs of SPEC 12.1 and 12.2, named in words. Each id is in the
 * spec's vocabulary (a test checks). */
export const TRY = {
  state: [['idle', 'Idle'], ['listening', 'Listening'], ['thinking', 'Thinking'], ['speaking', 'Speaking']],
  activity: [['', 'None'], ['searching', 'Searching'], ['working', 'Working'], ['waiting', 'Waiting'],
    ['error', 'Hit an error'], ['done', 'Done'], ['sleeping', 'Sleeping']],
  userActivity: [['', 'None'], ['coding', 'Coding'], ['writing', 'Writing'], ['reading', 'Reading'], ['browsing', 'Browsing'],
    ['designing', 'Designing'], ['form-filling', 'Filling in a form'], ['chatting', 'Chatting'], ['meeting', 'In a meeting'],
    ['watching', 'Watching a video'], ['listening-music', 'Listening to music'], ['gaming', 'Gaming'], ['away', 'Away']],
  expression: [['happy', 'Happy'], ['surprised', 'Surprised'], ['sad', 'Sad'], ['love', 'Love'], ['laugh', 'Laugh']],
  motion: [['wave', 'Wave'], ['nod', 'Nod'], ['hop', 'Hop'], ['dance', 'Dance'], ['celebrate', 'Celebrate']],
};

function choices(input, legend, options) {
  const items = options.map(([id, label], i) => `<label class="choice"><input type="radio" name="${input}" value="${esc(id)}"${i ? '' : ' checked'}><span>${esc(label)}</span></label>`);
  return `<fieldset class="try-group"><legend>${esc(legend)}</legend><div class="choices">${items.join('')}</div></fieldset>`;
}

function once(kind, options) {
  return options.map(([id, label]) => `<button type="button" class="chip" data-${kind}="${esc(id)}">${esc(label)}</button>`).join('');
}

/** One avatar's page: the avatar live (its picture without WebGL), what it is, how to get it, and how it reacts. */
export function avatarPage(entry, { origin }) {
  const fileUrl = `${origin}/avatars/${entry.slug}.openavatar`;
  const by = entry.authors.length ? `by ${entry.authors.join(', ')}` : 'Maker not stated';
  const body = `<main class="avatar">
  <figure class="stage avatar-stage">
    <img class="stage-still" src="/avatars/${esc(entry.slug)}.webp?v=${esc(entry.revision)}" alt="${esc(`${entry.name}. ${entry.description}`)}" width="512" height="512">
    <canvas class="stage-canvas" aria-hidden="true"></canvas>
    <figcaption class="stage-status" aria-live="polite" hidden></figcaption>
  </figure>
  <div class="avatar-text">
    <h1>${esc(entry.name)}</h1>
    <p class="lede">${esc(entry.description)}</p>
    <p class="avatar-credit"><span>${esc(by)}</span><span>${esc(licenseName(entry.license))}</span><span>${Math.max(1, Math.round(entry.bytes / 1024))} KB</span></p>
    <p class="hero-actions">
      <a class="button button-primary" href="${esc(enconvoLink(fileUrl))}">Open in Enconvo</a>
      <a class="button" href="/avatars/${esc(entry.slug)}.openavatar" download="${esc(entry.slug)}.openavatar">Download file</a>
    </p>
    ${entry.tags.length ? `<ul class="tags">${entry.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
  </div>
  <section class="try" aria-labelledby="try-title" hidden>
    <h2 id="try-title">See how ${esc(entry.name)} reacts</h2>
    <p class="try-lede">Pick what's happening. An app tells its avatar the same things (<a href="/spec/#12-the-host-interface">SPEC 12</a>).</p>
    <form class="try-form">
      ${choices('state', 'Conversation', TRY.state)}
      ${choices('activity', 'Agent activity', TRY.activity)}
      ${choices('userActivity', 'Your activity', TRY.userActivity)}
      <fieldset class="try-group"><legend>Once</legend><div class="choices">${once('expression', TRY.expression)}${once('motion', TRY.motion)}</div></fieldset>
    </form>
    <pre class="code try-code" aria-label="What an app sends"><code data-code>stage.setInput({ state: 'idle' });</code></pre>
  </section>
</main>`;
  return layout({
    title: `${entry.name}, an OpenAvatar`,
    description: entry.description || `${entry.name}, an open avatar for AI agents.`,
    body,
    scripts: `<script type="application/json" id="avatar">${scriptJSON({ slug: entry.slug, revision: entry.revision, name: entry.name })}</script>\n<script type="module" src="/avatar.js"></script>`,
  });
}

/** The spec, from the parts `renderSpec` makes. The contents list stays beside the text on a wide screen. */
export function specPage({ title, meta, body, sections }) {
  const contents = sections.map(s => `<li><a href="#${esc(s.id)}">${esc(s.title)}</a></li>`).join('');
  const html = `<main class="doc">
  <nav class="doc-nav" aria-label="Contents">
    <details open><summary>Contents</summary><ol>${contents}</ol></details>
  </nav>
  <article class="doc-body">
    <h1>${esc(title)}</h1>
    <dl class="doc-meta">${meta.map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${value}</dd></div>`).join('')}</dl>
    ${body}
  </article>
</main>`;
  return layout({
    title: `${title}: the OpenAvatar specification`,
    description: 'The OpenAvatar specification: the file format for 3D avatars that react to what an AI agent and its user are doing, and what apps that show them do.',
    body: html,
    page: 'spec',
    // A phone shows the contents folded, so the text comes first.
    scripts: `<script>if (matchMedia('(max-width: 760px)').matches) document.querySelector('.doc-nav details').open = false;</script>`,
  });
}

/** How to make an avatar: with an agent and the skill, in Enconvo, or by hand. */
export function makePage({ origin, sheet }) {
  const skill = `${origin}/skill/SKILL.md`;
  const body = `<main class="make">
  <header class="make-head">
    <h1>Make your own avatar</h1>
    <p class="lede">Describe a character in a sentence and let AI build it. An avatar is plain data, so an AI model can write one, and the OpenAvatar skill shows an agent how to check what it made.</p>
  </header>

  <section class="make-way" aria-labelledby="agent-title">
    <h2 id="agent-title">With an AI agent</h2>
    <div class="make-columns">
      <div class="make-text">
        <p>Agents that load skills, such as Claude Code or Codex, can use the OpenAvatar skill. Add the <a href="/skill/SKILL.md"><code>openavatar</code> skill</a> and its <a href="/skill/reference.md">reference</a> to your agent's skills, or give the agent this address:</p>
        <pre class="code"><code>${esc(skill)}</code></pre>
        <p>Then ask for the character you want, in your own words: what it is, its colors, what it wears, how it behaves. The agent works in a loop until the picture matches.</p>
        <ol class="loop">
          <li>Decides the silhouette, colors, material, face and parts.</li>
          <li>Writes the <code>.openavatar</code> file.</li>
          <li>Checks it with <code>openavatar validate --strict</code>.</li>
          <li>Draws a contact sheet and looks at it.</li>
          <li>Fixes what doesn't match and checks again.</li>
        </ol>
      </div>
      ${sheet ? `<figure class="make-sheet">
        <img src="${esc(sheet.src)}" alt="${esc(`A contact sheet of ${sheet.name}: front, three-quarter, side and back views, then happy, surprised, listening, thinking, speaking, sleeping, coding and waving.`)}" width="${sheet.width}" height="${sheet.height}" loading="lazy">
        <figcaption>The contact sheet an agent checks, here for ${esc(sheet.name)}.</figcaption>
      </figure>` : ''}
    </div>
  </section>

  <section class="make-way" aria-labelledby="enconvo-title">
    <h2 id="enconvo-title">In Enconvo</h2>
    <p class="make-text">Open Settings, then Avatar, and choose Create. Under Describe it, say what you'd like and pick one of three drafts to fine-tune. Avatars from this gallery open there too, with Open in Enconvo on each avatar's page.</p>
  </section>

  <section class="make-way" aria-labelledby="hand-title">
    <h2 id="hand-title">By hand</h2>
    <p class="make-text">The <code>openavatar</code> command starts a valid file, checks it, draws it and installs it. It needs Node.js and Chrome, Edge or Chromium.</p>
    <pre class="code"><code>npx @openavatar/cli new "My avatar" --rig blob -o my-avatar.openavatar
npx @openavatar/cli validate --strict my-avatar.openavatar
npx @openavatar/cli render my-avatar.openavatar --sheet -o sheet.png
npx @openavatar/cli install my-avatar.openavatar</code></pre>
    <p class="make-text"><code>install</code> puts it in <code>~/.openavatar/avatars/</code>, where every OpenAvatar app on the computer finds it. The <a href="/spec/">spec</a> describes every member of the file.</p>
  </section>

  <section class="make-way" aria-labelledby="share-title">
    <h2 id="share-title">Share it</h2>
    <p class="make-text">An avatar is one file, so it works wherever you send it. To put it in this gallery, <a href="/submit/">add it here</a>.</p>
  </section>
</main>`;
  return layout({
    title: 'Make your own OpenAvatar',
    description: 'Describe a character and let AI build it: the OpenAvatar skill for AI agents, Describe it in Enconvo, and the openavatar command.',
    body,
    page: 'make',
  });
}

/** Sending an avatar to the gallery: the file is checked on the page, shown live, then sent for review. */
export function submitPage({ licenses }) {
  const choices = Object.entries(licenses).map(([id, what], i) => `<label class="license-choice"><input type="radio" name="license" value="${esc(id)}"${i ? '' : ' checked'}><span><strong>${esc(licenseName(id))}</strong> ${esc(what)}</span></label>`).join('');
  const body = `<main class="submit">
  <header class="make-head">
    <h1>Add your avatar</h1>
    <p class="lede">Send a <code>.openavatar</code> file. It's checked here first, and a person looks at every avatar before it appears in the gallery.</p>
  </header>
  <div class="submit-columns">
    <figure class="stage submit-stage">
      <canvas class="stage-canvas" aria-hidden="true"></canvas>
      <p class="submit-empty">Your avatar shows here.</p>
      <figcaption class="stage-status" aria-live="polite" hidden></figcaption>
    </figure>
    <form class="submit-form" novalidate>
      <label class="drop">
        <input type="file" name="file" accept=".openavatar,application/vnd.openavatar+json,application/json">
        <span class="drop-title">Choose a file</span>
        <span class="drop-note">or drop it here. At most 256 KB.</span>
      </label>
      <div class="submit-check" role="status"></div>
      <fieldset class="submit-details" disabled hidden>
        <label class="field">Credit as
          <input type="text" name="author" maxlength="60" autocomplete="nickname" spellcheck="false">
          <span class="field-note">Shown on the avatar's page. Leave it empty to stay anonymous.</span>
        </label>
        <fieldset class="try-group"><legend>License</legend>${choices}</fieldset>
        <label class="consent"><input type="checkbox" name="consent"> I made this avatar, or I may share it under this license.</label>
        <p class="hero-actions"><button type="submit" class="button button-primary">Send for review</button></p>
      </fieldset>
      <div class="submit-result" role="alert"></div>
    </form>
  </div>
</main>`;
  return layout({
    title: 'Add your avatar to the OpenAvatar gallery',
    description: 'Send an OpenAvatar file to the gallery. It is checked at once and reviewed by a person before it appears.',
    body,
    scripts: '<script type="module" src="/submit.js"></script>',
  });
}

export function notFoundPage() {
  return layout({
    title: 'Not in the OpenAvatar gallery',
    description: 'This page is not in the gallery.',
    body: `<main class="missing"><div class="avatar-text"><h1>Nothing here</h1><p class="lede">This page isn't in the gallery. It may have been renamed.</p><p class="hero-actions"><a class="button button-primary" href="/#gallery">Browse avatars</a></p></div></main>`,
  });
}

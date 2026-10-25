// The spec as a page: SPEC.md rendered with marked. Headings get the ids GitHub gives them, so the spec's own links
// and links from elsewhere keep working, and links to files beside the spec point at the copies the site serves.
import { Marked } from 'marked';
import { esc, REPO } from './pages.js';

/** A heading's id, as GitHub makes it: lower case, punctuation dropped, spaces to dashes. */
export const headingId = text => text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');

/** Where the spec's relative links go on the site. */
export const SPEC_LINKS = {
  'schema/openavatar-0.1.schema.json': '/spec/openavatar-0.1.schema.json',
  'vocabulary.json': '/spec/vocabulary.json',
  '../skills/openavatar/SKILL.md': '/make/',
  '../conformance/README.md': `${REPO}/tree/main/conformance`,
};

/**
 * The spec's parts for its page: the title, the metadata at its top (Status, Editors, ...), the body as HTML without
 * the spec's own contents list (the page draws one), and the sections for that list.
 */
export function renderSpec(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const title = lines[0].replace(/^#\s+/, '');
  const meta = [];
  let i = 1;
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^\*\*([^*]+):\*\*\s+(.*)$/);
    if (m) meta.push([m[1], m[2]]);
    else if (lines[i].trim()) break;
  }
  const rest = lines.slice(i).join('\n').replace(/^## Contents\n[\s\S]*?(?=^## )/m, '');

  const sections = [];
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth, text }) {
        const id = headingId(text.replace(/`/g, ''));
        if (depth === 2) sections.push({ id, title: text.replace(/`/g, '') });
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${depth}>\n`;
      },
      link({ href, tokens }) {
        const to = SPEC_LINKS[href] ?? href;
        const outside = /^https?:/.test(to) && !to.startsWith('/');
        return `<a href="${esc(to)}"${outside ? ' rel="noopener"' : ''}>${this.parser.parseInline(tokens)}</a>`;
      },
    },
  });
  const body = marked.parse(rest)
    // Wide tables scroll on their own instead of the page.
    .replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>');
  return { title, meta: meta.map(([name, value]) => [name, marked.parseInline(value)]), body, sections };
}

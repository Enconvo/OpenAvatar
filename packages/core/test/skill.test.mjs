// The agent skill (skills/openavatar) stays in step with the format: its
// reference is generated from the model, and the guide names only members and
// ids the reference has.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { LIMITS } from '../src/model.js';

const root = new URL('../../../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const skill = read('skills/openavatar/SKILL.md');
const reference = read('skills/openavatar/reference.md');
const tokens = text => [...new Set([...text.matchAll(/`([^`\n]+)`/g)].map(m => m[1]))];

test('reference.md is generated from the current model', () => {
  const r = spawnSync(process.execPath, [new URL('spec/tools/skill-reference.mjs', root).pathname, '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('SKILL.md has the front matter agents load', () => {
  const m = skill.match(/^---\nname: (.+)\ndescription: (.+)\n---\n/);
  assert.ok(m, 'front matter with name and description');
  assert.equal(m[1], 'openavatar');
  assert.ok(m[2].length <= 1024, 'description fits 1024 characters');
});

test('SKILL.md names only members and ids from the reference', () => {
  const known = new Set(tokens(reference).flatMap(t => [t, ...t.split(/[.[\]<>]+/)]).map(t => t.replace(/^"|"$/g, '')));
  // Commands are checked by the CLI's tests; front points like [0, height] are notation.
  const skip = t => /^(openavatar|npx|npm) |^--|^\[/.test(t) || ['openavatar new', 'validate --strict', 'validate', 'pack', 'install'].includes(t);
  const unknown = tokens(skill).filter(t => !skip(t)).filter(t => {
    const value = t.replace(/^\w+: /, '').replace(/^"|"$/g, '');
    return !known.has(value) && !value.split('.').every(p => known.has(p));
  });
  assert.deepEqual(unknown, []);
});

test('SKILL.md states the limits of the model', () => {
  const sentence = skill.match(/Respect the limits: ([^.]+)\./s)[1].replace(/\s+/g, ' ');
  assert.equal(sentence, `${LIMITS.parts} parts, ${LIMITS.materials} materials, ${LIMITS.shapes} shapes and outlines, ${LIMITS.depth} levels of nesting, ${LIMITS.points} polygon and stroke points, ${LIMITS.fileBytes / 1024} KB`);
});

test('the links of the skill resolve', () => {
  for (const [, href] of skill.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^https?:/.test(href)) continue;
    assert.ok(fs.existsSync(new URL(`skills/openavatar/${href}`, root)), href);
  }
  assert.ok(read('spec/SPEC.md').includes('(../skills/openavatar/SKILL.md)'));
});

// What a gallery submission must be. The submit page runs this before sending, so people see problems at once, and
// the Worker runs it again on what arrives. A submission only queues an avatar for review; nothing reaches the
// gallery until a person approves it.
import { LIMITS, validate } from 'openavatar';

/** The licenses the gallery accepts, with what each lets others do. */
export const LICENSES = {
  'CC-BY-4.0': 'Others may use and change it, and credit you.',
  'CC0-1.0': 'Anyone may use it for anything, with no credit needed.',
};
export const MAX_AUTHOR = 60;
/** At most this many problems are reported; the first ones are what to fix first. */
export const MAX_PROBLEMS = 8;

const bytesOf = text => new TextEncoder().encode(text).length;

/**
 * Checks a submission: `{ document, author, license, consent }`, where `document` is the file's text.
 * @returns {{ ok: true, value: { text: string, id: string, name: string, author: string, license: string, bytes: number } }
 *   | { ok: false, error: 'not_text'|'too_large'|'not_json'|'invalid'|'author'|'license'|'consent', problems?: { path: string, message: string }[] }}
 */
export function checkSubmission({ document, author = '', license, consent } = {}) {
  const checked = checkDocument(document);
  if (!checked.ok) return checked;
  const credit = typeof author === 'string' ? author.trim() : null;
  // A name, not markup or several lines: letters, marks, digits, spaces and common punctuation.
  if (credit === null || credit.length > MAX_AUTHOR || /[\p{Cc}\p{Cf}<>]/u.test(credit)) return { ok: false, error: 'author' };
  if (!Object.hasOwn(LICENSES, license)) return { ok: false, error: 'license' };
  if (consent !== true) return { ok: false, error: 'consent' };
  return { ok: true, value: { ...checked.value, author: credit, license } };
}

/** Checks only the file: text, at most 256 KB, JSON, and a document with no errors (SPEC 17.1). */
export function checkDocument(text) {
  if (typeof text !== 'string') return { ok: false, error: 'not_text' };
  const bytes = bytesOf(text);
  if (bytes > LIMITS.fileBytes) return { ok: false, error: 'too_large' };
  let value;
  try { value = JSON.parse(text.replace(/^﻿/, '')); } catch { return { ok: false, error: 'not_json' }; }
  const { valid, errors } = validate(value);
  if (!valid) {
    return { ok: false, error: 'invalid', problems: errors.slice(0, MAX_PROBLEMS).map(e => ({ path: e.path || '(the document)', message: e.message })) };
  }
  return { ok: true, value: { text, id: value.id, name: value.name, bytes } };
}

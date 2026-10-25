// Starting points for `openavatar new`: the smallest documents that show
// each rig well. Every value here is a default a writer is expected to change.
import { newId, SPEC_VERSION } from '@openavatar/core';

const BLOB = {
  body: {
    shape: { type: 'ellipsoid', radii: [0.95, 0.85, 0.85], deform: [{ type: 'squash', axis: 'y', below: 0.8 }] },
    material: 'main',
  },
  materials: { main: { type: 'felt', color: '#F2C9A0', sheen: '#FFFFFF' } },
  face: {
    type: 'bead',
    eyes: { size: 0.08, spacing: 0.32, height: 0.15 },
    mouth: { shape: 'smile', width: 0.14, height: -0.06 },
    cheeks: { color: '#FF9DB2', size: 0.1, spacing: 0.52, height: -0.03, show: 'happy' },
  },
  parts: [],
  behavior: { temperament: { energy: 0.5, bounce: 0.5 } },
};

const BIPED = {
  body: {
    rig: 'biped',
    material: 'main',
    proportions: { head: 0.6, headShape: 'round', body: 0.5, bodyShape: 'pear', legs: 0.4, arms: 0.5 },
  },
  materials: { main: { type: 'felt', color: '#8FB8E8', sheen: '#FFFFFF' } },
  face: {
    type: 'sewn',
    eyes: { size: 0.09, spacing: 0.24, height: 0.42 },
    mouth: { shape: 'smile', width: 0.13, height: 0.22 },
    cheeks: { color: '#FF9DB2', size: 0.08, spacing: 0.36, height: 0.29, show: 'happy' },
  },
  parts: [],
  behavior: { temperament: { energy: 0.5, bounce: 0.5 } },
};

export const TEMPLATES = { blob: BLOB, biped: BIPED };

/** A new document with a fresh id, made by this tool. */
export function newDocument({ name = 'New avatar', rig = 'blob', version = '0.1.0' } = {}) {
  const t = TEMPLATES[rig];
  if (!t) throw new Error(`unknown rig "${rig}"; use ${Object.keys(TEMPLATES).join(' or ')}`);
  // To the second, the form the skill shows.
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return {
    openavatar: SPEC_VERSION,
    id: newId(),
    name,
    meta: { created: now, updated: now, generator: { name: '@openavatar/cli', version } },
    ...structuredClone(t),
  };
}

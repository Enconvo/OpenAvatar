// The gallery's categories: a few broad kinds of avatar, each recognised by its tags. An avatar is in the first
// category one of its tags names, else in Other. The build files each avatar under one, and the API lists them.
// Plain data, so the Worker and the build share it.

export const CATEGORIES = [
  { id: 'abstract', name: 'Abstract', description: 'Faceless forms of light and shape', tags: ['abstract', 'faceless'] },
  { id: 'creatures', name: 'Creatures', description: 'Animals, insects and other critters', tags: ['animal', 'creature', 'insect'] },
  { id: 'plush', name: 'Plush', description: 'Soft toys of felt and fur', tags: ['plush', 'felt', 'fur'] },
  { id: 'objects', name: 'Objects', description: 'Robots, plants and things brought to life', tags: ['robot', 'object', 'plant', 'planet', 'food', 'computer'] },
];
export const OTHER = { id: 'other', name: 'Other', description: 'Avatars that fit no other category', tags: [] };

/** The id of the category an avatar with these (lower-case) tags is in. */
export function categoryOf(tags) {
  const have = new Set(tags);
  return (CATEGORIES.find(c => c.tags.some(t => have.has(t))) ?? OTHER).id;
}

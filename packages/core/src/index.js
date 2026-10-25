// openavatar: read, validate and normalize OpenAvatar documents, and resolve
// how an avatar reacts. No dependencies; runs in browsers and Node.
export { SPEC_VERSION, OpenAvatarError, validate, normalize, parse, stringify, newId, instant, compareCopies, byCodePoint } from './read.js';
export { CHANNELS, BASE_MOTIONS, hasArms, reactionFor, isQuiet, resolveMotion, motionLoops, resolveExpression, expressionPoses, resolveBehavior } from './behavior.js';
export { LIMITS, SHAPES, OUTLINES, DEFORMERS, EXPRESSIONS, MOTIONS, PROPS, EFFECTS, OUTFITS, STATES, ACTIVITIES, USER_ACTIVITIES, DRIVERS } from './model.js';
export { default as VOCABULARY } from './vocabulary.js';

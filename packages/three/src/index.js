// @openavatar/three: the reference renderer for OpenAvatar documents.
export { OpenAvatar, bipedSuit } from './avatar.js';
export { OpenAvatarStage } from './stage.js';
export { makeMaterial, addShells, studioEnvironment, pileHeight, featureLift } from './materials.js';
export { shapeGeometry, clearGeometryCache } from './geometry.js';
export { SUPPORTED_MOTIONS } from './motion.js';
export { Props, SUPPORTED_PROPS, roundedBox } from './props.js';
export { Effects, SUPPORTED_EFFECTS } from './effects.js';
export { Outfits, SUPPORTED_OUTFITS } from './outfits.js';
export { compileShape, compileOutline, shapeBounds, frontPoint, surfaceAlong } from './sdf.js';
export { meshField } from './mesh.js';

// OpenAvatar materials (SPEC 7) as three.js materials. Felt and fur get fuzz
// shells (copies of the mesh pushed out along the normal and cut to sparse
// fibres), the way Enconvo's felt characters are drawn; patterns paint in the
// object's own space so they move with it; glow is an emissive whose strength
// the avatar sets every frame from the glow's driver.
import * as THREE from 'three';
import { patternGLSL, HASH_GLSL } from './patterns.js';

// Grey value noise for felt bump maps, seeded so every frame and every
// machine shows the same fibres.
function noiseTexture(seed, base, span, rx, ry) {
  const n = 256, data = new Uint8Array(n * n * 4);
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n * n; i++) { const v = Math.round(base + rnd() * span); data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(data, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
let FELT_NOISE = null, CLAY_NOISE = null;
const feltNoise = () => FELT_NOISE ||= noiseTexture(11, 96, 160, 14, 7);
const clayNoise = () => CLAY_NOISE ||= noiseTexture(5, 110, 60, 3, 2);
let TOON_RAMP = null;
const toonRamp = () => {
  if (TOON_RAMP) return TOON_RAMP;
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]), 3, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return TOON_RAMP = t;
};

const lighter = (c, k = .45) => c.clone().lerp(new THREE.Color(1, 1, 1), k);

// The types SPEC 7.1 defines; a renderer draws any other as felt.
const TYPES = new Set(['felt', 'fur', 'velvet', 'plastic', 'rubber', 'clay', 'ceramic', 'glass', 'metal', 'toon']);
const kindOf = spec => (TYPES.has(spec?.type) ? spec.type : 'felt');
const strand = spec => .015 + .085 * (spec.fur?.length ?? .5);

/** How far a material's pile of fibres stands off the surface, P in SPEC 7.1; 0 without a pile. */
export function pileHeight(spec = {}) {
  const t = kindOf(spec);
  return t === 'felt' ? .034 : t === 'fur' ? strand(spec) : t === 'velvet' ? .008 : 0;
}

/**
 * How far above a material's surface the face's features sit (SPEC 7.1, C.1): `feature`, and `ink`, where thin ink
 * strokes sit instead (on felt, above nearly all its pile, as embroidery thread sits on the cloth), or null.
 */
export function featureLift(spec = {}) {
  const t = kindOf(spec);
  return { feature: t === 'felt' ? .018 : t === 'fur' ? .004 + .8 * strand(spec) : t === 'velvet' ? .008 : .003, ink: t === 'felt' ? .032 : null };
}

// One onBeforeCompile for the pattern and, on shell copies, the fuzz cut-out and the push along the normal.
// `sheenK` is how far toward white a sheen the document didn't name is; on a pattern that sheen follows the color
// under it, so a dark stripe on light felt doesn't take the light base color's sheen.
function hook(m, { pattern, base, shell, sheenK = null }) {
  const pat = patternGLSL(pattern, base);
  if (!pat && !shell) return m;
  const u = shell ? { uShell: { value: shell.offset }, uThr: { value: shell.threshold }, uFreq: { value: shell.freq }, uAO: { value: shell.ao }, uDroop: { value: shell.droop }, uTip: { value: shell.tip }, uTipK: { value: shell.tipK } } : {};
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    // A gradient spans the solid it colors: the mesh's range along the axis, which the avatar puts in userData.
    if (pattern?.type === 'gradient') sh.uniforms.uOARange = { value: new THREE.Vector2(...(m.userData.oaRange || [-1, 1])) };
    let vs = sh.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 vOAP;${shell ? 'uniform float uShell,uDroop;' : ''}`);
    vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\nvOAP=position;${shell ? 'transformed+=normalize(objectNormal)*uShell;transformed.y-=uDroop*uShell*uShell*6.;' : ''}`);
    let fs = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vOAP;${shell ? 'uniform float uThr,uFreq,uAO,uTipK;uniform vec3 uTip;' : ''}${HASH_GLSL}${pat}`);
    if (shell) fs = fs.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif(oaH(ivec3(floor(vOAP*uFreq)),5u)<uThr)discard;');
    // On a pattern, a tip derived from the color follows the pattern under it, so a dark stripe's fuzz stays dark.
    const tip = pat && shell?.lighten != null ? `mix(diffuseColor.rgb,vec3(1.),${shell.lighten.toFixed(3)})` : 'uTip';
    fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n${pat ? 'vec3 oaC=oaPattern(diffuseColor.rgb);diffuseColor.rgb=oaC;' : ''}${shell ? `diffuseColor.rgb=mix(diffuseColor.rgb,${tip},uTipK)*uAO;` : ''}`);
    if (pat && sheenK != null) fs = fs.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>\n#ifdef USE_SHEEN\nmaterial.sheenColor=mix(oaC,vec3(1.),${sheenK.toFixed(3)});\n#endif`);
    sh.vertexShader = vs; sh.fragmentShader = fs;
  };
  // The pattern's GLSL holds the base color, so two materials with one pattern and different colors need two programs.
  m.customProgramCacheKey = () => `oa:${pattern ? `${JSON.stringify(pattern)}:${base.getHexString()}:${sheenK ?? ''}` : ''}:${shell ? `shell${shell.lighten ?? ''}` : ''}`;
  return m;
}

/**
 * A three.js material for an OpenAvatar material. Returns
 * { material, shells, glow }: `shells` describes the fuzz copies to add (or
 * null), `glow` the glow (or null) whose emissiveIntensity the avatar drives.
 */
export function makeMaterial(spec = {}, { envMap = null, quality = 'high' } = {}) {
  const type = kindOf(spec);
  const color = new THREE.Color(spec.color || '#9AA4B2');
  // A sheen the document names is used as it is; otherwise it is the color lightened by `sheenK` (see hook).
  let sheenK = spec.sheen ? null : .45;
  const sheen = () => (sheenK == null ? new THREE.Color(spec.sheen) : lighter(color, sheenK));
  let m, shells = null;
  const physical = o => new THREE.MeshPhysicalMaterial({ color, envMap, ...o });
  switch (type) {
    case 'fur': {
      const f = spec.fur || {};
      m = physical({ roughness: spec.roughness ?? 1, sheen: 1, sheenRoughness: .5, sheenColor: sheen(), bumpMap: feltNoise(), bumpScale: 1.2, envMapIntensity: .3 });
      shells = { n: quality === 'low' ? 4 : 8, length: pileHeight(spec), freq: 70 + 140 * (f.density ?? .5), density: f.density ?? .5, droop: f.droop ?? .3, tip: spec.fur?.tip ? new THREE.Color(spec.fur.tip) : lighter(color, .25), lighten: spec.fur?.tip ? null : .25 };
      break;
    }
    case 'velvet':
      if (sheenK != null) sheenK = .6;
      m = physical({ roughness: spec.roughness ?? .9, sheen: 1, sheenRoughness: .2, sheenColor: sheen(), envMapIntensity: .3 });
      shells = { n: quality === 'low' ? 2 : 3, length: pileHeight(spec), freq: 260, density: .8, droop: 0, tip: color, lighten: 0 };
      break;
    case 'plastic': m = physical({ roughness: spec.roughness ?? .32, clearcoat: .6, clearcoatRoughness: .2, envMapIntensity: .8 }); break;
    case 'rubber': m = physical({ roughness: spec.roughness ?? .8, envMapIntensity: .3 }); break;
    case 'clay': m = physical({ roughness: spec.roughness ?? .92, bumpMap: clayNoise(), bumpScale: .6, envMapIntensity: .25 }); break;
    case 'ceramic': m = physical({ roughness: spec.roughness ?? .12, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1 }); break;
    case 'glass': {
      const o = spec.opacity ?? .2;
      m = physical({ roughness: spec.roughness ?? .05 + .5 * o, transmission: 1 - .6 * o, thickness: .3, ior: 1.45, attenuationColor: color, attenuationDistance: .8, envMapIntensity: 1.2, transparent: true });
      break;
    }
    case 'metal': m = physical({ metalness: 1, roughness: spec.roughness ?? .28, envMapIntensity: 1.2 }); break;
    case 'toon': m = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp() }); break;
    default: // felt, and any type a newer spec adds (kindOf)
      m = physical({ roughness: spec.roughness ?? 1, metalness: 0, sheen: 1, sheenRoughness: .38, sheenColor: sheen(), bumpMap: feltNoise(), bumpScale: 1.5, envMapIntensity: .42 });
      shells = { n: quality === 'low' ? 2 : 4, length: pileHeight(spec), freq: 96, density: .5, droop: 0, tip: color, lighten: 0 };
  }
  let glow = null;
  if (spec.glow) {
    glow = { color: new THREE.Color(spec.glow.color || spec.color || '#9AA4B2'), intensity: spec.glow.intensity ?? 1, base: spec.glow.base ?? 0, driver: spec.glow.driver || 'always' };
    m.emissive = glow.color.clone(); m.emissiveIntensity = 0;
  }
  if (!m.sheen) sheenK = null;
  hook(m, { pattern: spec.pattern, base: color, sheenK });
  m.userData.oa = { type, spec, sheenK };
  return { material: m, shells, glow };
}

/**
 * Adds the pile (SPEC 7.1) to a mesh as shells: copies of it pushed out along the normal to evenly spaced heights, each
 * cut to the fibres that reach it.
 */
export function addShells(mesh, material, shells, spec = {}) {
  if (!shells) return [];
  const thr = Array.from({ length: shells.n }, (_, i) => {
    // Sparser toward the tips; denser pile keeps more fibres.
    const k = (i + 1) / shells.n;
    return Math.min(.97, .35 + .6 * k - .25 * shells.density * (1 - k));
  });
  const out = [];
  for (let i = 1; i <= shells.n; i++) {
    const m = material.clone(); m.color = material.color; if (material.sheenColor) m.sheenColor = material.sheenColor; m.emissive = material.emissive;
    hook(m, { pattern: spec.pattern, base: material.color, shell: {
      offset: shells.length * i / shells.n, threshold: thr[i - 1], freq: shells.freq, ao: .84 + .16 * i / shells.n,
      droop: shells.droop, tip: shells.tip, tipK: .6 * Math.pow(i / shells.n, 2), lighten: shells.lighten,
    }, sheenK: material.userData.oa?.sheenK ?? null });
    const s = new THREE.Mesh(mesh.geometry, m); s.renderOrder = i; s.raycast = () => {}; s.userData.shell = true;
    mesh.add(s); out.push(m);
  }
  return out;
}

/** A small studio environment for reflections and sheen, made in code (no files). */
export function studioEnvironment(renderer) {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x5a5e66, side: THREE.BackSide }));
  scene.add(room);
  const panel = (c, i, p, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(...s), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); scene.add(m); };
  panel(0xfff4e8, 6, [-3, 4, 3], [3, 2]); panel(0xdfe8ff, 3, [4, 1, 2], [2, 3]); panel(0xffffff, 4, [0, 4.8, -2], [4, 2]); panel(0xffffff, 1.5, [0, -4.8, 0], [6, 6]);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(scene, .04).texture;
  pm.dispose(); scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  return tex;
}

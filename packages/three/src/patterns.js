// The patterns of SPEC 7.2, written twice: patternWeights computes how much of each palette color a point gets, in
// plain JavaScript, and patternGLSL writes the same computation as a fragment shader function. Every choice between
// colors is made with integers, so a GPU's rounding can only move a blend edge by a hair, never pick another color.
// The tests run the shader in a browser and compare the two pixel by pixel.
import * as THREE from 'three';

const clamp01 = x => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mod = (i, n) => ((i % n) + n) % n;

function fmix(h) {
  h ^= h >>> 16; h = Math.imul(h, 0x85EBCA6B); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16;
  return h >>> 0;
}
/** The 24-bit hash of SPEC 7.2 for the cell (cx, cy, cz) and the key k: an integer from 0 to 2^24 − 1. */
export function cellBits(cx, cy, cz, k) {
  const v = Math.imul(cx + 1024, 0x8DA6B343) + Math.imul(cy + 1024, 0xD8163841) + Math.imul(cz + 1024, 0xCB1AB31F) + Math.imul(k, 0x165667B1);
  return fmix(v >>> 0) >>> 8;
}
/** cellBits as a number from 0 to just under 1. */
export const cellHash = (cx, cy, cz, k) => cellBits(cx, cy, cz, k) / 16777216;

/**
 * How much of each palette color (the base color, then `pattern.colors`) the point p = [x, y, z] of a solid's own
 * space gets (SPEC 7.2). `range` is the lowest and highest coordinate of the solid along the pattern's axis, which
 * only a gradient uses. Returns one weight per palette color; they add up to 1.
 */
export function patternWeights(pattern, p, range = [-1, 1]) {
  const n = 1 + pattern.colors.length, w = new Array(n).fill(0), axis = { x: 0, y: 1, z: 2 }[pattern.axis || 'y'];
  const scale = pattern.scale ?? .3, a = p[axis];
  switch (pattern.type) {
    case 'gradient': {
      const d = range[1] - range[0], t = d > 1e-6 ? clamp01((a - range[0]) / d) * (n - 1) : 0, i = Math.floor(t), k = smoothstep(0, 1, t - i);
      w[i] += 1 - k; w[Math.min(i + 1, n - 1)] += k;
      return w;
    }
    case 'stripes': {
      const th = (pattern.angle || 0) * Math.PI / 180, b = p[pattern.axis === 'x' ? 1 : 0];
      const s = (a * Math.cos(th) + b * Math.sin(th)) / scale, i = Math.floor(s), e = s - i;
      const k1 = smoothstep(-.03, .03, e), k2 = smoothstep(.97, 1.03, e);
      w[mod(i - 1, n)] += (1 - k1) * (1 - k2); w[mod(i, n)] += k1 * (1 - k2); w[mod(i + 1, n)] += k2;
      return w;
    }
    case 'spots': {
      const q = p.map(x => x / scale), c = q.map(Math.floor), f = q.map((x, j) => x - c[j] - .5);
      const h = k => cellHash(c[0], c[1], c[2], k), o = [h(0), h(1), h(2)].map(x => .3 * (x - .5)), r = .2 + .1 * h(3);
      const k = 1 - smoothstep(r - .03, r + .03, Math.hypot(f[0] - o[0], f[1] - o[1], f[2] - o[2]));
      w[0] += 1 - k; w[1 + ((cellBits(c[0], c[1], c[2], 4) * (n - 1)) >>> 24)] += k;
      return w;
    }
    case 'checks': {
      const c = p.map(x => Math.floor(x / scale));
      w[mod(c[0] + c[1] + c[2], n)] = 1;
      return w;
    }
  }
  w[0] = 1;
  return w;
}

/** SPEC 7.2's hash in GLSL: `oaBits(ivec3 cell, uint key)` (24 bits) and `oaH` (0 to 1). Spots and fur pile use it. */
export const HASH_GLSL = 'uint oaMix(uint h){h^=h>>16u;h*=0x85EBCA6Bu;h^=h>>13u;h*=0xC2B2AE35u;h^=h>>16u;return h;}'
  + 'uint oaBits(ivec3 c,uint k){uvec3 u=uvec3(c+ivec3(1024));return oaMix(u.x*0x8DA6B343u+u.y*0xD8163841u+u.z*0xCB1AB31Fu+k*0x165667B1u)>>8u;}'
  + 'float oaH(ivec3 c,uint k){return float(oaBits(c,k))/16777216.;}';

const glsl = c => `vec3(${c.r.toFixed(6)},${c.g.toFixed(6)},${c.b.toFixed(6)})`;
const num = x => (Number.isInteger(x) ? x.toFixed(1) : String(x));

/**
 * The pattern as GLSL (ES 3.00): `vec3 oaPattern(vec3 c)` gives the color at the object-space position `vOAP`, which
 * the caller declares, from the base color `c`. Spots call HASH_GLSL's functions, which the caller puts before it. A
 * gradient also reads `uniform vec2 uOARange`, the solid's range along the axis. `base` is the base color as a
 * THREE.Color.
 */
export function patternGLSL(p, base) {
  if (!p) return '';
  const cols = [base, ...p.colors.map(c => new THREE.Color(c))], n = cols.length;
  const ax = { x: 'vOAP.x', y: 'vOAP.y', z: 'vOAP.z' }[p.axis || 'y'], sc = num(p.scale ?? .3);
  // A non-negative left operand keeps % defined in GLSL; stripes and checks stay well inside 4096 cells.
  const head = cols.map((c, i) => `const vec3 PC${i}=${glsl(c)};`).join('')
    + `vec3 pickC(int i){${cols.slice(0, -1).map((_, i) => `if(i==${i})return PC${i};`).join('')}return PC${n - 1};}`
    + `int oaMod(int i){return (i+${n * 4096})%${n};}`;
  switch (p.type) {
    case 'gradient':
      return `${head}uniform vec2 uOARange;vec3 oaPattern(vec3 c){float d=uOARange.y-uOARange.x;float t=d>1e-6?clamp((${ax}-uOARange.x)/d,0.,1.)*${num(n - 1)}:0.;float i=floor(t);int j=int(i);return mix(pickC(j),pickC(min(j+1,${n - 1})),smoothstep(0.,1.,t-i));}`;
    case 'stripes': {
      const a = (p.angle || 0) * Math.PI / 180, tilt = p.axis === 'x' ? 'vOAP.y' : 'vOAP.x';
      return `${head}vec3 oaPattern(vec3 c){float s=(${ax}*${num(Math.cos(a))}+${tilt}*${num(Math.sin(a))})/${sc};float i=floor(s);float e=s-i;int j=int(i);vec3 r=mix(pickC(oaMod(j-1)),pickC(oaMod(j)),smoothstep(-.03,.03,e));return mix(r,pickC(oaMod(j+1)),smoothstep(.97,1.03,e));}`;
    }
    case 'spots':
      return `${head}vec3 oaPattern(vec3 c){vec3 q=vOAP/${sc};vec3 fc=floor(q);ivec3 id=ivec3(fc);vec3 f=q-fc-.5;vec3 o=.3*(vec3(oaH(id,0u),oaH(id,1u),oaH(id,2u))-.5);float r=.2+.1*oaH(id,3u);float k=1.-smoothstep(r-.03,r+.03,length(f-o));return mix(c,pickC(1+int((oaBits(id,4u)*${n - 1}u)>>24u)),k);}`;
    case 'checks':
      return `${head}vec3 oaPattern(vec3 c){ivec3 q=ivec3(floor(vOAP/${sc}));return pickC(oaMod(q.x+q.y+q.z));}`;
  }
  return '';
}

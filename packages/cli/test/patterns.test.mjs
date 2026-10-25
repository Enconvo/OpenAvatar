// Runs the reference renderer's pattern shaders in a real browser and compares every pixel with the JavaScript
// version of SPEC 7.2 (@openavatar/three/patterns). Needs Chrome, Edge or Chromium; skipped without one.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HASH_GLSL, patternGLSL, patternWeights } from '@openavatar/three/patterns';
import { launch } from '../src/render.js';

let browser = null;
try { browser = await launch(process.env.OPENAVATAR_BROWSER); } catch (e) { if (e.code !== 'no-browser') throw e; }

const W = 64, H = 64;
const COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF'];
// Each case paints a square of the solid's space, o + u·s + v·t for s and t from 0 to 1, with a black base color.
const CASES = [
  { pattern: { type: 'gradient', colors: COLORS.slice(0, 3) }, range: [-.8, .6], o: [-1, -1, .2], u: [2, 0, 0], v: [0, 2, 0] },
  { pattern: { type: 'gradient', colors: COLORS.slice(0, 1), axis: 'x' }, range: [-1, 1], o: [-1, -1, 0], u: [2, 0, 0], v: [0, 2, 0] },
  { pattern: { type: 'stripes', colors: COLORS.slice(0, 3) }, o: [-1, -1, 0], u: [2, 0, 0], v: [0, 2, 0] },
  { pattern: { type: 'stripes', colors: COLORS.slice(0, 2), axis: 'x', angle: 30, scale: .2 }, o: [-1, -1, 0], u: [2, 0, 0], v: [0, 2, 0] },
  { pattern: { type: 'stripes', colors: COLORS, axis: 'z', angle: -45, scale: .15 }, o: [-1, .3, -1], u: [2, 0, 0], v: [0, 0, 2] },
  { pattern: { type: 'spots', colors: COLORS.slice(0, 2), scale: .25 }, o: [-1, -1, .37], u: [2, 0, 0], v: [0, 2, 0] },
  { pattern: { type: 'spots', colors: COLORS, scale: .5 }, o: [-2, -.4, -2], u: [4, 0, 0], v: [0, 0, 4] },
  { pattern: { type: 'spots', colors: COLORS.slice(0, 1), scale: .1 }, o: [-.5, -.5, -.5], u: [1, .3, 0], v: [0, 1, .6] },
  { pattern: { type: 'checks', colors: COLORS.slice(0, 2) }, o: [-1, -1, .1], u: [2, 0, 0], v: [0, 2, 0] },
  { pattern: { type: 'checks', colors: COLORS.slice(0, 3), scale: .2 }, o: [-.9, -.7, -.6], u: [1.4, .5, 0], v: [0, .4, 1.3] },
];

// Draws each case's oaPattern into a float target and reads it back.
async function paint(cases) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(([cases, W, H]) => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return { error: 'no WebGL2' };
      const float = !!gl.getExtension('EXT_color_buffer_float');
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, float ? gl.RGBA32F : gl.RGBA8, W, H, 0, gl.RGBA, float ? gl.FLOAT : gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, gl.createFramebuffer());
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, W, H);
      const shader = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const vs = shader(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){gl_Position=vec4(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.,0.,1.);}');
      const out = [];
      for (const c of cases) {
        let fs;
        try {
          fs = shader(gl.FRAGMENT_SHADER, `#version 300 es\nprecision highp float;precision highp int;uniform vec3 uO,uU,uV;uniform vec2 uSize;vec3 vOAP;\n${c.glsl}\nout vec4 oC;void main(){vec2 t=gl_FragCoord.xy/uSize;vOAP=uO+uU*t.x+uV*t.y;oC=vec4(oaPattern(PC0),1.);}`);
        } catch (e) { return { error: `${c.pattern.type}: ${e.message}` }; }
        const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return { error: gl.getProgramInfoLog(prog) };
        gl.useProgram(prog);
        for (const k of ['o', 'u', 'v']) gl.uniform3fv(gl.getUniformLocation(prog, `u${k.toUpperCase()}`), c[k]);
        gl.uniform2f(gl.getUniformLocation(prog, 'uSize'), W, H);
        const range = gl.getUniformLocation(prog, 'uOARange');
        if (range) gl.uniform2fv(range, c.range);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const px = float ? new Float32Array(W * H * 4) : new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, float ? gl.FLOAT : gl.UNSIGNED_BYTE, px);
        out.push(Array.from(px, v => (float ? v : v / 255)));
      }
      return { float, out };
    }, [cases, W, H]);
  } finally { await page.close(); }
}

test('the pattern shaders paint what SPEC 7.2 says, pixel for pixel', { skip: !browser && 'no browser' }, async () => {
  try {
    const black = new THREE.Color(0, 0, 0);
    const palette = c => [black, ...c.pattern.colors.map(h => new THREE.Color(h))].map(k => [k.r, k.g, k.b]);
    const r = await paint(CASES.map(c => ({ ...c, glsl: HASH_GLSL + patternGLSL(c.pattern, black) })));
    assert.ok(!r.error, r.error);
    const tolerance = r.float ? 2e-3 : 2 / 255;
    CASES.forEach((c, n) => {
      const pal = palette(c), px = r.out[n], scale = c.pattern.scale ?? .3, used = new Set();
      let worst = 0, at = null, skipped = 0;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const s = (i + .5) / W, t = (j + .5) / H, p = [0, 1, 2].map(k => c.o[k] + c.u[k] * s + c.v[k] * t);
        // A check's color jumps at its edges, where the GPU's rounding may land on either side.
        if (c.pattern.type === 'checks' && p.some(x => { const q = x / scale; return Math.abs(q - Math.round(q)) < 1e-4; })) { skipped++; continue; }
        const w = patternWeights(c.pattern, p, c.range);
        w.forEach((x, k) => { if (x > .99) used.add(k); });
        for (let ch = 0; ch < 3; ch++) {
          const want = w.reduce((a, x, k) => a + x * pal[k][ch], 0), got = px[(j * W + i) * 4 + ch], d = Math.abs(want - got);
          if (d > worst) { worst = d; at = { i, j, ch, want, got, p }; }
        }
      }
      const name = `${c.pattern.type} ${c.pattern.axis || 'y'} ×${c.pattern.colors.length}`;
      assert.ok(worst <= tolerance, `${name}: off by ${worst} at ${JSON.stringify(at)}`);
      assert.ok(skipped < W * H * .02, `${name}: skipped ${skipped}`);
      // Every case shows at least two colors of its palette in full, so a flat picture can't pass.
      assert.ok(used.size >= 2, `${name} shows ${[...used]}`);
    });
  } finally { await browser.close(); }
});

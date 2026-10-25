// A ready-made stage for one avatar on a canvas: renderer, studio light, a soft
// ground shadow and a camera that frames the avatar. Hosts with their own
// three.js scene use OpenAvatar directly instead.
import * as THREE from 'three';
import { OpenAvatar } from './avatar.js';
import { studioEnvironment } from './materials.js';

export class OpenAvatarStage {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ quality?: 'low'|'medium'|'high', background?: string|null, pixelRatio?: number,
   *   shadow?: boolean, preserveDrawingBuffer?: boolean, margin?: number, roomForEffects?: boolean }} [options]
   */
  constructor(canvas, { quality = 'high', background = null, pixelRatio, shadow = true, preserveDrawingBuffer = false, margin = 1.12, roomForEffects = true } = {}) {
    this.canvas = canvas; this.quality = quality; this.margin = margin; this.roomForEffects = roomForEffects;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: background === null, preserveDrawingBuffer });
    r.setPixelRatio(pixelRatio ?? Math.min(2, globalThis.devicePixelRatio || 1));
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    if (background !== null) r.setClearColor(new THREE.Color(background), 1); else r.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.env = studioEnvironment(r); this.scene.environment = this.env;
    this.camera = new THREE.PerspectiveCamera(26, 1, .05, 50);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb9a89a, .55));
    const key = this.key = new THREE.DirectionalLight(0xfff1e2, 2.3); key.position.set(-2.4, 4.2, 3.6);
    const rim = new THREE.DirectionalLight(0xd8e4ff, 1.3); rim.position.set(3, 2.2, -3);
    const fill = new THREE.DirectionalLight(0xffffff, .45); fill.position.set(2.5, .4, 3);
    this.scene.add(key, rim, fill);
    // A soft round shadow under the avatar: cheap, and it reads on any background.
    const n = 64, data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const d = Math.hypot(x - n / 2 + .5, y - n / 2 + .5) / (n / 2); data[(y * n + x) * 4 + 3] = Math.round(255 * Math.pow(Math.max(0, 1 - d), 1.6)); }
    const tex = new THREE.DataTexture(data, n, n); tex.needsUpdate = true; tex.magFilter = tex.minFilter = THREE.LinearFilter;
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2a2018, map: tex, transparent: true, opacity: shadow ? .3 : 0, depthWrite: false }));
    this.ground.renderOrder = -1; this.scene.add(this.ground);
    this.avatar = null; this.previous = null; this.running = false; this.last = 0; this.yaw = 0;
    this.resize();
  }

  /** Shows a document (it is normalized first). Returns the OpenAvatar. */
  load(document) {
    // The avatar shown before is disposed after the next frame, once the new one's materials have taken the shader
    // programs they share with it: disposed first, it would let three.js free them, and each load would compile them
    // all again.
    this.retire();
    if (this.avatar) { this.avatar.object.removeFromParent(); this.previous = this.avatar; }
    const a = this.avatar = new OpenAvatar(document, { quality: this.quality, envMap: this.env });
    a.object.rotation.y = this.yaw;
    this.scene.add(a.object);
    a.update(0);
    this.frame();
    return a;
  }

  /** Turns the avatar about its vertical axis, in degrees (90 shows its left side), and reframes it. */
  turn(degrees) {
    this.yaw = THREE.MathUtils.degToRad(degrees || 0);
    if (this.avatar) { this.avatar.object.rotation.y = this.yaw; this.frame(); }
  }

  /** Points the camera at the avatar's resting bounds. */
  frame() {
    const a = this.avatar; if (!a) return;
    // Room for the effects beside the head, on both sides so the avatar stays centered.
    const turn = new THREE.Matrix4().makeRotationY(this.yaw);
    const bounds = a.viewBounds(this.yaw), box = bounds.clone();
    if (this.roomForEffects) box.union(a.effects.reach().union(a.props.reach()).applyMatrix4(turn));
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    // A floating avatar casts its shadow a little below; a standing one stands on the ground.
    this.ground.position.y = bounds.min.y - (a.float ? .28 : .002);
    const bs = bounds.getSize(new THREE.Vector3());
    this.ground.scale.set(bs.x * 1.15, 1, Math.max(.4, bs.z) * 1.1); this.ground.material.opacity = (this.ground.material.opacity && (a.float ? .16 : .3));
    const cam = this.camera, fov = THREE.MathUtils.degToRad(cam.fov);
    // She stays centered on her own axis, so the frame is as wide as twice her wider side (a staff held out on one).
    const wide = 2 * Math.max(-box.min.x, box.max.x);
    const h = Math.max(s.y + (a.float ? .3 : 0), wide / cam.aspect) * this.margin;
    const dist = h / 2 / Math.tan(fov / 2) + s.z / 2;
    cam.position.set(0, c.y + s.y * .06, c.z + dist); cam.lookAt(0, c.y - (a.float ? .1 : 0), c.z);
    cam.near = dist / 20; cam.far = dist * 6; cam.updateProjectionMatrix();
  }

  resize(width, height) {
    const w = width ?? this.canvas.clientWidth ?? this.canvas.width, h = height ?? this.canvas.clientHeight ?? this.canvas.height;
    if (!w || !h) return;
    this.renderer.setSize(w, h, width === undefined ? false : true);
    this.camera.aspect = w / h; this.frame(); this.camera.updateProjectionMatrix();
  }
  setInput(input) { this.avatar?.setInput(input); }
  play(id, options) { return this.avatar?.play(id, options) ?? 0; }
  /** Advances by dt seconds and draws one frame. */
  render(dt = 0) { this.avatar?.update(dt); this.renderer.render(this.scene, this.camera); this.retire(); }
  retire() { this.previous?.dispose(); this.previous = null; }
  start() {
    if (this.running) return; this.running = true; this.last = performance.now();
    const loop = now => { if (!this.running) return; this.render(Math.min(.1, ((now ?? performance.now()) - this.last) / 1000)); this.last = now ?? performance.now(); this.raf = requestAnimationFrame(loop); };
    loop();
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  dispose() {
    this.stop(); this.retire(); this.avatar?.dispose(); this.env.dispose();
    this.ground.geometry.dispose(); this.ground.material.map.dispose(); this.ground.material.dispose(); this.renderer.dispose();
  }
}

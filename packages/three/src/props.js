// Props (SPEC 13.6): objects the renderer provides and documents only name. A
// prop pops in when the layers resolve to it and out when they move on. Held
// props sit where the avatar's hands meet in front of it (or float there when it
// has no arms), the laptop and the notepad rest on its lap, the magnifier goes
// up beside its face and headphones are worn over the top of its head.
import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { frontPoint, surfaceAlong } from './sdf.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const pop = v => v < 1 ? 1 + 2.4 * (v - 1) ** 3 + 1.4 * (v - 1) ** 2 : 1;

function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/** A box with rounded edges, centered on the origin. */
export function roundedBox(w, h, d, r) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const g = new THREE.ExtrudeGeometry(roundRect(w - 2 * r, h - 2 * r, r * .6), { depth: Math.max(1e-4, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 4, curveSegments: 8 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  return g;
}

// Each prop: where it goes and how to build it. Sizes are in avatar units for
// a body about two units tall; the avatar scales them to its own width.
const PROPS = {
  laptop: { at: 'lap', build(k) {
    const g = new THREE.Group(), shell = k.mat({ type: 'metal', color: '#C9CDD4', roughness: .38 });
    const base = k.mesh(roundedBox(.72, .035, .48, .014), shell); g.add(base);
    const keys = k.mesh(new THREE.PlaneGeometry(.6, .26).rotateX(-Math.PI / 2), k.mat({ type: 'rubber', color: '#2A2D33' })); keys.position.set(0, .0185, -.05); g.add(keys);
    // The lid opens at the edge away from the avatar, so its screen faces the avatar and the viewer sees the back.
    const lid = new THREE.Group(); lid.position.set(0, .016, .23); lid.rotation.x = .3; g.add(lid);
    const back = k.mesh(roundedBox(.72, .46, .022, .012), shell); back.position.y = .23; lid.add(back);
    const screen = k.mesh(new THREE.PlaneGeometry(.66, .4).rotateY(Math.PI), new THREE.MeshBasicMaterial({ color: '#BFD6FF' })); screen.position.set(0, .23, -.012); lid.add(screen);
    const logo = k.mesh(new THREE.CircleGeometry(.035, 24), k.mat({ type: 'ceramic', color: '#F4F6F8' })); logo.position.set(0, .25, .012); lid.add(logo);
    // Turned a little so the viewer sees it is a laptop, not a tablet.
    g.rotation.y = -.5;
    return g;
  } },
  notebook: { at: 'lap', build(k) {
    const g = new THREE.Group();
    const pad = k.mesh(roundedBox(.42, .03, .52, .01), k.mat({ type: 'felt', color: '#F6EEDC' })); g.add(pad);
    const cover = k.mesh(roundedBox(.42, .012, .06, .005), k.mat({ type: 'felt', color: '#E8705A' })); cover.position.set(0, .02, .24); g.add(cover);
    for (let i = 0; i < 5; i++) { const l = k.mesh(new THREE.PlaneGeometry(.32, .008).rotateX(-Math.PI / 2), k.mat({ type: 'felt', color: '#9DB4E8' })); l.position.set(0, .0165, .14 - i * .075); g.add(l); }
    const pencil = new THREE.Group(); pencil.position.set(.12, .07, -.02); pencil.rotation.set(0, .5, -.9); g.add(pencil);
    pencil.add(k.mesh(new THREE.CylinderGeometry(.018, .018, .3, 6), k.mat({ type: 'plastic', color: '#FFC83D' })));
    pencil.add(k.mesh(new THREE.ConeGeometry(.018, .05, 6).rotateX(Math.PI).translate(0, -.175, 0), k.mat({ type: 'clay', color: '#E7C9A2' })));
    const rubber = k.mesh(new THREE.CylinderGeometry(.018, .018, .035, 12), k.mat({ type: 'rubber', color: '#FF8FA3' })); rubber.position.y = .165; pencil.add(rubber);
    return g;
  } },
  book: { at: 'hands', build(k) {
    // Open toward the avatar, tipped up so it can read; the viewer sees the cover.
    const g = new THREE.Group(), cover = k.mat({ type: 'felt', color: '#4F7BE8' }), paper = k.mat({ type: 'felt', color: '#FBF6EA' });
    for (const s of [1, -1]) {
      const half = new THREE.Group(); half.rotation.y = s * .32; g.add(half);
      const c = k.mesh(roundedBox(.3, .4, .02, .008), cover); c.position.set(s * .15, 0, 0); half.add(c);
      const p = k.mesh(roundedBox(.28, .37, .03, .006), paper); p.position.set(s * .145, 0, -.022); half.add(p);
    }
    const spine = k.mesh(new THREE.CylinderGeometry(.025, .025, .4, 12), cover); spine.position.z = .01; g.add(spine);
    g.rotation.x = -.55;
    return g;
  } },
  clipboard: { at: 'hands', build(k) {
    const g = new THREE.Group();
    g.add(k.mesh(roundedBox(.38, .5, .02, .02), k.mat({ type: 'clay', color: '#C08A55' })));
    const sheet = k.mesh(roundedBox(.32, .4, .006, .003), k.mat({ type: 'felt', color: '#FFFFFF' })); sheet.position.set(0, -.03, -.013); g.add(sheet);
    for (let i = 0; i < 4; i++) {
      const box = k.mesh(roundedBox(.035, .035, .004, .004), k.mat({ type: 'felt', color: '#8EA9E6' })); box.position.set(-.11, .1 - i * .085, -.017); g.add(box);
      const l = k.mesh(new THREE.PlaneGeometry(.17, .012).rotateY(Math.PI), k.mat({ type: 'felt', color: '#C7D3EE' })); l.position.set(.03, .1 - i * .085, -.017); g.add(l);
    }
    const clip = k.mesh(roundedBox(.14, .06, .04, .012), k.mat({ type: 'metal', color: '#B8BEC8' })); clip.position.set(0, .25, -.012); g.add(clip);
    g.rotation.x = -.7;
    return g;
  } },
  cup: { at: 'hands', build(k) {
    const g = new THREE.Group(), glaze = k.mat({ type: 'ceramic', color: '#F2E3CF' });
    g.add(k.mesh(new THREE.CylinderGeometry(.1, .085, .2, 32), glaze));
    const handle = k.mesh(new THREE.TorusGeometry(.055, .016, 10, 24, Math.PI * 1.3).rotateZ(-Math.PI * .65), glaze); handle.position.x = .1; g.add(handle);
    const coffee = k.mesh(new THREE.CircleGeometry(.088, 32).rotateX(-Math.PI / 2), k.mat({ type: 'ceramic', color: '#6B3E26' })); coffee.position.y = .085; g.add(coffee);
    const band = k.mesh(new THREE.CylinderGeometry(.1005, .097, .05, 32, 1, true), k.mat({ type: 'ceramic', color: '#E8705A' })); band.position.y = -.02; g.add(band);
    g.position.x = .1;
    return g;
  } },
  phone: { at: 'hands', build(k) {
    const g = new THREE.Group();
    g.add(k.mesh(roundedBox(.17, .32, .024, .025), k.mat({ type: 'plastic', color: '#24262C' })));
    const screen = k.mesh(new THREE.PlaneGeometry(.15, .29).rotateY(Math.PI), new THREE.MeshBasicMaterial({ color: '#CFE0FF' })); screen.position.z = -.0125; g.add(screen);
    const cam = k.mesh(new THREE.CircleGeometry(.014, 16), k.mat({ type: 'glass', color: '#111111', opacity: .9 })); cam.position.set(-.045, .12, .0125); g.add(cam);
    g.rotation.x = -.45; g.position.x = .06;
    return g;
  } },
  gamepad: { at: 'hands', build(k) {
    const g = new THREE.Group(), body = k.mat({ type: 'plastic', color: '#F3F4F6' });
    g.add(k.mesh(roundedBox(.34, .14, .06, .05), body));
    for (const s of [1, -1]) { const grip = k.mesh(new THREE.SphereGeometry(.085, 24, 16), body); grip.scale.set(1, 1.15, .75); grip.position.set(s * .15, -.04, 0); g.add(grip); }
    const pad = k.mat({ type: 'plastic', color: '#30333A' });
    const h = k.mesh(roundedBox(.07, .022, .02, .006), pad), v = k.mesh(roundedBox(.022, .07, .02, .006), pad);
    for (const m of [h, v]) { m.position.set(-.1, .005, .034); g.add(m); }
    [['#FF6778', [.12, .03]], ['#6FD08C', [.12, -.02]], ['#8D9FFF', [.095, .005]], ['#FFC83D', [.145, .005]]].forEach(([c, [x, y]]) => {
      const b = k.mesh(new THREE.SphereGeometry(.014, 12, 8), k.mat({ type: 'plastic', color: c })); b.position.set(x, y, .034); g.add(b);
    });
    g.rotation.x = -.5;
    return g;
  } },
  popcorn: { at: 'lap', build(k) {
    const g = new THREE.Group();
    const box = k.mesh(new THREE.CylinderGeometry(.16, .11, .3, 8, 1, true), k.mat({ type: 'felt', color: '#FFFFFF', pattern: { type: 'stripes', colors: ['#E8483F'], axis: 'x', scale: .06 } }));
    box.material.side = THREE.DoubleSide; box.position.y = .15; g.add(box);
    const bottom = k.mesh(new THREE.CircleGeometry(.11, 8).rotateX(Math.PI / 2), k.mat({ type: 'felt', color: '#E8483F' })); g.add(bottom);
    const kernel = k.mat({ type: 'felt', color: '#FFF4D6' });
    for (let i = 0; i < 26; i++) {
      const a = i * 2.4, r = .14 * Math.sqrt((i + .5) / 26), b = k.mesh(new THREE.IcosahedronGeometry(.04 + .012 * Math.sin(i * 1.7), 1), kernel);
      b.position.set(r * Math.cos(a), .3 + .05 * (1 - r / .14) + .015 * Math.sin(i * 3.1), r * Math.sin(a)); b.rotation.set(i, i * 2, i * 3); g.add(b);
    }
    return g;
  } },
  magnifier: { at: 'side', build(k) {
    const g = new THREE.Group(), rim = k.mat({ type: 'metal', color: '#D9B45A', roughness: .3 });
    g.add(k.mesh(new THREE.TorusGeometry(.12, .02, 12, 48), rim));
    g.add(k.mesh(new THREE.CircleGeometry(.12, 48), k.mat({ type: 'glass', color: '#DDEBFF', opacity: .15 })));
    const handle = k.mesh(new THREE.CylinderGeometry(.022, .026, .22, 16), k.mat({ type: 'clay', color: '#7A4A2A' })); handle.position.set(.1, -.18, 0); handle.rotation.z = .55; g.add(handle);
    return g;
  } },
  headphones: { at: 'head', build(k, a) {
    // A band over the top of the head and a cup on each side, fitted by rays from the head's center.
    const g = new THREE.Group(), tone = k.mat({ type: 'plastic', color: '#30333A' }), cushion = k.mat({ type: 'velvet', color: '#5B5F68' });
    const c = a.headCenter, pts = [];
    for (let i = 0; i <= 20; i++) {
      const al = -Math.PI / 2 + Math.PI * i / 20, hit = surfaceAlong(a.bodySdf, c, [Math.sin(al), Math.cos(al), -.08]);
      if (hit) pts.push(new THREE.Vector3(...hit.p).addScaledVector(new THREE.Vector3(...hit.n), .07));
    }
    if (pts.length > 3) g.add(k.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, .032, 10, false), tone));
    for (const s of [1, -1]) {
      const hit = surfaceAlong(a.bodySdf, c, [s, -.05, -.05]); if (!hit) continue;
      const cup = new THREE.Group(); cup.position.set(...hit.p).addScaledVector(new THREE.Vector3(...hit.n), .05);
      cup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...hit.n));
      const shell = k.mesh(new THREE.CylinderGeometry(.13, .13, .07, 32).rotateX(Math.PI / 2), tone); shell.position.z = .02; cup.add(shell);
      const pad = k.mesh(new THREE.TorusGeometry(.105, .035, 12, 32), cushion); pad.position.z = -.025; cup.add(pad);
      g.add(cup);
    }
    return g;
  } },
};

export class Props {
  constructor(avatar) {
    this.avatar = avatar; this.built = new Map(); this.current = null;
    const bb = avatar.bodyBounds, sdf = avatar.bodySdf;
    this.scale = clamp((bb.hi[0] - bb.lo[0]) / 1.7, .6, 1.3);
    const suit = avatar.suit;
    const mid = (bb.lo[1] + bb.hi[1]) / 2, H = bb.hi[1] - bb.lo[1];
    this.headCenter = suit ? suit.head.center : [0, mid + H * .15, 0];
    const front = y => frontPoint(sdf, 0, y)?.p[2] ?? bb.hi[2];
    const arm = avatar.arms[0];
    // With arms, props go where the hands meet; without, low in front so the face stays clear.
    const handY = arm ? arm.group.position.y - .1 : bb.lo[1] + H * .27;
    // An armless avatar's lap props stand where it stands: the lowest point of its body and parts (a pot, a base).
    const ground = Math.min(bb.lo[1], avatar.bounds?.min.y ?? bb.lo[1]);
    // Where each kind of prop sits, in the body's space (before it moves).
    this.anchors = {
      lap: [0, arm ? handY - .14 : ground + .03, (arm ? front(handY) : front(bb.lo[1] + H * .25)) + .22 * this.scale],
      hands: [0, handY, front(handY) + .14 * this.scale],
      side: [Math.min(.9, bb.hi[0] * .8) + .1, (avatar.document.face?.eyes?.height ?? .15) + (avatar.faceDy || 0), front(.1) * .7 + .1],
      head: [0, 0, 0],
    };
    this.bodySdf = sdf;
  }
  /** The box props can reach, in the avatar's space, for framing a stage. */
  reach() {
    const [x, y, z] = this.anchors.lap, r = .4 * this.scale;
    return new THREE.Box3(new THREE.Vector3(x - r, y - .02, z - r), new THREE.Vector3(x + r, y + r, z + r * .6));
  }
  build(id) {
    if (this.built.has(id)) return this.built.get(id);
    const P = PROPS[id]; if (!P) { this.built.set(id, null); return null; }
    const av = this.avatar;
    const k = {
      mat: spec => { const m = makeMaterial(spec, { envMap: av.envMap, quality: av.quality }).material; av.disposables.push(m); return m; },
      mesh: (geo, mat) => { av.disposables.push(geo); const m = new THREE.Mesh(geo, mat); m.userData.noBounds = true; return m; },
    };
    const inner = P.build(k, this), holder = new THREE.Group();
    holder.add(inner); holder.visible = false; holder.userData.noBounds = true;
    if (P.at === 'head') av.bodyMesh.add(holder);
    else {
      const s = this.scale; inner.scale.multiplyScalar(s);
      holder.position.set(...this.anchors[P.at]);
      // Without arms a laptop or a notepad stays on the ground while the body moves; held props move with the body.
      (P.at === 'lap' && !av.arms.length ? av.root : av.bodyMesh).add(holder);
    }
    const entry = { id, holder, v: 0 };
    this.built.set(id, entry);
    return entry;
  }
  update(t, dt, b) {
    const want = b.prop && PROPS[b.prop] ? b.prop : null;
    if (want) this.build(want);
    for (const e of this.built.values()) {
      if (!e) continue;
      const target = e.id === want ? 1 : 0;
      e.v += (target - e.v) * (1 - Math.exp(-dt / (target ? .18 : .12)));
      e.holder.visible = e.v > .02;
      e.holder.scale.setScalar(Math.max(1e-4, pop(clamp(e.v))));
    }
    this.current = want;
  }
}

export const SUPPORTED_PROPS = Object.freeze(Object.keys(PROPS));

# @openavatar/three

The reference renderer for [OpenAvatar 0.1](https://github.com/Enconvo/OpenAvatar/blob/main/spec/SPEC.md)
in [three.js](https://threejs.org): soft-solid bodies, felt, fur and glass
materials, faces, parts, props, effects, outfits and motions, reacting live to
what an AI agent and its user are doing.

```sh
npm install @openavatar/three @openavatar/core three
```

A ready-made stage for one avatar on a canvas:

```js
import { parse } from '@openavatar/core';
import { OpenAvatarStage } from '@openavatar/three';

const stage = new OpenAvatarStage(canvas);
stage.load(parse(text).document);
stage.start();

stage.setInput({ state: 'speaking', voice: 0.6 }); // host inputs, SPEC 12.1
stage.setInput({ activity: 'working', userActivity: 'coding' });
stage.play('wave');                                 // a host command, SPEC 12.2
```

In your own three.js scene, add `new OpenAvatar(document).object`, call
`setInput()` when the situation changes and `update(dt)` every frame, and
`dispose()` when it goes.

| Export | What it is |
|---|---|
| `OpenAvatarStage` | Renderer, studio light, ground shadow and a camera that frames the avatar |
| `OpenAvatar` | One avatar as a `THREE.Object3D` (`object`), with `setInput`, `play`, `stop`, `update` and `dispose` |
| `SUPPORTED_MOTIONS`, `SUPPORTED_PROPS`, `SUPPORTED_EFFECTS`, `SUPPORTED_OUTFITS` | What this renderer draws |
| `@openavatar/three/sdf`, `/mesh`, `/patterns` | The shape field, the mesher and the pattern painter on their own |

Peer dependencies: `three` 0.160 or later and `@openavatar/core` 0.1. Avatars to try
are in the [gallery](https://openavatar.enconvo.com).

Apache-2.0.

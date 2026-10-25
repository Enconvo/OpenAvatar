# @openavatar/core

Reads, validates and repairs [OpenAvatar 0.1](https://github.com/Enconvo/OpenAvatar/blob/main/spec/SPEC.md)
documents (`.openavatar` files), and works out how an avatar reacts to what
its host reports. No dependencies; runs in browsers and Node.js.

```sh
npm install @openavatar/core
```

```js
import { parse, validate, resolveBehavior } from '@openavatar/core';

const { valid, errors } = validate(JSON.parse(text)); // SPEC 17.1: may this file be accepted?
const { document, repairs } = parse(text);           // the document as every reader sees it (SPEC 15)
const now = resolveBehavior(document, { state: 'thinking', userActivity: 'coding' });
// now.expression, now.motion, now.prop, now.effect, now.gaze: what each channel shows (SPEC 11)
```

| Export | What it does |
|---|---|
| `validate(value)` | Checks a parsed value against the spec: `{ valid, errors }` |
| `parse(text)`, `normalize(value)` | Reads a document the way every reader must, filling defaults and making the repairs of SPEC 15: `{ document, repairs }`. Throws `OpenAvatarError` for a file no reader accepts |
| `stringify(document)` | Writes a document back as JSON |
| `resolveBehavior(document, input)` | Resolves the layers of SPEC 11 for the host inputs of SPEC 12 |
| `VOCABULARY`, `MOTIONS`, `PROPS`, `EFFECTS`, `OUTFITS`, … | The standard ids and what each means |
| `@openavatar/core/schema.json`, `@openavatar/core/vocabulary.json` | The JSON Schema and the vocabulary as files |

TypeScript types ship with the package. To draw avatars, use
[`@openavatar/three`](https://www.npmjs.com/package/@openavatar/three); to
check, render and install them from a terminal, use
[`@openavatar/cli`](https://www.npmjs.com/package/@openavatar/cli). Avatars to
try are in the [gallery](https://openavatar.enconvo.com).

Apache-2.0. The specification is CC BY 4.0.

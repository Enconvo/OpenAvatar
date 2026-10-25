# OpenAvatar 0.1 reference

Every member a document can have, with its type, range and meaning. Generated from the
`openavatar` package by `spec/tools/skill-reference.mjs`; [SPEC.md](https://github.com/Enconvo/OpenAvatar/blob/main/spec/SPEC.md) is the full text.
Lengths are avatar units (a body is about 2 tall), angles are degrees, `[x, y]` positions on the
surface are front points, and a number outside its range is clamped. A front point is where the line
through `[x, y]` along z first meets the solid from the front; one that misses the solid floats at
z = 0, and `validate` warns about it.

## The document

| Member | Type | Meaning |
|---|---|---|
| `$schema` | text up to 500 | The JSON Schema URL, for editors; readers ignore it |
| `openavatar` (required) | text up to 16 | The spec version: `"0.1"` |
| `id` (required) | text up to 128 | Stable id of the character, 1 to 128 of `A-Z a-z 0-9 . _ -`; a lowercase UUID v4. Keep it when editing; a new character gets a new one |
| `name` (required) | text up to 64 | Display name |
| `meta` | object, see `meta` | Description, authors, license, provenance |
| `preview` | object, see `preview` | A picture for hosts that cannot render. Never write it: tools add it after rendering |
| `body` (required) | object, see `body` | The main solid and its rig |
| `materials` | object of id (`a-z 0-9 -`, up to 32) to `materials.<id>` | Named materials, at most 16; ids are 1 to 32 of `a-z 0-9 -` |
| `face` | object, see `face` | Eyes, mouth, cheeks, brows, nose |
| `parts` | list of up to 32: object, see `parts[]` | Pieces attached to the body, at most 32 |
| `outfit` | an outfit id or an `x-` id | A standard outfit the avatar wears by default (see Outfits) |
| `behavior` | object, see `behavior` | Temperament and reactions |
| `extensions` | object | Vendor data under reverse-DNS keys; readers ignore keys they do not know |

## `meta`

| Member | Type | Meaning |
|---|---|---|
| `description` | text up to 500 | One or two sentences |
| `authors` | list of up to 8: object, see `meta.authors[]` | Who made it |
| `license` | text up to 200 | An SPDX license expression; without one the character is all rights reserved |
| `version` | text up to 64 | The character's own semantic version |
| `tags` | list of up to 12: id (`a-z 0-9 -`, up to 32) | Lowercase keywords |
| `created` | text up to 64 | RFC 3339 date-time in the form `YYYY-MM-DDTHH:MM:SSZ`, on a real calendar day |
| `updated` | text up to 64 | RFC 3339 date-time; in the shared folder the copy of an id with the later one wins |
| `source` | text up to 500 | Where it is published |
| `derivedFrom` | object, see `meta.derivedFrom` | The character this one was remixed from |
| `generator` | object, see `meta.generator` | The tool that wrote it, and the AI model if one did |

## `meta.authors[]`

| Member | Type | Meaning |
|---|---|---|
| `name` (required) | text up to 64 | Author name |
| `url` | text up to 500 | Author link |

## `meta.derivedFrom`

| Member | Type | Meaning |
|---|---|---|
| `id` (required) | text up to 128 | Its id |
| `name` | text up to 64 | Its name |
| `url` | text up to 500 | Its page |

## `meta.generator`

| Member | Type | Meaning |
|---|---|---|
| `name` (required) | text up to 64 | Tool name |
| `version` | text up to 32 | Tool version |
| `model` | text up to 100 | The AI model id |

## `preview`

| Member | Type | Meaning |
|---|---|---|
| `image` (required) | text up to 131100 | A PNG or WebP data URI, at most 96 KB decoded |
| `background` | color `#RRGGBB` | Its background |

## `body`

| Member | Type | Meaning |
|---|---|---|
| `rig` | `blob`, `biped` | `blob` (default): one solid that moves as a whole. `biped`: a plush suit with head, body, legs and arms built from `proportions` |
| `shape` | shape | The solid; required for a blob. On a biped it is joined to the suit (smooth 0.06) in the body's space, so it does not move with the head when `proportions` change; put what belongs on the head on parts attached `to: "head"` |
| `material` | id (`a-z 0-9 -`, up to 32), or object | An id from `materials`, or a material written in place; default `"main"` |
| `anchor` | `ground`, `float` | `ground` (default): its lowest resting point, of the body, arms and parts that show at rest, stands on the floor. `float`: hovers and bobs |
| `proportions` | object, see `body.proportions` | Biped only; every number 0 to 1, default 0.5 |
| `arms` | object, see `body.arms` | Arms the renderer animates; a biped always has them |

## `body.proportions`

| Member | Type | Meaning |
|---|---|---|
| `head` | number 0 to 1 | Head size relative to the body |
| `headShape` | `round`, `wide`, `tall`, `square` | Default `round` |
| `body` | number 0 to 1 | Body size |
| `bodyShape` | `pear`, `round`, `slim`, `square` | Default `pear` |
| `legs` | number 0 to 1 | Leg length; 0 hides the legs |
| `arms` | number 0 to 1 | Arm length |

## `body.arms`

| Member | Type | Meaning |
|---|---|---|
| `style` | `nub`, `paw`, `none` | Default `none` on a blob, `nub` on a biped |
| `length` | number 0 to 1 | Default 0.5 |
| `thickness` | number 0 to 1 | Default 0.5 |
| `at` | [x, y], each -1.5 to 1.5 | Blob only: the front point of the shoulder at +x; the other mirrors it |
| `material` | id (`a-z 0-9 -`, up to 32), or object | An id from `materials`, or a material written in place; default the body's |

## `materials.<id>`

| Member | Type | Meaning |
|---|---|---|
| `type` | `felt`, `fur`, `velvet`, `plastic`, `rubber`, `clay`, `ceramic`, `glass`, `metal`, `toon` | Default `felt`. A renderer that cannot draw a type draws felt |
| `color` | color `#RRGGBB` | Base color, default `#9AA4B2` |
| `sheen` | color `#RRGGBB` | Soft highlight at grazing angles (felt, fur, velvet); default a lighter version of the color under it, so a pattern keeps its colors. A named sheen is one color over the whole pattern |
| `roughness` | number 0 to 1 | How blurred reflections are. Default by type: felt and fur 1, velvet 0.9, clay 0.92, rubber 0.8, plastic 0.32, metal 0.28, ceramic 0.12, glass 0.05 + 0.5 × opacity; toon ignores it |
| `pattern` | object, see `materials.<id>.pattern` | Painted in the object's own space |
| `glow` | object, see `materials.<id>.glow` | Gives off light: `intensity` times `base` plus the rest of the way to full with the driver's weight |
| `fur` | object, see `materials.<id>.fur` | Fur only |
| `opacity` | number 0 to 1 | Glass only: 0 clear, 1 frosted, default 0.2. Glass shows what is behind it, the host's background too; parts inside it show only as a haze |

## `materials.<id>.pattern`

| Member | Type | Meaning |
|---|---|---|
| `type` (required) | `gradient`, `stripes`, `spots`, `checks` | `gradient` blends along `axis` from one end of the part (or body) to the other; the others repeat |
| `colors` (required) | list of up to 4: color `#RRGGBB` | 1 to 4 colors that join the base color |
| `axis` | `x`, `y`, `z` | Default `y` |
| `scale` | number 0.05 to 4 | Size of one stripe, spot or check, in avatar units; smaller repeats more often. Default 0.3 |
| `angle` | number -360 to 360 | Stripes' angle in degrees: tilts them toward x (toward y when `axis` is `x`). Stripes start at 0 on the axis: the base color covers 0 to `scale`, then each of `colors` in turn, repeating both ways |

## `materials.<id>.glow`

| Member | Type | Meaning |
|---|---|---|
| `color` | color `#RRGGBB` | Default the base color |
| `intensity` | number 0 to 4 | Default 1; high values wash the color out toward white |
| `base` | number 0 to 1 | How much it glows when the driver's weight is 0, so it can glow always and brighten in a situation; default 0 |
| `driver` | a driver or an `x-` id | Default `always` (see Drivers) |

## `materials.<id>.fur`

| Member | Type | Meaning |
|---|---|---|
| `length` | number 0 to 1 | Strand length: 0.015 + 0.085 × length units long. Default 0.5 |
| `density` | number 0 to 1 | How thick the pile is: more and finer strands. Default 0.5 |
| `droop` | number 0 to 1 | How much strands hang. Default 0.3 |
| `tip` | color `#RRGGBB` | Strand tip color. Default the color under it, a quarter of the way to white |

## `face`

| Member | Type | Meaning |
|---|---|---|
| `type` | `bead`, `sewn`, `drawn`, `none` | `bead` (default): glossy bead eyes. `sewn`: felt cut-outs that change shape per expression. `drawn`: flat painted features. `none`: no face |
| `eyes` | object, see `face.eyes` | At the front points [-spacing, height] and [spacing, height] |
| `mouth` | object, see `face.mouth` | At the front point [0, height] |
| `cheeks` | object, see `face.cheeks` | Two round blush patches |
| `brows` | object, see `face.brows` | Two brows that tilt with expressions; omit for none |
| `nose` | object, see `face.nose` | Omit for none |
| `color` | color `#RRGGBB` | Ink for sewn and drawn eyes, brows and nose that have no color of their own, default `#1C1E23`. Drawn features are unlit and show their exact colors |
| `expressions` | object of an expression id or an `x-` id to `face.expressions.<id>` | Overrides the poses of an expression (see Expressions) |

## `face.eyes`

| Member | Type | Meaning |
|---|---|---|
| `shape` | `round`, `oval`, `tall`, `wide`, `dot`, `almond` | Default `round` |
| `size` | number 0.02 to 0.3 | Eye radius, default 0.09 |
| `spacing` | number 0 to 0.6 | From the middle to each eye's center, default 0.3 |
| `height` | number -1.2 to 1.2 | The y of the eyes, default 0.15 |
| `color` | color `#RRGGBB` | Default `#040406` on bead eyes, the face's `color` on sewn and drawn ones |
| `highlight` | true or false | A catchlight on bead eyes, default true |
| `blink` | true or false | Default true |
| `gaze` | true or false | Eyes follow what it looks at, default true |

## `face.mouth`

| Member | Type | Meaning |
|---|---|---|
| `shape` | `oval`, `smile`, `line`, `cat`, `beak`, `none` | Default `oval`, which shows only while speaking; the others always show |
| `width` | number 0.02 to 0.6 | Default 0.17 |
| `height` | number -1.2 to 1.2 | Default -0.1 |
| `color` | color `#RRGGBB` | Default `#2A0E17` |
| `speaks` | true or false | Opens with the voice, default true |

## `face.cheeks`

| Member | Type | Meaning |
|---|---|---|
| `color` | color `#RRGGBB` | Default `#FF9DB2` |
| `size` | number 0.02 to 0.4 | Default 0.12 |
| `spacing` | number 0 to 0.8 | Default 0.5 |
| `height` | number -1.2 to 1.2 | Default -0.02 |
| `show` | `always`, `happy`, `speaking`, `never` | `happy` (the default) flushes with happy, laugh, love and relaxed |

## `face.brows`

| Member | Type | Meaning |
|---|---|---|
| `color` | color `#RRGGBB` | Default the ink color |
| `thickness` | number 0.005 to 0.1 | Default 0.035; under about 0.03 they vanish at small sizes |
| `length` | number 0.02 to 0.4 | Default 0.12 |
| `height` | number -1.2 to 1.2 | How far above the eyes, default 0.12; unlike the other heights it is not a y |

## `face.nose`

| Member | Type | Meaning |
|---|---|---|
| `shape` | `button`, `triangle`, `snout` | Default `button`; `snout` is a muzzle in the body's material |
| `color` | color `#RRGGBB` | Default the ink color |
| `size` | number 0.01 to 0.3 | Default 0.05 |
| `height` | number -1.2 to 1.2 | Default halfway between eyes and mouth |

## `face.expressions.<id>`

| Member | Type | Meaning |
|---|---|---|
| `eyes` | `open`, `arc`, `chevron`, `heart`, `wide`, `sad`, `mad`, `shut`, `squint`, `wink-left`, `wink-right` | Eye pose |
| `mouth` | `smile`, `grin`, `o`, `flat`, `frown`, `hmm` | Mouth pose |
| `cheeks` | true or false | Flush or not while this pose shows, whatever `face.cheeks.show` says; needs `face.cheeks` with a `show` other than `never` |
| `effect` | an effect id or an `x-` id | An effect shown with it |

## `parts[]`

| Member | Type | Meaning |
|---|---|---|
| `id` (required) | id (`a-z 0-9 -`, up to 32) | Unique in the document |
| `role` | `ear`, `horn`, `antenna`, `hair`, `hat`, `tail`, `wing`, `leaf`, `fin`, `glasses`, `accessory`, `prop`, `detail` | What it is; hosts hide `hat` parts while a hat outfit is on. Default `detail` |
| `shape` | shape | Its solid, modeled around its own origin |
| `patch` | outline | Instead of `shape`: a cut-out 0.02 thick bent onto the surface around its attach point, 0.006 above it unless `attach.lift` says otherwise |
| `material` | id (`a-z 0-9 -`, up to 32), or object | An id from `materials`, or a material written in place; default the body's |
| `attach` | object, see `parts[].attach` | Where it sits: `to`, then one of `position`, `at`, `direction` |
| `mirror` | `x` | `x` adds a copy mirrored across x = 0 of the target's space. A part attached to a mirrored part is already on both copies |
| `pivot` | [x, y, z], each -5 to 5 | The point it turns and scales about, in its own space; default its origin |
| `animations` | list of up to 4: object, see `parts[].animations[]` | Up to 4 |

## `parts[].attach`

| Member | Type | Meaning |
|---|---|---|
| `to` | text up to 32 | `body` (default), `head`, `left-hand`, `right-hand`, or the id of a part listed earlier; the part moves, mirrors and hides with it (see Attach targets) |
| `position` | [x, y, z], each -5 to 5 | A point in the target's space (a part's own space when `to` names one); the part is not turned to a surface |
| `at` | [x, y], each -1.5 to 1.5 | A front point on the target; the part sits on the surface there |
| `direction` | [x, y, z], each -1 to 1 | From the target's center along this direction to where it leaves the surface for the last time; `[0,1,0]` is the top. The body's center is at x 0, z 0, halfway up the body, so on a blob with its head off that center use `at` for the head |
| `lift` | number -0.5 to 0.5 | With `at` or `direction`: out along the normal; negative sinks it in. Default 0 |
| `align` | `surface`, `upright`, `none` | With `at` or `direction`: `surface` (default) turns +z along the normal; `upright` and `none` only move it |
| `rotation` | [x, y, z], each -360 to 360 | An extra turn in degrees, with any way of placing: first about x, then y, then z, about the part's axes after `align` |

## `parts[].animations[]`

| Member | Type | Meaning |
|---|---|---|
| `type` (required) | `sway`, `spin`, `bob`, `pulse`, `wiggle`, `flap`, `appear`, `drift`, `glow` | See Animation types |
| `driver` | a driver or an `x-` id | When it plays and how strongly; default `always` (see Drivers) |
| `axis` | `x`, `y`, `z` | Default by type |
| `amount` | number -360 to 360 | Degrees, units or a factor, by type (see Animation types) |
| `speed` | number 0 to 8 | Cycles per second, default 1 (3 for `wiggle`) |
| `phase` | number 0 to 1 | Offset within the cycle, default 0 |

## `behavior`

| Member | Type | Meaning |
|---|---|---|
| `temperament` | object, see `behavior.temperament` | Every member 0 to 1, default 0.5 |
| `reactions` | object, see `behavior.reactions` | Replace the default reaction of a situation member by member (see the vocabulary lists); `null` turns a default off |
| `idleMotions` | list of up to 8: a motion id or an `x-` id | Played now and then while nothing happens; different ids |

## `behavior.temperament`

| Member | Type | Meaning |
|---|---|---|
| `energy` | number 0 to 1 | Calm and slow to quick and lively |
| `bounce` | number 0 to 1 | Stiff to squashy |
| `sway` | number 0 to 1 | Still to swaying when idle |
| `blink` | number 0 to 1 | Rare to frequent blinks |

## `behavior.reactions`

| Member | Type | Meaning |
|---|---|---|
| `states` | object of a state or an `x-` id to `reaction` or null | Keyed by conversation state |
| `activities` | object of an agent activity or an `x-` id to `reaction` or null | Keyed by agent activity |
| `userActivities` | object of a user activity or an `x-` id to `reaction` or null | Keyed by user activity |

## `reaction`

| Member | Type | Meaning |
|---|---|---|
| `expression` | an expression id or an `x-` id, or null | Set it, or `null` to turn the default off |
| `motion` | a motion id or an `x-` id, or null | Looping motions loop while the situation lasts; others play once |
| `prop` | a prop id or an `x-` id, or null | Held or sat at |
| `effect` | an effect id or an `x-` id, or null | Shown beside it |
| `gaze` | `user`, `down`, `up`, `side`, `around`, `pointer`, `work`, or null | `user` looks out at the person, `work` at its prop |
| `intensity` | number 0 to 1, or null | The expression's strength, default 1; motions play at full strength |

## Shapes

Every shape has `type` and may have the common members:

`position`? ([x, y, z], each -5 to 5); `rotation`? ([x, y, z], each -360 to 360); `scale`? (number 0.05 to 20, or [x, y, z], each 0.05 to 20); `mirror`? (`x`, `y`, `z`); `inflate`? (number -0.3 to 0.3); `deform`? (list of up to 4: deformer).

Every primitive is centered on its own origin. A shape's deformers act in its own space, before its `scale`, then `rotation` (first about x, then y, then z, about the parent's axes), then `position`. `rounding` never grows a solid. `mirror` adds the reflection across the plane through the origin. `inflate` grows (or, negative, shrinks) the surface.

| `type` | Members | Solid |
|---|---|---|
| `sphere` | `radius` (number 0.01 to 1.5) | A ball |
| `ellipsoid` | `radii` ([x, y, z], each 0.01 to 1.5) | An egg stretched to three radii |
| `box` | `size` ([x, y, z], each 0.01 to 3); `rounding`? (number 0 to 1.5) | A box with rounded edges; `size` is the full extent |
| `superellipsoid` | `radii` ([x, y, z], each 0.01 to 1.5); `exponent`? (number 1 to 10) | Between an ellipsoid (exponent 2) and a box (high values); 1 gives a diamond; default 3 |
| `capsule` | `from` ([x, y, z], each -3 to 3); `to` ([x, y, z], each -3 to 3); `radius` (number 0.005 to 1); `radiusTo`? (number 0.005 to 1) | A rod with round ends from `from` to `to`, tapering to `radiusTo` |
| `cylinder` | `radius` (number 0.01 to 1.5); `height` (number 0.01 to 3); `rounding`? (number 0 to 1.5) | Upright on the y axis, from -height/2 to height/2 |
| `cone` | `radius` (number 0.01 to 1.5); `radiusTop`? (number 0 to 1.5); `height` (number 0.01 to 3); `rounding`? (number 0 to 1.5) | Upright on y, base down at -height/2; `radiusTop` makes a frustum |
| `torus` | `radius` (number 0.02 to 1.5); `thickness` (number 0.005 to 0.75) | A ring lying in the xz plane: a tube of radius `thickness` around a circle of radius `radius`; rotate it [90, 0, 0] to stand it up |
| `extrusion` | `outline` (outline); `depth` (number 0.005 to 3); `rounding`? (number 0 to 1.5); `puff`? (number 0 to 1) | The outline pushed out along z, centered on z = 0; `puff` swells the middle like a pillow |
| `halfspace` | `normal` ([x, y, z], each -1 to 1); `offset`? (number -3 to 3) | Every point whose distance along `normal` (any length; it is normalized) is below `offset`; use it inside intersect or subtract to cut |
| `union` | `children` (list of 1 to 32 shapes); `smooth`? (number 0 to 1) | All children; `smooth` blends the seams like a soft toy (0.1 to 0.4) |
| `subtract` | `children` (list of 2 to 32 shapes); `smooth`? (number 0 to 1) | The first child with the others cut away |
| `intersect` | `children` (list of 2 to 32 shapes); `smooth`? (number 0 to 1) | Only where every child is |

## Outlines

Flat shapes in the xy plane, for `extrusion` and `patch`. Common members: `rotation`? (number -360 to 360); `scale`? (number 0.05 to 20, or [x, y], each 0.05 to 20); `mirror`? (`x`, `y`). `rotation`, `scale` and `mirror` act about `[0, 0]`, not about `center`: the scale first, then the rotation, then the mirror.

| `type` | Members | Outline |
|---|---|---|
| `circle` | `radius` (number 0.005 to 3); `center`? ([x, y], each -3 to 3) | A disk |
| `ellipse` | `radii` ([x, y], each 0.005 to 3); `center`? ([x, y], each -3 to 3) | An oval |
| `rect` | `size` ([x, y], each 0.005 to 6); `center`? ([x, y], each -3 to 3); `rounding`? (number 0 to 3) | A rounded rectangle |
| `polygon` | `points` (list of 3 to 64 points [x, y]); `rounding`? (number 0 to 1) | A simple polygon, either winding; `rounding` rounds its convex corners, and a polygon thinner than its rounding rounds only as much as it can hold |
| `star` | `points` (integer 3 to 12); `radius` (number 0.005 to 3); `innerRadius` (number 0.001 to 3); `center`? ([x, y], each -3 to 3) | A star with one point up |
| `heart` | `size` (number 0.01 to 3); `center`? ([x, y], each -3 to 3) | A heart, point down: the point is `size`/2 below `center`, and the lobes reach 0.6 × `size` above it and to either side |
| `stroke` | `points` (list of 2 to 64 points [x, y]); `width` (number 0.002 to 1); `widthTo`? (number 0.002 to 1) | A polyline drawn with a round pen, tapering from `width` to `widthTo` |
| `union` | `children` (list of 1 to 32 outlines); `smooth`? (number 0 to 1) | As for shapes, in 2D |
| `subtract` | `children` (list of 2 to 32 outlines); `smooth`? (number 0 to 1) | As for shapes, in 2D |
| `intersect` | `children` (list of 2 to 32 outlines); `smooth`? (number 0 to 1) | As for shapes, in 2D |

## Deformers

Up to 4 per shape in `deform`, applied in order.

| `type` | Members | Effect |
|---|---|---|
| `taper` | `axis` (`x`, `y`, `z`); `amount` (number -1 to 1) | The cross-section grows by `amount` per unit along the axis; negative narrows toward +axis |
| `twist` | `axis` (`x`, `y`, `z`); `amount` (number -180 to 180) | Turns the cross-section `amount` degrees per unit along the axis |
| `bend` | `axis` (`x`, `y`, `z`); `toward` (`x`, `y`, `z`); `amount` (number -180 to 180) | Curves the axis into a circular arc toward `toward`: its direction turns `amount` degrees per unit of length, so a piece of length L turns `amount`·L degrees, and keeps its thickness. Both sides of the origin curve the same way (a positive amount toward +`toward`), so put the origin where the curve starts, such as a capsule's `from` at `[0, 0, 0]` |
| `squash` | `axis` (`x`, `y`, `z`); `below`? (number 0.2 to 5); `above`? (number 0.2 to 5) | Scales the half below 0 on the axis by `below` and the half above by `above`, each default 1 |
| `ripple` | `axis` (`x`, `y`, `z`); `count` (integer 2 to 32); `amplitude` (number 0 to 0.2); `range`? ([x, y], each -3 to 3) | `count` bumps around the axis, like a skirt's hem or petals, not waves along it; `range` limits them to a stretch of the axis |

## Vocabulary

An unknown id falls back: an expression to `neutral`, a motion along its fallbacks to a base motion, else `nod`, and a prop, effect or outfit to none. `x-` ids are for hosts that know them.

### Conversation states

| Id | Meaning | Default reaction |
|---|---|---|
| `idle` | Nothing is happening | gaze user |
| `listening` | The user is talking or typing to the agent | expression neutral, gaze user, motion lean-in |
| `thinking` | The agent is working on an answer | expression thinking, gaze up, effect dots |
| `speaking` | The agent is speaking or its reply is streaming | expression happy, intensity 0.4, gaze user |

### Agent activities

| Id | Meaning | Default reaction |
|---|---|---|
| `searching` | Looking things up | motion look-around, gaze around |
| `working` | Running a tool or a long task | expression thinking, intensity 0.6, motion nod-beat, gaze work |
| `waiting` | Waiting for the user's answer or approval | expression surprised, intensity 0.6, motion bounce, gaze user |
| `error` | A task failed | expression sad, motion shake, effect sweat |
| `done` | A task finished | expression happy, motion hop, effect sparkles |
| `sleeping` | Nothing has happened for a long time | expression sleepy, motion sleep, effect zzz |

### User activities

| Id | Meaning | Default reaction |
|---|---|---|
| `coding` | Writing code | prop laptop, motion typing, expression thinking, intensity 0.4, gaze work |
| `writing` | Writing text: documents, notes, mail | prop notebook, motion writing, gaze work |
| `reading` | Reading: articles, documents, PDFs | prop book, motion reading, gaze work |
| `browsing` | Browsing the web | motion look-around, gaze side |
| `designing` | Drawing or designing | prop notebook, motion writing, expression thinking, intensity 0.5 |
| `form-filling` | Filling in a form | prop clipboard, expression thinking, gaze work |
| `chatting` | Messaging people | expression happy, intensity 0.5, motion nod |
| `meeting` | In a call or meeting | expression neutral, gaze user, quiet true |
| `watching` | Watching a video | prop popcorn, expression happy, intensity 0.4, gaze side |
| `listening-music` | Listening to music | prop headphones, motion groove, effect notes |
| `gaming` | Playing a game | prop gamepad, expression happy, intensity 0.6 |
| `away` | Away from the computer | expression sleepy, intensity 0.6, motion sleep |

### Expressions

| Id | Eyes | Mouth | Fallback |
|---|---|---|---|
| `neutral` | open | rest |  |
| `happy` | arc | smile | neutral |
| `angry` | mad | frown | neutral |
| `sad` | sad | frown | neutral |
| `relaxed` | arc | smile | happy |
| `surprised` | wide | o | neutral |
| `laugh` | chevron | grin | happy |
| `thinking` | squint | hmm | neutral |
| `love` | heart | smile | happy |
| `sleepy` | shut | flat | relaxed |
| `wink-left` | wink-left | smile | happy |
| `wink-right` | wink-right | smile | happy |

### Motions

| Id | Movement | Needs | Loops | Fallback |
|---|---|---|---|---|
| `nod` | Nods yes |  |  |  |
| `hop` | One small jump with a landing squash |  |  |  |
| `spin` | One full turn |  |  |  |
| `wiggle` | A side-to-side shimmy |  |  |  |
| `shake` | Shakes its head no |  |  | wiggle |
| `bow` | Bows |  |  | nod |
| `jump` | A big jump |  |  | hop |
| `bounce` | Small hops in a row |  | yes | hop |
| `nod-beat` | Quick nods to a beat, busy |  | yes | nod |
| `look-around` | Looks from side to side |  | yes | wiggle |
| `lean-in` | Leans toward the user, attentive |  |  | nod |
| `shiver` | Trembles |  |  | wiggle |
| `stretch` | Stretches up tall |  |  | jump |
| `yawn` | Yawns |  |  | nod |
| `sleep` | Settles down and breathes slowly |  | yes | nod |
| `peek` | Peeks out from one side |  |  | look-around |
| `groove` | Sways to music |  | yes | bounce |
| `dance` | Dances |  | yes | groove |
| `celebrate` | Celebrates a success |  |  | jump |
| `wave` | Waves hello | arms |  | wiggle |
| `clap` | Claps | arms |  | celebrate |
| `cheer` | Both arms up | arms |  | celebrate |
| `shrug` | Shrugs | arms |  | wiggle |
| `point` | Points to the side | arms |  | nod |
| `think` | Hand to chin, pondering | arms |  | look-around |
| `typing` | Types on its prop | arms | yes | nod-beat |
| `writing` | Writes on its prop | arms | yes | typing |
| `reading` | Holds its prop and reads, turning pages | arms | yes | nod |
| `facepalm` | Hand to face | arms |  | shake |
| `heart-hands` | Makes a heart with its arms | arms |  | celebrate |

### Props

| Id | What |
|---|---|
| `laptop` | An open laptop in front of it |
| `book` | An open book in its hands |
| `notebook` | A notepad and pencil |
| `magnifier` | A magnifying glass |
| `clipboard` | A clipboard with a form |
| `cup` | A warm cup |
| `phone` | A phone in its hand |
| `headphones` | Headphones it wears |
| `gamepad` | A game controller |
| `popcorn` | A box of popcorn |

### Effects

Placed beside and above the head, clear of the body and the parts on it.

| Id | What |
|---|---|
| `dots` | A typing bubble with three dots |
| `zzz` | Floating Z letters |
| `sparkles` | Twinkling stars |
| `hearts` | Rising hearts |
| `notes` | Music notes |
| `question` | A question mark |
| `exclaim` | An exclamation mark |
| `sweat` | A drop of sweat |
| `steam` | Puffs of steam |
| `confetti` | Falling confetti |

### Outfits

Hats are marked; a hat outfit hides `hat` parts.

`party-hat` (hat), `beanie` (hat), `crown` (hat), `headphones`, `bow-tie`, `flower`, `witch-hat` (hat), `santa-hat` (hat), `bunny-ears`, `scarf`, `chef-hat` (hat), `cowboy-hat` (hat), `headband`, `halo`, `top-hat` (hat), `graduation-cap` (hat), `beret` (hat), `flower-crown`, `propeller-cap` (hat), `pirate-hat` (hat), `lei`, `bucket-hat` (hat), `cat-ears`, `antennae`, `viking-helmet` (hat), `hair-bow`, `devil-horns`, `unicorn-horn`, `goggles`, `hard-hat` (hat), `sailor-hat` (hat), `tiara`, `mushroom-cap` (hat), `jester-hat` (hat), `fez` (hat), `bowler-hat` (hat), `earmuffs`, `sprout`, `laurel-wreath`, `baseball-cap` (hat), `straw-hat` (hat), `deerstalker` (hat), `bandana`, `chick`, `butterfly`, `headlamp`, `frog-hat` (hat), `strawberry-hat` (hat), `fire-helmet` (hat).

### Drivers

A driver is a weight from 0 to 1 that eases over about 0.3 s: `always`; `active` (not idle); `voice` (speech level while speaking); `mic` (the user's voice while listening); `pointer` (the pointer near the middle of the avatar's frame); any state, agent activity, user activity or expression id. `thinking` is both a state and an expression; as a driver it is the state.

### Attach targets

`body`: the body's space. `head`: on a biped, a space with its origin at the head's center, which moves with the head when the proportions change; on a blob, the body's space. `left-hand` and `right-hand`: a space at the tip of that arm (the avatar's left is +x), with its origin inside the arm's round end, whose radius is 0.08 + 0.14 × the arms' `thickness` (so model a held item's grip at least that far out, or the hand hides it), turning with it as it waves or holds a prop; while the arm rests, +y is up, +z forward and +x away from the body in both, so a part modeled upright is held upright and reads the same in either hand, and `mirror: "x"` puts its copy in the other hand. Without arms, the hands are where the arms would hang. A part id never shadows these names.

### Animation types

The axis is in the part's own space, so it turns with the part's `rotation` and with the part it is attached `to`. Several animations on one part apply in order: turns follow each other, moves add, scales multiply.

| `type` | Defaults | Movement |
|---|---|---|
| `sway` | axis z, amount 10 | Turns back and forth about the pivot, around the axis, by up to `amount` degrees |
| `spin` | axis y | Turns on and on about the pivot, around the axis, `speed` turns per second; it settles when the weight falls |
| `bob` | axis y, amount 0.05 | Moves back and forth along the axis by up to `amount` units |
| `pulse` | amount 0.15 | Scales by up to 1 + `amount` |
| `wiggle` | axis z, amount 6, speed 3 | A quick shake of up to `amount` degrees |
| `flap` | axis z, amount 25 | Flaps up and back by up to `amount` degrees, twice a cycle; the mirrored copy flaps the mirror way |
| `appear` | — | Grows from nothing with the weight, hidden at 0 |
| `drift` | axis y, amount -0.6 | Moves `amount` units along the axis each cycle from where the part is, fading in and out, then starts again; it shrinks away as the weight falls |
| `glow` | amount 1 | Adds up to `amount` to the part's glow intensity, on top of its material's glow |

### Poses and gazes

What `face.expressions` can set. Eye poses: `open` (the eye shape at rest), `arc` (closed and curved up, pleased), `chevron` (closed and pointing in, laughing), `heart` (hearts), `wide` (large and round), `sad` (drooping at the outer corners), `mad` (lids slanting down toward the middle), `shut` (closed lines), `squint` (nearly closed, content), `wink-left` (the avatar's left eye closed), `wink-right` (the avatar's right eye closed). Mouth poses: `smile` (a closed smile), `grin` (an open smile), `o` (a small round opening), `flat` (a straight line), `frown` (curved down), `hmm` (a small crooked line).

Gazes: `user`, `down`, `up`, `side`, `around`, `pointer`, `work`.

## Limits

At most 512 shapes and outlines in all, nested at most 16 deep, 1024 polygon and stroke points, 32 parts, 16 materials, 4 animations per part, 4 deformers per shape, 32 children per combinator and 8 idle motions. A file is at most 256 KB. A reader rejects a document over the shape, depth, point or file limits; it cuts the other lists.

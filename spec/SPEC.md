# OpenAvatar 0.1

**Status:** Draft, 2026-10-24.
**Editors:** the Enconvo team.
**License:** this document is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
**Schema:** [`schema/openavatar-0.1.schema.json`](schema/openavatar-0.1.schema.json).
**Vocabulary:** [`vocabulary.json`](vocabulary.json).

OpenAvatar is an open format for the animated characters that AI agents show
on screen. An OpenAvatar document is a small JSON file that says what a
character looks like and how it reacts: its shape, built from a fixed set of
solid primitives, its materials, its face, the parts it wears, and what it
does while the agent listens, thinks, speaks or works and while the user
types, reads or watches. A document holds data only. Any app that implements
this spec can render any document and drive it from its own agent, so a
character made in one app works in every other.

The format is designed to be written by AI models as much as by people. Every
field has a meaning that can be described in words, numbers have documented
ranges, and a reader repairs what a writer gets wrong instead of failing.

## Contents

1. [Conventions](#1-conventions)
2. [Concepts](#2-concepts)
3. [The document](#3-the-document)
4. [Space and units](#4-space-and-units)
5. [Shapes](#5-shapes)
6. [Body](#6-body)
7. [Materials](#7-materials)
8. [Face](#8-face)
9. [Parts](#9-parts)
10. [Animations](#10-animations)
11. [Behavior](#11-behavior)
12. [The host interface](#12-the-host-interface)
13. [Vocabularies](#13-vocabularies)
14. [Files, storage and exchange](#14-files-storage-and-exchange)
15. [Versioning and compatibility](#15-versioning-and-compatibility)
16. [Security and privacy](#16-security-and-privacy)
17. [Conformance](#17-conformance)
18. [Designing avatars with AI (informative)](#18-designing-avatars-with-ai-informative)

[Appendix A. Shape fields](#appendix-a-shape-fields)\
[Appendix B. Normalization](#appendix-b-normalization)\
[Appendix C. Face features](#appendix-c-face-features)\
[Appendix D. Whole-body motion](#appendix-d-whole-body-motion)

## 1. Conventions

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, RECOMMENDED, MAY
and OPTIONAL are to be interpreted as described in RFC 2119 and RFC 8174 when,
and only when, they appear in all capitals.

JSON types are written as in JSON Schema: `string`, `number`, `integer`,
`boolean`, `array`, `object`. A **vec2** is an array of two numbers, a
**vec3** an array of three. A **color** is a string `#RRGGBB` of six
hexadecimal digits in the sRGB color space; readers MUST also accept
`#RGB` and lowercase digits. A **name** is a string of 1 to 32 characters
from `a-z 0-9 -` that does not start with `-`; material ids, part ids and
tags are names. An **`x-` id** is `x-` followed by 1 to 40 characters from
`a-z 0-9 -`, the first not `-` (3.4). A KB is 1024 bytes.

The JSON Schema ([`schema/openavatar-0.1.schema.json`](schema/openavatar-0.1.schema.json))
is part of this spec. It gives the range of every number, the length of
every string and list, and the pattern of every string, including those
this text does not repeat; where the text gives one, the two agree.

Sections marked *informative* are not part of the normative spec.

## 2. Concepts

- **Document**: one OpenAvatar character, a JSON object as defined in
  section 3.
- **Writer**: anything that produces documents: an editor, a script, an AI
  model.
- **Reader**: anything that parses documents. A reader validates and
  normalizes a document (section 15) before use.
- **Renderer**: a reader that draws a document and animates it. The
  reference renderer is `@openavatar/three`.
- **Host**: the app that shows the avatar and tells the renderer what is
  happening: what the agent is doing, what the user is doing, the voice
  level. Section 12 defines what a host provides.
- **Gallery**: a website that publishes documents for others to download.

## 3. The document

A document is a JSON object. Its top-level members are:

| Member | Type | Required | Meaning |
|---|---|---|---|
| `openavatar` | string | yes | The spec version the document follows, `"0.1"` for this spec |
| `id` | string | yes | A stable identifier for the character (3.1) |
| `name` | string | yes | Display name, 1 to 64 characters |
| `meta` | object | no | Description, authors, license, provenance (3.2) |
| `preview` | object | no | A still image for hosts that cannot render (3.3) |
| `body` | object | yes | The main solid and its rig (section 6) |
| `materials` | object | no | Named materials (section 7) |
| `face` | object | no | Eyes, mouth, cheeks, brows, nose (section 8) |
| `parts` | array | no | Pieces attached to the body (section 9) |
| `outfit` | string | no | A standard outfit id the avatar wears by default (13.8) |
| `behavior` | object | no | Temperament and reactions (section 11) |
| `extensions` | object | no | Vendor data (3.4) |
| `$schema` | string | no | The URL of the JSON Schema, for editors; readers ignore it |

A writer MUST NOT add other top-level members.

### 3.1 Identifier

`id` is 1 to 128 characters from `A-Z a-z 0-9 . _ -`. It identifies the
character across versions of the document: an edited character keeps its
`id`, a copy that someone changes into a new character gets a new one. Writers
SHOULD use a random UUID (version 4, lowercase). A writer that cannot make a
UUID (for example an AI model writing JSON by hand) MAY leave a placeholder;
the tool that saves the document then replaces it.

### 3.2 Metadata

`meta` is an object with these optional members:

| Member | Type | Meaning |
|---|---|---|
| `description` | string | One or two sentences, at most 500 characters |
| `authors` | array | Up to 8 objects `{ "name": string, "url"?: string }` |
| `license` | string | An SPDX license expression that covers the document |
| `version` | string | The character's own version, a semantic version |
| `tags` | array | Up to 12 names (section 1) |
| `created`, `updated` | string | RFC 3339 date-times that name real instants (B.2) |
| `source` | string | An `https` URL where the character is published |
| `derivedFrom` | object | `{ "id": string, "name"?: string, "url"?: string }`: the character this one was remixed from |
| `generator` | object | `{ "name": string, "version"?: string, "model"?: string }`: the tool, and the AI model if one wrote it |

A document without `license` is all rights reserved: a host MAY render it for
the person who has it, and MUST NOT publish or redistribute it. Galleries
SHOULD require a license that allows redistribution.

### 3.3 Preview

`preview` is `{ "image": string, "background"?: color }`. `image` is a
`data:` URI of a PNG or WebP picture, at most 96 KB decoded, that shows the
character from the front on a transparent or plain background. A host that
cannot render the document MAY show the picture instead. Renderers MUST NOT
use it for anything else. A document SHOULD NOT carry a preview when it is
written by an AI model; tools add it after rendering.

### 3.4 Extensions

`extensions` maps reverse-DNS keys (for example `com.enconvo`) to objects: a
key is two or more labels of `a-z 0-9 -` joined by periods, at most 253
characters in all. A reader MUST ignore keys it does not know. Data under `extensions` MUST NOT
change how the standard members are understood; it may only add to it.
Enumerated values in standard members MAY use a vendor `x-` id (section 1,
for example a motion `x-moonwalk`); a reader that does not know it
uses the member's fallback (section 13).

## 4. Space and units

- The space is right-handed: **+y** is up, **+z** points out of the screen
  toward the viewer, and **+x** is the viewer's right. The avatar faces +z.
- Lengths are in **avatar units**. A body SHOULD fit inside the box from
  -1 to 1 on every axis and MUST fit inside -1.5 to 1.5. With its parts, the
  whole avatar SHOULD fit inside -1.5 to 1.5 and MUST fit inside -2 to 2; a
  renderer MAY leave out parts that reach beyond that. Renderers scale the
  avatar to fit their stage, so only proportions matter: a body two units tall
  is the normal size.
- Angles are in **degrees**.
- A **front point** `[x, y]` names a spot on the surface as seen from the
  front: the first point where the line from `(x, y, +∞)` toward -z meets the
  solid. Faces and parts are placed this way, so a writer can place an eye
  without knowing exactly where the surface is. A line that misses the solid
  gives `(x, y, 0)`, facing +z (A.9).
- Numbers have documented ranges. A reader MUST clamp a number outside its
  range to the nearest bound.

## 5. Shapes

A **shape** is a JSON object that describes a solid. Shapes nest: primitives
are the leaves, and combinators join them. Every shape has a `type`, and
every shape MAY have the common members in 5.1. The meaning of a shape is a
signed distance field: a function that is negative inside the solid, zero on
its surface and positive outside. Appendix A defines each field exactly.
Renderers MAY turn it into a mesh any way they like; the reference renderer
uses dual contouring.

### 5.1 Common members

| Member | Type | Default | Meaning |
|---|---|---|---|
| `type` | string | required | One of the shape types below |
| `position` | vec3 | `[0,0,0]` | Moves the shape; each coordinate -5 to 5 |
| `rotation` | vec3 | `[0,0,0]` | Turns the shape, in degrees, first about x, then y, then z, all about the parent's axes |
| `scale` | number or vec3 | `1` | Scales the shape about its origin; each factor 0.05 to 20 |
| `mirror` | string | none | `"x"`, `"y"` or `"z"`: adds the shape's reflection across the parent's plane through the origin (x = 0 for `"x"`), joined with a union |
| `deform` | array | none | Up to 4 deformers (5.5), applied in order |
| `inflate` | number | `0` | Grows the solid outward by this distance (shrinks it when negative), -0.3 to 0.3 |

Order of operations: to find whether a point of the parent's space is inside
a shape, take away `position`, undo `rotation` and `scale`, undo the
deformers from last to first, evaluate the primitive or combinator, and
subtract `inflate`. `mirror` evaluates the shape at the point and at its
reflection and takes the nearer. A.6 gives the exact steps.

### 5.2 Primitives

Each primitive is centered on its own origin.

| `type` | Members (range) | Solid |
|---|---|---|
| `sphere` | `radius` (0.01–1.5) | A ball |
| `ellipsoid` | `radii` vec3 (each 0.01–1.5) | An egg stretched to the three radii |
| `box` | `size` vec3 (each 0.01–3, full extents), `rounding` (0 to half the smallest size) | A box with rounded edges |
| `superellipsoid` | `radii` vec3, `exponent` (1–10, default 3) | Between an ellipsoid (2) and a box (high values); 1 gives a diamond |
| `capsule` | `from` vec3, `to` vec3, `radius` (0.005–1), `radiusTo` (default `radius`) | A rod with round ends, tapering from `radius` at `from` to `radiusTo` at `to` |
| `cylinder` | `radius` (0.01–1.5), `height` (0.01–3), `rounding` | A cylinder on the y axis |
| `cone` | `radius` (0.01–1.5), `radiusTop` (0 to 1.5, default 0), `height` (0.01–3), `rounding` | A cone or frustum on the y axis, base down |
| `torus` | `radius` (0.02–1.5), `thickness` (0.005–0.75) | A ring lying in the xz plane: a tube of radius `thickness` around a circle of radius `radius` |
| `extrusion` | `outline` (5.4), `depth` (0.005–3), `rounding`, `puff` (0–1, default 0) | The outline pushed out along z, centered on z = 0; `puff` swells the middle like a pillow |
| `halfspace` | `normal` vec3 (each -1 to 1, of any length), `offset` (-3 to 3, default 0) | Every point whose distance along `normal` is below `offset`; used to cut |

`rounding` (default 0) rounds the edges with that radius and never grows
the solid. A.3 gives each primitive's field.

### 5.3 Combinators

| `type` | Members | Solid |
|---|---|---|
| `union` | `children` (1–32 shapes), `smooth` (0–1, default 0) | All children together |
| `subtract` | `children` (2–32 shapes), `smooth` | The first child with the others cut away |
| `intersect` | `children` (2–32 shapes), `smooth` | Only where every child is |

`smooth` blends the seams with a fillet of about that size, the way soft toys
and clay join. A `smooth` of 0, the default, gives a sharp seam. Children are joined one at
a time, from the first to the last (A.2), and with `smooth` their order
changes the result.

### 5.4 Outlines

An **outline** is a flat shape in the xy plane, used by `extrusion` and by
patches (9.3). Outlines have their own types:

| `type` | Members | Outline |
|---|---|---|
| `circle` | `radius` (0.005–3), `center` | A disk |
| `ellipse` | `radii` vec2 (each 0.005–3), `center` | An oval |
| `rect` | `size` vec2 (each 0.005–6), `center`, `rounding` (0–3) | A rectangle with rounded corners |
| `polygon` | `points` (3–64 vec2), `rounding` (0–1) | A simple polygon, either winding; `rounding` rounds its convex corners, and a polygon too thin for it rounds by what it can hold |
| `star` | `points` (integer 3–12), `radius` (0.005–3), `innerRadius` (0.001–3), `center` | A star with one point up |
| `heart` | `size` (0.01–3), `center` | A heart, point down: the point `size`/2 below `center`, the lobes 0.6 · `size` above it and to either side |
| `stroke` | `points` (2–64 vec2), `width` (0.002–1), `widthTo` (default `width`) | A polyline drawn with a round pen, tapering from `width` to `widthTo` |
| `union`, `subtract`, `intersect` | `children` (outlines), `smooth` | As in 5.3, in 2D |

`rounding` and `smooth` default to 0. Outlines MAY have `rotation` (a
number, degrees, counterclockwise, default 0), `scale`
(a number or vec2, each factor 0.05 to 20) and `mirror` (`"x"` or `"y"`).
They act about `[0, 0]`, after `center` has placed the outline: first the
scale, then the rotation, then the mirror. `center` is a vec2 that defaults
to `[0, 0]`; outline coordinates are -3 to 3. A.4 gives each outline's
field.

### 5.5 Deformers

A deformer bends space before the shape is evaluated. `axis` is `"x"`, `"y"`
or `"z"`.

| `type` | Members (range) | Effect |
|---|---|---|
| `taper` | `axis`, `amount` (-1 to 1) | The cross-section grows by `amount` per unit along the axis; a negative amount narrows toward +axis |
| `twist` | `axis`, `amount` (-180 to 180) | Turns the cross-section by `amount` degrees per unit along the axis |
| `bend` | `axis`, `toward` (another axis), `amount` (-180 to 180) | Curves the axis into a circular arc toward `toward`: its direction turns by `amount` degrees per unit of length, so a piece of length L turns by `amount`·L degrees, and both sides of the origin curve toward +`toward` for a positive amount. Distances across the axis are kept |
| `squash` | `axis`, `below` (0.2–5, default 1), `above` (0.2–5, default 1) | Scales the half below 0 on the axis by `below` and the half above by `above` |
| `ripple` | `axis`, `count` (integer 2–32), `amplitude` (0–0.2), `range` vec2 (default the whole shape) | Waves around the axis, like a skirt or a flower; `range` limits them to a stretch of the axis, fading at its ends, and a range with equal ends holds none |

Deformed fields are not exact distances. Renderers MUST tolerate that. A.5
gives each deformer as a map of the point.

### 5.6 Limits

A document MUST NOT contain more than 512 shapes and outlines in total, nest
them more than 16 deep, or use more than 1024 polygon and stroke points in
total. A reader MUST reject a document over these limits.

## 6. Body

`body` is the main solid. It is an object:

| Member | Type | Default | Meaning |
|---|---|---|---|
| `rig` | string | `"blob"` | `"blob"` or `"biped"` (6.1, 6.2) |
| `shape` | shape | required for `blob` | The solid |
| `material` | material reference | `"main"` | Its material (section 7) |
| `anchor` | string | `"ground"` | `"ground"`: it stands on the floor with its lowest resting point (that of the body, its arms and the parts that show at rest). `"float"`: it hovers and bobs |
| `proportions` | object | | Biped only (6.2) |
| `arms` | object | | Arms the renderer animates (6.3) |

### 6.1 Blob

A blob is one solid that moves as a whole: it squashes, stretches, leans,
turns, hops and spins. It has no head of its own; `"head"` in an attachment
means the body. A blob's shape can be anything the shape language describes,
including shapes with holes or several separate pieces. The face goes on its
front.

### 6.2 Biped

A biped is a plush suit: a head, a body, two stub legs and two arms, built by
the renderer from `proportions`, all numbers from 0 to 1:

| Member | Default | Meaning |
|---|---|---|
| `head` | 0.5 | Head size relative to the body; 1 is a head much bigger than the body |
| `headShape` | `"round"` | `"round"`, `"wide"`, `"tall"` or `"square"` |
| `body` | 0.5 | Body size |
| `bodyShape` | `"pear"` | `"pear"`, `"round"`, `"slim"` or `"square"` |
| `legs` | 0.5 | Leg length; 0 hides the legs in the body |
| `arms` | 0.5 | Arm length |

If `shape` is present it is joined to the suit with a smooth union (smooth
0.06), for bellies, ears grown from the head, horns or tails. Parts attached
to `"head"` move with the head. A biped can play every standard motion,
because it has arms and legs.

The suit stands on y = -1. At the default proportions the head's center is at
y = 0.42 and the body's at y = -0.36, and the head's radii are about 0.7
across, 0.6 up and 0.62 deep; a bigger head or longer legs move and size
them, and the feet stay on y = -1. A renderer scales a suit that would reach above
y = 1.05 down about its feet, so that every suit fits the box of section 4.
Front points use this same space. Face heights are written for the default
proportions: the renderer moves the whole face up or down by as much as the
head's center moved, so a face written around y = 0.42 stays on the head
whatever the proportions. A.7 gives the suit's field exactly.

### 6.3 Arms

`arms` is `{ "style", "length", "thickness", "at", "material" }`:

- `style`: `"nub"` (a short round arm), `"paw"` (a nub with a round end),
  `"none"`. Default `"none"` for a blob and `"nub"` for a biped.
- `length`, `thickness`: 0 to 1, default 0.5.
- `at`: for a blob, the front point of the shoulder on the +x side (the
  avatar's left); the other mirrors it. Ignored for a biped.
- `material`: default the body's.

Arms let motions such as `wave` and `typing` play as written (13.5). Each
arm ends in a hand that parts can be attached to (9.1). A.8 gives the arms'
sizes, shoulders and hands exactly.

## 7. Materials

`materials` maps ids, which are names (section 1), to materials, at most 16
of them. A **material reference** is either such an id or a material
object written in place. A reference to an id that does not exist means the
body's material; a body whose material does not resolve uses a felt in
`#9AA4B2`.

A material is an object:

| Member | Type | Default | Meaning |
|---|---|---|---|
| `type` | string | `"felt"` | 7.1 |
| `color` | color | `#9AA4B2` | Base color |
| `sheen` | color | lighter `color` | The soft highlight at grazing angles (felt, fur, velvet). Without one, each point's sheen is its own color, the pattern's included, lightened (7.1) |
| `roughness` | number 0–1 | by type (7.1) | How blurred reflections are |
| `pattern` | object | none | 7.2 |
| `glow` | object | none | 7.3 |
| `fur` | object | | Fur only (7.1) |
| `opacity` | number 0–1 | 0.2 | Glass only: 0 is clear, 1 is frosted |

### 7.1 Types

| `type` | Looks like |
|---|---|
| `felt` | Wool felt: matte with a soft sheen and short fuzz at the silhouette |
| `fur` | Long pile. `fur` = `{ "length" 0–1, "density" 0–1, "droop" 0–1, "tip"?: color }`: strand length, how thick the pile is, how much strands hang, and the strand tips' color |
| `velvet` | Short dense plush with a strong sheen |
| `plastic` | Smooth glossy vinyl, like a toy figure |
| `rubber` | Matte soft plastic |
| `clay` | Matte with faint fingerprints, like modeling clay |
| `ceramic` | Glazed, glossy and hard |
| `glass` | See-through, tinted by `color`; `opacity` frosts it |
| `metal` | Metallic, tinted by `color` |
| `toon` | Flat cartoon shading with an outline |

A renderer that cannot draw a type MUST draw a felt of the same color.

Each type's parameters follow glTF 2.0's metallic-roughness model with its
sheen, clearcoat, transmission, volume and IOR extensions; a renderer on
another engine uses the nearest equivalents. A document's `roughness`
replaces the type's on every type but toon. Every color is decoded from
sRGB to linear light with the transfer function of IEC 61966-2-1 before it
is mixed, lightened or lit, and all mixing is on linear values; a color
lightened by k is mixed toward white by k.

| `type` | Roughness | Metallic | Clearcoat; its roughness | Sheen roughness; lightening | Pile P | Feature lift F |
|---|---|---|---|---|---|---|
| `felt` | 1 | 0 | none | 0.38; 0.45 | 0.034 | 0.018 |
| `fur` | 1 | 0 | none | 0.5; 0.45 | L | 0.004 + 0.8·L |
| `velvet` | 0.9 | 0 | none | 0.2; 0.6 | 0.008 | 0.008 |
| `plastic` | 0.32 | 0 | 0.6; 0.2 | none | 0 | 0.003 |
| `rubber` | 0.8 | 0 | none | none | 0 | 0.003 |
| `clay` | 0.92 | 0 | none | none | 0 | 0.003 |
| `ceramic` | 0.12 | 0 | 1; 0.05 | none | 0 | 0.003 |
| `glass` | 0.05 + 0.5·opacity | 0 | none | none | 0 | 0.003 |
| `metal` | 0.28 | 1 | none | none | 0 | 0.003 |
| `toon` | none | none | none | none | 0 | 0.003 |

- **Sheen** is at full strength. Its color is `sheen` when the document
  gives one; otherwise it is each point's color, the pattern's included,
  lightened by the table's amount.
- **Felt and clay** add a fine grain to the surface, like fibres or
  fingerprints. How it looks is the renderer's choice.
- **Glass** transmits 1 − 0.6·`opacity` of the light (`opacity` defaults to
  0.2), with an index of refraction of 1.45, a thickness of 0.3, and
  attenuation toward `color` over a distance of 0.8.
- **Toon** shades in three flat bands. With d = (n·l + 1) / 2 for the
  surface normal n and the light direction l, the light is 0.353 of full
  where d < 1/3, 0.706 where d < 2/3, and full above that. Its outline is
  the mesh's back faces pushed 0.022 out along the normal, in `#15161A`.
- **Feature lift** F is how far above the surface the face's features sit
  (C.1). On felt, thin ink strokes sit at 0.032 instead, above nearly all
  of its pile, as embroidery thread sits on the cloth.

**Pile.** Felt, fur and velvet carry a pile of fibres standing up to the
height P off the surface. Fur's strands are L = 0.015 + 0.085 × `length`
long. Fibres stand on a grid of cubes 1/f apart in the solid's space (7.2):
the surface point s belongs to the fibre cell c = floor(s·f), and with
u = H(c, 5) / 2²⁴ (the hash of 7.2) its fibre reaches the height h = k·P,
for 0 < k ≤ 1, where u ≥ min(0.97, 0.35 + 0.6·k − 0.25·D·(1 − k)). So the
pile thins toward its tips, and a denser one keeps more fibres low down.
At height h a fibre's color is the surface color under it, the pattern's
included, mixed toward the tip color by 0.6·k² and then darkened to
(0.84 + 0.16·k) of itself, and the fibre sags by 6·droop·h² along −y of the
solid's space.

| `type` | Fibres per unit f | Density D | Tip color | Droop |
|---|---|---|---|---|
| `felt` | 96 | 0.5 | the surface color | 0 |
| `velvet` | 260 | 0.8 | the surface color | 0 |
| `fur` | 70 + 140·`density` | `density` | `tip`, or the surface color lightened by 0.25 | `droop` |

The members of `fur` default to `length` 0.5, `density` 0.5 and `droop`
0.3. The reference renderer draws the pile as copies of the mesh at evenly
spaced heights (shells): 4 for felt, 3 for velvet and 8 for fur, or 2, 2
and 4 at low quality. A renderer MAY draw it another way that gives the same
coverage, color and sag.

### 7.2 Patterns

`pattern` = `{ "type", "colors", "axis", "scale", "angle" }`:

- `type`: `"gradient"` (blends `colors` along `axis` from one end of the
  solid to the other), `"stripes"`, `"spots"`, `"checks"`.
- `colors`: 1 to 4 colors that join the base color.
- `axis`: `"x"`, `"y"` or `"z"`, default `"y"`.
- `scale`: 0.05 to 4, the size of a stripe, spot or check, default 0.3.
- `angle`: stripes' angle in degrees, default 0. It tilts them toward x
  (toward y when `axis` is `"x"`), turning them about the third axis.

Patterns sit in the **solid's space**, the space its shape is written in:
the body's space for the body, a biped's suit included; the part's own
space (9.1), before its placement, for a part; the arm's own space (A.8)
for an arm. A shape's own `position`, `rotation` and `scale` do not move the
pattern, while the placement, the pose and animations carry it, so it
moves, turns and squashes with the solid. The palette
is the base color followed by `colors`, P[0] to P[n − 1] with n from 2 to
5. Each point p = (x, y, z) of the solid gets a mix of the palette, made on
linear-light values before lighting. Below, a is p's coordinate on `axis`,
s is `scale`, smoothstep(e0, e1, x) is t²(3 − 2t) with
t = clamp((x − e0) / (e1 − e0), 0, 1), and mod(i, n) is never negative.

- **Gradient.** lo and hi are the lowest and highest values of a on the
  surface of the solid the material colors. The body is one solid, each arm
  is one, and so is each copy of a part, whether the copy comes from its
  `mirror` or from its being attached to a mirrored part (9.1). t = clamp((a − lo) / (hi − lo), 0, 1)
  × (n − 1), or 0 when hi − lo ≤ 10⁻⁶, and i = floor(t). The color is P[i]
  mixed toward P[min(i + 1, n − 1)] by smoothstep(0, 1, t − i).
- **Stripes.** b is p's x, or its y when `axis` is `"x"`, and θ is `angle`
  in radians. u = (a·cos θ + b·sin θ) / s, i = floor(u) and e = u − i:
  stripe i is P[mod(i, n)], so the base color covers 0 to `scale`, then each
  of `colors` in turn, repeating both ways. Neighboring stripes blend only at
  their edge: the color is P[mod(i − 1, n)] mixed toward P[mod(i, n)] by
  smoothstep(−0.03, 0.03, e), then mixed toward P[mod(i + 1, n)] by
  smoothstep(0.97, 1.03, e).
- **Spots.** One spot sits in each cell of a grid `scale` apart. q = p / s,
  the cell c = floor(q) on each coordinate, and f = q − c − 0.5. With
  h(k) = H(c, k) / 2²⁴, the spot's center is
  o = 0.3 × (h(0) − 0.5, h(1) − 0.5, h(2) − 0.5), its radius is
  r = 0.2 + 0.1·h(3), and its color is P[1 + j] with
  j = (H(c, 4) × (n − 1)) >> 24, an integer product. The color is the base color mixed toward the spot's by
  1 − smoothstep(r − 0.03, r + 0.03, |f − o|). A spot and its blend stay
  inside their cell (0.15 + 0.33 < 0.5), so no cell edge cuts one.
- **Checks.** c = floor(p / s) on each coordinate, and the color is
  P[mod(cx + cy + cz, n)].

H(c, k), for the cell c = (cx, cy, cz) and the key k from 0 to 5, is a
24-bit integer. Every operation is on unsigned 32-bit integers and wraps
modulo 2³², so a negative cell works as its two's complement:

```
v = (cx + 1024)·0x8DA6B343 + (cy + 1024)·0xD8163841
  + (cz + 1024)·0xCB1AB31F + k·0x165667B1
v ^= v >> 16;  v *= 0x85EBCA6B;  v ^= v >> 13;  v *= 0xC2B2AE35;  v ^= v >> 16
H = v >> 8
```

For example, H((0, 0, 0), 0) = 8173136 and H((−1, 2, −3), 4) = 16178321.

A renderer makes every choice between colors (a cell, a stripe, a gradient
step, a check) with integers, and uses floating point only for the blends,
so rounding can move an edge by a hair but never change a color. A
renderer's mix stays within 0.002 of these formulas on each linear channel; only
right at a check's edge, where the color jumps, may rounding land on either
side. The reference renderer's `@openavatar/three/patterns` has the
formulas in JavaScript (`patternWeights`) and GLSL (`patternGLSL`).

### 7.3 Glow

`glow` = `{ "color", "intensity", "base", "driver" }` makes the material give
off light: `color` (default the base color), `intensity` (0 to 4, default 1),
`base` (0 to 1, default 0) and `driver` (an animation driver, 10.2, default
`"always"`). The glow's strength is `intensity × (base + (1 − base) × w)`,
where `w` is the driver's weight: with a `base`, the material glows all the
time and brightens to full in the driver's situation.

## 8. Face

`face` places the features that show expressions. Without `face`, a renderer
uses `{ "type": "bead" }` with every default below. `{ "type": "none" }`
makes a faceless avatar, which shows states with its body only.

The features sit on the body's surface and on the patches laid on it (9.3):
a patch under the eyes, such as an eye patch or a screen, never covers them.
Appendix C gives each feature's outline, how it is laid on the surface, and
how the face blinks, looks and speaks.

| Member | Type | Default | Meaning |
|---|---|---|---|
| `type` | string | `"bead"` | `"bead"`, `"sewn"`, `"drawn"` or `"none"` (8.1) |
| `eyes` | object | | 8.2 |
| `mouth` | object | | 8.3 |
| `cheeks` | object | | 8.4 |
| `brows` | object | none | 8.4 |
| `nose` | object | none | 8.4 |
| `color` | color | `#1C1E23` | Ink color for sewn and drawn features |
| `expressions` | object | | Overrides per expression (8.5) |

### 8.1 Face types

- `bead`: glossy round bead eyes with a catchlight. Expressions show through
  the eyes' size and lids, the mouth, the cheeks and effects.
- `sewn`: felt cut-out eyes stitched to the surface. Each expression swaps
  the eye cut-outs for its own shape (8.5).
- `drawn`: flat painted or glowing features, like a face on a screen. They
  are unlit and show their exact colors, and change shape as sewn eyes do.
- `none`: no features.

### 8.2 Eyes

| Member | Range | Default | Meaning |
|---|---|---|---|
| `shape` | | `"round"` | `"round"`, `"oval"`, `"tall"`, `"wide"`, `"dot"` or `"almond"` |
| `size` | 0.02–0.3 | 0.09 | Eye radius |
| `spacing` | 0–0.6 | 0.3 | Distance from the middle to each eye's center |
| `height` | -1.2–1.2 | 0.15 | The y of the eyes' front points |
| `color` | | `#040406` on bead eyes, the face's `color` on sewn and drawn ones | |
| `highlight` | boolean | true | A catchlight on bead eyes |
| `blink` | boolean | true | Blinks now and then |
| `gaze` | boolean | true | Eyes move toward what it looks at |

The eyes sit at the front points `[-spacing, height]` and
`[spacing, height]`.

### 8.3 Mouth

| Member | Range | Default | Meaning |
|---|---|---|---|
| `shape` | | `"oval"` | `"oval"`, `"smile"`, `"line"`, `"cat"`, `"beak"` or `"none"` |
| `width` | 0.02–0.6 | 0.17 | |
| `height` | -1.2–1.2 | -0.1 | The y of its front point, at x = 0 |
| `color` | | `#2A0E17` | |
| `speaks` | boolean | true | Opens and shapes with the voice |

An `oval` mouth is hidden while closed and opens while speaking; the other
shapes always show.

### 8.4 Cheeks, brows and nose

- `cheeks` = `{ "color", "size", "spacing", "height", "show" }`: two round
  patches. `show` is `"always"`, `"happy"` (they flush with the happy,
  laugh, love and relaxed expressions; the default), `"speaking"` or
  `"never"`. Without `cheeks` there are none. Ranges and defaults: `size`
  0.02–0.4 (0.12), `spacing` 0–0.8 (0.5), `height` -1.2–1.2 (-0.02),
  `color` `#FF9DB2`.
- `brows` = `{ "color", "thickness", "length", "height" }`: two short brows
  that tilt with expressions; omit for none. `color` defaults to the face's
  `color`, `thickness` 0.005–0.1 (0.035),
  `length` 0.02–0.4 (0.12). Unlike the other heights, the brows' `height` is
  how far they sit above the eyes (default 0.12), so they move with them.
- `nose` = `{ "shape", "color", "size", "height" }`: `shape` is `"button"`
  (the default), `"triangle"` or `"snout"`; omit for none. `color` defaults
  to the face's `color`, `size` 0.01–0.3 (0.05),
  `height` default halfway between the eyes and the mouth.

### 8.5 Expression overrides

`expressions` maps an expression id (13.4) to
`{ "eyes"?: eye pose, "mouth"?: mouth pose, "cheeks"?: boolean, "effect"?: effect id }`.
An **eye pose** is `"open"`, `"arc"`, `"chevron"`, `"heart"`, `"wide"`,
`"sad"`, `"mad"`, `"shut"`, `"squint"`, `"wink-left"` or `"wink-right"`; a
**mouth pose** is `"smile"`, `"grin"`, `"o"`, `"flat"`, `"frown"` or
`"hmm"`. Without an override a renderer uses the poses in 13.4. An `x-` id
defines an expression of the character's own: a reaction or the host can
name it, and it shows the poses given here, with `open` eyes and the resting
mouth where it gives none. `cheeks`
flushes (`true`) or clears (`false`) the cheeks while that expression leads,
whatever their `show` says; it has no effect on a face without cheeks or
with `show: "never"`. `effect` shows that effect (13.7) while the
expression holds the expression channel (11.3) at an intensity of at least
0.3, beside the effect channel's own, and not while the user activity is
quiet.

Left and right are the avatar's own. It faces +z, so its left eye is the one
at +x: `wink-left` closes the eye at +x, as VRM's `blinkLeft` does.

## 9. Parts

`parts` is an array of up to 32 parts: ears, antennae, leaves, hats, tails,
wings, glasses and other pieces that sit on the body. Each part is an object:

| Member | Type | Default | Meaning |
|---|---|---|---|
| `id` | string | required | A name (section 1), unique in the document |
| `role` | string | `"detail"` | What it is (9.2) |
| `shape` | shape | required unless `patch` | The part's solid, in its own space |
| `patch` | outline | | Instead of `shape`: a flat felt cut-out sewn onto the surface (9.3) |
| `material` | material reference | body's | |
| `attach` | object | at the origin | Where it sits (9.1) |
| `mirror` | string | none | `"x"`: a second copy mirrored across x = 0, for pairs |
| `pivot` | vec3 | `[0,0,0]` | The point in its own space it turns and scales about |
| `animations` | array | none | Up to 4 animations (section 10) |

### 9.1 Attaching

`attach` is an object with `to` and one way to place the part:

- `to`: the target, `"body"` (default), `"head"`, `"left-hand"`,
  `"right-hand"`, or the `id` of a part listed earlier. The part moves with
  what it is attached to.
  - `"head"`: on a biped, the body's space moved so that its origin is the
    center of the head (6.2), neither turned nor scaled, so a part on it
    follows the head when the proportions change. On a blob, the head is the
    body.
  - `"left-hand"` and `"right-hand"`: a space at the tip of that arm (the
    avatar's left is +x, section 4) that turns with the arm while it waves,
    types or holds a prop. In both, while the arm rests, +y points up, +z
    forward and +x away from the body, so a part modeled upright is held
    upright; the right hand's space is the mirror image of the left's and a
    part reads the same in either hand. On an avatar
    without arms, the hands are fixed where the arms would hang.
  - These four names are never part ids for `to`, even when a part has one
    of them as its `id`; documents SHOULD NOT name parts so.
- `position`: a vec3 in the target's space. The part's origin goes there,
  not turned to any surface.
- `at`: a front point on the target (section 4). The part's origin goes on
  the surface there.
- `direction`: a vec3, each coordinate -1 to 1. The part's origin goes where the line from the
  target's center along the direction leaves the surface for the last time
  (`[0,1,0]` is the top). The body's center is `[0, y, 0]`, with y halfway
  between its lowest and highest points; the head's is its center (6.2); a
  part's is halfway between its lowest and highest points on each axis; a
  hand's is its origin. On a blob whose head is off that center, place things
  on the head with `at`.
- `lift`: with `at` or `direction`, moves the part out along the surface
  normal (negative sinks it in). -0.5 to 0.5, default 0.
- `align`: with `at` or `direction`, `"surface"` (default) turns the part so
  its +z points along the surface normal; `"upright"` keeps it upright and
  only moves it; `"none"` is the same as `"upright"`.
- `rotation`: an extra turn in degrees, with any of the three ways to place
  the part. Like a shape's `rotation` (5.1) it turns first about x, then y,
  then z, about the part's axes as `align` left them.

With `"surface"`, a part's +z leaves the surface, so a flat piece (a patch, a
badge, glasses) faces out. A front point or ray that misses the target puts
the part at `(x, y, 0)` or at the target's center, unturned; A.9 gives every
step exactly. Pieces that stand up from the surface, such as
ears, horns, antennae and stems, are usually modeled upright along +y and
attached with `"upright"`; modeled along +z, they can use `"surface"` and lean
with the surface instead.

When `to` names a part, `position` is in that part's own space and `at` and
`direction` use its surface. A part attached to a mirrored part goes on both
of its copies, mirrored with the second; its own `mirror` adds a reflection
across x = 0 of the target's space, except in a hand, where it puts the
mirrored copy in the other hand. A part attached to another is hidden
when that part is hidden. Attachments MUST NOT form a cycle; a part attached
to an unknown id is attached to the body.

### 9.2 Roles

`role` tells hosts and renderers what the part is: `"ear"`, `"horn"`,
`"antenna"`, `"hair"`, `"hat"`, `"tail"`, `"wing"`, `"leaf"`, `"fin"`,
`"glasses"`, `"accessory"`, `"prop"` or `"detail"`. A host that lets people
pick an outfit SHOULD hide parts with role `"hat"` while a hat outfit is on,
and with them the parts attached to them.
Renderers MAY sway tails, ears and antennae a little on their own.

### 9.3 Patches

A part with `patch` instead of `shape` is a cut-out sewn onto the surface:
a belly, eye patches, spots, a logo. Its outline (A.4) is cut from a sheet
about 0.02 thick, centered on the xy plane of the part's own space. The part
is placed as in 9.1 and then bent onto the surface (A.9), so its middle is
the same height above the surface everywhere: `lift` above it, or 0.006 when
`lift` is not given, and never less than P − 0.008, where P is the pile of
the surface's material (7.1), so its fuzz or fur doesn't show through. A patch placed with
`position`, or whose placement misses, is not bent. A patch follows the
surface up to 0.25 away from its plane; a marking that wraps further around
the body is better made as a part. A patch's `material` is usually a felt of
another color.

## 10. Animations

An animation moves a part (or makes it glow) when something happens. It is an
object:

| Member | Range | Default | Meaning |
|---|---|---|---|
| `type` | | required | 10.1 |
| `driver` | | `"always"` | When it plays and how strongly (10.2) |
| `axis` | `"x"`, `"y"`, `"z"` | by type | |
| `amount` | -360 to 360 | by type | How far |
| `speed` | 0–8 | 1 (3 for `wiggle`) | Cycles (or turns) per second |
| `phase` | 0–1 | 0 | Offset within the cycle; the mirrored copy uses the same phase |

### 10.1 Types

Every type is scaled by the driver's weight `w` (10.2), so it fades in and out
as the driver does. In the table, `t` is the renderer's clock in seconds and
`u = speed·t + phase` counts cycles. A renderer SHOULD move parts by these
curves, so an avatar moves alike everywhere.

| `type` | Default axis, amount | Effect | Pose |
|---|---|---|---|
| `sway` | z, 10 | Turns back and forth about the pivot by up to `amount` degrees | Turn by `amount·w·sin(2πu)` degrees |
| `spin` | y, — | Turns continuously, `speed` turns per second; as the weight falls it slows and settles back to rest | The angle grows by `360·speed·w` degrees a second; while `w < 0.08` it also closes `1 − e^(−5·dt)` of its gap to the nearest whole turn each frame of `dt` seconds |
| `bob` | y, 0.05 | Moves back and forth along the axis by up to `amount` units | Move `amount·w·sin(2πu)` along the axis |
| `pulse` | —, 0.15 | Scales by up to 1 + `amount` | Scale by `1 + amount·w·(1 + sin(2πu))/2` |
| `wiggle` | z, 6 | A quick irregular shake of up to `amount` degrees | Turn by `amount·w·(0.6·sin(2π(1.2·speed·t + phase)) + 0.4·sin(2π(2·speed·t + 2·phase)))` degrees |
| `flap` | z, 25 | Flaps up and back by up to `amount` degrees, twice a cycle; the mirrored copy flaps the mirror way | Turn by `amount·w·abs(sin(2πu))` degrees |
| `appear` | — | Scales the part from nothing to full size with the weight, popping in; it is hidden at weight 0 | Scale by `1 + 2.4·(w − 1)³ + 1.4·(w − 1)²`, which overshoots a little on the way in; hidden while `w < 0.02` |
| `drift` | y, -0.6 | Moves the part `amount` units along the axis over each cycle, fading in at the start and out at the end, then starts again; for rain (negative amount), bubbles, sparks and notes | With `k = u − floor(u)`: move `amount·k` along the axis and scale by `w·sqrt(sin(πk))`; hidden while `w < 0.02` |
| `glow` | —, 1 | Adds up to `amount`, clamped to 0–4, to the intensity of the part's glow, on top of its material's own glow (7.3); a material without `glow` glows here in its base color | Add `amount·w` |

Turns are about the part's pivot (9.1) and moves are along the part's own
axes, after its placement. A part's animations apply in the order the
document lists them: each turn follows the ones before it, moves add up and
scales multiply. Exactly, a point `q` of the part's own space goes to
`A·(c + m + s·R1·R2·…·Rn·(q − c))`, where `A` places the part (9.1, A.9),
`c` is its `pivot`, `m` the sum of its moves, each along its axis of the
part's own space, `s` the product of its scales, and `Ri` the i-th turn in
the order listed, a right-handed turn about its axis of the part's own space.
So each turn is about the axes as the turns listed before it left them,
and moves are not turned by turns. A mirrored copy's `A` holds the mirror,
so it moves the mirror way. Of several `glow` animations, the largest
counts.

### 10.2 Drivers

A driver is a source of a weight between 0 and 1. The renderer eases the
weights of states, activities, expressions and the pointer, so animations
never jump: each frame of `dt` seconds a weight moves `1 − e^(−dt/τ)` of the
way to its target. A renderer SHOULD use `τ` = 0.3 s for the conversation
states and the agent activities (1.2 s for `sleeping`), 0.5 s for the user
activities, 0.25 s for expressions (whose target is the strength 11.3 gives
them) and 0.2 s for `pointer`. `voice` and `mic` follow their inputs without
easing.

| Driver | Weight |
|---|---|
| `always` | 1 |
| `idle`, `listening`, `thinking`, `speaking` | That conversation state's weight (11.3) |
| `active` | 1 minus the idle weight |
| `voice` | The speech level while speaking, 0 otherwise |
| `mic` | The user's voice level while listening, 0 otherwise |
| `pointer` | 1 while the pointer (12.1) is within 0.5 of the middle of the avatar's frame |
| an activity id (13.2) | That agent activity's weight |
| a user activity id (13.3) | That user activity's weight |
| an expression id (13.4), or one the document defines (8.5) | That expression's strength |

`thinking` is both a state and an expression; as a driver it is the state.

## 11. Behavior

`behavior` is an object with `temperament`, `reactions` and `idleMotions`.
Everything in it is optional: a renderer gives every avatar sensible behavior
from the defaults in section 13.

### 11.1 Temperament

`temperament` sets how the avatar moves. All members are 0 to 1, default 0.5:

| Member | Low | High |
|---|---|---|
| `energy` | Slow, calm, few idle moves | Quick, lively, frequent idle moves |
| `bounce` | Stiff | Squashes and stretches a lot |
| `sway` | Holds still when idle | Sways and turns when idle |
| `blink` | Rarely blinks | Blinks often |

### 11.2 Reactions

A **reaction** says what the avatar does in a situation:

```
{ "expression"?, "motion"?, "prop"?, "effect"?, "gaze"?, "intensity"? }
```

- `expression`: an expression id (13.4).
- `motion`: a motion id (13.5). Looping motions loop while the situation
  lasts; others play once when it starts.
- `prop`: a prop id (13.6) the avatar holds or sits at.
- `effect`: an effect id (13.7) shown beside it.
- `gaze`: where it looks: `"user"` (out of the screen, at the person),
  `"down"`, `"up"`, `"side"`, `"around"` (scanning), `"pointer"` (the cursor)
  or `"work"` (down and to its own right, the same with or without a prop;
  C.5).
- `intensity`: 0 to 1, default 1, the strength of the expression. Motions
  play at full strength.

`reactions` = `{ "states", "activities", "userActivities" }`, each an object
from ids of that kind (13.1, 13.2, 13.3) to a reaction. A reaction replaces
the default for that id member by member; a member set to `null` turns that
member of the default off. Setting the whole reaction to `null` turns the
default off.

`idleMotions` is an array of up to 8 different motion ids the avatar plays now and then
while nothing else happens: while the state is `idle` (its weight above
0.9), no agent activity is set, the user activity is not quiet (13.3), and no
motion plays or loops. They play more often with higher `energy`: a
renderer SHOULD wait between 7 and 16 seconds, divided by
`0.6 + 0.8·energy`. Default: `nod`, `wiggle` and `look-around`. D.3 gives
how they play.

### 11.3 How reactions combine

At any moment several situations can hold at once: the user is coding, the
agent is searching, and the agent starts to speak. Each situation is a
**layer**, from highest to lowest:

1. a motion the host asked for directly (12.2), until it ends or the host
   stops it;
2. an expression the host asks for (12.1), which sets only the expression
   channel, with its strength as the intensity;
3. the conversation state `speaking`;
4. the conversation states `listening` and `thinking`;
5. the agent activity;
6. the user activity;
7. idle, the reaction to the state `idle`, which is always there.

A reaction has five **channels**: expression, motion, prop, effect and gaze.
For each channel, the highest layer whose reaction sets it wins, and the
expression takes that reaction's `intensity`. So while the
user codes and the agent thinks, the avatar keeps the laptop (the user
activity sets the prop and thinking does not) but wears the thinking
expression. An expression the host asks for outranks speaking's own. Speaking
always drives the mouth. Weights fade between layers (10.2), so changes
blend.

A looping motion (13.5) holds the motion channel while its layer's situation
lasts. A motion that plays once plays from its start each time it takes the
channel: when its situation begins, or when a layer above lets the channel
go. When it has played to its end, its layer sets no motion until its
situation changes, so the next layer down that sets one takes the channel:
an avatar that hops when the agent is done goes back to typing beside a user
who codes. A situation changes when the layer's state or id changes, or the
layer goes and comes back.

While the user activity is quiet (13.3), the effect channel is empty and no
idle motions play.

## 12. The host interface

This section defines what a host gives a renderer. It does not define an API;
each renderer documents its own calls for these inputs.

### 12.1 Inputs on every frame

| Input | Values | Meaning |
|---|---|---|
| `time` | seconds | A clock that only moves forward |
| `state` | `idle`, `listening`, `thinking`, `speaking` | The conversation state (13.1) |
| `voice` | 0–1 | The loudness of the avatar's own speech, sampled every frame while speaking (scale below) |
| `viseme` | `aa`, `ih`, `ou`, `ee`, `oh` or none | The mouth shape of the speech now, when the host knows it |
| `mic` | 0–1 | The loudness of the user's voice while listening, on the same scale |
| `activity` | an agent activity id or none | What the agent is doing (13.2) |
| `userActivity` | a user activity id or none | What the user is doing (13.3) |
| `expression` | an expression id and a strength, or none | An expression the host asks for, for example one the agent's model picked for its reply. It takes the expression channel at layer 2 of 11.3, above speaking's own |
| `pointer` | a vec2 from -1 to 1 relative to the avatar, or none | Where the pointer is, for `gaze: "pointer"` and the `pointer` driver |

A host that does not know an input leaves it at its rest value: `idle`, 0 or
none.

`voice` and `mic` are the level of the last 50 ms or so of the sound, its RMS
in dBFS mapped straight from −50 dBFS (0) to −10 dBFS (1) and clamped to
0–1. A host that measures loudness another way SHOULD match it at those two
points, so a renderer's mouth and drivers move alike in every host. `pointer`
is in the avatar's **frame**, the box the host draws it in: `[0, 0]` is its
middle, x grows to the right and y upward, and ±1 are its edges. A pointer
outside the frame is clamped to its edge, or is none when the host doesn't
follow it there. `gaze: "pointer"` looks toward it.

### 12.2 Commands

- **play**(motion id, loop): plays a motion on top of everything else, once,
  or over and over until stopped when the host asks it to loop. The renderer
  resolves the id with the fallbacks in 13.5 and reports how long one play
  lasts.
- **stop**(): ends a motion the host started.
- **outfit**(outfit id or none): changes the outfit (13.8).

### 12.3 The user activity

A host MAY tell the avatar what the user is doing so it can keep them
company: type on a laptop beside them while they code, read along while they
read. The host decides the user activity on the device, from signals such as
the frontmost app. It passes only the id (13.3) to the renderer. Section 16.2
limits what it may do with those signals.

## 13. Vocabularies

The ids below are the standard ids of OpenAvatar 0.1. `vocabulary.json`
holds the same lists with each id's fallback and default reaction, for
programs. A reader that meets an id it does not know, standard or `x-`,
uses the fallback of the member where it appears: for an expression,
`neutral`, unless it is an `x-` id the document defines (8.5); for a
motion, the motion's `fallback` chain ending at one of the base motions,
else `nod`; for a prop, effect or outfit, none; for an animation driver
(10.2), a weight of 0. `x-` ids are allowed where these five kinds of id
and drivers appear, and as keys of the three maps of `behavior.reactions`
(11.2). A reaction under an id applies only while the host reports that id,
so one under an `x-` state never does: the state is always one of the four
of 13.1.

### 13.1 Conversation states

| Id | When | Default reaction |
|---|---|---|
| `idle` | Nothing is happening | gaze `user`, idle motions |
| `listening` | The user is talking or typing to the agent | expression `neutral`, gaze `user`, motion `lean-in` |
| `thinking` | The agent is working on an answer | expression `thinking`, gaze `up`, effect `dots` |
| `speaking` | The agent is speaking or its reply is streaming | expression `happy` at 0.4, gaze `user`; the mouth follows `voice` |

### 13.2 Agent activities

| Id | When | Default reaction |
|---|---|---|
| `searching` | Looking things up | motion `look-around`, gaze `around` |
| `working` | Running a tool or a long task | expression `thinking` at 0.6, motion `nod-beat`, gaze `work` |
| `waiting` | Waiting for the user's answer or approval | expression `surprised` at 0.6, motion `bounce`, gaze `user` |
| `error` | A task failed | expression `sad`, motion `shake`, effect `sweat` |
| `done` | A task finished | expression `happy`, motion `hop`, effect `sparkles` |
| `sleeping` | Nothing has happened for a long time | expression `sleepy`, motion `sleep`, effect `zzz` |

### 13.3 User activities

| Id | The user is | Default reaction |
|---|---|---|
| `coding` | Writing code | prop `laptop`, motion `typing`, expression `thinking` at 0.4, gaze `work` |
| `writing` | Writing text: documents, notes, mail | prop `notebook`, motion `writing`, gaze `work` |
| `reading` | Reading: articles, documents, PDFs | prop `book`, motion `reading`, gaze `work` |
| `browsing` | Browsing the web | motion `look-around`, gaze `side` |
| `designing` | Drawing or designing | prop `notebook`, motion `writing`, expression `thinking` at 0.5 |
| `form-filling` | Filling in a form | prop `clipboard`, expression `thinking`, gaze `work` |
| `chatting` | Messaging people | expression `happy` at 0.5, motion `nod` |
| `meeting` | In a call or meeting | expression `neutral`, gaze `user`; quiet (below) |
| `watching` | Watching a video | prop `popcorn`, expression `happy` at 0.4, gaze `side` |
| `listening-music` | Listening to music | prop `headphones`, motion `groove`, effect `notes` |
| `gaming` | Playing a game | prop `gamepad`, expression `happy` at 0.6 |
| `away` | Away from the computer | expression `sleepy` at 0.6, motion `sleep` |

`meeting` is **quiet**: while it holds, a renderer shows no effects and plays
no idle motions, whatever other layers ask for, so the avatar never distracts
the person during a call. Being quiet belongs to the standard user activity,
not to a document: a document cannot make a user activity quiet, and an `x-`
user activity is not quiet.

### 13.4 Expressions

The first six match VRM 1.0's preset expressions, so a host can drive VRM and
OpenAvatar characters the same way.

| Id | VRM | Eyes | Mouth | Fallback |
|---|---|---|---|---|
| `neutral` | neutral | `open` | rest | |
| `happy` | happy | `arc` | `smile` | `neutral` |
| `angry` | angry | `mad` | `frown` | `neutral` |
| `sad` | sad | `sad` | `frown` | `neutral` |
| `relaxed` | relaxed | `arc` | `smile` | `happy` |
| `surprised` | surprised | `wide` | `o` | `neutral` |
| `laugh` | | `chevron` | `grin` | `happy` |
| `thinking` | | `squint` | `hmm` | `neutral` |
| `love` | | `heart` | `smile` | `happy` |
| `sleepy` | | `shut` | `flat` | `relaxed` |
| `wink-left` | | `wink-left` | `smile` | `happy` |
| `wink-right` | | `wink-right` | `smile` | `happy` |

Visemes (`aa`, `ih`, `ou`, `ee`, `oh`) are mouth shapes for speech, not
expressions; they come from the host's `viseme` input.

### 13.5 Motions

A motion moves the whole avatar, its arms or both. Four **base motions**
need nothing but a body, and every renderer MUST play them: `nod`, `hop`,
`spin` and `wiggle`. Every other standard id has a fallback; a renderer
follows the chain until it reaches a motion it can play. "Loops" marks
motions that repeat until the situation ends.

| Id | Movement | Needs | Loops | Fallback |
|---|---|---|---|---|
| `nod` | Nods yes | | | base |
| `hop` | One small jump with a landing squash | | | base |
| `spin` | One full turn | | | base |
| `wiggle` | A side-to-side shimmy | | | base |
| `shake` | Shakes its head no | | | `wiggle` |
| `bow` | Bows | | | `nod` |
| `jump` | A big jump | | | `hop` |
| `bounce` | Small hops in a row | | yes | `hop` |
| `nod-beat` | Quick nods to a beat, busy | | yes | `nod` |
| `look-around` | Looks from side to side | | yes | `wiggle` |
| `lean-in` | Leans toward the user, attentive | | | `nod` |
| `shiver` | Trembles | | | `wiggle` |
| `stretch` | Stretches up tall | | | `jump` |
| `yawn` | Yawns | | | `nod` |
| `sleep` | Settles down and breathes slowly | | yes | `nod` |
| `peek` | Peeks out from one side | | | `look-around` |
| `groove` | Sways to music | | yes | `bounce` |
| `dance` | Dances | | yes | `groove` |
| `celebrate` | Celebrates a success | | | `jump` |
| `wave` | Waves hello | arms | | `wiggle` |
| `clap` | Claps | arms | | `celebrate` |
| `cheer` | Both arms up | arms | | `celebrate` |
| `shrug` | Shrugs | arms | | `wiggle` |
| `point` | Points to the side | arms | | `nod` |
| `think` | Hand to chin, pondering | arms | | `look-around` |
| `typing` | Types on its prop | arms | yes | `nod-beat` |
| `writing` | Writes on its prop | arms | yes | `typing` |
| `reading` | Holds its prop and reads, turning pages | arms | yes | `nod` |
| `facepalm` | Hand to face | arms | | `shake` |
| `heart-hands` | Makes a heart with its arms | arms | | `celebrate` |

Appendix D gives each motion's movement exactly. A renderer SHOULD move the
avatar by it, so an avatar moves alike in every app.

"Needs arms" means a renderer can play the motion as described only for an
avatar with arms: a biped unless its `arms.style` is `"none"`, or a blob
whose `arms.style` is other than `"none"` (6.3); for others it uses the
fallback. Whether a motion loops is read from the motion that plays after
the fallbacks, so a looping motion whose fallback does not loop plays
once. Renderers MAY offer more motions under `x-` ids.

### 13.6 Props

Props are objects the renderer provides; documents only name them. A prop
sits in front of the avatar or in its hands. `laptop`, `book`, `notebook`
(a pad and pencil), `magnifier`, `clipboard`, `cup`, `phone`, `headphones`
(worn), `gamepad`, `popcorn`.

### 13.7 Effects

Effects are small signs beside the avatar, in the manner of comics: `dots`
(a typing bubble), `zzz`, `sparkles`, `hearts`, `notes`, `question`,
`exclaim`, `sweat`, `steam`, `confetti`. Renderers place them clear of the
body and the parts on it, so a big cap or helmet doesn't hide them, and
draw them in front. Where they would cross a part that floats free of the
body (a moon, a star, a ring), renderers SHOULD move them further out, so
the two don't tangle in the front view.

### 13.8 Outfits

Outfits are worn pieces the renderer provides, fitted to the avatar's head.
The standard ids are listed in `vocabulary.json` (party hats, beanies,
crowns, headphones, cat ears and forty-nine in all). Renderers MAY support any of
them; one that does not know an outfit shows none.

A renderer fits each outfit to the head the document describes, so every
outfit works on any shape: a biped's head is the suit's head (6.2), and a
blob's head is the top of its body, above and around the eyes. Hats rest
where the head is as wide as their opening, caps follow the head's own
surface and stay clear of the eyes, and pieces worn at the neck go under a
biped's head or under a blob's mouth. While a hat outfit (`hat: true` in
`vocabulary.json`) is on, parts with role `"hat"` are hidden (9.2).

## 14. Files, storage and exchange

### 14.1 Files

- A document is stored as UTF-8 JSON without a byte order mark, in a file
  with the extension `.openavatar`.
- Its media type is `application/vnd.openavatar+json`.
- On Apple platforms its uniform type identifier is `dev.openavatar.avatar`,
  which conforms to `public.json`. An app that opens these files declares it
  as an imported type.
- A file MUST NOT be larger than 256 KB.

### 14.2 The shared folder

So that every OpenAvatar app on a computer sees the same characters, apps
SHOULD read documents from the shared folder and MAY save documents there:

- macOS and Linux: `~/.openavatar/avatars/`
- Windows: `%USERPROFILE%\.openavatar\avatars\`

File names do not matter; a reader identifies a document by its `id` after
normalization (B.1). When several files hold the same `id`, a reader shows
one of them, comparing two at a time:

1. One whose `meta.updated` names a real instant (B.2) wins over one without.
2. Of two with real instants, the later wins.
3. Otherwise, the one with the later file modification time wins.
4. If those are equal too, the one whose file name comes first in code point
   order (B.1) wins.

A file the reader rejects takes no part. An app that saves a document there
SHOULD set its `meta.updated` to the time of saving, so that its copy wins.
The reference is `compareCopies` in the `@openavatar/core` package. Apps SHOULD
notice files added,
changed and removed while they run. An app MUST NOT delete or rewrite a file
it did not write unless the person asks it to. When the person deletes a
character, an app SHOULD delete every file in the folder that holds its `id`,
since an older copy would otherwise take its place, and SHOULD move the files
to the system's trash where it has one.

### 14.3 Galleries (informative)

A gallery serves each document at a stable `https` URL ending in
`.openavatar` with the media type above, and SHOULD record the license and
author. The reference gallery also serves a JSON list of its avatars; see its
documentation. A host can offer a link that installs a document from a
gallery URL; Enconvo uses `enconvo://avatar/install?url=<encoded URL>`.
Section 16.1 says what such a link may fetch.

## 15. Versioning and compatibility

- `openavatar` is `"<major>.<minor>"`. A reader MUST read documents with its
  own major version and any minor version. It rejects a document with a
  higher major version (B.1) and SHOULD tell the person to update.
- A reader MUST ignore members it does not know, use the fallback for ids it
  does not know (section 13), and clamp numbers to their ranges (section 4).
- A shape with a `type` the reader does not know is empty. If a blob
  body's shape ends up empty, the reader uses a sphere of radius 0.9; a
  biped's is dropped, and its suit stands alone.
- A part whose shape is empty or invalid is dropped; the rest of the
  document still renders.
- A reader MUST reject, with an error that names the problem, only a
  document that is not JSON or not a JSON object, lacks `openavatar`, `id`,
  `name` or `body` or has one of the first three in a form it cannot read, is
  over a limit (5.6, 14.1), or has a higher major version (B.1 lists each
  case). Anything else it repairs. The steps a reader takes
  to repair a document are its **normalization**, given exactly in Appendix
  B; the reference implementation is the `normalize` function of the
  `@openavatar/core` package.
- The JSON Schema describes what a writer of 0.1 writes, so it fixes
  `openavatar` to `"0.1"`. A reader does not reject a document for failing
  it, and reads a later minor version as its own.
- A writer MUST write only the members this spec defines for the version it
  declares, plus `extensions` and `x-` ids.

## 16. Security and privacy

### 16.1 Documents are data

A document cannot run code. It has no scripts, shaders, expressions or
references to other files, and a renderer MUST NOT fetch anything a document
names. The only embedded binary data is `preview.image`, which a renderer
MUST decode as a PNG or WebP image and nothing else.

Renderers MUST enforce the limits in 5.6 and 14.1 and SHOULD bound the time
and memory they spend turning a shape into a mesh, so that a hostile document
cannot hang them. The reference renderer meshes on a fixed grid.

Any web page can open an install link (14.3). A host that installs a document
from one SHOULD fetch only `https` URLs, including each redirect, MUST stop
reading once the response passes the limit in 14.1, and MUST show the avatar
and let the person decline before it saves the document.

Text in a document (`name`, `meta.description`, `meta.tags`, author names) is
untrusted. A host MUST escape it when showing it. A host that gives a
document to an AI model, for example to edit it, MUST present it as data and
MUST NOT follow instructions written inside it.

### 16.2 What the user does stays on the device

A host that sets `userActivity` decides it locally. It MUST NOT send the
signals it decides from (app names, window titles, URLs, file names, what is
on screen) to a renderer or a server as part of OpenAvatar, and SHOULD let the
person turn the user activity off. Only the id from 13.3 reaches the
renderer.

## 17. Conformance

### 17.1 Documents

A conforming document validates against the JSON Schema and also:

- its part ids are unique, and each `attach.to` names a target of 9.1 or a
  part listed earlier, so attachments form no cycle;
- every material id it references exists;
- its `meta.created` and `meta.updated` name real instants (B.2);
- it is within the limits in 5.6 and 14.1.

The reference `validate` checks all of this (B.6).

### 17.2 Renderers

A conforming renderer:

1. renders every conforming document, and every document normalization can
   repair, without failing;
2. implements every primitive, combinator, outline and deformer in section 5,
   the body rigs in section 6, and every face type in section 8;
3. draws every material type, at least as felt (7.1);
4. shows the four conversation states, every expression in 13.4 (directly or
   by its fallback), the four base motions, and the default reactions in
   13.1 to 13.3;
5. follows every fallback in section 13;
6. enforces the limits in section 16.

The conformance suite in [`conformance/`](../conformance/README.md) holds
documents that cover each feature with reference renders, documents a reader
must repair with the document it ends up with, documents it must reject, and
behavior cases: a host's input and the channels it resolves to. A renderer's
pictures need not match the reference ones; they must show the same shape,
colors and features.

Each render case also has geometry vectors: the body's field at sample points,
each placed part's placement and its own field at sample points, and where the
arms, the hands and the face features sit, all with the avatar as built and
before any animation runs. A renderer's fields must match them within 0.00001
and its placements within 0.0001; the fields of patches are informative. The
lowest and highest points that set a center (9.1, A.9) and a gradient's range
(7.2) are the solid's, found on its field, so they do not depend on how finely
a renderer meshes it.

### 17.3 Hosts

A conforming host gives the renderer the inputs of 12.1 it knows, follows
16.2, and SHOULD read the shared folder (14.2).

## 18. Designing avatars with AI (informative)

The format was shaped so that a language model can design a character from a
sentence:

- Start from the silhouette. Most characters are one to four primitives in a
  smooth union, with `smooth` between 0.1 and 0.4 for soft toys.
- Keep the body about two units tall, centered on the origin, and place the
  face with front points rather than exact surface coordinates.
- Give each part a role, and attach ears and antennae with `direction` or
  `at` so they land on the surface whatever its exact shape.
- Use reactions for personality: a plant that spins its leaves while
  thinking, a cloud that rains when a task fails.
- Validate, render, look at the picture, and adjust. The `openavatar` CLI
  does the first two, and the OpenAvatar skill
  ([`skills/openavatar`](../skills/openavatar/SKILL.md)) walks an agent
  through the loop.

## Appendix A. Shape fields

This appendix defines the field of every shape in section 5 exactly, and the
biped suit, the arms and the placing of parts and faces built on them, so that
two renderers build the same solid from the same document. The solid is the
set of points where the field is below zero. Fields feed one another: a smooth
blend, `inflate`, a rounded corner and `puff` use the values, not only their
signs. A renderer MUST therefore compute these fields, or fields with the same
values up to floating-point rounding. It MAY mesh or ray-march them however it
likes, and it MUST draw the whole solid, not only the part inside a box worked
out from the members.

### A.1 Notation

```
clamp(x, a, b) = min(b, max(a, x));   clamp(x) = clamp(x, 0, 1)
mix(a, b, t)   = a + (b − a)·t
smoothstep(a, b, x) = t²·(3 − 2t), with t = clamp((x − a) / (b − a)); it falls when a > b
‖v‖            the Euclidean length of a vector v
abs(x)         the absolute value of a number x
max(v, 0)      taken for each component of v
```

Fields here take a point `p = (x, y, z)`, or `(x, y)` for an outline, in the
shape's own space (A.6). Members have already been through normalization, so
every number is in its range and every default from section 5 is filled in.
Angles in members are degrees; `sin` and `cos` take radians. The field of a
shape whose type the reader does not know is +∞ everywhere (an empty solid).

### A.2 Blends and combinators

```
smin(a, b, k) = min(a, b)                               if k ≤ 0
smin(a, b, k) = b + (a − b)·h − k·h·(1 − h),
                with h = clamp(0.5 + 0.5·(b − a) / k)   otherwise
smax(a, b, k) = −smin(−a, −b, k)
```

With `k` = `smooth` and the children's fields `d1 … dn` in document order:

```
union:      d = d1;  d = smin(d, di, k)  for i = 2 … n
intersect:  d = d1;  d = smax(d, di, k)  for i = 2 … n
subtract:   d = d1;  d = smax(d, −di, k) for i = 2 … n
```

The folds go from the first child to the last. `smin` gives the same value
with its two arguments swapped, but folding three or more children in a
different order gives a different blend, so a renderer MUST keep the order.
Outline combinators (5.4) use the same rules in 2D.

### A.3 Primitives

| `type` | Field |
|---|---|
| `sphere` | `‖p‖ − radius` |
| `ellipsoid` | `k0·(k0 − 1) / k1`, with `r` = `radii`, `k0 = ‖(x/rx, y/ry, z/rz)‖` and `k1 = ‖(x/rx², y/ry², z/rz²)‖`; `−min(rx, ry, rz)` when `k1 < 10⁻⁹` |
| `box` | `‖max(q, 0)‖ + min(max(qx, qy, qz), 0) − ρ`, with `b` = `size`/2, `ρ = min(rounding, bx, by, bz)` and `q = (abs(x), abs(y), abs(z)) − b + ρ` |
| `superellipsoid` | `((abs(x/rx)ⁿ + abs(y/ry)ⁿ + abs(z/rz)ⁿ)^(1/n) − 1)·min(rx, ry, rz)`, with `r` = `radii` and `n` = `exponent` |
| `capsule` | `‖p − a − e·h‖ − mix(radius, radiusTo, h)`, with `a` = `from`, `e` = `to` − `from` and `h = clamp(((p − a)·e) / (e·e))`; `h = 0` when `e` is zero |
| `cylinder` | `min(max(w1, w2), 0) + ‖max(w, 0)‖ − ρ`, with `H` = `height`/2, `ρ = min(rounding, radius, H)` and `w = (‖(x, z)‖ − radius + ρ, abs(y) − H + ρ)` |
| `cone` | Below |
| `torus` | `‖(‖(x, z)‖ − radius, y)‖ − thickness`: `thickness` is the radius of the tube |
| `extrusion` | Below |
| `halfspace` | `p·n − offset`, with `n` = `normal` / `‖normal‖`; when `normal` is zero, `n` is zero and the field is `−offset` everywhere |

The cone is a capped cone rounded by shrinking it by `ρ` and growing it back:

```
ρ  = min(rounding, 0.45·height, 0.9·radius)
h  = height/2 − ρ
r1 = max(radius − ρ, 0.0001)            the base, at y = −height/2
r2 = max(radiusTop − ρ, 0)              the top, at y = +height/2
k  = (r2 − r1, 2h)
q  = (‖(x, z)‖, y)
ca = (q.x − min(q.x, r1 if q.y < 0 else r2), abs(q.y) − h)
t  = clamp(((r2 − q.x)·k.x + (h − q.y)·k.y) / (k·k))
cb = (q.x − r2 + k.x·t, q.y − h + k.y·t)
s  = −1 if cb.x < 0 and ca.y < 0, else 1
d  = s·√min(ca·ca, cb·cb) − ρ
```

The extrusion pushes its outline's field `o`, taken at `(x, y)`, out along z:

```
half = depth/2
ρ    = min(rounding, 0.95·half)
hz   = (half − ρ)·(1 − puff·(1 − smoothstep(0, 3·half, −o)))
w    = (o + ρ, abs(z) − hz)
d    = min(max(w.x, w.y), 0) + ‖max(w, 0)‖ − ρ
```

With `puff`, the slab keeps its full thickness from one and a half depths
inside the edge, and thins toward the edge to `1 − puff` of its flat part.

### A.4 Outlines

In this table `c` is `center`; outlines without a `center` member ignore it.

| `type` | Field at `(x, y)` |
|---|---|
| `circle` | `‖(x, y) − c‖ − radius` |
| `ellipse` | The ellipsoid's formula in 2D at `(x, y) − c` with `radii`; `−min(radii)` when `k1 < 10⁻⁹` |
| `rect` | The box's formula in 2D at `(x, y) − c`, with `b` = `size`/2 and `ρ = min(rounding, bx, by)` |
| `polygon` | `P(points)` when `rounding` is 0; otherwise the rounded polygon below |
| `star` | `P(S)`, where `S` has `2·points` vertices `si = c + Ri·(cos αi, sin αi)` for `i = 0 … 2·points − 1`, with `αi` = 90° + i·180°/`points`, `Ri` = `radius` for even `i` and `min(innerRadius, radius)` for odd `i` |
| `heart` | `heart((x − cx)/size, (y − cy)/size + 0.5)·size` |
| `stroke` | Below |

`P(V)` is the signed distance to the closed polygon through the vertices `V`:
the distance from the point to the nearest edge, negative when the point is
inside by the even-odd rule.

A rounded polygon is the polygon shrunk by a radius `r` and grown back by it,
which rounds every convex corner with that radius:

```
r = rounding
o = 1 if the polygon's signed area Σ (vi.x·vi+1.y − vi+1.x·vi.y) is above 0, else −1
for each vertex v, with the vertex a before it and b after it:
    e1 = unit(v − a),  e2 = unit(b − v)          unit(0) = 0
    n1 = o·(−e1.y, e1.x),  n2 = o·(−e2.y, e2.x)   the inward normals of its edges
    m  = n1 + n2
    A(v) = (0, 0)                     if ‖m‖ < 10⁻⁶
    A(v) = u / max(u·n1, u·n2)        otherwise, with u = m / ‖m‖
for each edge from vi to vj = vi+1, with e = vj − vi:
    if (A(vi) − A(vj))·e > 0:  r = min(r, (e·e) / ((A(vi) − A(vj))·e))
Q = the vertices vi + r·A(vi)
d = max(P(Q) − r, P(points))
```

`A(v)` moves a vertex along its corner's bisector so that both of its edges
sit one unit inside. The second loop lowers `r` to the largest inset that
turns no edge around, so a polygon thinner than its `rounding` rounds by what
it can hold: a triangle at most to its inscribed circle. The final `max` keeps
the solid inside the polygon.

The heart, with its point at `(0, 0)` and its lobes centered at
`(±0.25, 0.75)` before the shift above:

```
heart(x, y):
    x = abs(x)
    if x + y > 1:  return ‖(x − 0.25, y − 0.75)‖ − √2/4
    m = 0.5·max(x + y, 0)
    return √min(x² + (y − 1)², (x − m)² + (y − m)²) · sign(x − y)
```

So a heart's point is `size`/2 below `center`, and its lobes reach 0.604 ·
`size` above `center` and to either side.

The stroke is drawn along its points `P0 … Pn` with a pen whose radius goes
from `width`/2 at `P0` to `widthTo`/2 at `Pn` by length along the line:

```
Li = the length of the line from P0 to Pi;  L = Ln, or 1 when Ln is 0
for each segment i = 1 … n, from a = Pi−1 to b = Pi:
    e = b − a
    h = clamp(((x, y) − a)·e / (e·e)), or 0 when e is zero
    ri = mix(width/2, widthTo/2, (Li−1 + h·(Li − Li−1)) / L)
    di = ‖(x, y) − a − e·h‖ − ri
d = min(d1 … dn)
```

An outline's `rotation`, `scale` and `mirror` act after its own field, about
`[0, 0]`: the outline is scaled, then turned counterclockwise by `rotation`,
then mirrored. With `θ` = `rotation` and `(sx, sy)` = `scale`:

```
g(x, y) = f((cos θ·x + sin θ·y) / sx, (−sin θ·x + cos θ·y) / sy) · min(sx, sy)
mirror "x":  min(g(x, y), g(−x, y))
mirror "y":  min(g(x, y), g(x, −y))
```

### A.5 Deformers

A deformer maps the point at which the field below it is taken, and some also
change the distance. For `axis` = `a`, the two other axes are `u` and `v`, in
the order x, y, z: (y, z) for x, (x, z) for y, and (x, y) for z. `f` is the
field the deformer wraps, and `k` = `amount`.

| `type` | Field |
|---|---|
| `taper` | `f(q)·min(s, 1)`, where `s = max(0.1, 1 + k·pa)` and `q` is `p` with `pu` and `pv` divided by `s` |
| `twist` | `f(q)`, where `q` is `p` with `(pu, pv)` turned by `t = −k·pa` degrees: `qu = pu·cos t − pv·sin t`, `qv = pu·sin t + pv·cos t` |
| `bend` | `f(p)` when `toward` equals `axis` or `k = 0`; else, with `b` = `toward`, `κ = k·π/180`, `R = 1/κ` and `σ` the sign of `R`, `f(q)`, where `q` is `p` with `qa = atan2(σ·pa, σ·(R − pb)) / κ` and `qb = R − σ·√(pa² + (R − pb)²)`. It reads each point back from the arc of radius `R` about `(pa, pb) = (0, R)`, onto which a point `s` along the axis and `h` toward `b` goes at `(0, R) + (R − h)·(sin κs, −cos κs)`; `atan2(y, x)` is the angle of `(x, y)` from +x toward +y, in radians |
| `squash` | `f(q)·min(below, above, 1)`, where `q` is `p` with `pa` divided by `below` when `pa < 0` and by `above` otherwise; one factor for both halves keeps the field continuous where they meet |
| `ripple` | `f(p) + amplitude·w·sin(count·atan2(pv, pu))`, with `w` below; `atan2(pv, pu)` is the angle of `(pu, pv)` from +u toward +v, in radians |

```
w = 1                                                     without a range
r0 = min(range), r1 = max(range), l = 0.2·(r1 − r0)       with one:
w = smoothstep(r0, r0 + l, pa)·smoothstep(r1, r1 − l, pa)    when l > 0
w = 0                                                        when l = 0
```

Twist turns the solid from +u toward +v by `amount` degrees per unit along the
axis. Bend takes its angle from the point's own `pa`, so it is not exactly a
turn of the solid; it curves both halves toward +`toward` for a positive
amount. A ripple's waves fade in over the first and last fifth of its range,
and a range with equal ends holds none. Deformed fields are not exact
distances (5.5).

### A.6 A shape's own space

A shape's field at a point `p` of its parent's space (the avatar's space for a
body or part shape, the combinator's own space for a child) is:

```
u  = p − position
u  = Rᵀ·u,  with R = Rz(rotation[2])·Ry(rotation[1])·Rx(rotation[0])
u  = (ux/sx, uy/sy, uz/sz),  with (sx, sy, sz) = scale; a number s is (s, s, s)
F0 = the primitive's field (A.3), or the combinator's (A.2) with its children taken at the point it is given
Fi = deformer i of `deform` (A.5) wrapping Fi−1, for i = 1 … n
d  = Fn(u)·min(sx, sy, sz) − inflate
```

```
Rx(θ) = [1 0 0; 0 cos θ −sin θ; 0 sin θ cos θ]
Ry(θ) = [cos θ 0 sin θ; 0 1 0; −sin θ 0 cos θ]
Rz(θ) = [cos θ −sin θ 0; sin θ cos θ 0; 0 0 1]
```

Each matrix turns counterclockwise as seen from the + end of its axis, and the
product turns a shape first about x, then y, then z, about the parent's axes
(5.1). The last deformer wraps the others, so a point goes through the last
deformer's map first, and the first deformer acts on the solid first.
`inflate` is taken off in the parent's units, after the scale.

`mirror` then joins the shape with its reflection across the parent's plane
through the origin:

```
"x":  min(d(x, y, z), d(−x, y, z))
"y":  min(d(x, y, z), d(x, −y, z))
"z":  min(d(x, y, z), d(x, y, −z))
```

### A.7 The biped suit

A biped's suit (6.2) is one field, built from `proportions` with the defaults
of 6.2. `E(u; a, b, c)` is the ellipsoid field of A.3 with radii `(a, b, c)`
at the point `u`, and `S(u; a, b, c, n)` the superellipsoid field.

```
hk = 0.8 + 0.4·head,  bk = 0.8 + 0.4·body
(hw, hh, hd) = (0.7, 0.6, 0.62)·hk          the head's radii
    headShape "wide":  hw = 1.15·hw, hh = 0.92·hh
    headShape "tall":  hh = 1.15·hh, hw = 0.95·hw
(bw, bh, bd) = (0.56, 0.56, 0.5)·bk          the body's radii
    bodyShape "round": bw = bh = max(bw, bh), bd = 1.08·bd
    bodyShape "slim":  bw = 0.8·bw, bd = 0.85·bd
by = −0.36,  hy = by + 0.672·(bh + hh)       the centers' heights
legged = legs > 0.02,  L = 0.14 + 0.4·legs
bottom = by − 0.54·bh − L if legged, else by − 0.9·bh
s = −1 − bottom;  by = by + s,  hy = hy + s,  bottom = −1

head(p)  = S(p − (0, hy, 0); hw, hh, hd, 3.2) if headShape is "square",
           else E(p − (0, hy, 0); hw, hh, hd)
torso(p) = with u = p − (0, by, 0):
           S(u; bw, bh, bd, 3.2)                              if bodyShape is "square"
           E(u; bw·(1 + 0.12·clamp(−u.y/bh, −1, 1)), bh, bd)  if "pear"
           E(u; bw, bh, bd)                                    if "round" or "slim"
leg(p)   = with lx = 0.48·bw, r = 0.19·(0.85 + 0.3·body), a = by − 0.3·bh,
           e = bottom + 0.6·r and h = clamp((p.y − a)/(e − a)):
           ‖(abs(p.x) − lx, p.y − mix(a, e, h), p.z − 0.04·h)‖ − r·(1 + 0.08·h)
d    = smin(head, torso, 0.2);  if legged, d = smin(d, leg, 0.1)
suit = smax(d, −(p.y − bottom), 0.06)
```

`leg` draws both legs, and the last line cuts the feet flat on y = −1. A
suit too tall for the box of section 4 is scaled down about its feet:

```
k = min(1, 2.05 / (hy + hh + 1))
suit_k(p) = k·suit(p.x/k, (p.y + 1)/k − 1, p.z/k)
```

The head's center is then `(0, −1 + (hy + 1)·k, 0)` and its radii
`(hw, hh, hd)·k`, and the body's likewise. With a `shape`, the body's field is
`smin(suit_k, shape, 0.06)`. The default suit's head center is at
y = 0.42192: the face moves up or down by the difference between the head's
center and that height (6.2).

### A.8 Arms and hands

Both arms are the same solid, in the arm's own space, hanging down −y from the
shoulder at its origin:

```
L = 0.26 + 0.4·length          length is arms.length, or for a biped proportions.arms when that is missing
r = 0.08 + 0.14·thickness
"nub":  capsule from (0, 0, 0) to (0, −L, 0), radius 1.1·r, radiusTo r;  the tip t = −L
"paw":  union, smooth 0.04, of a capsule from (0, 0, 0) to (0, −L + 0.3·r, 0) of radius 0.9·r
        and a sphere of radius 1.2·r at (0, −L + 0.3·r, 0);  the tip t = −L + 0.3·r
"none": no solid;  the tip t = −L, and the hands' field is a sphere of radius r at it
```

The left arm's shoulder (the avatar's left is +x) is:

- on a biped, `(0.9·bw, by + 0.5·bh, 0.04)` with the body's radii and center
  after the scale `k` of A.7;
- on a blob, the front point of `arms.at` on the body, with its z multiplied
  by 0.4 so that the arm hangs from inside the side. Without `at`, the front
  point is `(min(0.9, 0.85·xmax), ymid − 0.1)`, where `xmax` is the body's
  largest x and `ymid` is halfway between its lowest and highest points. On a
  miss (A.9), the shoulder is `(x, y, 0)`.

At rest the left arm is turned about +z by 0.42 radians (about 24°), so that
its tip swings out to +x. The right arm is its mirror image across x = 0.

A hand (9.1) is a space at its arm's tip: its origin is at `(0, t, 0)` of the
arm's space, and it is turned back by −0.42 radians about z, so it is upright
while the arm rests. The right hand's space is the mirror image of the
left's. The hand's field, for `at` and `direction`, is its arm's, and its
center is its origin.

### A.9 Placing on the surface

The **normal** at a point of a surface is the field's gradient there,
normalized. A renderer MAY estimate it by central differences.

The **front point** `[x, y]` on a target (section 4) is `(x, y, z*)` in the
target's space, where `z*` is the largest z at which the target's field is
below zero along the line through `(x, y)` parallel to the z axis. A
**direction** `d` (9.1) from the target's center `c` gives the point
`c + t*·d/‖d‖`, where `t*` is the largest `t > 0` at which the field is below
zero along that ray. A direction of length 0 misses.

The target's field and center:

| `to` | Field | Center |
|---|---|---|
| `"body"` | The body's, in the avatar's space | `(0, y, 0)`, with y halfway between the body's lowest and highest points |
| `"head"` | On a biped, the body's field in the head's space (A.7); on a blob, the body's | `(0, 0, 0)` on a biped; the body's on a blob |
| `"left-hand"`, `"right-hand"` | The arm's, in the hand's space (A.8) | `(0, 0, 0)` |
| A part's `id` | That part's shape | The middle of its bounding box |

When the line or the ray never meets the solid, the placement **misses**. It
then acts as a surface facing +z: a front point is `(x, y, 0)` of the target's
space, a direction is the target's center, and the normal is +z in both. A
renderer MUST place a miss this way and SHOULD tell the document's writer
about it; checkers such as `openavatar validate` report it.

At the point `P` with normal `n`, the part's origin goes to `P + lift·n`. With
`align` `"surface"`, the part is turned by the shortest turn that takes +z to
`n`: about the axis `z × n` by the angle between them, or a half turn about y
when `n` is −z. With `"upright"` or `"none"` it is not turned. `rotation`
(9.1) then turns it about its own axes as `align` left them, by
`Rz·Ry·Rx` as in A.6. A part placed with `position` goes there unturned
before its `rotation`.

A part's mirrored copy (`mirror` `"x"`) is placed by the same steps with the
x coordinate of `at`, `direction` or `position` negated, and is the
reflection across x = 0 of the part placed there: its shape is reflected, and
so is its turn, which negates the y and z angles of `rotation`. On a target
that is not symmetric, the two copies can land on surfaces that are not
reflections of each other.

A **patch** (9.3) placed on the surface is bent onto it. Let `O` be where its
origin went, `n` its own +z there (after `align` and `rotation`), `F` the
target's field and `L = F(O)`. The point `(x, y, z)` of the patch's own space
goes to `B + (t + z)·n`, where `B` is where `(x, y, 0)` goes unbent and `t`
is the root of `g(t) = F(B + t·n) − L` nearest 0 with `abs(t) ≤ 0.25`; when
`g` has no root there, `t` is where `abs(g)` is least in that range. So the
patch's middle follows the surface at the height of its origin, and its
thickness stays along `n`. The bent patch's field at `(x, y, z)` of its own
space is the flat patch's at `(x, y, z − t(x, y))`; a renderer MAY find `t`
at points about 0.015 apart and interpolate between them. Each copy of a
mirrored patch is bent onto the surface under it, and a part attached to a
patch uses the bent copy's field and the middle of its bent bounding box.

## Appendix B. Normalization

This appendix gives normalization (section 15) exactly, so that every reader
reads a document the same way. A reader MUST read a document as if it had
normalized it by these rules. It need not build the normalized document, but
one it shows, saves or hands on MUST be the one these rules give. The
reference implementation is `normalize` in the `@openavatar/core` package, with
the members of every object listed in its `model.js`.

The JSON Schema describes what a writer of 0.1 writes, so it fixes
`openavatar` to `"0.1"` and lists the required members. A reader does not
reject a document for failing it.

### B.1 Steps

1. **The file.** A file over 256 KB is rejected. A UTF-8 byte order mark at
   the start is skipped, and text that is not JSON is rejected. When an
   object repeats a member name, the last one counts, as ECMAScript's
   `JSON.parse` does; writers MUST NOT repeat one.
2. **The header.** The document is rejected when it is not an object; when it
   lacks `openavatar`, `id`, `name` or `body`; when `openavatar` is not a
   string of digits, a period and digits; when that major version is higher
   than the reader's; when `id` is not a non-empty string; or when `name` is
   not a string with something other than white space in it.
3. **The members a document cannot lack.** Each code point of `id` outside
   `A-Z a-z 0-9 . _ -` becomes `-`, so two ids that differ only in such
   characters name the same character. A `body` that is not an object becomes
   `{}`.
4. **The walk.** Every member is read by its kind (B.2), objects by B.3 and
   shapes by B.4. A document over a limit of 5.6 is rejected (B.4).
5. **The rest.** `openavatar` becomes the reader's version, `"0.1"`. A blob
   body left without a shape gets `{ "type": "sphere", "radius": 0.9 }`.
   Then parts and references are checked (B.5).

A member that normalization **drops** is removed, as if the writer had left
it out, so its default applies. Strings are measured in Unicode code points,
as JSON Schema measures them, and are compared in **code point order**: code
point by code point, a string that begins another coming first. It is the
byte order of their UTF-8.

### B.2 Values

| Kind | Normalization |
|---|---|
| Number | A finite JSON number, clamped to its range. Anything else is dropped |
| Whole number | A number, rounded to the nearest whole number (a half rounds up, toward +∞), then clamped |
| Boolean | `true` or `false`. Anything else is dropped |
| String | A longer string than its maximum is cut to its first code points up to the maximum. It is then dropped if it is shorter than its minimum or does not have its form (a pattern, such as an id's) |
| Date-time | A string, and also dropped unless it names a real instant (below) |
| Color | `#RGB` becomes `#RRGGBB`, and letters become upper case. Anything else is dropped |
| Vector | An array of exactly its count of finite numbers, each clamped. Anything else is dropped |
| Id from a list | A listed id, or an `x-` id where the member allows them (3.4). Another value takes the member's fallback, or is dropped where it has none |
| Object | B.3. Anything that is not an object is dropped |
| Array | Not an array: dropped. Over its maximum: cut to its first items up to the maximum, before they are read. Each item is read by its kind, and dropped items are removed. In a list of unique items (`idleMotions`, `tags`), an item equal to an earlier one is removed. With fewer items than its minimum left, the array is dropped |
| Map | Not an object: dropped. A key not of the map's key kind is dropped with its value, and values are read by their kind. Over its maximum (16 for `materials`), the entries whose keys come first in code point order stay, since JSON parsers do not agree on the order of members |
| Either | The first alternative that reads the value without a repair, else the first that can repair it; dropped when neither can |

`null` is kept where a member allows it: in reactions (11.2). An id this
version does not list takes the fallback of section 13: an expression
becomes `neutral`, a motion `nod`, and a reaction's prop or effect `null`
(none). A `driver` becomes `always`, a material `type` `felt`, a `rig` `blob`
and a part `role` `detail`, which are their defaults. Any other such id (an
outfit, a face type, a pose, the effect of an expression override, a key of
a map) is dropped. The values of `extensions` are kept as they are when they
are objects.

A **real instant** is written `YYYY-MM-DDTHH:MM:SS`, then optionally a period
and digits, then `Z` or `+HH:MM` or `-HH:MM`, with `T` and `Z` in either case.
The month is 01 to 12 and the day is within that month of the Gregorian
calendar. The hour is at most 23, the minute at most 59 and the second at
most 59, or 60 when the time is 23:59 in UTC (a leap second). An offset's
hour is at most 23 and its minute at most 59. Two date-times compare by the
instants they name, to the millisecond: digits past the third after the
period are ignored, and a leap second counts as the start of the next minute.
The reference is `instant` in the `@openavatar/core` package.

### B.3 Objects

A member the object does not define is dropped. Members are read by their
kinds, and then an object that lacks a member the JSON Schema lists as
required is dropped, which drops it from its parent in turn. A part's
`attach` that has more than one of `position`, `at` and `direction` keeps the
first in that order. A part that has both `shape` and `patch` keeps `shape`,
and a part with neither is dropped.

### B.4 Shapes and limits

- A shape or outline whose `type` the reader does not know is empty, and
  its other members are not read. A deformer whose `type` the reader does
  not know, or that lacks a required member, is dropped from `deform`.
- A shape or outline is read as an object of its type (B.3). One that lacks
  a required member, for example a sphere without `radius`, is empty.
- `children` beyond the first 32 are not read. After the children are read,
  the empty ones are removed. A subtract whose first child is empty is empty,
  and so is a combinator with no child left. An intersect or subtract with
  one child left becomes a union of it.
- A polygon or stroke keeps, among the first 64 entries of `points`, those
  that are arrays of two finite numbers, each clamped to -3 to 3. With fewer
  than its minimum left (3 for a polygon, 2 for a stroke), the outline is
  empty.
- An empty shape is dropped. A part whose shape or patch is dropped is
  dropped; for the body, see B.1 step 5.

Limits are counted as the reader goes. Every shape or outline object it
reads counts, whatever its type and even if it then turns out empty, and so
does every entry of every `points` array it reads, before the cut to 64. The
shape of the body or a part and a part's patch are at depth 1; a
combinator's children and an extrusion's outline are one deeper than it.
Members cut from a list and members of a shape of an unknown type are not
read, so they do not count. A document with more than 512 shapes and
outlines, a shape deeper than 16 or more than 1024 points is rejected.

### B.5 Parts and references

Parts are checked in order, after the walk:

- A part whose `id` an earlier part has is renamed `<id>-<n>`, with the
  smallest `n` from 2 that no earlier part has; `<id>` is cut from its end so
  that the new id has at most 32 characters.
- An `attach.to` that is not one of the targets of 9.1 and names no earlier
  part becomes `body`, so attachments never form a cycle. A name that several
  parts had before renaming means the first of them.
- A material reference that names no material is kept, and means what
  section 7 says. It is the one thing normalization reports but does not
  change.

### B.6 Reports (informative)

The reference `normalize` returns, with the document, a list of repairs, each
with the path of the member (for example `parts[2].attach.to`) and a message.
`validate` returns the same list without changing anything: a conforming
document (17.1) has nothing in it. The messages are not part of this
specification.

## Appendix C. Face features

This appendix gives the outline of every face feature and pose in section 8,
how features are laid on the surface, and how the face moves, so that two
renderers draw the same face. A renderer SHOULD draw these outlines and
follow these timings; it MAY draw the outlines more finely, and how a feature
looks in light (gloss, felt, glow) is its own. Lengths are avatar units,
angles radians, and times seconds.

### C.1 Laying features on the surface

Each feature has a front point on the face's surface (the body's, with the
patches laid on it): the eyes at `[±spacing, height]`, the mouth at
`[0, height]`, the cheeks at `[±spacing, height]` of `cheeks`, the brows at
`[±s, h + brows.height]` where `s` and `h` are the eyes' `spacing` and
`height`, and the nose at `[0, height]` of `nose`. On a biped every height
moves with the head (6.2). The feature is placed there as a part with
`align` `"surface"` is (A.9), a miss included, at a lift above the surface,
and its outline, drawn in the plane z = 0 of that place, is bent onto the
surface as a patch is (A.9). Outlines are given for the feature at +x; the
one at −x is its mirror image (x negated).

The lifts come from the body's material (7.1): F is its feature lift, and
I its ink lift, 0.032 on felt. The eyes are placed at F, and an eye drawn
as an outline sits at I, or at F on a material without an ink lift. The
mouth sits at I, or 0.8·F; the brows and a `button` or `triangle` nose at
I, or F; the cheeks at 0.7·F. A material type a renderer doesn't know is
felt here too.

A **stroke** of width `w` along a curve is the set of points within `w/2` of
the curve, so its ends are round. Curves are given as functions of `u` from
−1 to 1.

### C.2 Eyes

With `k = size`, an eye shape has radii `rx = a·k` and `ry = b·k`:

| `shape` | `a` | `b` |
|---|---|---|
| `round` | 1 | 1 |
| `oval` | 0.82 | 1.1 |
| `tall` | 0.62 | 1.28 |
| `wide` | 1.28 | 0.74 |
| `dot` | 0.5 | 0.5 |
| `almond` | 1.2 | 0.68 |

Its **outline** is the ellipse `(rx·cos θ, ry·sin θ)`; an almond's is
`(rx·c, ry·s·(1 − 0.35·abs(c)³)·q)` with `c = cos θ`, `s = sin θ`, and
`q = 1` where `s > 0`, else 0.8. With `w = max(0.012, 0.3·k)`, the poses are:

| Pose | Outline |
|---|---|
| `open` | The filled outline |
| `wide` | The filled outline with radii 1.2·rx and 1.25·ry (an almond's 1.22·rx and 1.3·ry) |
| `sad` | The part of the filled outline below the line through `(−rx, 0.5·ry)` and `(rx, −0.05·ry)` |
| `mad` | The part below the line through `(−rx, −0.05·ry)` and `(rx, 0.55·ry)` |
| `arc` | A stroke of width `w` along `(0.95·k·u, k·(0.42·(1 − u²) − 0.12))` |
| `squint` | A stroke of width `0.9·w` along `(0.85·k·u, k·(0.14·(1 − u²) − 0.02))` |
| `shut` | A stroke of width `0.85·w` along `(0.9·k·u, k·(0.1 − 0.3·(1 − u²)))` |
| `chevron` | A stroke of width `w` along the lines from `(0.62·k, 0.55·k)` to `(−0.48·k, 0)` to `(0.62·k, −0.55·k)` |
| `heart` | The closed curve of cubic Bézier segments, with `h = 1.25·k / 1.6`: from `(0, −1.05·h)` by `(−0.25·h, −0.75·h)` and `(−1.2·h, −0.25·h)` to `(−1.05·h, 0.35·h)`, by `(−0.95·h, 0.95·h)` and `(−0.25·h, 1.05·h)` to `(0, 0.55·h)`, and back down the right side, the mirror image |
| `wink-left`, `wink-right` | The eye at +x (left) or at −x (right) `shut`, the other `open` |

So a sad lid falls toward the eye's outer corner and a mad one toward its
inner corner. Sewn and drawn eyes are these outlines in the eyes' color.
A bead eye is a glossy ellipsoid with radii `rx`, `ry` and `0.55·k`, sunk
`0.12·k` into its place. It shows `open`, `wide` (both radii times 1.22),
`sad` (`ry` times 0.82, turned 0.25 so its outer end goes down) and `mad`
(`ry` times 0.72, turned 0.28 so its outer end goes up) itself, and swaps to
the outline in its color for the other poses.

### C.3 Mouth

With `m = width` and `t = max(0.012, 0.13·m)`:

| Shape or pose | Outline |
|---|---|
| `smile` | A stroke of width `t` along `(m/2·u, −0.2·m·(1 − u²))` |
| `frown` | A stroke of width `t` along `(0.42·m·u, 0.16·m·(1 − u²) − 0.08·m)` |
| `line`, `flat` | A stroke of width `t` from `(−0.42·m, 0)` to `(0.42·m, 0)` |
| `hmm` | A stroke of width `t` along `(0.4·m·u, −0.06·m·u + 0.035·m·sin(π·u))` |
| `cat` | A stroke of width `0.85·t` along `(m/2·u, 0.02·m − 0.16·m·abs(sin(π·u)))` |
| `grin` | The part of the filled ellipse with radii `m/2` and `0.45·m` below y = 0 |
| `o` | A filled ellipse with radii `0.2·m` and `0.24·m` |

The mouth's **openness** `o` follows `voice` while the state is `speaking`
and `speaks` is true, else 0, or `0.8·mouth` when that is larger, `mouth`
being the motion pose's (D.1); it eases with τ = 0.05 (10.2). While `o > 0.06` the mouth is a filled ellipse with radii
`0.42·m·vx·(0.6 + 0.4·o)` and `0.42·m·vy·(0.25 + 0.75·o)`, where
`(vx, vy)` is `(1, 1)` for the viseme `aa`, `(1.15, 0.5)` for `ih`,
`(0.55, 0.75)` for `ou`, `(1.2, 0.4)` for `ee`, `(0.75, 0.9)` for `oh` and
`(0.9, 0.8)` with none; a `beak` opens its lower half by `0.5·o` instead.
Otherwise it shows the mouth pose of the expression (C.6), else its shape at
rest: none for `oval`, the outline of `smile`, `line` or `cat`, or a closed
beak, two small cones pointing out of the face.

### C.4 Cheeks, brows and nose

- **Cheeks** are filled ellipses with radii `0.5·size` and `0.36·size`. Their
  weight `c` eases with τ = 0.18 toward 1 for `show` `"always"`, the largest
  weight of the `happy`, `laugh`, `love` and `relaxed` expressions for
  `"happy"`, and the `speaking` state's weight for `"speaking"`; an
  expression override's `cheeks` sets it to 1 or 0 (8.5). They show while
  `c > 0.03`, scaled by `0.4 + 0.6·c`.
- **Brows** are strokes of width `thickness` along
  `(length/2·u, 0.12·length·(1 − u²))`. With the eyes' `size` `k`, the eye
  pose turns each brow by `r` and raises it by `y`: `mad` −0.38 and −0.12·k,
  `sad` 0.32 and 0, `squint` −0.12 and 0, `wide` 0 and 0.45·k, `arc` and
  `chevron` 0 and 0.2·k, any other 0 and 0. A positive `r` lifts the brow's
  inner end, the one toward x = 0. Both ease with τ = 0.1.
- A **nose** of `size` `k`: `button` is a glossy ellipsoid with radii
  `1.1·k`, `0.8·k` and `0.6·k`; `triangle` is a closed stroke of width
  `0.35·k` through `(−0.55·k, 0.3·k)`, `(0.55·k, 0.3·k)` and `(0, −0.4·k)`;
  `snout` is a bump in the body's material with radii `1.7·k`, `1.15·k` and
  `1.1·k`, its center `0.25·k` out from the surface, with two nostrils in the
  nose's color.

### C.5 Blinking and gaze

- The eyes' **lid** `l` scales their height. A blink lasts 0.14 with
  `l = abs(1 − 2·p)` as `p` goes from 0 to 1. With `blink` true, blinks come
  `(2.2 + 3.6·r) / (0.5 + temperament.blink)` apart, `r` drawn uniformly
  from 0 to 1 each time. Then `l` is multiplied by `1 − 0.82·w` with `w` the
  `sleeping` activity's weight, and is at least 0.08; while `w > 0.9` an
  `open` eye is `shut`. Every other pose, all but `open`, `wide` and those a
  bead shows itself, scales by `max(l, 0.6)` instead, so a stroke never
  vanishes.
- The **gaze** target `(gx, gy)` is `(0, 0)` for `user` or none,
  `(0, −0.8)` for `down`, `(0.2, 0.8)` for `up`, `(±0.8, 0)` for `side`
  with the sign of `sin(0.35·time)`, `(0.9·sin(0.7·time), 0.3·sin(1.1·time))`
  for `around`, `(−0.4, −0.6)` for `work`, and the `pointer` input for
  `pointer` (12.1), plus the motion pose's `(gx, gy)` (D.1), each clamped to
  −1 to 1. It eases with τ = 0.2. The avatar turns toward it, by
  `0.14·gx` about y and `0.06·gy` upward about x, added to the pose (D.4):
  the whole avatar turns, a biped's head with its body. With `gaze` true the eyes also move in their places by
  `(0.38·k·gx, 0.3·k·gy)`, or 0.4 of that for those other poses.

### C.6 Expressions on the face

The face shows the poses (8.5, 13.4) of the expression channel's id when its
intensity is at least 0.3, else those of `neutral`: the document's override
for that id, else the standard poses of the id or its fallback. A change of
eye pose happens behind a quick blink of 0.16 (`l = abs(1 − 2·p)` as `p`
goes from 0 to 1), the new pose taking over at its middle. Blinks wait
while it lasts.

## Appendix D. Whole-body motion

This appendix gives how the whole avatar moves: at rest, in each conversation
state, while it sleeps, and in each motion of 13.5. A renderer SHOULD move the
avatar by it, as 10.1 asks for parts, so an avatar moves alike in every app.
Appendix C gives the face's own movement.

Every frame the renderer sums a target pose from D.2 and D.3, eases the pose
toward it and applies it (D.4).

### D.1 The pose

| Channel | Meaning |
|---|---|
| `x`, `y` | Moves the avatar along x and y, in avatar units |
| `rx`, `ry`, `rz` | Turns it, in radians: about x (its top toward the viewer), about y (its front toward +x) and about z (its top toward −x) |
| `sq` | Squashes it; below 0 it stretches |
| `la`, `ra` | Raises the left and the right arm, in radians added to the rest angle of A.8 |
| `lf`, `rf` | Swings the left and the right arm toward the viewer, in radians |
| `gx`, `gy` | Moves the gaze target (C.5) |
| `mouth` | Opens the mouth (C.3), 0 to 1 |

Every channel is 0 unless something adds to it. The poses use these
functions of a motion's progress `p`, which runs from 0 to 1:

```
clamp(p)   = min(1, max(0, p))
bell(p)    = sin(π·clamp(p))
osc(p, n)  = sin(2π·n·p)
smooth(p)  = c²·(3 − 2·c), where c = clamp(p)
hold(p)    = smooth(p / 0.2)·(1 − smooth((p − 0.8) / 0.2))
jump(p, h) sets y = h·sin(π·a) and sq = e − 0.06·bell(a), where a = clamp((p − 0.2) / 0.6)
           and e = 0.1·bell(p / 0.2) while p < 0.2, 0.1·bell((p − 0.8) / 0.2) while p > 0.8, else 0
```

### D.2 At rest and in each situation

With `t` the time input (12.1) and the temperament's members (11.1):

```
v = 0.7 + 0.6·energy        S = 0.3 + 1.4·sway        B = 0.4 + 1.2·bounce
φ = 2π·(h mod 1000) / 1000, where h starts at 7 and becomes (31·h + c) mod 2³²
    for each UTF-16 code unit c of the document's id

always:     sq += 0.012·sin(1.9·t + φ);  rz += 0.018·S·sin(0.55·v·t + φ);  ry += 0.03·S·sin(0.31·t + φ)
floating:   y  += 0.035·sin(1.3·t + φ)
listening:  rx += 0.07·wl;  rz += 0.04·wl;  sq −= 0.035·mic·wl
thinking:   rz −= 0.07·wt;  ry −= 0.06·wt;  rx −= 0.03·wt
speaking:   y  += 0.022·B·voice;  sq −= 0.04·voice;  rx += 0.03·sin(7·t)·voice
sleeping:   sq += 0.06·ws;  rx += 0.1·ws;  y −= 0.02·ws
```

`wl` and `wt` are the weights of the `listening` and `thinking` states, `ws`
that of the `sleeping` activity, and `voice` and `mic` those drivers'
weights (10.2). "floating" applies to an avatar whose `anchor` is `"float"`
(6). `φ` keeps avatars side by side from breathing in step.

### D.3 Motions

A motion of length `L` adds its pose at progress `p`, times its weight `k`.
The motion channel (11.3), idle motions (11.2) and the host's **play**
(12.2) each play one, after the fallbacks of 13.5, and what they play adds
up. While the host's play holds the motion channel (layer 1), the channel
plays nothing of its own: its looping motion lets go and fades as below, a
motion it played once plays on to its end, and the host's motion is played
only as the host's play. Whether a motion loops is read from the motion
that plays after the fallbacks.

- A looping motion that holds the motion channel: `p = (v·s / L) mod 1`,
  where `s` counts the seconds since it took the channel. `k` eases toward 1
  while it holds the channel and toward 0 after it lets go, with τ = 0.35
  (10.2), and the motion ends once `k < 0.01`. A new looping motion starts
  at `k = 0` and replaces one still fading out.
- A motion that plays once when it takes the channel: `k = 1` and
  `p = v·s / L` until `p` reaches 1, so it lasts `L / v` seconds. A new one
  replaces it.
- An idle motion: it plays as one that plays once, but with `k = 0.8`; a
  looping one eases toward 0.8 instead of 1 and lets go after one cycle.
  Each is picked at random, all equally likely, from `idleMotions`. The
  first comes 6 to 12 seconds after the avatar appears, each next one the
  wait of 11.2 after the one before starts, and none sooner than 4 seconds
  after idle motions last could not play.
- A motion the host plays: `k = 1` and `p = s / L`, at its own pace whatever
  the energy. It ends when `p` reaches 1, or, when the host asks it to loop,
  goes on with `p mod 1` until the host stops it.

| Motion | `L` (s) | Pose |
|---|---|---|
| `nod` | 0.9 | `rx = 0.16·max(0, osc(p, 2))·bell(p)` |
| `hop` | 0.75 | `jump(p, 0.14)` |
| `spin` | 1.1 | `ry = 2π·smooth(p)`; `y = 0.05·bell(p)` |
| `wiggle` | 1 | `rz = 0.14·osc(p, 3)·bell(p)`; `x = 0.02·osc(p, 3)·bell(p)` |
| `shake` | 1 | `ry = 0.32·osc(p, 3)·bell(p)` |
| `bow` | 1.6 | `rx = 0.45·smooth(p / 0.35)·(1 − smooth((p − 0.65) / 0.35))` |
| `jump` | 1 | `jump(p, 0.36)`; `la, ra = 1.4·bell(p)` |
| `bounce` | 0.5 | `jump(p, 0.07)` |
| `nod-beat` | 0.5 | `rx = 0.1·max(0, osc(p, 1))`; `y = 0.01·bell(p)` |
| `look-around` | 3 | `ry = 0.45·osc(p, 1)`; `rx = −0.04·bell(p)`; `gx = osc(p, 1)` |
| `lean-in` | 1.8 | `rx = 0.2·bell(p)`; `sq = −0.02·bell(p)` |
| `shiver` | 1.2 | `x = 0.012·osc(p, 19)·bell(p)`; `sq = 0.03·bell(p)`; `la, ra = 0.2·bell(p)` |
| `stretch` | 2 | `sq = −0.14·bell(p)`; `y = 0.03·bell(p)`; `la, ra = 1.9·bell(p)`; `lf, rf = −0.25·bell(p)` |
| `yawn` | 2.4 | `rx = −0.14·bell(p)`; `sq = −0.05·bell(p)`; `mouth = bell(p)`; `la, ra = 0.8·bell(p)` |
| `sleep` | 4 | `rx = 0.14`; `rz = 0.1`; `sq = 0.04 + 0.03·osc(p, 1)`; `y = −0.02` |
| `peek` | 2.2 | `x = 0.25·bell(p)`; `rz = −0.2·bell(p)`; `ry = −0.2·bell(p)`; `gx = −bell(p)` |
| `groove` | 1 | `rz = 0.1·osc(p, 1)`; `x = 0.03·osc(p, 1)`; `y = 0.025·abs(osc(p, 1))`; `la = 0.3 + 0.25·osc(p, 1)`; `ra = 0.3 − 0.25·osc(p, 1)` |
| `dance` | 1.2 | `ry = 0.5·osc(p, 1)`; `y = 0.06·abs(osc(p, 2))`; `rz = 0.12·osc(p, 2)`; `la = 1.1 + 0.75·osc(p, 2)`; `ra = 1.1 − 0.75·osc(p, 2)`; `lf, rf = −0.2` |
| `celebrate` | 1.6 | `jump(clamp(1.4·p), 0.3)`; `ry = 2π·smooth((p − 0.1) / 0.6)`; `la, ra = 1.9·bell(p)`; `lf, rf = −0.25·bell(p)` |
| `wave` | 1.8 | `la = hold(p)·(1.65 + 0.3·osc(p, 3))`; `lf = −0.35·hold(p)`; `rz = −0.05·hold(p)` |
| `clap` | 1.4 | `la, ra = −(0.075 + 0.225·osc(p, 4))·bell(p)`; `lf, rf = 1.35·bell(p)`; `y = 0.02·abs(osc(p, 4))·bell(p)` |
| `cheer` | 1.4 | `la, ra = 1.9·bell(p)`; `lf, rf = −0.25·bell(p)`; `y = 0.06·abs(osc(p, 2))·bell(p)`; `sq = −0.04·bell(p)` |
| `shrug` | 1.4 | `la, ra = 0.55·bell(p)`; `lf, rf = 0.5·bell(p)`; `rz = 0.06·bell(p)`; `sq = −0.03·bell(p)` |
| `point` | 1.6 | `ra = 1.15·bell(p)`; `rf = 0.3·bell(p)`; `ry = 0.25·bell(p)`; `gx = −bell(p)` |
| `think` | 2.6 | `la = −0.1·bell(p)`; `lf = 1.75·bell(p)`; `rz = 0.08·bell(p)`; `gy = 0.7·bell(p)` |
| `typing` | 0.8 | `la = −0.3 + 0.08·osc(p, 3)`; `ra = −0.3 − 0.08·osc(p, 3)`; `lf = 1.3 + 0.12·osc(p, 3)`; `rf = 1.3 − 0.12·osc(p, 3)`; `rx = 0.07`; `gy = −1` |
| `writing` | 1.2 | `ra = −0.25 + 0.08·osc(p, 4)`; `rf = 1.3`; `la = −0.2`; `lf = 1`; `rx = 0.1`; `rz = 0.03·osc(p, 1)`; `gy = −1` |
| `reading` | 4 | `la, ra = −0.2`; `lf, rf = 1.25`; `rx = 0.08`; `ry = 0.05·osc(p, 1)`; `gy = −0.8` |
| `facepalm` | 1.8 | `ra = −0.15·bell(p)`; `rf = 1.95·bell(p)`; `rx = 0.12·bell(p)`; `ry = 0.1·bell(p)` |
| `heart-hands` | 1.8 | `la, ra = 1.85·bell(p)`; `lf, rf = −0.5·bell(p)`; `sq = −0.02·bell(p)` |

`a, b = …` sets both channels. On an avatar without arms the arm channels do
nothing, and 13.5's fallbacks pick motions that need none.

### D.4 Applying the pose

The target is the sum of D.2, D.3 and the head's turn toward the gaze (C.5:
`ry += 0.14·gx`, `rx −= 0.06·gy`). Each frame of `dt` seconds every channel
of the pose moves `1 − e^(−dt/0.06)` of the way to the target. The turns
`rx`, `ry` and `rz` move the short way round: by that share of the
difference wrapped to −π to π, after which the turn itself is wrapped to −π
to π. So a motion that ends a full turn round, such as `spin`, stops there
instead of turning back. Then:

- The avatar, its body and everything on it, is squashed, turned and moved
  about its **pivot** `P = (0, yp, 0)`, where `yp` is the body's lowest point
  when it stands and halfway between its lowest and highest points when it
  floats. A point `q` goes to `P + (x, y, 0) + R·Q·(q − P)`, where `Q`
  scales by `(1 + 0.5·s, 1 − s, 1 + 0.5·s)` with `s = clamp(sq, −0.25, 0.3)`,
  and `R` turns by `rz` about z, then by `rx` about x, then by `ry` about y,
  each about the fixed axes of the avatar's space: `R = Ry(ry)·Rx(rx)·Rz(rz)`,
  where `Ra(θ)` is the right-handed turn by θ about axis a.
- Each arm turns about z, at its shoulder, by
  `side·max(−0.4, min(2.4, 0.42 + raise))` instead of A.8's rest turn, then
  about x by `−f`, both about the fixed axes of the shoulder: a point `q` of
  the arm goes to `S + Rx(−f)·Rz(side·θ)·(q − S)`, with `S` the shoulder and
  `θ` that clamped angle. `side` is 1 for the left arm and −1 for the right,
  `raise` is its `la` or `ra` and `f` its `lf` or `rf`.
- The mouth and the gaze use `mouth`, `gx` and `gy` as C.3 and C.5 say.

## Change log

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-10-24 | First draft |
| 0.1 | 2026-10-25 | Appendix A gives every shape's field exactly. Polygon `rounding` never grows the polygon; a ripple `range` with equal ends holds no waves |
| 0.1 | 2026-10-25 | Appendix A gives the biped suit, the arms and hands, and placing on the surface exactly, with one rule for a front point or ray that misses. A part's center is halfway between its lowest and highest points |
| 0.1 | 2026-10-25 | A patch is bent onto the surface by an exact rule (A.9), 0.006 above it unless `lift` says otherwise |
| 0.1 | 2026-10-25 | Behavior: an expression the host asks for outranks speaking; a motion played once gives the channel back to the next layer down; a reaction's `intensity` is the expression's strength only; exact animation curves, weight easing, idle motion timing, and the `voice`, `mic` and `pointer` scales. `wiggle`'s default speed is 3, a `drift` shrinks away with its weight and a `spin` settles on a whole turn |
| 0.1 | 2026-10-25 | Appendix B gives normalization exactly. Strings are measured in code points; a repeated item keeps its first place; an id with other characters and a body that is not an object are repaired, not rejected; a renamed part id stays within 32 characters; dates must name real instants; over 16 materials, the ids that sort first stay; the shared folder breaks ties by file name |
| 0.1 | 2026-10-25 | Appendix C gives every face feature's outline, how features are laid and bent on the surface, and how the face blinks, looks and speaks. A bead eye's sad and mad tilts now match the stitched lids; `relaxed` uses the full `arc` and `smile` |
| 0.1 | 2026-10-25 | 7.2 gives every pattern exactly, with a portable hash for spots. A gradient spans the solid it colors instead of −1 to 1, and spots stay inside their cells |
| 0.1 | 2026-10-25 | 7.1 gives every material type's parameters, the pile of felt, fur and velvet, and the feature lifts that C.1 uses. `roughness` now applies to fur and velvet too, and a patch always clears the pile under it |
| 0.1 | 2026-10-25 | The conformance suite has geometry vectors for every render case (17.2). The lowest and highest points of a solid are found on its field, not on a mesh of it |
| 0.1 | 2026-10-25 | Appendix D gives how the whole avatar moves: at rest, in each situation and in every motion of 13.5. The host's **play** can loop a motion; a looping idle motion plays one cycle; the default idle motions are `nod`, `wiggle` and `look-around` |
| 0.1 | 2026-10-25 | A document can define expressions of its own: an `x-` id in `face.expressions` that a reaction or the host names (8.5, 10.2). `squash` scales the field by one factor on both halves, so the surface has no seam at the split (A.5) |
| 0.1 | 2026-10-25 | `bend` lays the axis on an exact circular arc whose direction turns by `amount` degrees per unit of length and keeps distances across it (5.4, A.5); it used to turn each point about the origin, which bent about twice as much near the origin and stretched long pieces |
| 0.1 | 2026-10-25 | 13.7: effects are drawn in front, and move further out where they would cross a part floating free of the body |
| 0.1 | 2026-10-25 | Section 1 defines a name and an `x-` id and makes the JSON Schema normative for ranges, lengths and patterns. Cheeks given without `show` flush when happy (8.4); defaults are stated for `rounding`, `smooth`, `offset`, `squash`, stripes' `angle`, glass `opacity` (0.2), and the brows' and nose's color. A deformer of an unknown type or without a required member is dropped (B.4); a higher major version is always rejected (15) |
| 0.1 | 2026-10-25 | The pose's turns ease the short way round and stay within half a turn, so `spin` and `celebrate` no longer turn back after their full turn (D.4). While the host's play holds the motion channel, the channel plays nothing of its own (D.3). Whether a motion loops is read after its fallbacks (13.5). An unknown driver weighs 0, `x-` ids are listed by where they may appear (13), and an expression override's `effect` is defined (8.5) |
| 0.1 | 2026-10-25 | The pose, the arms and part animations are given as matrices (D.4, 10.1). Patterns and pile sit in the solid's space, which a shape's own transform does not move, and each arm and each copy of a part is a solid of its own (7.2). Colors are decoded from sRGB before any mixing (7.1). A biped's head space is moved to the head's center and not scaled (9.1), and the gaze turns the whole avatar (C.5) |
| 0.1 | 2026-10-25 | A `direction` of length 0 misses (A.9). A `glow` animation's amount is clamped to 0–4, and on a material without `glow` it glows in the base color (10.1); a glow's color defaults to the base color, `#9AA4B2` when the material gives none (7.3) |

# OpenAvatar 0.1 conformance suite

The suite of [SPEC 17.2](../spec/SPEC.md#172-renderers). Use it to check a
reader, a renderer or a host that implements OpenAvatar. `manifest.json`
lists every case.

| Folder | Cases | What a conforming implementation does |
|---|---|---|
| `render/` | 58 documents, plus the 16 [examples](../examples/) | Renders each one. Together they use every primitive, combinator, outline, deformer, rig, face type, eye, mouth and nose shape, material type, pattern, part role, attachment, attach target and animation of 0.1 |
| `geometry/` | one JSON file per render case | Builds the same fields and puts the parts, arms, hands and face features in the same places, within the tolerances below |
| `renders/` | one WebP per render case | The reference renderer's picture. Yours need not match it pixel for pixel; it must show the same shape, colors and features |
| `repair/` | 23 inputs, each with `<id>.expected.openavatar` | Reads the input and repairs it (SPEC 15, Appendix B). A reader's repaired document should equal the expected one; at least it must render the same character |
| `reject/` | 11 documents | Refuses each one with an error that names the problem. `code` in the manifest is the reference reader's error code |
| `behavior/cases.json` | 40 cases | Given the document and the host's input, resolves the expression, motion, prop, effect and gaze channels to the expected values (SPEC 11.3, 13) |

Every case has a sentence that says what it checks: `shows` for a render
case, `checks` for a repair or behavior case, `because` for a reject case.
Each render case also lists what it `covers`, as `kind:value` tags such as
`shape:torus`, `mouth:cat` or `attach:direction`, so you can find the cases
for a feature.

A behavior case's `input` holds the host's inputs (`state`, `activity`,
`userActivity`, `expression` and its `expressionIntensity`), `command` for a
motion the host started, and `finished` for the layers whose motion played
once and ended while their situation lasts (SPEC 11.3).

The behavior cases expect what a renderer resolves when it knows exactly the
standard ids of 0.1. A renderer that also knows an `x-` motion plays it where
the case expects `nod`; everything else must match.

## Geometry vectors

A render case's `geometry` file holds numbers from the reference renderer
for the avatar as built, before any animation runs. Every point and matrix is
in the avatar's space (SPEC 4), the space of the body's field, unless it says
otherwise.

| Key | Holds |
|---|---|
| `body.points` | `[x, y, z, d]`: the body's field `d` at the point. Half the points are spread over the body's box grown by 0.15, half lie within 0.08 of its surface |
| `parts` | One entry per placed copy, in document order, with a mirrored copy after the copy it mirrors. `id` and `copy` name it, `hidden` marks a part hidden at rest and `patch` a patch. `matrix` is the top three rows of the 4×4 matrix that takes the part's own space to the avatar's, and `points` is its own field at points in its own space |
| `arms` | Each arm's `side` and the `matrix` of its space |
| `hands` | The `matrix` of the left and the right hand's space |
| `face` | `eyes`, `mouth`, `brows` and `cheeks`, each a point `p` and the outward normal `n` there, or `null` when the face has none of that feature; `face` is `null` for a face of type `none` |

A point is written with six decimals and its field computed at the written
point, so `d` is the field there, rounded to six decimals. A renderer
conforms when its fields are within 0.00001 of `d` and its matrices, points
and normals within 0.0001 of the ones written. A patch's points are its bent
field, which the reference renderer computes in its own way; they are
informative.

## Checking a renderer by eye

Render each case from the front at rest and next to its reference picture.
The reference pictures show the cells named under them: most show the front
and a three-quarter view (turned 35 degrees, showing the avatar's left side),
faces add `happy` and `speaking`, and the examples show the twelve cells of
`openavatar render --sheet`. The `openavatar` CLI draws the same cells:

```sh
npx @openavatar/cli render conformance/render/shape-torus.openavatar --view three-quarter
```

## How the suite is made

`tools/cases.mjs` defines the cases, and `tools/build.mjs` writes the
documents, asks the reference implementation (the `openavatar` and
`@openavatar/three` packages) for the expected results and the geometry
vectors (`tools/geometry.mjs`), and renders the pictures in a headless
browser. After changing a case or the reference
implementation, run it from `openavatar/`:

```sh
node conformance/tools/build.mjs               # documents, expectations and renders
node conformance/tools/build.mjs --no-renders  # without the browser
```

The tests of both packages check the suite: the core package recomputes
every repair, rejection and behavior and checks that the render cases cover
every value in `vocabulary.json`, and the renderer builds every render and
repair case, recomputes the geometry vectors at high and low quality, and
checks the fields in them against an independent version of Appendix A.

The documents and pictures are released under CC0 1.0.

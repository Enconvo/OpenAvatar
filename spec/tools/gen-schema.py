import json, sys
spec_dir = sys.argv[1]
V = json.load(open(f'{spec_dir}/vocabulary.json'))
ids = lambda k: [x['id'] for x in V[k]]
XID = {"type": "string", "pattern": "^x-[a-z0-9][a-z0-9-]{0,39}$"}
# An RFC 3339 date-time; the format also asks for a real calendar day (SPEC B.2).
DATE_TIME = {"type": "string", "format": "date-time", "pattern": "^\\d{4}-\\d{2}-\\d{2}[Tt]\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?([Zz]|[+-]\\d{2}:\\d{2})$", "maxLength": 64}
def vocab(name, values):
    return {"description": f"A standard {name} id (vocabulary.json) or an x- vendor id.", "anyOf": [{"enum": values}, XID]}
def num(lo, hi, desc=None):
    d = {"type": "number", "minimum": lo, "maximum": hi}
    if desc: d["description"] = desc
    return d
def intr(lo, hi): return {"type": "integer", "minimum": lo, "maximum": hi}
def obj(props, required=(), desc=None, extra=None):
    d = {"type": "object", "properties": props, "additionalProperties": False}
    if required: d["required"] = list(required)
    if desc: d["description"] = desc
    if extra: d.update(extra)
    return d
def vec(n, lo, hi): return {"type": "array", "prefixItems": [num(lo, hi)] * n, "items": False, "minItems": n}
ref = lambda n: {"$ref": f"#/$defs/{n}"}
nullable = lambda s: {"anyOf": [s, {"type": "null"}]}
# `required` inside if/then/not/oneOf, with the names declared beside it, so strict validators (Ajv strictRequired) accept it.
need = lambda *names: {"required": list(names), "properties": {n: True for n in names}}
axis = {"enum": ["x", "y", "z"]}
D = {}
D["color"] = {"type": "string", "pattern": "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", "description": "sRGB color, #RRGGBB or #RGB."}
D["vec3"] = vec(3, -5, 5)
D["vec2"] = vec(2, -5, 5)
D["frontPoint"] = dict(vec(2, -1.5, 1.5), description="A front point [x, y]: where the line from (x, y, +infinity) toward -z first meets the solid (SPEC 4).")
D["rotation3"] = vec(3, -360, 360)
D["scale3"] = {"anyOf": [num(0.05, 20), vec(3, 0.05, 20)]}
D["scale2"] = {"anyOf": [num(0.05, 20), vec(2, 0.05, 20)]}
# ---- deformers
D["deformer"] = {"oneOf": [
  obj({"type": {"const": "taper"}, "axis": axis, "amount": num(-1, 1)}, ["type", "axis", "amount"]),
  obj({"type": {"const": "twist"}, "axis": axis, "amount": num(-180, 180)}, ["type", "axis", "amount"]),
  obj({"type": {"const": "bend"}, "axis": axis, "toward": axis, "amount": num(-180, 180)}, ["type", "axis", "toward", "amount"]),
  obj({"type": {"const": "squash"}, "axis": axis, "below": num(0.2, 5), "above": num(0.2, 5)}, ["type", "axis"]),
  obj({"type": {"const": "ripple"}, "axis": axis, "count": intr(2, 32), "amplitude": num(0, 0.2), "range": vec(2, -3, 3)}, ["type", "axis", "count", "amplitude"]),
]}
# ---- shapes
common = {"position": ref("vec3"), "rotation": ref("rotation3"), "scale": ref("scale3"), "mirror": axis,
          "deform": {"type": "array", "items": ref("deformer"), "maxItems": 4}, "inflate": num(-0.3, 0.3)}
def shape(t, props, req=()):
    return obj({"type": {"const": t}, **common, **props}, ["type", *req])
children = lambda lo, item: {"type": "array", "items": ref(item), "minItems": lo, "maxItems": 32}
D["shape"] = {"description": "A solid (SPEC 5).", "oneOf": [
  shape("sphere", {"radius": num(0.01, 1.5)}, ["radius"]),
  shape("ellipsoid", {"radii": vec(3, 0.01, 1.5)}, ["radii"]),
  shape("box", {"size": vec(3, 0.01, 3), "rounding": num(0, 1.5)}, ["size"]),
  shape("superellipsoid", {"radii": vec(3, 0.01, 1.5), "exponent": num(1, 10)}, ["radii"]),
  shape("capsule", {"from": vec(3, -3, 3), "to": vec(3, -3, 3), "radius": num(0.005, 1), "radiusTo": num(0.005, 1)}, ["from", "to", "radius"]),
  shape("cylinder", {"radius": num(0.01, 1.5), "height": num(0.01, 3), "rounding": num(0, 1.5)}, ["radius", "height"]),
  shape("cone", {"radius": num(0.01, 1.5), "radiusTop": num(0, 1.5), "height": num(0.01, 3), "rounding": num(0, 1.5)}, ["radius", "height"]),
  shape("torus", {"radius": num(0.02, 1.5), "thickness": num(0.005, 0.75)}, ["radius", "thickness"]),
  shape("extrusion", {"outline": ref("outline"), "depth": num(0.005, 3), "rounding": num(0, 1.5), "puff": num(0, 1)}, ["outline", "depth"]),
  shape("halfspace", {"normal": vec(3, -1, 1), "offset": num(-3, 3)}, ["normal"]),
  shape("union", {"children": children(1, "shape"), "smooth": num(0, 1)}, ["children"]),
  shape("subtract", {"children": children(2, "shape"), "smooth": num(0, 1)}, ["children"]),
  shape("intersect", {"children": children(2, "shape"), "smooth": num(0, 1)}, ["children"]),
]}
ocommon = {"rotation": num(-360, 360), "scale": ref("scale2"), "mirror": {"enum": ["x", "y"]}}
def outline(t, props, req=()):
    return obj({"type": {"const": t}, **ocommon, **props}, ["type", *req])
pts = lambda lo: {"type": "array", "items": vec(2, -3, 3), "minItems": lo, "maxItems": 64}
c2 = vec(2, -3, 3)
D["outline"] = {"description": "A flat shape in the xy plane (SPEC 5.4).", "oneOf": [
  outline("circle", {"radius": num(0.005, 3), "center": c2}, ["radius"]),
  outline("ellipse", {"radii": vec(2, 0.005, 3), "center": c2}, ["radii"]),
  outline("rect", {"size": vec(2, 0.005, 6), "center": c2, "rounding": num(0, 3)}, ["size"]),
  outline("polygon", {"points": pts(3), "rounding": num(0, 1)}, ["points"]),
  outline("star", {"points": intr(3, 12), "radius": num(0.005, 3), "innerRadius": num(0.001, 3), "center": c2}, ["points", "radius", "innerRadius"]),
  outline("heart", {"size": num(0.01, 3), "center": c2}, ["size"]),
  outline("stroke", {"points": pts(2), "width": num(0.002, 1), "widthTo": num(0.002, 1)}, ["points", "width"]),
  outline("union", {"children": children(1, "outline"), "smooth": num(0, 1)}, ["children"]),
  outline("subtract", {"children": children(2, "outline"), "smooth": num(0, 1)}, ["children"]),
  outline("intersect", {"children": children(2, "outline"), "smooth": num(0, 1)}, ["children"]),
]}
# ---- drivers, ids
state_ids, act_ids, user_ids, expr_ids = ids("states"), ids("activities"), ids("userActivities"), ids("expressions")
D["driver"] = vocab("animation driver", V["drivers"] + state_ids + act_ids + user_ids + expr_ids)
D["expressionId"] = vocab("expression", expr_ids)
D["motionId"] = vocab("motion", ids("motions"))
D["propId"] = vocab("prop", ids("props"))
D["effectId"] = vocab("effect", ids("effects"))
D["outfitId"] = vocab("outfit", ids("outfits"))
D["materialId"] = {"type": "string", "pattern": "^[a-z0-9][a-z0-9-]{0,31}$"}
# ---- materials
D["material"] = obj({
  "type": {"enum": V["materialTypes"]}, "color": ref("color"), "sheen": ref("color"), "roughness": num(0, 1),
  "pattern": obj({"type": {"enum": V["patternTypes"]}, "colors": {"type": "array", "items": ref("color"), "minItems": 1, "maxItems": 4},
                  "axis": axis, "scale": num(0.05, 4), "angle": num(-360, 360)}, ["type", "colors"]),
  "glow": obj({"color": ref("color"), "intensity": num(0, 4), "base": num(0, 1), "driver": ref("driver")}),
  "fur": obj({"length": num(0, 1), "density": num(0, 1), "droop": num(0, 1), "tip": ref("color")}),
  "opacity": num(0, 1),
}, desc="A material (SPEC 7).")
D["materialRef"] = {"anyOf": [ref("materialId"), ref("material")], "description": "A material id from `materials`, or a material written in place."}
# ---- face
y = num(-1.2, 1.2)
D["face"] = obj({
  "type": {"enum": V["faceTypes"]},
  "eyes": obj({"shape": {"enum": V["eyeShapes"]}, "size": num(0.02, 0.3), "spacing": num(0, 0.6), "height": y, "color": ref("color"),
               "highlight": {"type": "boolean"}, "blink": {"type": "boolean"}, "gaze": {"type": "boolean"}}),
  "mouth": obj({"shape": {"enum": V["mouthShapes"]}, "width": num(0.02, 0.6), "height": y, "color": ref("color"), "speaks": {"type": "boolean"}}),
  "cheeks": obj({"color": ref("color"), "size": num(0.02, 0.4), "spacing": num(0, 0.8), "height": y, "show": {"enum": V["cheekShows"]}}),
  "brows": obj({"color": ref("color"), "thickness": num(0.005, 0.1), "length": num(0.02, 0.4), "height": y}),
  "nose": obj({"shape": {"enum": V["noseShapes"]}, "color": ref("color"), "size": num(0.01, 0.3), "height": y}),
  "color": ref("color"),
  "expressions": {"type": "object", "propertyNames": ref("expressionId"), "additionalProperties": obj({
      "eyes": {"enum": V["eyePoses"]}, "mouth": {"enum": V["mouthPoses"]}, "cheeks": {"type": "boolean"}, "effect": ref("effectId")})},
}, desc="Eyes, mouth, cheeks, brows and nose (SPEC 8).")
# ---- parts
D["animation"] = obj({"type": {"enum": list(V["animationTypes"].keys())}, "driver": ref("driver"), "axis": axis,
  "amount": num(-360, 360), "speed": num(0, 8), "phase": num(0, 1)}, ["type"], desc="SPEC 10.")
D["attach"] = obj({"to": {"type": "string", "pattern": "^(body|head|[a-z0-9][a-z0-9-]{0,31})$"}, "position": ref("vec3"), "at": ref("frontPoint"),
  "direction": vec(3, -1, 1), "lift": num(-0.5, 0.5), "align": {"enum": ["surface", "upright", "none"]}, "rotation": ref("rotation3")},
  desc="SPEC 9.1. At most one of position, at and direction.",
  extra={"not": {"anyOf": [need("position", "at"), need("position", "direction"), need("at", "direction")]}})
D["part"] = obj({"id": {"type": "string", "pattern": "^[a-z0-9][a-z0-9-]{0,31}$"}, "role": {"enum": V["partRoles"]},
  "shape": ref("shape"), "patch": ref("outline"), "material": ref("materialRef"), "attach": ref("attach"),
  "mirror": {"const": "x"}, "pivot": ref("vec3"), "animations": {"type": "array", "items": ref("animation"), "maxItems": 4}},
  ["id"], desc="SPEC 9.", extra={"oneOf": [need("shape"), need("patch")]})
# ---- body
p01 = num(0, 1)
D["body"] = obj({"rig": {"enum": V["rigs"]}, "shape": ref("shape"), "material": ref("materialRef"), "anchor": {"enum": V["anchors"]},
  "proportions": obj({"head": p01, "headShape": {"enum": V["headShapes"]}, "body": p01, "bodyShape": {"enum": V["bodyShapes"]}, "legs": p01, "arms": p01}),
  "arms": obj({"style": {"enum": V["armStyles"]}, "length": p01, "thickness": p01, "at": ref("frontPoint"), "material": ref("materialRef")})},
  desc="SPEC 6.", extra={"if": {"not": {"properties": {"rig": {"const": "biped"}}, "required": ["rig"]}}, "then": need("shape")})
# ---- behavior
D["reaction"] = obj({"expression": nullable(ref("expressionId")), "motion": nullable(ref("motionId")), "prop": nullable(ref("propId")),
  "effect": nullable(ref("effectId")), "gaze": nullable({"enum": V["gazes"]}), "intensity": nullable(p01)}, desc="SPEC 11.2.")
rmap = lambda keys: {"type": "object", "propertyNames": vocab("id", keys), "additionalProperties": nullable(ref("reaction"))}
D["behavior"] = obj({
  "temperament": obj({"energy": p01, "bounce": p01, "sway": p01, "blink": p01}),
  "reactions": obj({"states": rmap(state_ids), "activities": rmap(act_ids), "userActivities": rmap(user_ids)}),
  "idleMotions": {"type": "array", "items": ref("motionId"), "maxItems": 8, "uniqueItems": True}}, desc="SPEC 11.")
D["meta"] = obj({
  "description": {"type": "string", "maxLength": 500},
  "authors": {"type": "array", "maxItems": 8, "items": obj({"name": {"type": "string", "minLength": 1, "maxLength": 64}, "url": {"type": "string", "format": "uri", "maxLength": 500}}, ["name"])},
  "license": {"type": "string", "minLength": 1, "maxLength": 200, "description": "An SPDX license expression."},
  "version": {"type": "string", "pattern": "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$"},
  "tags": {"type": "array", "maxItems": 12, "uniqueItems": True, "items": {"type": "string", "pattern": "^[a-z0-9][a-z0-9-]{0,31}$"}},
  "created": DATE_TIME, "updated": DATE_TIME,
  "source": {"type": "string", "pattern": "^https://", "maxLength": 500},
  "derivedFrom": obj({"id": {"type": "string", "pattern": "^[A-Za-z0-9._-]{1,128}$"}, "name": {"type": "string", "maxLength": 64}, "url": {"type": "string", "pattern": "^https://", "maxLength": 500}}, ["id"]),
  "generator": obj({"name": {"type": "string", "minLength": 1, "maxLength": 64}, "version": {"type": "string", "maxLength": 32}, "model": {"type": "string", "maxLength": 100}}, ["name"]),
}, desc="SPEC 3.2.")
schema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openavatar.dev/schema/0.1/openavatar.schema.json",
  "title": "OpenAvatar 0.1 document",
  "description": "An animated character for AI agents, data only. Spec: https://openavatar.dev/spec/0.1. Limits that JSON Schema cannot express (SPEC 5.6, 14.1, 17.1) are checked by the @openavatar/core package's validate().",
  "type": "object",
  "required": ["openavatar", "id", "name", "body"],
  "additionalProperties": False,
  "properties": {
    "$schema": {"type": "string"},
    "openavatar": {"const": "0.1"},
    "id": {"type": "string", "pattern": "^[A-Za-z0-9._-]{1,128}$"},
    "name": {"type": "string", "minLength": 1, "maxLength": 64},
    "meta": ref("meta"),
    "preview": obj({"image": {"type": "string", "pattern": "^data:image/(png|webp);base64,[A-Za-z0-9+/=]+$", "maxLength": 131100}, "background": ref("color")}, ["image"]),
    "body": ref("body"),
    "materials": {"type": "object", "propertyNames": ref("materialId"), "maxProperties": 16, "additionalProperties": ref("material")},
    "face": ref("face"),
    "parts": {"type": "array", "items": ref("part"), "maxItems": 32},
    "outfit": ref("outfitId"),
    "behavior": ref("behavior"),
    "extensions": {"type": "object", "propertyNames": {"pattern": "^[a-z0-9-]+(\\.[a-z0-9-]+)+$", "maxLength": 253}, "additionalProperties": {"type": "object"}},
  },
  "$defs": D,
}
json.dump(schema, open(f'{spec_dir}/schema/openavatar-0.1.schema.json', 'w'), indent=2)
print("ok", len(json.dumps(schema)))

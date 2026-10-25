// Generated from spec/vocabulary.json by scripts/vocabulary-module.mjs. Do not edit.
export default Object.freeze({
  "openavatar": "0.1",
  "$comment": "Standard ids of OpenAvatar 0.1 with fallbacks and default reactions. Section numbers refer to SPEC.md.",
  "states": [
    {
      "id": "idle",
      "description": "Nothing is happening",
      "reaction": {
        "gaze": "user"
      }
    },
    {
      "id": "listening",
      "description": "The user is talking or typing to the agent",
      "reaction": {
        "expression": "neutral",
        "gaze": "user",
        "motion": "lean-in"
      }
    },
    {
      "id": "thinking",
      "description": "The agent is working on an answer",
      "reaction": {
        "expression": "thinking",
        "gaze": "up",
        "effect": "dots"
      }
    },
    {
      "id": "speaking",
      "description": "The agent is speaking or its reply is streaming",
      "reaction": {
        "expression": "happy",
        "intensity": 0.4,
        "gaze": "user"
      }
    }
  ],
  "activities": [
    {
      "id": "searching",
      "description": "Looking things up",
      "reaction": {
        "motion": "look-around",
        "gaze": "around"
      }
    },
    {
      "id": "working",
      "description": "Running a tool or a long task",
      "reaction": {
        "expression": "thinking",
        "intensity": 0.6,
        "motion": "nod-beat",
        "gaze": "work"
      }
    },
    {
      "id": "waiting",
      "description": "Waiting for the user's answer or approval",
      "reaction": {
        "expression": "surprised",
        "intensity": 0.6,
        "motion": "bounce",
        "gaze": "user"
      }
    },
    {
      "id": "error",
      "description": "A task failed",
      "reaction": {
        "expression": "sad",
        "motion": "shake",
        "effect": "sweat"
      }
    },
    {
      "id": "done",
      "description": "A task finished",
      "reaction": {
        "expression": "happy",
        "motion": "hop",
        "effect": "sparkles"
      }
    },
    {
      "id": "sleeping",
      "description": "Nothing has happened for a long time",
      "reaction": {
        "expression": "sleepy",
        "motion": "sleep",
        "effect": "zzz"
      }
    }
  ],
  "userActivities": [
    {
      "id": "coding",
      "description": "Writing code",
      "reaction": {
        "prop": "laptop",
        "motion": "typing",
        "expression": "thinking",
        "intensity": 0.4,
        "gaze": "work"
      }
    },
    {
      "id": "writing",
      "description": "Writing text: documents, notes, mail",
      "reaction": {
        "prop": "notebook",
        "motion": "writing",
        "gaze": "work"
      }
    },
    {
      "id": "reading",
      "description": "Reading: articles, documents, PDFs",
      "reaction": {
        "prop": "book",
        "motion": "reading",
        "gaze": "work"
      }
    },
    {
      "id": "browsing",
      "description": "Browsing the web",
      "reaction": {
        "motion": "look-around",
        "gaze": "side"
      }
    },
    {
      "id": "designing",
      "description": "Drawing or designing",
      "reaction": {
        "prop": "notebook",
        "motion": "writing",
        "expression": "thinking",
        "intensity": 0.5
      }
    },
    {
      "id": "form-filling",
      "description": "Filling in a form",
      "reaction": {
        "prop": "clipboard",
        "expression": "thinking",
        "gaze": "work"
      }
    },
    {
      "id": "chatting",
      "description": "Messaging people",
      "reaction": {
        "expression": "happy",
        "intensity": 0.5,
        "motion": "nod"
      }
    },
    {
      "id": "meeting",
      "description": "In a call or meeting",
      "reaction": {
        "expression": "neutral",
        "gaze": "user",
        "quiet": true
      }
    },
    {
      "id": "watching",
      "description": "Watching a video",
      "reaction": {
        "prop": "popcorn",
        "expression": "happy",
        "intensity": 0.4,
        "gaze": "side"
      }
    },
    {
      "id": "listening-music",
      "description": "Listening to music",
      "reaction": {
        "prop": "headphones",
        "motion": "groove",
        "effect": "notes"
      }
    },
    {
      "id": "gaming",
      "description": "Playing a game",
      "reaction": {
        "prop": "gamepad",
        "expression": "happy",
        "intensity": 0.6
      }
    },
    {
      "id": "away",
      "description": "Away from the computer",
      "reaction": {
        "expression": "sleepy",
        "intensity": 0.6,
        "motion": "sleep"
      }
    }
  ],
  "expressions": [
    {
      "id": "neutral",
      "vrm": "neutral",
      "eyes": "open",
      "mouth": "rest"
    },
    {
      "id": "happy",
      "vrm": "happy",
      "eyes": "arc",
      "mouth": "smile",
      "fallback": "neutral"
    },
    {
      "id": "angry",
      "vrm": "angry",
      "eyes": "mad",
      "mouth": "frown",
      "fallback": "neutral"
    },
    {
      "id": "sad",
      "vrm": "sad",
      "eyes": "sad",
      "mouth": "frown",
      "fallback": "neutral"
    },
    {
      "id": "relaxed",
      "vrm": "relaxed",
      "eyes": "arc",
      "mouth": "smile",
      "fallback": "happy"
    },
    {
      "id": "surprised",
      "vrm": "surprised",
      "eyes": "wide",
      "mouth": "o",
      "fallback": "neutral"
    },
    {
      "id": "laugh",
      "eyes": "chevron",
      "mouth": "grin",
      "fallback": "happy"
    },
    {
      "id": "thinking",
      "eyes": "squint",
      "mouth": "hmm",
      "fallback": "neutral"
    },
    {
      "id": "love",
      "eyes": "heart",
      "mouth": "smile",
      "fallback": "happy"
    },
    {
      "id": "sleepy",
      "eyes": "shut",
      "mouth": "flat",
      "fallback": "relaxed"
    },
    {
      "id": "wink-left",
      "eyes": "wink-left",
      "mouth": "smile",
      "fallback": "happy"
    },
    {
      "id": "wink-right",
      "eyes": "wink-right",
      "mouth": "smile",
      "fallback": "happy"
    }
  ],
  "visemes": [
    "aa",
    "ih",
    "ou",
    "ee",
    "oh"
  ],
  "baseMotions": [
    "nod",
    "hop",
    "spin",
    "wiggle"
  ],
  "motions": [
    {
      "id": "nod",
      "description": "Nods yes",
      "loops": false
    },
    {
      "id": "hop",
      "description": "One small jump with a landing squash",
      "loops": false
    },
    {
      "id": "spin",
      "description": "One full turn",
      "loops": false
    },
    {
      "id": "wiggle",
      "description": "A side-to-side shimmy",
      "loops": false
    },
    {
      "id": "shake",
      "description": "Shakes its head no",
      "loops": false,
      "fallback": "wiggle"
    },
    {
      "id": "bow",
      "description": "Bows",
      "loops": false,
      "fallback": "nod"
    },
    {
      "id": "jump",
      "description": "A big jump",
      "loops": false,
      "fallback": "hop"
    },
    {
      "id": "bounce",
      "description": "Small hops in a row",
      "loops": true,
      "fallback": "hop"
    },
    {
      "id": "nod-beat",
      "description": "Quick nods to a beat, busy",
      "loops": true,
      "fallback": "nod"
    },
    {
      "id": "look-around",
      "description": "Looks from side to side",
      "loops": true,
      "fallback": "wiggle"
    },
    {
      "id": "lean-in",
      "description": "Leans toward the user, attentive",
      "loops": false,
      "fallback": "nod"
    },
    {
      "id": "shiver",
      "description": "Trembles",
      "loops": false,
      "fallback": "wiggle"
    },
    {
      "id": "stretch",
      "description": "Stretches up tall",
      "loops": false,
      "fallback": "jump"
    },
    {
      "id": "yawn",
      "description": "Yawns",
      "loops": false,
      "fallback": "nod"
    },
    {
      "id": "sleep",
      "description": "Settles down and breathes slowly",
      "loops": true,
      "fallback": "nod"
    },
    {
      "id": "peek",
      "description": "Peeks out from one side",
      "loops": false,
      "fallback": "look-around"
    },
    {
      "id": "groove",
      "description": "Sways to music",
      "loops": true,
      "fallback": "bounce"
    },
    {
      "id": "dance",
      "description": "Dances",
      "loops": true,
      "fallback": "groove"
    },
    {
      "id": "celebrate",
      "description": "Celebrates a success",
      "loops": false,
      "fallback": "jump"
    },
    {
      "id": "wave",
      "description": "Waves hello",
      "needs": "arms",
      "loops": false,
      "fallback": "wiggle"
    },
    {
      "id": "clap",
      "description": "Claps",
      "needs": "arms",
      "loops": false,
      "fallback": "celebrate"
    },
    {
      "id": "cheer",
      "description": "Both arms up",
      "needs": "arms",
      "loops": false,
      "fallback": "celebrate"
    },
    {
      "id": "shrug",
      "description": "Shrugs",
      "needs": "arms",
      "loops": false,
      "fallback": "wiggle"
    },
    {
      "id": "point",
      "description": "Points to the side",
      "needs": "arms",
      "loops": false,
      "fallback": "nod"
    },
    {
      "id": "think",
      "description": "Hand to chin, pondering",
      "needs": "arms",
      "loops": false,
      "fallback": "look-around"
    },
    {
      "id": "typing",
      "description": "Types on its prop",
      "needs": "arms",
      "loops": true,
      "fallback": "nod-beat"
    },
    {
      "id": "writing",
      "description": "Writes on its prop",
      "needs": "arms",
      "loops": true,
      "fallback": "typing"
    },
    {
      "id": "reading",
      "description": "Holds its prop and reads, turning pages",
      "needs": "arms",
      "loops": true,
      "fallback": "nod"
    },
    {
      "id": "facepalm",
      "description": "Hand to face",
      "needs": "arms",
      "loops": false,
      "fallback": "shake"
    },
    {
      "id": "heart-hands",
      "description": "Makes a heart with its arms",
      "needs": "arms",
      "loops": false,
      "fallback": "celebrate"
    }
  ],
  "props": [
    {
      "id": "laptop",
      "description": "An open laptop in front of it"
    },
    {
      "id": "book",
      "description": "An open book in its hands"
    },
    {
      "id": "notebook",
      "description": "A notepad and pencil"
    },
    {
      "id": "magnifier",
      "description": "A magnifying glass"
    },
    {
      "id": "clipboard",
      "description": "A clipboard with a form"
    },
    {
      "id": "cup",
      "description": "A warm cup"
    },
    {
      "id": "phone",
      "description": "A phone in its hand"
    },
    {
      "id": "headphones",
      "description": "Headphones it wears"
    },
    {
      "id": "gamepad",
      "description": "A game controller"
    },
    {
      "id": "popcorn",
      "description": "A box of popcorn"
    }
  ],
  "effects": [
    {
      "id": "dots",
      "description": "A typing bubble with three dots"
    },
    {
      "id": "zzz",
      "description": "Floating Z letters"
    },
    {
      "id": "sparkles",
      "description": "Twinkling stars"
    },
    {
      "id": "hearts",
      "description": "Rising hearts"
    },
    {
      "id": "notes",
      "description": "Music notes"
    },
    {
      "id": "question",
      "description": "A question mark"
    },
    {
      "id": "exclaim",
      "description": "An exclamation mark"
    },
    {
      "id": "sweat",
      "description": "A drop of sweat"
    },
    {
      "id": "steam",
      "description": "Puffs of steam"
    },
    {
      "id": "confetti",
      "description": "Falling confetti"
    }
  ],
  "outfits": [
    {
      "id": "party-hat",
      "name": "Party hat",
      "hat": true
    },
    {
      "id": "beanie",
      "name": "Beanie",
      "hat": true
    },
    {
      "id": "crown",
      "name": "Crown",
      "hat": true
    },
    {
      "id": "headphones",
      "name": "Headphones",
      "hat": false
    },
    {
      "id": "bow-tie",
      "name": "Bow tie",
      "hat": false
    },
    {
      "id": "flower",
      "name": "Flower",
      "hat": false
    },
    {
      "id": "witch-hat",
      "name": "Witch hat",
      "hat": true
    },
    {
      "id": "santa-hat",
      "name": "Santa hat",
      "hat": true
    },
    {
      "id": "bunny-ears",
      "name": "Bunny ears",
      "hat": false
    },
    {
      "id": "scarf",
      "name": "Scarf",
      "hat": false
    },
    {
      "id": "chef-hat",
      "name": "Chef hat",
      "hat": true
    },
    {
      "id": "cowboy-hat",
      "name": "Cowboy hat",
      "hat": true
    },
    {
      "id": "headband",
      "name": "Headband",
      "hat": false
    },
    {
      "id": "halo",
      "name": "Halo",
      "hat": false
    },
    {
      "id": "top-hat",
      "name": "Top hat",
      "hat": true
    },
    {
      "id": "graduation-cap",
      "name": "Graduation cap",
      "hat": true
    },
    {
      "id": "beret",
      "name": "Beret",
      "hat": true
    },
    {
      "id": "flower-crown",
      "name": "Flower crown",
      "hat": false
    },
    {
      "id": "propeller-cap",
      "name": "Propeller cap",
      "hat": true
    },
    {
      "id": "pirate-hat",
      "name": "Pirate hat",
      "hat": true
    },
    {
      "id": "lei",
      "name": "Lei",
      "hat": false
    },
    {
      "id": "bucket-hat",
      "name": "Bucket hat",
      "hat": true
    },
    {
      "id": "cat-ears",
      "name": "Cat ears",
      "hat": false
    },
    {
      "id": "antennae",
      "name": "Antennae",
      "hat": false
    },
    {
      "id": "viking-helmet",
      "name": "Viking helmet",
      "hat": true
    },
    {
      "id": "hair-bow",
      "name": "Hair bow",
      "hat": false
    },
    {
      "id": "devil-horns",
      "name": "Devil horns",
      "hat": false
    },
    {
      "id": "unicorn-horn",
      "name": "Unicorn horn",
      "hat": false
    },
    {
      "id": "goggles",
      "name": "Goggles",
      "hat": false
    },
    {
      "id": "hard-hat",
      "name": "Hard hat",
      "hat": true
    },
    {
      "id": "sailor-hat",
      "name": "Sailor hat",
      "hat": true
    },
    {
      "id": "tiara",
      "name": "Tiara",
      "hat": false
    },
    {
      "id": "mushroom-cap",
      "name": "Mushroom cap",
      "hat": true
    },
    {
      "id": "jester-hat",
      "name": "Jester hat",
      "hat": true
    },
    {
      "id": "fez",
      "name": "Fez",
      "hat": true
    },
    {
      "id": "bowler-hat",
      "name": "Bowler hat",
      "hat": true
    },
    {
      "id": "earmuffs",
      "name": "Earmuffs",
      "hat": false
    },
    {
      "id": "sprout",
      "name": "Sprout",
      "hat": false
    },
    {
      "id": "laurel-wreath",
      "name": "Laurel wreath",
      "hat": false
    },
    {
      "id": "baseball-cap",
      "name": "Baseball cap",
      "hat": true
    },
    {
      "id": "straw-hat",
      "name": "Straw hat",
      "hat": true
    },
    {
      "id": "deerstalker",
      "name": "Deerstalker",
      "hat": true
    },
    {
      "id": "bandana",
      "name": "Bandana",
      "hat": false
    },
    {
      "id": "chick",
      "name": "Chick",
      "hat": false
    },
    {
      "id": "butterfly",
      "name": "Butterfly",
      "hat": false
    },
    {
      "id": "headlamp",
      "name": "Headlamp",
      "hat": false
    },
    {
      "id": "frog-hat",
      "name": "Frog hat",
      "hat": true
    },
    {
      "id": "strawberry-hat",
      "name": "Strawberry hat",
      "hat": true
    },
    {
      "id": "fire-helmet",
      "name": "Fire helmet",
      "hat": true
    }
  ],
  "eyeShapes": [
    "round",
    "oval",
    "tall",
    "wide",
    "dot",
    "almond"
  ],
  "eyePoses": [
    "open",
    "arc",
    "chevron",
    "heart",
    "wide",
    "sad",
    "mad",
    "shut",
    "squint",
    "wink-left",
    "wink-right"
  ],
  "mouthShapes": [
    "oval",
    "smile",
    "line",
    "cat",
    "beak",
    "none"
  ],
  "mouthPoses": [
    "smile",
    "grin",
    "o",
    "flat",
    "frown",
    "hmm"
  ],
  "noseShapes": [
    "button",
    "triangle",
    "snout"
  ],
  "cheekShows": [
    "always",
    "happy",
    "speaking",
    "never"
  ],
  "faceTypes": [
    "bead",
    "sewn",
    "drawn",
    "none"
  ],
  "rigs": [
    "blob",
    "biped"
  ],
  "anchors": [
    "ground",
    "float"
  ],
  "headShapes": [
    "round",
    "wide",
    "tall",
    "square"
  ],
  "bodyShapes": [
    "pear",
    "round",
    "slim",
    "square"
  ],
  "armStyles": [
    "nub",
    "paw",
    "none"
  ],
  "materialTypes": [
    "felt",
    "fur",
    "velvet",
    "plastic",
    "rubber",
    "clay",
    "ceramic",
    "glass",
    "metal",
    "toon"
  ],
  "patternTypes": [
    "gradient",
    "stripes",
    "spots",
    "checks"
  ],
  "partRoles": [
    "ear",
    "horn",
    "antenna",
    "hair",
    "hat",
    "tail",
    "wing",
    "leaf",
    "fin",
    "glasses",
    "accessory",
    "prop",
    "detail"
  ],
  "attachTargets": [
    "body",
    "head",
    "left-hand",
    "right-hand"
  ],
  "animationTypes": {
    "sway": {
      "axis": "z",
      "amount": 10
    },
    "spin": {
      "axis": "y"
    },
    "bob": {
      "axis": "y",
      "amount": 0.05
    },
    "pulse": {
      "amount": 0.15
    },
    "wiggle": {
      "axis": "z",
      "amount": 6,
      "speed": 3
    },
    "flap": {
      "axis": "z",
      "amount": 25
    },
    "appear": {},
    "drift": {
      "axis": "y",
      "amount": -0.6
    },
    "glow": {
      "amount": 1
    }
  },
  "drivers": [
    "always",
    "idle",
    "listening",
    "thinking",
    "speaking",
    "active",
    "voice",
    "mic",
    "pointer"
  ],
  "gazes": [
    "user",
    "down",
    "up",
    "side",
    "around",
    "pointer",
    "work"
  ],
  "shapeTypes": [
    "sphere",
    "ellipsoid",
    "box",
    "superellipsoid",
    "capsule",
    "cylinder",
    "cone",
    "torus",
    "extrusion",
    "halfspace",
    "union",
    "subtract",
    "intersect"
  ],
  "outlineTypes": [
    "circle",
    "ellipse",
    "rect",
    "polygon",
    "star",
    "heart",
    "stroke",
    "union",
    "subtract",
    "intersect"
  ],
  "deformerTypes": [
    "taper",
    "twist",
    "bend",
    "squash",
    "ripple"
  ],
  "layers": [
    "command",
    "host",
    "speaking",
    "listening-thinking",
    "activity",
    "userActivity",
    "idle"
  ],
  "limits": {
    "fileBytes": 262144,
    "shapes": 512,
    "depth": 16,
    "points": 1024,
    "parts": 32,
    "materials": 16,
    "animationsPerPart": 4,
    "deformersPerShape": 4,
    "children": 32,
    "tags": 12,
    "authors": 8,
    "idleMotions": 8,
    "previewBytes": 98304
  }
});

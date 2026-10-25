// Types for the openavatar package and the OpenAvatar 0.1 document (SPEC.md).

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
/** sRGB `#RRGGBB` (readers also accept `#RGB`). */
export type Color = string;
export type Axis = 'x' | 'y' | 'z';
/** A standard id or an `x-` vendor id. */
type Id<T extends string> = T | `x-${string}`;

export type Deformer =
  | { type: 'taper'; axis: Axis; amount: number }
  | { type: 'twist'; axis: Axis; amount: number }
  | { type: 'bend'; axis: Axis; toward: Axis; amount: number }
  | { type: 'squash'; axis: Axis; below?: number; above?: number }
  | { type: 'ripple'; axis: Axis; count: number; amplitude: number; range?: Vec2 };

interface ShapeCommon {
  position?: Vec3; rotation?: Vec3; scale?: number | Vec3; mirror?: Axis;
  deform?: Deformer[]; inflate?: number;
}
export type Shape = ShapeCommon & (
  | { type: 'sphere'; radius: number }
  | { type: 'ellipsoid'; radii: Vec3 }
  | { type: 'box'; size: Vec3; rounding?: number }
  | { type: 'superellipsoid'; radii: Vec3; exponent?: number }
  | { type: 'capsule'; from: Vec3; to: Vec3; radius: number; radiusTo?: number }
  | { type: 'cylinder'; radius: number; height: number; rounding?: number }
  | { type: 'cone'; radius: number; radiusTop?: number; height: number; rounding?: number }
  | { type: 'torus'; radius: number; thickness: number }
  | { type: 'extrusion'; outline: Outline; depth: number; rounding?: number; puff?: number }
  | { type: 'halfspace'; normal: Vec3; offset?: number }
  | { type: 'union' | 'subtract' | 'intersect'; children: Shape[]; smooth?: number }
);

interface OutlineCommon { rotation?: number; scale?: number | Vec2; mirror?: 'x' | 'y' }
export type Outline = OutlineCommon & (
  | { type: 'circle'; radius: number; center?: Vec2 }
  | { type: 'ellipse'; radii: Vec2; center?: Vec2 }
  | { type: 'rect'; size: Vec2; center?: Vec2; rounding?: number }
  | { type: 'polygon'; points: Vec2[]; rounding?: number }
  | { type: 'star'; points: number; radius: number; innerRadius: number; center?: Vec2 }
  | { type: 'heart'; size: number; center?: Vec2 }
  | { type: 'stroke'; points: Vec2[]; width: number; widthTo?: number }
  | { type: 'union' | 'subtract' | 'intersect'; children: Outline[]; smooth?: number }
);

export type State = 'idle' | 'listening' | 'thinking' | 'speaking';
export type Activity = 'searching' | 'working' | 'waiting' | 'error' | 'done' | 'sleeping';
export type UserActivity = 'coding' | 'writing' | 'reading' | 'browsing' | 'designing' | 'form-filling'
  | 'chatting' | 'meeting' | 'watching' | 'listening-music' | 'gaming' | 'away';
export type Expression = 'neutral' | 'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised' | 'laugh'
  | 'thinking' | 'love' | 'sleepy' | 'wink-left' | 'wink-right';
export type Motion = 'nod' | 'hop' | 'spin' | 'wiggle' | 'shake' | 'bow' | 'jump' | 'bounce' | 'nod-beat'
  | 'look-around' | 'lean-in' | 'shiver' | 'stretch' | 'yawn' | 'sleep' | 'peek' | 'groove' | 'dance'
  | 'celebrate' | 'wave' | 'clap' | 'cheer' | 'shrug' | 'point' | 'think' | 'typing' | 'writing'
  | 'reading' | 'facepalm' | 'heart-hands';
export type Prop = 'laptop' | 'book' | 'notebook' | 'magnifier' | 'clipboard' | 'cup' | 'phone'
  | 'headphones' | 'gamepad' | 'popcorn';
export type Effect = 'dots' | 'zzz' | 'sparkles' | 'hearts' | 'notes' | 'question' | 'exclaim'
  | 'sweat' | 'steam' | 'confetti';
export type Gaze = 'user' | 'down' | 'up' | 'side' | 'around' | 'pointer' | 'work';
export type Driver = 'always' | 'active' | 'voice' | 'mic' | 'pointer' | State | Activity | UserActivity | Expression | `x-${string}`;
export type EyePose = 'open' | 'arc' | 'chevron' | 'heart' | 'wide' | 'sad' | 'mad' | 'shut' | 'squint' | 'wink-left' | 'wink-right';
export type MouthPose = 'smile' | 'grin' | 'o' | 'flat' | 'frown' | 'hmm';

export interface Material {
  type?: 'felt' | 'fur' | 'velvet' | 'plastic' | 'rubber' | 'clay' | 'ceramic' | 'glass' | 'metal' | 'toon';
  color?: Color; sheen?: Color; roughness?: number; opacity?: number;
  pattern?: { type: 'gradient' | 'stripes' | 'spots' | 'checks'; colors: Color[]; axis?: Axis; scale?: number; angle?: number };
  glow?: { color?: Color; intensity?: number; driver?: Driver };
  fur?: { length?: number; density?: number; droop?: number; tip?: Color };
}
export type MaterialRef = string | Material;

export interface Face {
  type?: 'bead' | 'sewn' | 'drawn' | 'none';
  eyes?: { shape?: 'round' | 'oval' | 'tall' | 'wide' | 'dot' | 'almond'; size?: number; spacing?: number; height?: number; color?: Color; highlight?: boolean; blink?: boolean; gaze?: boolean };
  mouth?: { shape?: 'oval' | 'smile' | 'line' | 'cat' | 'beak' | 'none'; width?: number; height?: number; color?: Color; speaks?: boolean };
  cheeks?: { color?: Color; size?: number; spacing?: number; height?: number; show?: 'always' | 'happy' | 'speaking' | 'never' };
  brows?: { color?: Color; thickness?: number; length?: number; height?: number };
  nose?: { shape?: 'button' | 'triangle' | 'snout'; color?: Color; size?: number; height?: number };
  color?: Color;
  expressions?: Partial<Record<Id<Expression>, { eyes?: EyePose; mouth?: MouthPose; cheeks?: boolean; effect?: Id<Effect> }>>;
}

export interface Animation {
  type: 'sway' | 'spin' | 'bob' | 'pulse' | 'wiggle' | 'flap' | 'appear' | 'drift' | 'glow';
  driver?: Driver; axis?: Axis; amount?: number; speed?: number; phase?: number;
}
export interface Attach {
  to?: string; position?: Vec3; at?: Vec2; direction?: Vec3;
  lift?: number; align?: 'surface' | 'upright' | 'none'; rotation?: Vec3;
}
export interface Part {
  id: string;
  role?: 'ear' | 'horn' | 'antenna' | 'hair' | 'hat' | 'tail' | 'wing' | 'leaf' | 'fin' | 'glasses' | 'accessory' | 'prop' | 'detail';
  shape?: Shape; patch?: Outline; material?: MaterialRef; attach?: Attach;
  mirror?: 'x'; pivot?: Vec3; animations?: Animation[];
}

export interface Body {
  rig?: 'blob' | 'biped'; shape?: Shape; material?: MaterialRef; anchor?: 'ground' | 'float';
  proportions?: { head?: number; headShape?: 'round' | 'wide' | 'tall' | 'square'; body?: number; bodyShape?: 'pear' | 'round' | 'slim' | 'square'; legs?: number; arms?: number };
  arms?: { style?: 'nub' | 'paw' | 'none'; length?: number; thickness?: number; at?: Vec2; material?: MaterialRef };
}

export interface Reaction {
  expression?: Id<Expression> | null; motion?: Id<Motion> | null; prop?: Id<Prop> | null;
  effect?: Id<Effect> | null; gaze?: Gaze | null; intensity?: number | null;
}
export interface Behavior {
  temperament?: { energy?: number; bounce?: number; sway?: number; blink?: number };
  reactions?: {
    states?: Partial<Record<Id<State>, Reaction | null>>;
    activities?: Partial<Record<Id<Activity>, Reaction | null>>;
    userActivities?: Partial<Record<Id<UserActivity>, Reaction | null>>;
  };
  idleMotions?: Id<Motion>[];
}

export interface Meta {
  description?: string; authors?: { name: string; url?: string }[]; license?: string; version?: string;
  tags?: string[]; created?: string; updated?: string; source?: string;
  derivedFrom?: { id: string; name?: string; url?: string };
  generator?: { name: string; version?: string; model?: string };
}

export interface OpenAvatarDocument {
  $schema?: string;
  openavatar: string; id: string; name: string;
  meta?: Meta; preview?: { image: string; background?: Color };
  body: Body; materials?: Record<string, Material>; face?: Face; parts?: Part[];
  outfit?: string; behavior?: Behavior; extensions?: Record<string, Record<string, unknown>>;
}

export interface Issue { path: string; message: string; code?: string }

export const SPEC_VERSION: '0.1';
export class OpenAvatarError extends Error { code: string; path: string }
export function validate(value: unknown): { valid: boolean; errors: Issue[] };
export function normalize(value: unknown): { document: OpenAvatarDocument; repairs: Issue[] };
export function parse(text: string): { document: OpenAvatarDocument; repairs: Issue[] };
export function stringify(doc: OpenAvatarDocument): string;
export function newId(): string;
/** The instant an RFC 3339 date-time names, in milliseconds since 1970 UTC, or NaN (SPEC B.2). */
export function instant(text: unknown): number;
/** > 0 when copy a of an id in the shared folder wins over copy b (SPEC 14.2). */
export function compareCopies(a: { updated?: string; mtime: number; file: string }, b: { updated?: string; mtime: number; file: string }): number;
/** Compares two strings by code point (SPEC B.1). */
export function byCodePoint(a: string, b: string): number;

export interface BehaviorInput {
  state?: State; activity?: Activity | null; userActivity?: UserActivity | null;
  expression?: string | null; expressionIntensity?: number; command?: string | null;
  /** The layers whose motion played once and ended while their situation lasts (SPEC 11.3). */
  finished?: string[];
}
export interface ResolvedBehavior {
  expression: string | null; expressionIntensity: number;
  motion: string | null; motionLoops: boolean;
  prop: string | null; effect: string | null; gaze: Gaze | null; quiet: boolean;
  /** Which layer set each channel. */
  layers: Partial<Record<'expression' | 'motion' | 'prop' | 'effect' | 'gaze', string>>;
}
export const CHANNELS: readonly ['expression', 'motion', 'prop', 'effect', 'gaze'];
export const BASE_MOTIONS: readonly string[];
export function hasArms(doc: OpenAvatarDocument): boolean;
export function reactionFor(doc: OpenAvatarDocument, kind: 'states' | 'activities' | 'userActivities', id: string): Reaction | null;
export function isQuiet(userActivity: string | null | undefined): boolean;
export function resolveMotion(id: string, o?: { arms?: boolean; supported?: Iterable<string> }): string;
export function motionLoops(id: string): boolean;
export function resolveExpression(id: string, supported?: Iterable<string>): string;
export function expressionPoses(doc: OpenAvatarDocument, id: string): { eyes: EyePose; mouth: MouthPose | null; cheeks?: boolean; effect: string | null };
export function resolveBehavior(doc: OpenAvatarDocument, input?: BehaviorInput): ResolvedBehavior;

export const LIMITS: Record<string, number>;
export const SHAPES: Record<string, unknown>, OUTLINES: Record<string, unknown>, DEFORMERS: Record<string, unknown>;
export const EXPRESSIONS: string[], MOTIONS: string[], PROPS: string[], EFFECTS: string[], OUTFITS: string[];
export const STATES: string[], ACTIVITIES: string[], USER_ACTIVITIES: string[], DRIVERS: string[];
export const VOCABULARY: Record<string, any>;

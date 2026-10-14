/**
 * Characters a grown-up adds from their own pictures. Pure data and checks
 * here; the picture is decoded and drawn by the scenes, and the list is kept
 * by save/characterLibrary.ts.
 *
 * A picture is one row of frames (standing, happy, thinking, walk A, walk B),
 * each frame the built-in 16x20 grid times 1-4, so shop accessories can be
 * scaled onto it later. See README, "Adding your own characters".
 */
import { GAME_CONFIG, type GameConfig } from '../config/gameConfig';
import { FLAVOR_COLORS, SPRITE_H, SPRITE_W } from '../characters/sprites';
import { CUSTOMERS, type CustomerDef } from './customerManager';

type Rules = GameConfig['addedCharacters'];

export type AddedRole = 'customer' | 'shopkeeper';

/** A point inside one frame, in picture pixels. */
export interface ArtPoint {
  x: number;
  y: number;
}

export interface AddedCharacter {
  id: string;
  name: string;
  role: AddedRole;
  favoriteFlavor: string;
  greetings: string[];
  thanks: string[];
  enabled: boolean;
  /** PNG data URL: one row of frames. */
  image: string;
  frameW: number;
  frameH: number;
  frames: number;
  /** Top of the head and the neck within a frame: where hats and bows will sit (Milestone 3). */
  head: ArtPoint | null;
  neck: ArtPoint | null;
  addedAt: number;
}

/** What the grown-ups form collects before a character is created. */
export interface CharacterDraft {
  name: string;
  role: AddedRole;
  favoriteFlavor: string;
  greetings: string[];
  thanks: string[];
  image: string;
  /** Size of the whole picture in pixels. */
  width: number;
  height: number;
  head: ArtPoint | null;
  neck: ArtPoint | null;
}

const DEFAULT_GREETINGS = ['Hello!', 'Hi there!'];
const DEFAULT_THANKS = ['Thank you!', 'Yummy!'];
const PNG_PREFIX = 'data:image/png;base64,';
const ROLES: readonly AddedRole[] = ['customer', 'shopkeeper'];

// ---------------------------------------------------------------------------
// Picture layout
// ---------------------------------------------------------------------------

export type SheetLayout = { ok: true; frameW: number; frameH: number; frames: number } | { ok: false; error: string };

/** Works out the frames in a picture, or says (for a grown-up) what size it should be. */
export function sheetLayout(width: number, height: number, rules: Rules = GAME_CONFIG.addedCharacters): SheetLayout {
  const multiple = height / SPRITE_H;
  if (!rules.frameMultiples.includes(multiple)) {
    const heights = rules.frameMultiples.map((m) => m * SPRITE_H).join(', ');
    return { ok: false, error: `The picture should be ${heights} pixels tall. This one is ${height}.` };
  }
  const frameW = SPRITE_W * multiple;
  const frames = width / frameW;
  if (!rules.frameCounts.includes(frames)) {
    const widths = rules.frameCounts.map((n) => n * frameW).join(', ');
    return {
      ok: false,
      error: `A ${height}-pixel-tall picture should be ${widths} pixels wide (${rules.frameCounts.join(', ')} frames of ${frameW}×${height}). This one is ${width}.`,
    };
  }
  return { ok: true, frameW, frameH: height, frames };
}

export type Pose = 'stand' | 'happy' | 'thinking' | 'walkA' | 'walkB' | 'blink';
/** Blink comes after the five frames a picture can have, so only the built-in friends blink. */
const POSE_FRAME: Record<Pose, number> = { stand: 0, happy: 1, thinking: 2, walkA: 3, walkB: 4, blink: 5 };

/** Frame index for a pose; poses the picture doesn't have use the standing frame. */
export function frameFor(frames: number, pose: Pose): number {
  const i = POSE_FRAME[pose];
  return i < frames ? i : 0;
}

/** Characters with both walk frames step; the rest just sway as they walk. */
export const hasWalkFrames = (frames: number): boolean => frames > POSE_FRAME.walkB;

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const isStr = (v: unknown): v is string => typeof v === 'string';

function checkLines(label: string, lines: unknown, rules: Rules): string[] {
  if (!Array.isArray(lines) || !lines.every(isStr)) return [`${label} must be a list of text`];
  if (lines.length > rules.maxLines) return [`at most ${rules.maxLines} ${label}`];
  const long = lines.find((l) => l.length > rules.maxLineLength || l.trim() === '');
  return long === undefined ? [] : [`${label} must be 1-${rules.maxLineLength} characters each`];
}

function checkPoint(label: string, p: unknown, frameW: number, frameH: number): string[] {
  if (p === null) return [];
  const pt = p as ArtPoint;
  const inside =
    typeof p === 'object' &&
    Number.isInteger(pt.x) &&
    Number.isInteger(pt.y) &&
    pt.x >= 0 &&
    pt.y >= 0 &&
    pt.x < frameW &&
    pt.y < frameH;
  return inside ? [] : [`${label} point is outside the frame`];
}

function checkText(d: Partial<CharacterDraft>, rules: Rules): string[] {
  const out: string[] = [];
  const name = d.name;
  if (!isStr(name) || name.trim() === '' || name.length > rules.maxNameLength)
    out.push(`name must be 1-${rules.maxNameLength} characters`);
  if (!ROLES.includes(d.role as AddedRole)) out.push('role must be customer or shopkeeper');
  if (!isStr(d.favoriteFlavor) || !(d.favoriteFlavor in FLAVOR_COLORS)) out.push('unknown favourite flavour');
  return [...out, ...checkLines('hello lines', d.greetings, rules), ...checkLines('thank-you lines', d.thanks, rules)];
}

function checkPicture(image: unknown, rules: Rules): string[] {
  if (!isStr(image) || !image.startsWith(PNG_PREFIX)) return ['picture must be a PNG'];
  if (image.length > rules.maxStoredBytes) return ['picture is too big; pixel art pictures are usually a few KB'];
  return [];
}

/** Problems with a draft from the grown-ups form; empty means it can be added. */
export function checkDraft(d: CharacterDraft, existing: number, rules: Rules = GAME_CONFIG.addedCharacters): string[] {
  if (existing >= rules.maxCharacters) return [`there are already ${rules.maxCharacters} added characters`];
  const layout = sheetLayout(d.width, d.height, rules);
  const out = [...checkText(d, rules), ...checkPicture(d.image, rules)];
  if (!layout.ok) return [...out, layout.error];
  return [
    ...out,
    ...checkPoint('head', d.head, layout.frameW, layout.frameH),
    ...checkPoint('neck', d.neck, layout.frameW, layout.frameH),
  ];
}

function checkFrames(c: Partial<AddedCharacter>, rules: Rules): string[] {
  const layout = sheetLayout((c.frameW ?? 0) * (c.frames ?? 0), c.frameH ?? 0, rules);
  if (!layout.ok || layout.frameW !== c.frameW) return ['frame size invalid'];
  return [
    ...checkPoint('head', c.head, layout.frameW, layout.frameH),
    ...checkPoint('neck', c.neck, layout.frameW, layout.frameH),
  ];
}

/** Problems with a stored character (from this device or a backup file); empty means it is safe to use. */
export function validateAddedCharacter(v: unknown, rules: Rules = GAME_CONFIG.addedCharacters): string[] {
  if (typeof v !== 'object' || v === null) return ['not an object'];
  const c = v as Partial<AddedCharacter>;
  const out = [...checkText(c, rules), ...checkPicture(c.image, rules), ...checkFrames(c, rules)];
  if (!isStr(c.id) || !c.id.startsWith('added-')) out.push('id invalid');
  if (typeof c.enabled !== 'boolean') out.push('enabled invalid');
  if (typeof c.addedAt !== 'number') out.push('addedAt invalid');
  return out;
}

/** Turns a checked draft into a character with an id unlike any in `taken`. */
export function createCharacter(d: CharacterDraft, now: number, taken: readonly string[]): AddedCharacter {
  const layout = sheetLayout(d.width, d.height);
  if (!layout.ok) throw new Error(layout.error);
  let id = `added-${now.toString(36)}`;
  for (let n = 2; taken.includes(id); n++) id = `added-${now.toString(36)}-${n}`;
  return {
    id,
    name: d.name.trim(),
    role: d.role,
    favoriteFlavor: d.favoriteFlavor,
    greetings: d.greetings.map((l) => l.trim()),
    thanks: d.thanks.map((l) => l.trim()),
    enabled: true,
    image: d.image,
    frameW: layout.frameW,
    frameH: layout.frameH,
    frames: layout.frames,
    head: d.head,
    neck: d.neck,
    addedAt: now,
  };
}

// ---------------------------------------------------------------------------
// In the shop
// ---------------------------------------------------------------------------

export function toCustomerDef(c: AddedCharacter): CustomerDef {
  return {
    id: c.id,
    name: c.name,
    addedId: c.id,
    favoriteFlavor: c.favoriteFlavor,
    greetings: c.greetings.length > 0 ? c.greetings : DEFAULT_GREETINGS,
    thanks: c.thanks.length > 0 ? c.thanks : DEFAULT_THANKS,
  };
}

/** Built-in customers plus every switched-on added customer. */
/** Everyone who can visit: the built-in customers and switched-on added ones, but never the player's own shopkeeper. */
export function customerRoster(added: readonly AddedCharacter[], keeper?: string): CustomerDef[] {
  const all = [...CUSTOMERS, ...added.filter((c) => c.enabled && c.role === 'customer').map(toCustomerDef)];
  return all.filter((c) => c.id !== keeper);
}

/** The newest switched-on added shopkeeper, or null for the built-in puppy. */
export function chosenShopkeeper(added: readonly AddedCharacter[]): AddedCharacter | null {
  const keepers = added.filter((c) => c.enabled && c.role === 'shopkeeper');
  return keepers.reduce<AddedCharacter | null>((a, c) => (a === null || c.addedAt > a.addedAt ? c : a), null);
}

/**
 * The shop room as pixel art: the "strawberry parlour" (pink and cream
 * stripes, a scalloped valance, curtains, wooden floorboards).
 *
 * The room is painted on a small canvas, one texel per art pixel, and shown
 * at ROOM_SCALE with nearest-neighbour filtering, so it reads as the same
 * pixel art as the characters. The counter is a second canvas on a higher
 * layer so it can hide the shopkeeper's legs.
 *
 * Art coordinates: the room canvas starts at the top of the shop area. The
 * door, wall line and counter follow LAYOUT, so moving them in theme.ts
 * moves the art too.
 *
 * Wall paint and doors bought in Decorate repaint the room: `RoomLook` says
 * which are in use, and each look is its own texture.
 */
import { FLAVOR_COLORS } from '../characters/sprites';
import { tierPixel, tint, TIER_COLORS } from '../characters/tierColors';
import type { CatalogItem, TierId } from '../shop/catalog';
import { LAYOUT, type Rect } from '../ui/theme';
import { DOOR_ART, DOOR_W } from './doorArt';
import type { Pixels } from './roomPixels';

export const ROOM_SCALE = 4;
/** Outline colour shared with the characters. */
export const ROOM_OUTLINE = '#5b4a6b';

const C = {
  outline: ROOM_OUTLINE,
  cream: '#fff6e8',
  stripe: '#ffe3ec',
  heart: '#ffc2d4',
  pink: '#ff8fb3',
  pinkDark: '#e0607e',
  pinkLight: '#ffd1df',
  curtain: '#ff9ec0',
  wainscot: '#ffc9d9',
  panel: '#ffd9e5',
  panelLine: '#f29bb5',
  mint: '#9ee6c4',
  mintDark: '#5fbf98',
  wood: '#9a6b52',
  board: '#f0c79f',
  boardAlt: '#e8bb92',
  seam: '#c99a78',
  sky: '#cfe8ff',
  skyLow: '#bfe3ff',
  sun: '#fff08a',
  glass: '#eaf6ff',
  tray: '#d6dce8',
  white: '#ffffff',
  cone: '#f5c27a',
  coneDark: '#e0a65a',
  creamDark: '#f3e2c7',
  brass: '#f5c27a',
} as const;

/** Game y -> art row, and a game rect -> art rect. */
const artY = (y: number): number => Math.round((y - LAYOUT.shop.y) / ROOM_SCALE);
const artX = (x: number): number => Math.round(x / ROOM_SCALE);

/**
 * The room canvas fills the whole screen under the status bar, wider than
 * the shop area: the register covers the rest while serving, and slides
 * away to show it all while decorating.
 */
export function roomArt(): { x: number; y: number; w: number; h: number } {
  return { x: 0, y: LAYOUT.shop.y, w: LAYOUT.width / ROOM_SCALE, h: (LAYOUT.height - LAYOUT.shop.y) / ROOM_SCALE };
}

/** Counter canvas: a little wider than the counter, from its top lip down. */
export const COUNTER_ART = {
  x: LAYOUT.counter.x - 10,
  y: LAYOUT.counter.y - 32,
  w: Math.ceil((LAYOUT.counter.w + 20) / ROOM_SCALE),
  h: Math.ceil((LAYOUT.counter.h + 34) / ROOM_SCALE),
};

/** Wall-mounted pieces that don't move with the layout (art pixels). */
const WINDOW = { x: 56, y: 31, w: 50, h: 38 };
const SIGN = { x: 54, y: 7, w: 100, h: 20 };
const CASE = { x: 116, y: 62, w: 84, h: 42 };

/** Where the room's text labels go, in game pixels. */
export const ROOM_TEXT = {
  sign: { x: (SIGN.x + SIGN.w / 2) * ROOM_SCALE, y: LAYOUT.shop.y + (SIGN.y + SIGN.h / 2) * ROOM_SCALE },
  open: { x: LAYOUT.door.x + LAYOUT.door.w / 2, y: LAYOUT.shop.y + (doorArt().y + 31.5) * ROOM_SCALE },
};

function doorArt() {
  return { x: artX(LAYOUT.door.x), y: artY(LAYOUT.door.y), w: artX(LAYOUT.door.w), wall: artY(LAYOUT.wallBottom) };
}

/** The door and its frame, in art pixels: what a bought door is painted over. */
export function doorFrame(): Rect {
  const d = doorArt();
  return { x: d.x - 2, y: d.y - 2, w: d.w + 4, h: d.wall - d.y + 2 };
}

/** The door and its frame in game pixels. */
export function doorFrameRect(): Rect {
  const f = doorFrame();
  return { x: f.x * ROOM_SCALE, y: LAYOUT.shop.y + f.y * ROOM_SCALE, w: f.w * ROOM_SCALE, h: f.h * ROOM_SCALE };
}

/** The wall paint (its tier) and the door in use; null for the room's own. */
export interface RoomLook {
  wall: TierId | null;
  door: CatalogItem | null;
}

export const PLAIN_ROOM: RoomLook = { wall: null, door: null };

export function paintRoom(p: Pixels, look: RoomLook = PLAIN_ROOM): void {
  paintWall(p, wallColors(look.wall));
  paintFloor(p);
  paintWindow(p);
  paintDoor(p, look.door);
  paintSign(p);
  paintDisplayCase(p);
}

/** A colour per stripe, scallop or panel (the i-th), so Sparkly Rainbow runs in bands. */
type Band = (i: number) => string;

export interface WallColors {
  base: string;
  stripe: Band;
  heart: string;
  valance: Band;
  valanceShade: Band;
  rail: string;
  wainscot: string;
  panel: Band;
  panelLine: Band;
}

const PLAIN_WALL: WallColors = {
  base: C.cream,
  stripe: () => C.stripe,
  heart: C.heart,
  valance: () => C.pink,
  valanceShade: () => C.pinkDark,
  rail: C.mint,
  wainscot: C.wainscot,
  panel: () => C.panel,
  panelLine: () => C.panelLine,
};

/** The wall's colours: the strawberry parlour's own, or wall paint in a tier's colours. */
export function wallColors(tier: TierId | null): WallColors {
  if (!tier) return PLAIN_WALL;
  const { main, shade } = TIER_COLORS[tier];
  const band =
    (colors: readonly string[], amount: number): Band =>
    (i) =>
      tint(colors[Math.floor(i) % colors.length]!, amount);
  const plain = main.length === 1;
  return {
    base: plain ? tint(main[0]!, 0.82) : C.cream,
    stripe: band(main, 0.5),
    heart: plain ? tint(shade[0]!, 0.35) : C.white,
    valance: band(main, 0),
    valanceShade: band(shade, 0),
    rail: C.white,
    wainscot: plain ? tint(main[0]!, 0.35) : C.creamDark,
    panel: band(main, 0.62),
    panelLine: band(shade, 0.15),
  };
}

const HEART = ['p.p', 'ppp', '.p.'];

function paintWall(p: Pixels, c: WallColors): void {
  const { w } = roomArt();
  const wall = artY(LAYOUT.wallBottom);
  // Striped wallpaper with little hearts.
  p.rect(0, 0, w, wall, c.base);
  for (let x = 0; x < w; x += 12) p.rect(x, 0, 6, wall, c.stripe(x / 12));
  for (let x = 9; x < w; x += 24) {
    for (let y = 30; y < 96; y += 18) p.stamp(HEART, x, y + ((x / 24) % 2) * 9, { p: c.heart });
  }
  // Scalloped valance along the ceiling.
  p.rect(0, 0, w, 4, c.valance(0));
  for (let x = 0; x < w; x += 8) p.disc(x + 4, 4, 3, c.valance(x / 8)).rect(x + 3, 7, 3, 1, c.valanceShade(x / 8));
  // Wainscot panels under a rail.
  const rail = wall - 25;
  p.rect(0, rail, w, 25, c.wainscot)
    .rect(0, rail, w, 2, c.rail)
    .rect(0, rail + 2, w, 1, C.outline);
  for (let x = 4; x < w; x += 20) p.box(x, rail + 5, 16, 16, { fill: c.panel(x / 20), line: c.panelLine(x / 20) });
  p.rect(0, wall - 1, w, 1, C.outline);
}

function paintFloor(p: Pixels): void {
  const wall = artY(LAYOUT.wallBottom);
  const { w, h } = roomArt();
  for (let y = wall; y < h; y += 6) {
    const row = (y - wall) / 6;
    p.rect(0, y, w, 6, row % 2 === 0 ? C.board : C.boardAlt).rect(0, y + 5, w, 1, C.seam);
    for (let x = (row % 3) * 14; x < w; x += 42) p.rect(x, y, 1, 5, C.seam);
  }
  p.rect(0, wall, w, 2, C.seam);
}

const FLOWER = ['.p.', 'pyp', '.p.', '.g.'];

function cloud(p: Pixels, x: number, y: number): void {
  p.rect(x + 2, y, 6, 1, C.white)
    .rect(x, y + 1, 12, 3, C.white)
    .rect(x + 1, y + 4, 10, 1, C.white);
}

function paintWindow(p: Pixels): void {
  const { x, y, w, h } = WINDOW;
  p.box(x, y, w, h, C.wood);
  p.rect(x + 3, y + 3, w - 6, h - 6, C.sky).rect(x + 3, y + 25, w - 6, h - 28, C.skyLow);
  p.disc(x + 38, y + 10, 4, C.sun);
  cloud(p, x + 8, y + 9);
  cloud(p, x + 24, y + 19);
  // Mullions.
  p.rect(x + 24, y + 3, 2, h - 6, C.wood).rect(x + 3, y + 18, w - 6, 2, C.wood);
  // Tied-back curtains.
  for (const cx of [x + 1, x + w - 9]) {
    p.rect(cx, y + 1, 8, 30, C.curtain).rect(cx + 1, y + 13, 7, 2, C.pinkDark);
  }
  p.rect(x + 1, y + 1, 1, 30, C.pinkDark).rect(x + w - 2, y + 1, 1, 30, C.pinkDark);
  // Flower box.
  p.box(x - 2, y + h - 1, w + 4, 7, C.boardAlt);
  for (let fx = x + 2; fx < x + w - 2; fx += 7) p.stamp(FLOWER, fx, y + h - 5, { p: C.pink, y: C.sun, g: C.mintDark });
}

/** Colours of a bought door's fixed pixels; `L` and `l` take its tier's. */
const DOOR_FIXED: Record<string, string> = {
  o: C.outline,
  t: C.wood,
  B: C.sky,
  w: C.white,
  k: C.brass,
  S: C.pinkDark,
  p: C.pink,
};

function paintDoor(p: Pixels, door: CatalogItem | null): void {
  const rows = door && DOOR_ART[door.asset];
  if (!door || !rows) return paintPlainDoor(p);
  const f = doorFrame();
  p.paint(rows, f.x, f.y, (ch, x) => tierPixel(door.tier, ch, x, DOOR_W) ?? DOOR_FIXED[ch] ?? null);
}

function paintPlainDoor(p: Pixels): void {
  const d = doorArt();
  p.box(d.x - 2, d.y - 2, d.w + 4, d.wall - d.y + 2, C.wood);
  p.box(d.x + 1, d.y + 1, d.w - 2, d.wall - d.y - 1, C.curtain);
  const cx = d.x + Math.floor(d.w / 2);
  p.ring(cx, d.y + 13, 8, C.sky).rect(cx - 4, d.y + 9, 2, 2, C.white);
  p.disc(d.x + d.w - 6, d.y + 35, 1, C.brass);
  // Hanging OPEN sign (the text is added by drawShopRoom).
  p.box(d.x + 5, d.y + 27, d.w - 10, 9, C.pinkDark);
  p.rect(d.x + 3, d.y + 47, d.w - 6, 1, C.pinkDark).rect(d.x + 3, d.y + 55, d.w - 6, 1, C.pinkDark);
}

const CONE = [
  '..oooo..',
  '.oppppo.',
  'opwwpppo',
  'opwppppo',
  'oppppppo',
  'oooooooo',
  'oyxyyxyo',
  '.oyxyyo.',
  '.oyyxyo.',
  '..oyyo..',
  '..oxyo..',
  '...oo...',
];

function cone(p: Pixels, x: number, y: number, scoop: string): void {
  p.stamp(CONE, x, y, { p: scoop, w: C.white, y: C.cone, x: C.coneDark, o: C.outline });
}

function paintSign(p: Pixels): void {
  const { x, y, w, h } = SIGN;
  p.box(x, y, w, h, C.pink).rect(x + 2, y + 2, w - 4, 1, C.heart);
  for (let dx = x + 4; dx < x + w - 2; dx += 6) p.rect(dx, y + h - 3, 3, 1, C.pinkDark);
  cone(p, x - 11, y + 4, FLAVOR_COLORS.strawberry!);
  cone(p, x + w + 3, y + 4, FLAVOR_COLORS.blueberry!);
}

const MOUND = [
  '.....oooooooooo.....',
  '...ooSSWWSSSSSSSoo..',
  '..oSSWSSSSSSSSSSSSo.',
  '.oSSSSSSSSSSSSSSSSSo',
  'oSSSSSSSSSSSSSSSSSSo',
  'oSSSSSSSSSSSSSSSSSSo',
  'oooooooooooooooooooo',
];
const TUBS = ['strawberry', 'honey-lavender', 'blueberry', 'lemon', 'chocolate', 'mint'];

/** Top-left of a tub's mound in the display case (art pixels). */
const tubArt = (i: number) => ({ x: CASE.x + 6 + (i % 3) * 25, y: CASE.y + 8 + Math.floor(i / 3) * 16 });

/** Where the shopkeeper dips in for a flavour, in game pixels; flavours without a tub use the middle one. */
export function tubSpot(flavor: string): { x: number; y: number } {
  const i = TUBS.indexOf(flavor);
  const tub = tubArt(i < 0 ? 1 : i);
  return { x: (tub.x + 11) * ROOM_SCALE, y: LAYOUT.shop.y + (tub.y + 3) * ROOM_SCALE };
}

function paintDisplayCase(p: Pixels): void {
  const { x, y, w, h } = CASE;
  p.box(x, y, w, h, C.wood).box(x + 3, y + 3, w - 6, h - 6, C.glass);
  TUBS.forEach((flavor, i) => {
    const { x: tx, y: ty } = tubArt(i);
    p.rect(tx, ty + 6, 22, 5, C.tray).rect(tx, ty + 10, 22, 1, C.outline);
    p.stamp(MOUND, tx + 1, ty, { o: C.outline, S: FLAVOR_COLORS[flavor]!, W: C.white });
  });
  // Glass shine.
  p.rect(x + 5, y + 4, 1, 8, C.white).rect(x + 7, y + 4, 1, 4, C.white);
}

/** Cream top, candy-striped front with a scalloped trim. */
export function paintCounter(p: Pixels): void {
  const { w, h } = COUNTER_ART;
  p.box(0, 0, w, 10, C.cream).rect(1, 7, w - 2, 2, C.creamDark);
  p.rect(2, 10, w - 4, h - 10, C.pink);
  for (let x = 2; x < w - 2; x += 10) p.rect(x, 10, 5, h - 10, C.pinkLight);
  for (let x = 2; x < w - 2; x += 6) p.disc(x + 3, 10, 2, C.cream);
  p.rect(1, 10, 1, h - 10, C.outline).rect(w - 2, 10, 1, h - 10, C.outline);
  p.rect(2, h - 4, w - 4, 4, C.pinkDark);
}

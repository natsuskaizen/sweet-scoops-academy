/**
 * Decoration art: text pixel grids drawn at the room's pixel scale, so they
 * read as part of the room. `L` and `l` pixels take the item's tier colours
 * (see tierColors.ts); the other letters are fixed below.
 *
 * Wall paint, doors and counter paint are room surfaces: instead of standing
 * in a spot they repaint the room (shopRoom.ts); their grids here are the
 * tray icons.
 */
import type Phaser from 'phaser';
import { makePixelTexture } from '../characters/pixelArt';
import { sparkleTexture } from '../characters/scooperArt';
import { tierPixel } from '../characters/tierColors';
import type { PlacedDecoration } from '../save/saveTypes';
import { isRoomSurface, itemById, type CatalogDesign, type CatalogItem, type ShopSpot } from '../shop/catalog';
import { itemInSpot } from '../shop/purchases';
import { LAYOUT, type Layout, type Point, type Rect } from '../ui/theme';
import { DOOR_ART, PAINT_TIN } from './doorArt';
import { counterTexture, roomTexture, type ShopRoom } from './shopArt';
import { COUNTER_ART, doorFrameRect, PLAIN_ROOM, ROOM_OUTLINE, ROOM_SCALE, type RoomLook } from './shopRoom';

const FIXED: Record<string, string> = {
  o: ROOM_OUTLINE,
  w: '#ffffff',
  g: '#9ee6c4',
  G: '#5fbf98',
  B: '#cfe8ff',
  p: '#ff9ec0',
  P: '#ffd1df',
  k: '#f5c27a',
  x: '#e0a65a',
  t: '#9a6b52',
  s: '#d6dce8',
  S: '#e0607e',
  r: '#ff5a7a',
};

const PLANT = [
  '......oo........',
  '.....oGgo..oo...',
  '....oGggo.oggo..',
  '..oo.oGgooggGo..',
  '.oggooGgoggGo...',
  'oggGgooGoGgo.oo.',
  'oggggGooggo.oggo',
  '.oogggoGgo.oggGo',
  '...oooogo.oGgoo.',
  '.......ogooGo...',
  '..oooooooooooo..',
  '..ollllllllllo..',
  '...oLLLLLLLLo...',
  '...oLwLLLLLLo...',
  '...oLLLLLLLLo...',
  '...olLLLLLLlo...',
  '....oLLLLLLo....',
  '....ollllllo....',
  '.....oooooo.....',
];

const LAMP = [
  '....oooooo......',
  '..ooLLLLLLoo.oo.',
  '.oLLwwLLLLLLoLLo',
  'oLLwLLLLLLLLLLLo',
  'oLLLLLLLLLLLLLLo',
  '.ollllllllllllo.',
  '..oooooooooooo..',
  '.......oko......',
  '.......oko......',
  '.......oko......',
  '......okkko.....',
  '....oollllloo...',
  '....oooooooo....',
];

const FRAME = [
  'oooooooooooooooo',
  'oLLLLLLLLLLLLLLo',
  'oLooooooooooooLo',
  'oLoBBBBBBBBBBoLo',
  'oLoBBBBoooBBBoLo',
  'oLoBBBoppPoBBoLo',
  'oLoBBBopppoBBoLo',
  'oLoBBBoooooBBoLo',
  'oLoBBBokxkoBBoLo',
  'oLoBBBBokoBBBoLo',
  'oLoBBBBBoBBBBoLo',
  'oLooooooooooooLo',
  'ollllllllllllllo',
  'oooooooooooooooo',
];

const CHAIR = [
  '.oooooo.',
  'oLLLLLLo',
  'oLwLLLLo',
  'oLLLLLLo',
  'oLLLLLLo',
  'oLLLLLLo',
  'oooooooo',
  'oLLLLLLo',
  'ollllllo',
  'oooooooo',
  '.ot..to.',
  '.ot..to.',
  '.ot..to.',
  '.ot..to.',
  '.oo..oo.',
];

const TABLE = [
  '..oooooooooooooo..',
  '.oLLLLwwLLLLLLLLo.',
  'oLLLLLLLLLLLLLLLLo',
  'oLLLLLLLLLLLLLLLLo',
  'olLlLlLlLlLlLlLlLo',
  '.oooooooooooooooo.',
  '.......otto.......',
  '.......otto.......',
  '.......otto.......',
  '.......otto.......',
  '.....otttttto.....',
  '....oooooooooo....',
];

/** Two chairs either side of a round table, feet on one line. */
function cafeSet(): string[] {
  const top = CHAIR.length - TABLE.length;
  const blank = '.'.repeat(TABLE[0]!.length);
  return CHAIR.map((chair, y) => `${chair}..${TABLE[y - top] ?? blank}..${chair}`);
}

/** Five triangle flags on a string. */
function bunting(): string[] {
  const flag = ['oLLLLo', '.oLLo.', '..oo..'];
  const string = 'o'.repeat(40);
  return [string, ...flag.map((row) => `.${row}.`.repeat(5))];
}

/** An oval rug with an inner border and a heart in the middle. */
function rug(): string[] {
  const w = 32;
  const h = 10;
  const heart = ['.ww.ww.', 'wwwwwww', '.wwwww.', '..www..', '...w...'];
  return Array.from({ length: h }, (_, y) => {
    const dy = (y + 0.5 - h / 2) / (h / 2);
    const half = Math.round((w / 2) * Math.sqrt(1 - dy * dy));
    return Array.from({ length: w }, (_, x) => {
      const fromEdge = Math.min(x - (w / 2 - half), w / 2 + half - 1 - x);
      if (fromEdge < 0) return '.';
      if (fromEdge === 0 || y === 0 || y === h - 1) return 'o';
      const hy = y - 2;
      const hx = x - (w - 7) / 2;
      if (heart[hy]?.[Math.round(hx)] === 'w') return 'w';
      return fromEdge === 2 ? 'l' : 'L';
    }).join('');
  });
}

/** A little sign with a cone on it, hanging from a nail. */
const SIGN = [
  '.........oooo.........',
  '.......ooo..ooo.......',
  '....ooo........ooo....',
  '..ooo............ooo..',
  '.oooooooooooooooooooo.',
  'oLLLLLLLLLLLLLLLLLLLLo',
  'oLwwwwwwwwwwwwwwwwwwLo',
  'oLwwwwwwwppppwwwwwwwLo',
  'oLwwwwwwppPppppwwwwwLo',
  'oLwwwwwwppppppppwwwwLo',
  'oLwwwwwwwkxkxkxwwwwwLo',
  'oLwwwwwwwwkxkxwwwwwwLo',
  'oLwwwwwwwwwkxwwwwwwwLo',
  'ollllllllllllllllllllo',
  '.oooooooooooooooooooo.',
];

/** Two tiers of cupcakes on a stand. */
const CUPCAKES = [
  '.......oo.......',
  '......orro......',
  '.....oPPPPo.....',
  '....oPwPPPPo....',
  '....oPPPPPPo....',
  '.....oxkxko.....',
  '.....okxkxo.....',
  '.oooooooooooooo.',
  '.oLLLLLLLLLLLLo.',
  '..ollllllllllo..',
  '...ooooLLoooo...',
  '.oPPo.oLLo.oPPo.',
  'oPwPPooLLooPwPPo',
  'oPPPPooLLooPPPPo',
  '.okxooolloookxo.',
  '.oxkoLLLLLLoxko.',
  '.oooolllllloooo.',
  '....oooooooo....',
];

/** Three balloons on strings, tied to a little weight. */
const BALLOON_W = 20;
const BALLOON_H = 35;
const BALLOON_KNOT = 30;
const BALLOONS_AT = [
  { x: 5, y: 6 },
  { x: 14, y: 6 },
  { x: 9.5, y: 11 },
];

type Blob = { x: number; y: number };

const inBlob = (x: number, y: number, b: Blob): boolean => ((x - b.x) / 4.6) ** 2 + ((y - b.y) / 5.6) ** 2 <= 1;

function blobCell(x: number, y: number, b: Blob): string | null {
  if (!inBlob(x, y, b)) return null;
  const edge = [-1, 1].some((d) => !inBlob(x + d, y, b) || !inBlob(x, y + d, b));
  if (edge) return 'o';
  if (x - b.x <= -1.5 && x - b.x >= -2.5 && y - b.y <= -1 && y - b.y >= -3) return 'w';
  return x - b.x + (y - b.y) > 3 ? 'l' : 'L';
}

/** The strings from each balloon's knot down to the weight, then the weight. */
function stringCell(x: number, y: number): string {
  if (y >= BALLOON_KNOT) {
    const box = x >= 7 && x <= 12;
    if (!box) return '.';
    return y === BALLOON_KNOT || y === BALLOON_H - 1 || x === 7 || x === 12 ? 'o' : 'k';
  }
  const hit = BALLOONS_AT.some((b) => {
    const top = b.y + 6;
    const t = (y - top) / (BALLOON_KNOT - top);
    return t >= 0 && Math.round(b.x + (9.5 - b.x) * t) === x;
  });
  return hit ? 'o' : '.';
}

function balloons(): string[] {
  return Array.from({ length: BALLOON_H }, (_, y) =>
    Array.from({ length: BALLOON_W }, (_, x) => {
      for (const b of [...BALLOONS_AT].reverse()) {
        const ch = blobCell(x, y, b);
        if (ch) return ch;
      }
      return stringCell(x, y);
    }).join(''),
  );
}

/** A gumball machine: a glass globe of gumballs on a stand with a coin knob and a chute. */
const GUMBALL_W = 16;
const GLOBE = { x: 7.5, y: 8, r: 7.6 };
const GUMBALL_COLORS = ['p', 'g', 'k', 'r', 'S'];
const GUMBALL_STAND = [
  '...oooooooooo...',
  '..oLLLLLLLLLLo..',
  '..oLwLLookoLLo..',
  '..oLLLLokkoLLo..',
  '..oLLLLLooLLLo..',
  '..oLoooLLLLLLo..',
  '..oLowoLLLLLLo..',
  '..oLoooLLLLLLo..',
  '..ollllllllllo..',
  '.oooooooooooooo.',
  '.ollllllllllllo.',
  '.oooooooooooooo.',
];

function globeCell(x: number, y: number): string {
  const d = Math.hypot(x + 0.5 - GLOBE.x - 0.5, y + 0.5 - GLOBE.y - 0.5);
  if (d > GLOBE.r) return '.';
  if (d > GLOBE.r - 1) return 'o';
  if (x >= 3 && x <= 4 && y >= 4 && y <= 6) return 'w';
  if (y < 6) return 'B';
  const row = Math.floor(y / 2);
  const col = Math.floor((x + (row % 2)) / 2);
  return GUMBALL_COLORS[(col + row * 2) % GUMBALL_COLORS.length]!;
}

function gumballMachine(): string[] {
  const lid = ['......oooo......', '.....oLLLLo.....'];
  const globe = Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: GUMBALL_W }, (_, x) => globeCell(x, y)).join(''),
  ).filter((row) => row.includes('o'));
  return [...lid, ...globe.slice(1), ...GUMBALL_STAND];
}

/** A little wall shelf with three jars of sweets. */
const JAR = ['.oooo.', '.oLLo.', 'oooooo', 'owpgko', 'owkrpo', 'ogpkgo', 'oooooo'];
const SHELF_W = 24;

function candyShelf(): string[] {
  const jars = JAR.map((row) => `..${row}.${row}.${row}..`);
  return [
    ...jars,
    'o'.repeat(SHELF_W),
    `o${'L'.repeat(SHELF_W - 2)}o`,
    `o${'l'.repeat(SHELF_W - 2)}o`,
    'o'.repeat(SHELF_W),
    '...ot..............to...',
    '....ot............to....',
    '.....oo..........oo.....',
  ];
}

/** Three stars hanging from the ceiling on strings of different lengths. */
const STAR = ['...o...', '..oLo..', 'ooLLLoo', 'oLLwLLo', '.oLLLo.', 'oLlolLo', 'oo...oo'];
const STARS_AT = [
  { x: 3, drop: 6 },
  { x: 10, drop: 13 },
  { x: 17, drop: 2 },
];

function hangingStars(): string[] {
  const w = 21;
  const h = Math.max(...STARS_AT.map((s) => s.drop)) + STAR.length;
  const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  for (const s of STARS_AT) {
    for (let y = 0; y < s.drop; y++) grid[y]![s.x] = 'o';
    STAR.forEach((row, dy) => {
      [...row].forEach((ch, dx) => {
        if (ch !== '.') grid[s.drop + dy]![s.x - 3 + dx] = ch;
      });
    });
  }
  return grid.map((row) => row.join(''));
}

/** A string of hearts draped in two loops along the counter's front. */
const GARLAND_W = 60;
const GARLAND_HEART = ['.oo.oo.', 'oLLoLLo', 'oLwLLLo', '.oLLLo.', '..olo..', '...o...'];
const GARLAND_HEARTS = [6, 18, 30, 42, 54];

const garlandSag = (x: number): number => Math.round(3 * Math.abs(Math.sin((Math.PI * x) / (GARLAND_W / 2))));

function heartGarland(): string[] {
  const h = 3 + GARLAND_HEART.length + 1;
  const grid = Array.from({ length: h }, () => Array.from({ length: GARLAND_W }, () => '.'));
  for (let x = 0; x < GARLAND_W; x++) grid[garlandSag(x)]![x] = 'o';
  for (const cx of GARLAND_HEARTS) {
    const top = garlandSag(cx) + 1;
    GARLAND_HEART.forEach((row, dy) => {
      [...row].forEach((ch, dx) => {
        if (ch !== '.') grid[top + dy]![cx - 3 + dx] = ch;
      });
    });
  }
  return grid.map((row) => row.join(''));
}

/** Counter paint's tray icon: a little counter, cream top over a striped front. */
const COUNTER_ICON = [
  'oooooooooooooooo',
  'owwwwwwwwwwwwwwo',
  'osssssssssssssso',
  'oooooooooooooooo',
  ...Array.from({ length: 7 }, () => '.oLLllLLllLLllo.'),
  '.ollllllllllllo.',
  '.oooooooooooooo.',
];

export const DECOR_ART: Readonly<Record<string, readonly string[]>> = {
  'deco-plant': PLANT,
  'deco-lamp': LAMP,
  'deco-frame': FRAME,
  'deco-cafe': cafeSet(),
  'deco-flags': bunting(),
  'deco-rug': rug(),
  'deco-sign': SIGN,
  'deco-cupcakes': CUPCAKES,
  'deco-balloons': balloons(),
  'deco-gumball': gumballMachine(),
  'deco-shelf': candyShelf(),
  'deco-stars': hangingStars(),
  'deco-garland': heartGarland(),
  'counter-paint': COUNTER_ICON,
  'wall-paint': PAINT_TIN,
  ...DOOR_ART,
};

/** Screen pixels per art pixel for each design: furniture is drawn chunkier than the walls so it reads next to the customers. */
const DECOR_SCALE: Readonly<Record<string, number>> = { 'deco-cafe': 8 };
const DEFAULT_DECOR_SCALE = 5;

const scaleOf = (asset: string): number => DECOR_SCALE[asset] ?? DEFAULT_DECOR_SCALE;

/** How big a design is drawn in the room, in game pixels (0 x 0 for a design with no art). */
export function decorSize(asset: string): { w: number; h: number } {
  const rows = DECOR_ART[asset];
  if (!rows) return { w: 0, h: 0 };
  return { w: rows[0]!.length * scaleOf(asset), h: rows.length * scaleOf(asset) };
}

const spotOf = (design: Pick<CatalogDesign, 'placement'>): ShopSpot =>
  design.placement.kind === 'shop' ? design.placement.spot : 'floor-left';

/**
 * What a design covers in the room, in game pixels: the whole wall for wall
 * paint, the door frame for a door, the counter (as far as the screen) for
 * counter paint, else the piece standing on its spot.
 */
export function pieceRect(design: Pick<CatalogDesign, 'asset' | 'placement'>, layout: Layout = LAYOUT): Rect {
  const spot = spotOf(design);
  if (spot === 'wall') return { x: 0, y: layout.shop.y, w: layout.width, h: layout.wallBottom - layout.shop.y };
  if (spot === 'door') return doorFrameRect();
  if (spot === 'counter') {
    const w = Math.min(COUNTER_ART.w * ROOM_SCALE, layout.width - COUNTER_ART.x);
    return { x: COUNTER_ART.x, y: COUNTER_ART.y, w, h: COUNTER_ART.h * ROOM_SCALE };
  }
  const at = layout.decorSpots[spot];
  const { w, h } = decorSize(design.asset);
  return { x: at.x - w / 2, y: at.y - h, w, h };
}

/** The wall paint, door and counter paint in use (or being tried) as a look for the room. */
export function roomLookOf(decorations: readonly PlacedDecoration[]): RoomLook {
  return {
    wall: itemInSpot(decorations, 'wall')?.tier ?? null,
    door: itemInSpot(decorations, 'door') ?? null,
    counter: itemInSpot(decorations, 'counter')?.tier ?? null,
  };
}

/** The look with `item` (wall paint, a door or counter paint) tried on in place of what is in use. */
export function lookWith(look: RoomLook, item: CatalogItem): RoomLook {
  const spot = item.placement.kind === 'shop' ? item.placement.spot : null;
  if (spot === 'wall') return { ...look, wall: item.tier };
  if (spot === 'counter') return { ...look, counter: item.tier };
  return spot === 'door' ? { ...look, door: item } : look;
}

/** The item's texture (its design drawn in its tier's colours), or null for a design with no art. */
export function decorationTexture(scene: Phaser.Scene, item: CatalogItem): string | null {
  const rows = DECOR_ART[item.asset];
  if (!rows) return null;
  const width = rows[0]!.length;
  return makePixelTexture(
    scene,
    `decor-${item.id}`,
    rows,
    (ch, x) => tierPixel(item.tier, ch, x, width) ?? FIXED[ch] ?? null,
  );
}

/** Rugs lie under everything; counter-top and counter-front pieces stand in front of the counter; the rest sit behind people. */
function depthFor(item: CatalogItem): number {
  if (item.placement.kind !== 'shop') return 2;
  if (item.placement.spot === 'counter-top' || item.placement.spot === 'counter-front') return 31;
  return item.placement.spot === 'floor-center' ? 1.5 : 2;
}

/** Draws one decoration standing at `at` (bottom centre). Sparkly Rainbow pieces twinkle. */
export function drawDecoration(scene: Phaser.Scene, item: CatalogItem, at: Point): Phaser.GameObjects.Container {
  const box = scene.add.container(at.x, at.y).setDepth(depthFor(item));
  const key = decorationTexture(scene, item);
  if (!key) return box;
  const image = scene.add.image(0, 0, key).setOrigin(0.5, 1).setScale(scaleOf(item.asset));
  box.add(image);
  if (item.tier === 'rainbow') twinkle(scene, box, image.displayWidth, image.displayHeight);
  return box;
}

const TWINKLES = [
  { x: -0.45, y: 0.9, delay: 0 },
  { x: 0.4, y: 0.75, delay: 500 },
  { x: 0.05, y: 1.05, delay: 1000 },
];

/** Sparkles that come and go around a piece `w` by `h` standing at the bottom centre of `box`. */
export function twinkle(scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number, h: number): void {
  for (const t of TWINKLES) {
    const s = scene.add
      .image(t.x * w, -t.y * h, sparkleTexture(scene))
      .setScale(4)
      .setTint(0xffe680)
      .setAlpha(0);
    box.add(s);
    scene.tweens.add({
      targets: s,
      alpha: 1,
      scale: 5,
      duration: 500,
      yoyo: true,
      repeat: -1,
      delay: t.delay,
      repeatDelay: 900,
    });
  }
}

/** The decorations standing in the room, and the wall paint, door and counter paint it is painted with; redrawn whenever the save changes. */
export class PlacedDecorations {
  private shown = new Map<ShopSpot, Phaser.GameObjects.Container>();
  private look: RoomLook = PLAIN_ROOM;
  private sparkle: Phaser.GameObjects.Container | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly shop: Pick<ShopRoom, 'room' | 'counter'>,
  ) {}

  draw(decorations: readonly PlacedDecoration[]): void {
    for (const box of this.shown.values()) box.destroy();
    this.shown.clear();
    for (const deco of decorations) {
      const item = itemById(deco.itemId);
      if (!item || item.placement.kind !== 'shop' || isRoomSurface(deco.spot)) continue;
      this.shown.set(deco.spot, drawDecoration(this.scene, item, LAYOUT.decorSpots[deco.spot]));
    }
    this.look = roomLookOf(decorations);
    this.paint(this.look);
  }

  /** Hides what stands on a spot while something else is tried there. */
  setSpotVisible(spot: ShopSpot, visible: boolean): void {
    this.shown.get(spot)?.setVisible(visible);
  }

  /** Repaints the room trying wall paint, a door or counter paint; null goes back to what is in use. */
  tryOn(item: CatalogItem | null): void {
    this.paint(item ? lookWith(this.look, item) : this.look);
  }

  private paint(look: RoomLook): void {
    this.shop.room.setTexture(roomTexture(this.scene, look));
    this.shop.counter.setTexture(counterTexture(this.scene, look.counter));
    this.sparkle?.destroy();
    this.sparkle = null;
    if (look.door?.tier !== 'rainbow') return;
    const r = doorFrameRect();
    this.sparkle = this.scene.add.container(r.x + r.w / 2, r.y + r.h).setDepth(1.6);
    twinkle(this.scene, this.sparkle, r.w, r.h);
  }
}

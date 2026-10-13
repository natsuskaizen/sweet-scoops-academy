/**
 * Decoration art: text pixel grids drawn at the room's pixel scale, so they
 * read as part of the room. `L` and `l` pixels take the item's tier colours
 * (see tierColors.ts); the other letters are fixed below.
 *
 * Wall paint and doors are room surfaces: instead of standing in a spot they
 * repaint the room (shopRoom.ts); their grids here are the tray icons.
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
import { roomTexture } from './shopArt';
import { doorFrameRect, PLAIN_ROOM, ROOM_OUTLINE, type RoomLook } from './shopRoom';

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
 * paint, the door frame for a door, else the piece standing on its spot.
 */
export function pieceRect(design: Pick<CatalogDesign, 'asset' | 'placement'>, layout: Layout = LAYOUT): Rect {
  const spot = spotOf(design);
  if (spot === 'wall') return { x: 0, y: layout.shop.y, w: layout.width, h: layout.wallBottom - layout.shop.y };
  if (spot === 'door') return doorFrameRect();
  const at = layout.decorSpots[spot];
  const { w, h } = decorSize(design.asset);
  return { x: at.x - w / 2, y: at.y - h, w, h };
}

/** The wall paint and door in use (or being tried) as a look for the room. */
export function roomLookOf(decorations: readonly PlacedDecoration[]): RoomLook {
  return { wall: itemInSpot(decorations, 'wall')?.tier ?? null, door: itemInSpot(decorations, 'door') ?? null };
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

/** Rugs lie under everything; counter-top pieces stand in front of the counter; the rest sit behind people. */
function depthFor(item: CatalogItem): number {
  if (item.placement.kind !== 'shop') return 2;
  if (item.placement.spot === 'counter-top') return 31;
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

/** The decorations standing in the room, and the wall paint and door it is painted with; redrawn whenever the save changes. */
export class PlacedDecorations {
  private shown = new Map<ShopSpot, Phaser.GameObjects.Container>();
  private look: RoomLook = PLAIN_ROOM;
  private sparkle: Phaser.GameObjects.Container | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly room: Phaser.GameObjects.Image,
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

  /** Repaints the room trying wall paint or a door; null goes back to what is in use. */
  tryOn(item: CatalogItem | null): void {
    if (!item || item.placement.kind !== 'shop') return this.paint(this.look);
    this.paint(item.placement.spot === 'wall' ? { ...this.look, wall: item.tier } : { ...this.look, door: item });
  }

  private paint(look: RoomLook): void {
    this.room.setTexture(roomTexture(this.scene, look));
    this.sparkle?.destroy();
    this.sparkle = null;
    if (look.door?.tier !== 'rainbow') return;
    const r = doorFrameRect();
    this.sparkle = this.scene.add.container(r.x + r.w / 2, r.y + r.h).setDepth(1.6);
    twinkle(this.scene, this.sparkle, r.w, r.h);
  }
}

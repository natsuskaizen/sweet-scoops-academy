/**
 * Decoration art: text pixel grids drawn at the room's pixel scale, so they
 * read as part of the room. `L` and `l` pixels take the item's tier colours
 * (see tierColors.ts); the other letters are fixed below.
 */
import type Phaser from 'phaser';
import { makePixelTexture } from '../characters/pixelArt';
import { sparkleTexture } from '../characters/scooperArt';
import { tierPixel } from '../characters/tierColors';
import type { PlacedDecoration } from '../save/saveTypes';
import { itemById, type CatalogItem, type ShopSpot } from '../shop/catalog';
import { LAYOUT, type Point } from '../ui/theme';
import { ROOM_OUTLINE } from './shopRoom';

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

export const DECOR_ART: Readonly<Record<string, readonly string[]>> = {
  'deco-plant': PLANT,
  'deco-lamp': LAMP,
  'deco-frame': FRAME,
  'deco-cafe': cafeSet(),
  'deco-flags': bunting(),
  'deco-rug': rug(),
};

/** Screen pixels per art pixel for each design: furniture is drawn a little chunkier than the walls so it reads next to the customers. */
const DECOR_SCALE: Readonly<Record<string, number>> = { 'deco-cafe': 6 };
const DEFAULT_DECOR_SCALE = 5;

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
  const image = scene.add
    .image(0, 0, key)
    .setOrigin(0.5, 1)
    .setScale(DECOR_SCALE[item.asset] ?? DEFAULT_DECOR_SCALE);
  box.add(image);
  if (item.tier === 'rainbow') twinkle(scene, box, image.displayWidth, image.displayHeight);
  return box;
}

const TWINKLES = [
  { x: -0.45, y: 0.9, delay: 0 },
  { x: 0.4, y: 0.75, delay: 500 },
  { x: 0.05, y: 1.05, delay: 1000 },
];

function twinkle(scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number, h: number): void {
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

/** The decorations standing in the room, redrawn whenever the save changes. */
export class PlacedDecorations {
  private shown = new Map<ShopSpot, Phaser.GameObjects.Container>();

  constructor(private readonly scene: Phaser.Scene) {}

  draw(decorations: readonly PlacedDecoration[]): void {
    for (const box of this.shown.values()) box.destroy();
    this.shown.clear();
    for (const deco of decorations) {
      const item = itemById(deco.itemId);
      if (!item || item.placement.kind !== 'shop') continue;
      this.shown.set(deco.spot, drawDecoration(this.scene, item, LAYOUT.decorSpots[deco.spot]));
    }
  }

  /** Hides what stands on a spot while something else is tried there. */
  setSpotVisible(spot: ShopSpot, visible: boolean): void {
    this.shown.get(spot)?.setVisible(visible);
  }
}

/**
 * What the shopkeeper wears from the Closet: hats, a bow, glasses and
 * hearing aids, drawn on the friends' shared 32x40 frame (fitted to Momo)
 * so each one is a layer the same size as their picture. `L` and `l`
 * pixels take the item's tier colours (tierColors.ts).
 *
 * A hat replaces Momo's chef hat (and a hat or bow replaces Bonbon's
 * flower, and so on), so with one on they are drawn from a copy of their
 * picture with it taken off (withoutTopper).
 */
import type Phaser from 'phaser';
import type { CatalogItem, EquipSlot } from '../shop/catalog';
import type { CharacterView } from './characterManager';
import { FRIEND_ART, FRIEND_H, FRIEND_W, type FriendArt, type FriendId } from './friendArt';
import { makePixelTexture } from './pixelArt';
import { tierPixel } from './tierColors';

/** A piece of art and where its top left corner sits on Momo's frame. */
export interface WearArt {
  rows: readonly string[];
  x: number;
  y: number;
  /** A tighter picture for the Closet's tiles, when the worn one is spread out (hearing aids). */
  icon?: readonly string[];
}

const BERET = [
  '.........oo.........',
  '........oLLo........',
  '....oooooLLooooo....',
  '..ooLLLLLLLLLLLLoo..',
  '.oLLLLwwLLLLLLLLLLo.',
  'oLLLLwLLLLLLLLLLLLLo',
  'oLLLLLLLLLLLLLLLLLLo',
  '.oolllllllllllllloo.',
  '..oooooooooooooooo..',
];

const BERRY_HAT = [
  '.......ggg.......',
  '......oGgGo......',
  '....oooLLLooo....',
  '..ooLLLLLLLLLoo..',
  '.oLLwLLLLLLLLLLo.',
  'oLLLLLLwLLLLwLLLo',
  'oLwLLLLLLLLLLLLLo',
  '.ooLLLLLwLLLLLoo.',
  '...ooooooooooo...',
];

const FLOWER_CROWN = [
  '..ooo.....ooo.....ooo..',
  '.oLLLo...owwwo...oLLLo.',
  'oLLyLLo.owwywwo.oLLyLLo',
  '.oLLLo....owo....oLLLo.',
  '..oooGGGGGGGGGGGGGooo..',
  '....ooooooooooooooo....',
];

const CROWN = [
  '.o.....o.....o.',
  'oLo...oLo...oLo',
  'oLLo.oLLLo.oLLo',
  'oLLLoLLLLLoLLLo',
  'oLLLLLLLLLLLLLo',
  'oLrLLLLBLLLLrLo',
  'olllllllllllllo',
  'ooooooooooooooo',
];

const BOW = ['oo.....oo', 'oLoo.ooLo', 'oLLLoLLLo', 'oLLLoLLLo', 'oLoo.ooLo', 'oo.....oo'];

/** Two lenses (8 wide) around Momo's eyes, joined by a bridge, with arms out to the sides of her head. */
function spectacles(lens: readonly string[], bridgeRow: number): string[] {
  const band = (i: number) => (i === bridgeRow - 1 || i === bridgeRow + 1 ? 'o' : i === bridgeRow ? 'L' : '.');
  return lens.map((row, i) => {
    const side = band(i).repeat(3);
    return `..${side}${row}${band(i).repeat(6)}${row}${side}..`;
  });
}

const ROUND_LENS = ['.oooooo.', 'oLLLLLLo', 'oL....Lo', 'oL....Lo', 'oL....Lo', 'oLLLLLLo', '.oooooo.'];
const HEART_LENS = ['.oo..oo.', 'oLLooLLo', 'oLLLLLLo', 'oL....Lo', 'oL....Lo', '.oL..Lo.', '..oLLo..', '...oo...'];

const SUN_LENS = ['.oooooo.', 'oLLLLLLo', 'oLkkkwLo', 'oLkkkkLo', 'oLwkkkLo', 'oLLLLLLo', '.oooooo.'];

/** Clothes sit on Momo's body below her head: her tummy is rows 30-36, her feet rows 38-39. */
const SHIRT = ['.oLLwwwLLo.', '.oLLLLLLLo.', 'oLLLLLLLLLo', 'LLLLLLLLLLL', 'lllllllllll'];
const SKIRT_HEM = ['.oLLLLLLLLLLLLLo.', 'oLwLLLLwLLLLLwLLo', 'ooooooooooooooooo'];
const SKIRT = ['..oLLLLLLLLLLLo..', ...SKIRT_HEM];
const DRESS = [...SHIRT.slice(0, 4).map((r) => `...${r}...`), '..olllllllllllo..', ...SKIRT_HEM];
const SHOES = ['oLLwo...owLLo', 'ooooo...ooooo'];

const HEARING_AID = ['.ooo.', 'oLLLo', 'oLwLo', 'oLLLo', 'oLLlo', '.oLlo', '..oo.'];
const mirror = (rows: readonly string[]): string[] => rows.map((r) => [...r].reverse().join(''));

/** One hearing aid tucked behind each ear. */
function hearingAids(): { rows: string[]; icon: string[] } {
  const right = mirror(HEARING_AID);
  const gap = FRIEND_W - 2 * HEARING_AID[0]!.length;
  return {
    rows: HEARING_AID.map((row, i) => row + '.'.repeat(gap) + right[i]),
    icon: HEARING_AID.map((row, i) => `${row}..${right[i]}`),
  };
}

const AIDS = hearingAids();

/** Keyed by the catalog design's asset. Eyes sit on rows 18-20, the head's top on row 10. */
export const WEAR_ART: Readonly<Record<string, WearArt>> = {
  shirt: { rows: SHIRT, x: 11, y: 30 },
  skirt: { rows: SKIRT, x: 8, y: 34 },
  dress: { rows: DRESS, x: 8, y: 30 },
  shoes: { rows: SHOES, x: 10, y: 38 },
  'hat-beret': { rows: BERET, x: 6, y: 1 },
  'hat-berry': { rows: BERRY_HAT, x: 7, y: 1 },
  'hat-flowers': { rows: FLOWER_CROWN, x: 4, y: 4 },
  'hat-crown': { rows: CROWN, x: 8, y: 2 },
  'bow-strawberry': { rows: BOW, x: 22, y: 3 },
  'glasses-round': { rows: spectacles(ROUND_LENS, 1), x: 0, y: 16 },
  'glasses-heart': { rows: spectacles(HEART_LENS, 2), x: 0, y: 15 },
  'glasses-sun': { rows: spectacles(SUN_LENS, 1), x: 0, y: 16 },
  'hearing-aids': { rows: AIDS.rows, x: 0, y: 9, icon: AIDS.icon },
};

/** Colours for the letters that are not tier colours. */
const FIXED: Readonly<Record<string, string>> = {
  o: '#3b2f45',
  w: '#ffffff',
  g: '#7fd6a8',
  G: '#4fae80',
  y: '#ffd84a',
  r: '#ff5f7e',
  B: '#9cc8ff',
  k: '#3b2f45',
};

/** The art laid on a clear frame the size of Momo's picture. */
export function onFrame(art: WearArt): string[] {
  return Array.from({ length: FRIEND_H }, (_, y) => {
    const row = art.rows[y - art.y];
    if (row === undefined) return '.'.repeat(FRIEND_W);
    return ('.'.repeat(art.x) + row).padEnd(FRIEND_W, '.').slice(0, FRIEND_W);
  });
}

/** Rainbow bands span the art itself, wherever it sits in `rows` (`left` columns in). */
function texture(scene: Phaser.Scene, key: string, rows: readonly string[], item: CatalogItem, left = 0): string {
  const width = Math.max(...rows.map((r) => r.replace(/\.+$/, '').length)) - left;
  const color = (ch: string, x: number) => tierPixel(item.tier, ch, x - left, width) ?? FIXED[ch] ?? null;
  return makePixelTexture(scene, key, rows, color);
}

/** The item as worn: a layer the size of Momo's frame. Null for things she does not wear (her scooper). */
export function wearTexture(scene: Phaser.Scene, item: CatalogItem): string | null {
  const art = WEAR_ART[item.asset];
  return art ? texture(scene, `wear-${item.id}`, onFrame(art), item, art.x) : null;
}

/** The item on its own, for the Closet's tiles. */
export function wearIconTexture(scene: Phaser.Scene, item: CatalogItem): string | null {
  const art = WEAR_ART[item.asset];
  return art ? texture(scene, `wear-icon-${item.id}`, art.icon ?? art.rows, item) : null;
}

/**
 * What a friend wears on their head in their own picture (Momo's chef hat,
 * Bonbon's flower), taken off when a Closet item would sit in the same
 * place: the `chars` pixels in rows above `rows`, then any outline left
 * that no longer edges an `edge` pixel (the head or ears).
 */
export interface Topper {
  chars: string;
  rows: number;
  edge: string;
  /** Worn items that replace it. */
  under: readonly EquipSlot[];
}

export const TOPPERS: Readonly<Partial<Record<FriendId, Topper>>> = {
  momo: { chars: 'a', rows: 10, edge: 'bc', under: ['hat'] },
  mallow: { chars: 'ab', rows: 11, edge: 'cd', under: ['hat'] },
  bonbon: { chars: 'cd', rows: 9, edge: 'ab', under: ['hat', 'bow'] },
  kiki: { chars: 'c', rows: 10, edge: 'ab', under: ['hat', 'bow'] },
  lulu: { chars: 'b', rows: 11, edge: 'ac', under: ['hat', 'bow'] },
};

const touches = (grid: string[][], x: number, y: number, chars: string): boolean =>
  [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ].some(([dx, dy]) => chars.includes(grid[y + dy!]?.[x + dx!] ?? '.'));

/** A friend's picture with their topper taken off; everything below it stays as it was. */
export function withoutTopper(rows: readonly string[], topper: Topper): string[] {
  const grid = rows.map((r) => r.split(''));
  const top = grid.slice(0, topper.rows);
  for (const row of top) row.forEach((ch, x) => topper.chars.includes(ch) && (row[x] = '.'));
  top.forEach((row, y) => row.forEach((ch, x) => ch === 'o' && !touches(grid, x, y, topper.edge) && (row[x] = '.')));
  return grid.map((r) => r.join(''));
}

/** The friend without their topper, or null for one who has none. */
export function bareArt(id: FriendId): FriendArt | null {
  const topper = TOPPERS[id];
  return topper ? { ...FRIEND_ART[id], rows: withoutTopper(FRIEND_ART[id].rows, topper) } : null;
}

/** The slots drawn on Momo, back to front. Her scooper is only drawn while she serves. */
export const WORN_SLOTS: readonly EquipSlot[] = [
  'top',
  'bottom',
  'outfit',
  'shoes',
  'hearing',
  'hat',
  'bow',
  'glasses',
];

/** Texture keys of a friend's picture as drawn, and without their topper (null if they have none). */
export interface FriendSheets {
  dressed: string;
  bare: string | null;
}

/**
 * Dresses a friend in `items`: each worn slot shows its item or nothing,
 * and their own topper comes off while something is worn in its place.
 */
export function dressFriend(
  view: CharacterView,
  id: FriendId,
  items: readonly CatalogItem[],
  sheets: FriendSheets,
): void {
  const { scene } = view;
  const bySlot = new Map(items.map((i) => [i.placement.kind === 'equip' ? i.placement.slot : null, i]));
  const covered = TOPPERS[id]?.under.some((slot) => bySlot.has(slot)) ?? false;
  view.setSheet(covered && sheets.bare ? sheets.bare : sheets.dressed);
  const keys = WORN_SLOTS.map((slot) => bySlot.get(slot)).map((item) => item && wearTexture(scene, item));
  view.dress(keys.filter((key): key is string => !!key));
}

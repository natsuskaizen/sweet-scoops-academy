/**
 * Momo's scoopers: one 13x12 grid of her paw holding the handle, with the
 * bowl at the bottom left, coloured per scooper. `b` is the shopkeeper's body
 * colour, `1`-`3` the handle from the paw down, `m` the bowl and `w` its shine.
 *
 * She serves with the wooden one until another is bought in Momo's Closet:
 * one scooper for each item tier, the dearer ones throwing sparkles.
 */
import type Phaser from 'phaser';
import type { TierId } from '../shop/catalog';
import { makePixelTexture } from './pixelArt';

export const SCOOPER_GRID = [
  '........ooo..',
  '.......obbbo.',
  '......obbbbbo',
  '.....o1bbbbbo',
  '....o12obbbo.',
  '...o23o.ooo..',
  '..ommo.......',
  '.ommmmo......',
  'ommwmmmo.....',
  'ommmmmmo.....',
  '.ommmmo......',
  '..oooo.......',
];

/** The middle of the bowl, as a fraction of the grid: the scoop rests here. */
export const SCOOPER_BOWL = { x: 3.5 / 13, y: 9 / 12 };

interface ScooperLook {
  colors: Record<string, string>;
  /** Sparkles that pop off each scoop; none for the plain scoopers. */
  sparkles: string[];
}

export type ScooperId = 'wooden' | TierId;

/** A plain scooper: a coloured handle and a steel bowl. */
const plain = (handle: string, shade: string): ScooperLook => ({
  colors: { 1: handle, 2: handle, 3: shade, m: '#e4ecf6', w: '#ffffff' },
  sparkles: [],
});

export const SCOOPER_LOOKS: Record<ScooperId, ScooperLook> = {
  wooden: { colors: { 1: '#b07a4a', 2: '#b07a4a', 3: '#8a5a32', m: '#b8bcc8', w: '#ffffff' }, sparkles: [] },
  pink: plain('#ff8fb1', '#e0607f'),
  mint: plain('#9ee6c4', '#5fbf98'),
  sky: plain('#9cc8ff', '#6c9fe0'),
  silver: { colors: { 1: '#d4dce8', 2: '#d4dce8', 3: '#a8b4c8', m: '#f4f8fc', w: '#ffffff' }, sparkles: ['#ffffff'] },
  golden: {
    colors: { 1: '#8a5cc4', 2: '#8a5cc4', 3: '#6a3fa0', m: '#ffcf4a', w: '#fff6c0' },
    sparkles: ['#ffe680', '#ffffff', '#ffe680'],
  },
  rainbow: {
    colors: { 1: '#ff6b8a', 2: '#ffd84a', 3: '#5ac8ff', m: '#ffb3e0', w: '#ffffff' },
    sparkles: ['#ff6b8a', '#ffd84a', '#5ac8ff'],
  },
};

const SPARKLE = ['..w..', '..w..', 'wwwww', '..w..', '..w..'];

/** The scooper held in a paw of `bodyColor` (a CSS colour). */
export function scooperTexture(scene: Phaser.Scene, id: ScooperId, bodyColor: string): string {
  const colors: Record<string, string> = { o: '#3b2f45', b: bodyColor, ...SCOOPER_LOOKS[id].colors };
  return makePixelTexture(scene, `scooper-${id}-${bodyColor}`, SCOOPER_GRID, (ch) => colors[ch] ?? null);
}

/** A white four-point sparkle, tinted per use. */
export function sparkleTexture(scene: Phaser.Scene): string {
  return makePixelTexture(scene, 'sparkle', SPARKLE, () => '#ffffff');
}

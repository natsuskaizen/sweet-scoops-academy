/**
 * The colours of each item tier. Item art marks its tier-coloured pixels
 * with `L` (main) and `l` (shade); everything else keeps its own colour.
 * Sparkly Rainbow paints those pixels in bands across the item.
 */
import type { TierId } from '../shop/catalog';

const RAINBOW = ['#ff6b8a', '#ffb05a', '#ffd84a', '#7fd6a8', '#5ac8ff', '#b493f0'];
const RAINBOW_SHADE = ['#d9476a', '#e08a30', '#e0b030', '#4fae80', '#3a98d0', '#8a6ac4'];

export const TIER_COLORS: Readonly<Record<TierId, { main: readonly string[]; shade: readonly string[] }>> = {
  pink: { main: ['#ff9ec0'], shade: ['#e0607e'] },
  mint: { main: ['#9ee6c4'], shade: ['#5fbf98'] },
  sky: { main: ['#9cc8ff'], shade: ['#6c9fe0'] },
  silver: { main: ['#e4ecf6'], shade: ['#a8b4c8'] },
  golden: { main: ['#ffd84a'], shade: ['#e0a830'] },
  rainbow: { main: RAINBOW, shade: RAINBOW_SHADE },
};

/** A swatch colour for the tier (its first main colour). */
export const tierSwatch = (tier: TierId): string => TIER_COLORS[tier].main[0]!;

/** The colour of an `L` or `l` pixel in column `x` of art `width` pixels wide; null for any other pixel. */
export function tierPixel(tier: TierId, ch: string, x: number, width: number): string | null {
  const colors = ch === 'L' ? TIER_COLORS[tier].main : ch === 'l' ? TIER_COLORS[tier].shade : null;
  if (!colors) return null;
  const band = Math.max(2, Math.ceil(width / colors.length));
  return colors[Math.floor(x / band) % colors.length]!;
}

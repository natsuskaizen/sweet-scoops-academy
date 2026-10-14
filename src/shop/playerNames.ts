/**
 * Names a child gives their player and shop: the shop names the dice rolls
 * and offers, and what each tap on the letter keys does.
 */
import type { Rng } from '../core/rng';

/** Ready-made shop names to tap, so no typing is needed. */
export const SHOP_NAME_IDEAS = [
  'Rainbow Scoops',
  'Sprinkle Palace',
  'Cozy Cones',
  'Happy Sundaes',
  'Sugar Cloud',
  'Twinkle Treats',
] as const;

const FIRST_WORDS = [
  'Rainbow',
  'Sprinkle',
  'Cozy',
  'Happy',
  'Sugar',
  'Twinkle',
  'Sunny',
  'Fluffy',
  'Starry',
  'Bubbly',
  'Cherry',
  'Minty',
  'Giggle',
  'Jolly',
  'Cloud',
] as const;

const SECOND_WORDS = [
  'Scoops',
  'Cones',
  'Sundaes',
  'Treats',
  'Palace',
  'Parlour',
  'Corner',
  'Cottage',
  'Dreams',
  'Swirls',
] as const;

/** "Ava's Sunny Swirls", or just "Sunny Swirls" when the owner's name won't fit. */
export function ownedShopName(owner: string, name: string, maxLength: number): string {
  const owned = owner ? `${owner}'s ${name}` : name;
  return owned.length <= maxLength ? owned : name;
}

/** A shop name from the dice, with the owner's name in front when it fits. */
export function rollShopName(rng: Rng, owner: string, maxLength: number): string {
  return ownedShopName(owner, `${rng.pick(FIRST_WORDS)} ${rng.pick(SECOND_WORDS)}`, maxLength);
}

/** A tap on the letter keys: a letter, a space, or 'back'. */
export type LetterKey = string;

export const SPACE = ' ';
export const BACK = 'back';

/**
 * The text after a key is tapped. Each word starts with a capital and the
 * rest are small, so "AVA" comes out "Ava"; spaces never double or lead,
 * and taps past `maxLength` are ignored.
 */
export function typeKey(current: string, key: LetterKey, maxLength: number): string {
  if (key === BACK) return current.slice(0, -1);
  if (current.length >= maxLength) return current;
  if (key === SPACE) return current === '' || current.endsWith(SPACE) ? current : current + SPACE;
  const startsWord = current === '' || current.endsWith(SPACE);
  return current + (startsWord ? key.toUpperCase() : key.toLowerCase());
}

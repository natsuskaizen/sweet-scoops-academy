/**
 * Buying from the Sprinkle Shop and using what was bought. Bought items are
 * owned for good: nothing here ever removes one from `ownedItems`. A bought
 * item is put to use straight away (worn, held or placed in the room).
 */
import type { Profile } from '../save/saveTypes';
import { CATALOG, itemById, type CatalogItem } from './catalog';
import { spend } from './rewards';

export type BuyResult =
  | { ok: true; item: CatalogItem }
  | { ok: false; reason: 'unknown' | 'owned' }
  | { ok: false; reason: 'short'; short: number };

export function owns(profile: Profile, item: CatalogItem): boolean {
  return profile.ownedItems.includes(item.id);
}

/** How many more Sprinkles the item needs; 0 when it can be bought now (or is owned). */
export function sprinklesShort(profile: Profile, item: CatalogItem): number {
  return owns(profile, item) ? 0 : Math.max(0, item.price - profile.sprinkles);
}

export function buyItem(profile: Profile, itemId: string, catalog: readonly CatalogItem[] = CATALOG): BuyResult {
  const item = itemById(itemId, catalog);
  if (!item) return { ok: false, reason: 'unknown' };
  if (owns(profile, item)) return { ok: false, reason: 'owned' };
  if (!spend(profile, item.price)) return { ok: false, reason: 'short', short: sprinklesShort(profile, item) };
  profile.ownedItems.push(item.id);
  useItem(profile, item);
  return { ok: true, item };
}

/** Wears or places an owned item, replacing whatever was in its slot or spot. */
export function useItem(profile: Profile, item: CatalogItem): void {
  if (!owns(profile, item)) return;
  const { placement } = item;
  if (placement.kind === 'equip') {
    profile.equipped[placement.slot] = item.id;
    return;
  }
  profile.decorations = profile.decorations.filter((d) => d.spot !== placement.spot);
  profile.decorations.push({ itemId: item.id, spot: placement.spot });
}

/** Takes an item off or out of the room. It stays owned. */
export function stopUsing(profile: Profile, item: CatalogItem): void {
  const { placement } = item;
  if (placement.kind === 'equip') {
    if (profile.equipped[placement.slot] === item.id) delete profile.equipped[placement.slot];
    return;
  }
  profile.decorations = profile.decorations.filter((d) => d.itemId !== item.id);
}

export function isInUse(profile: Profile, item: CatalogItem): boolean {
  const { placement } = item;
  if (placement.kind === 'equip') return profile.equipped[placement.slot] === item.id;
  return profile.decorations.some((d) => d.itemId === item.id);
}

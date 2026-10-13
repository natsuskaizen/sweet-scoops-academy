/**
 * Buying from the Sprinkle Shop and using what was bought. Bought items are
 * owned for good: nothing here ever removes one from `ownedItems`. A bought
 * item is put to use straight away (worn, held or placed in the room).
 */
import type { PlacedDecoration, Profile } from '../save/saveTypes';
import {
  CATALOG,
  itemById,
  TIERS,
  itemId,
  SLOT_CLASHES,
  type CatalogDesign,
  type CatalogItem,
  type EquipSlot,
  type ShopSpot,
  type TierId,
} from './catalog';
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
    for (const slot of SLOT_CLASHES[placement.slot] ?? []) delete profile.equipped[slot];
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

/** Everything Momo has on, in no particular order. */
export function equippedItems(profile: Profile): CatalogItem[] {
  return Object.values(profile.equipped)
    .map((id) => (id ? itemById(id) : undefined))
    .filter((item): item is CatalogItem => item !== undefined);
}

/**
 * What Momo would have on wearing `item`: everything she wears now, less
 * whatever is in its slot or a slot that clashes with it, plus the item.
 */
export function wornWith(profile: Profile, item: CatalogItem): CatalogItem[] {
  const { placement } = item;
  if (placement.kind !== 'equip') return equippedItems(profile);
  const freed = [placement.slot, ...(SLOT_CLASHES[placement.slot] ?? [])];
  const kept = equippedItems(profile).filter((i) => i.placement.kind !== 'equip' || !freed.includes(i.placement.slot));
  return [...kept, item];
}

export function equippedIn(profile: Profile, slot: EquipSlot): CatalogItem | undefined {
  const id = profile.equipped[slot];
  return id ? itemById(id) : undefined;
}

/** The item in use in a spot of the room, if any (for a room surface: the wall paint or door in use). */
export function itemInSpot(decorations: readonly PlacedDecoration[], spot: ShopSpot): CatalogItem | undefined {
  const placed = decorations.find((d) => d.spot === spot);
  return placed ? itemById(placed.itemId) : undefined;
}

/** The tiers of a design the player owns, in tier order. */
export function ownedTiers(profile: Profile, design: CatalogDesign): TierId[] {
  return TIERS.filter((tier) => profile.ownedItems.includes(itemId(design.id, tier)));
}

/** What the shop's big button does for an item right now. */
export type Offer =
  { kind: 'buy'; price: number } | { kind: 'short'; short: number } | { kind: 'use' } | { kind: 'in-use' };

export function offerFor(profile: Profile, item: CatalogItem): Offer {
  if (isInUse(profile, item)) return { kind: 'in-use' };
  if (owns(profile, item)) return { kind: 'use' };
  const short = sprinklesShort(profile, item);
  return short > 0 ? { kind: 'short', short } : { kind: 'buy', price: item.price };
}

/** Does the shop's big button for an item. Returns what happened, for the scene to save and show. */
export function takeOffer(profile: Profile, item: CatalogItem): 'bought' | 'used' | 'removed' | 'none' {
  const offer = offerFor(profile, item);
  if (offer.kind === 'in-use') {
    stopUsing(profile, item);
    return 'removed';
  }
  if (offer.kind === 'use') {
    useItem(profile, item);
    return 'used';
  }
  if (offer.kind === 'buy') return buyItem(profile, item.id).ok ? 'bought' : 'none';
  return 'none';
}

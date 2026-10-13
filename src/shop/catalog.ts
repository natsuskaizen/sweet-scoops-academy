/**
 * Item catalog: the one place prices live. Items sit on one of three shelves
 * in the Sprinkle Shop: things Momo wears, her scoopers, and decorations for
 * the room.
 */
export type ItemCategory =
  'outfit' | 'hat' | 'bow' | 'handheld' | 'decoration' | 'furniture' | 'wallpaper' | 'sign' | 'collectible';

export type EquipSlot = 'outfit' | 'hat' | 'bow' | 'handheld';

export type ShopSpot = 'wall-left' | 'wall-right' | 'floor-left' | 'floor-center' | 'counter-top' | 'window';

export interface CatalogItem {
  id: string;
  name: string;
  price: number;
  category: ItemCategory;
  /** Art key: a layer or decoration texture, or a scooper look for handheld items. */
  asset: string;
  /** Character layer for wearables, or a named spot in the shop for decorations. */
  placement: { kind: 'equip'; slot: EquipSlot } | { kind: 'shop'; spot: ShopSpot };
}

/** The Sprinkle Shop's tabs, in the order they are shown. */
export const SHELVES = ['wear', 'scoop', 'room'] as const;
export type ShelfId = (typeof SHELVES)[number];

const wear = (id: string, name: string, price: number, slot: 'hat' | 'bow'): CatalogItem => ({
  id,
  name,
  price,
  category: slot,
  asset: id,
  placement: { kind: 'equip', slot },
});

const scooper = (look: string, name: string, price: number): CatalogItem => ({
  id: `scooper-${look}`,
  name,
  price,
  category: 'handheld',
  asset: look,
  placement: { kind: 'equip', slot: 'handheld' },
});

const decoration = (id: string, name: string, price: number, spot: ShopSpot): CatalogItem => ({
  id,
  name,
  price,
  category: 'decoration',
  asset: id,
  placement: { kind: 'shop', spot },
});

export const CATALOG: readonly CatalogItem[] = [
  wear('bow-strawberry', 'Strawberry Bow', 50, 'bow'),
  wear('hat-beret', 'Lavender Beret', 80, 'hat'),
  wear('hat-berry', 'Berry Hat', 120, 'hat'),
  wear('hat-flowers', 'Flower Crown', 150, 'hat'),
  wear('hat-crown', 'Little Crown', 400, 'hat'),
  scooper('silver', 'Silver Scooper', 200),
  scooper('golden', 'Golden Scooper', 500),
  scooper('rainbow', 'Rainbow Scooper', 1000),
  decoration('deco-plant', 'Mint Plant', 60, 'floor-left'),
  decoration('deco-flags', 'Party Flags', 70, 'window'),
  decoration('deco-lamp', 'Cloud Lamp', 90, 'counter-top'),
  decoration('deco-rug', 'Heart Rug', 100, 'floor-center'),
  decoration('deco-frame', 'Cone Picture', 120, 'wall-right'),
];

export function itemById(id: string, catalog: readonly CatalogItem[] = CATALOG): CatalogItem | undefined {
  return catalog.find((item) => item.id === id);
}

export function shelfOf(item: CatalogItem): ShelfId {
  if (item.placement.kind === 'shop') return 'room';
  return item.placement.slot === 'handheld' ? 'scoop' : 'wear';
}

/** A shelf's items, cheapest first. */
export function itemsOnShelf(shelf: ShelfId, catalog: readonly CatalogItem[] = CATALOG): CatalogItem[] {
  return catalog.filter((item) => shelfOf(item) === shelf).sort((a, b) => a.price - b.price);
}

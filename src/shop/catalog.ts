/**
 * Item catalog: the one place prices live. Milestone 1 only ships a few
 * placeholder entries so the save format and rendering hooks exist; the
 * shopping interface arrives in Milestone 3.
 */
export type ItemCategory =
  'outfit' | 'hat' | 'bow' | 'handheld' | 'decoration' | 'furniture' | 'wallpaper' | 'sign' | 'collectible';

export type EquipSlot = 'outfit' | 'hat' | 'bow' | 'handheld';

export interface CatalogItem {
  id: string;
  name: string;
  price: number;
  category: ItemCategory;
  /** Texture key (procedural placeholder today, real art later). */
  asset: string;
  /** Character layer for wearables, or a named spot in the shop for decorations. */
  placement: { kind: 'equip'; slot: EquipSlot } | { kind: 'shop'; spot: ShopSpot };
}

export type ShopSpot = 'wall-left' | 'wall-right' | 'floor-left' | 'counter-top' | 'window';

export const CATALOG: readonly CatalogItem[] = [
  {
    id: 'deco-plant',
    name: 'Mint Plant',
    price: 60,
    category: 'decoration',
    asset: 'deco-plant',
    placement: { kind: 'shop', spot: 'floor-left' },
  },
  {
    id: 'deco-lamp',
    name: 'Cloud Lamp',
    price: 90,
    category: 'decoration',
    asset: 'deco-lamp',
    placement: { kind: 'shop', spot: 'counter-top' },
  },
  {
    id: 'deco-frame',
    name: 'Cone Picture',
    price: 120,
    category: 'decoration',
    asset: 'deco-frame',
    placement: { kind: 'shop', spot: 'wall-right' },
  },
  {
    id: 'hat-beret',
    name: 'Lavender Beret',
    price: 80,
    category: 'hat',
    asset: 'hat-beret',
    placement: { kind: 'equip', slot: 'hat' },
  },
  {
    id: 'bow-strawberry',
    name: 'Strawberry Bow',
    price: 50,
    category: 'bow',
    asset: 'bow-strawberry',
    placement: { kind: 'equip', slot: 'bow' },
  },
];

export function itemById(id: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.id === id);
}

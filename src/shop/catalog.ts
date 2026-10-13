/**
 * Item catalog: the one place prices live.
 *
 * Each design (a beret, a café set) comes in six tiers: three plain colours
 * at the design's base price, then Silver, Golden and Sparkly Rainbow, each
 * dearer than the last. Every tier is its own item to buy and own, with an
 * id like `hat-beret.golden`.
 *
 * Wearables and scoopers are sold in Momo's Closet; decorations in Decorate.
 * Most decorations stand in a spot in the room; wall paint and doors are
 * room surfaces, which repaint the room itself.
 */
export type EquipSlot = 'outfit' | 'hat' | 'bow' | 'glasses' | 'hearing' | 'handheld';

export type ItemCategory = EquipSlot | 'decoration' | 'furniture' | 'wallpaper' | 'sign' | 'collectible';

export type ShopSpot =
  | 'wall-left'
  | 'wall-right'
  | 'floor-left'
  | 'floor-center'
  | 'floor-right'
  | 'floor-back'
  | 'counter-top'
  | 'counter-end'
  | 'window'
  | 'wall'
  | 'door';

/** Spots that are part of the room itself: what is used there repaints the room instead of standing in it. */
export const ROOM_SURFACES: readonly ShopSpot[] = ['wall', 'door'];

export const isRoomSurface = (spot: ShopSpot): boolean => ROOM_SURFACES.includes(spot);

export type Placement = { kind: 'equip'; slot: EquipSlot } | { kind: 'shop'; spot: ShopSpot };

export const TIERS = ['pink', 'mint', 'sky', 'silver', 'golden', 'rainbow'] as const;
export type TierId = (typeof TIERS)[number];

export const TIER_INFO: Readonly<Record<TierId, { name: string; priceFactor: number }>> = {
  pink: { name: 'Pink', priceFactor: 1 },
  mint: { name: 'Mint', priceFactor: 1 },
  sky: { name: 'Sky', priceFactor: 1 },
  silver: { name: 'Silver', priceFactor: 2.5 },
  golden: { name: 'Golden', priceFactor: 5 },
  rainbow: { name: 'Sparkly Rainbow', priceFactor: 10 },
};

export interface CatalogDesign {
  id: string;
  name: string;
  /** Price of the plain colours; the other tiers scale from it. */
  basePrice: number;
  category: ItemCategory;
  /** Art key for the design; the tier picks its colours. */
  asset: string;
  /** Character layer for wearables, or a named spot in the shop for decorations. */
  placement: Placement;
}

/** One tier of a design: the thing that is bought and owned. */
export interface CatalogItem {
  id: string;
  designId: string;
  tier: TierId;
  name: string;
  price: number;
  category: ItemCategory;
  asset: string;
  placement: Placement;
}

export type ShopId = 'closet' | 'decorate';

const wear = (id: string, name: string, basePrice: number, slot: EquipSlot): CatalogDesign => ({
  id,
  name,
  basePrice,
  category: slot,
  asset: id,
  placement: { kind: 'equip', slot },
});

const decoration = (
  id: string,
  name: string,
  basePrice: number,
  spot: ShopSpot,
  category: ItemCategory = 'decoration',
): CatalogDesign => ({
  id,
  name,
  basePrice,
  category,
  asset: id,
  placement: { kind: 'shop', spot },
});

export const DESIGNS: readonly CatalogDesign[] = [
  wear('bow-strawberry', 'Bow', 50, 'bow'),
  wear('hat-beret', 'Beret', 80, 'hat'),
  wear('hat-berry', 'Berry Hat', 120, 'hat'),
  wear('hat-flowers', 'Flower Crown', 150, 'hat'),
  wear('hat-crown', 'Little Crown', 200, 'hat'),
  wear('glasses-round', 'Round Glasses', 60, 'glasses'),
  wear('glasses-heart', 'Heart Glasses', 90, 'glasses'),
  wear('hearing-aids', 'Hearing Aids', 60, 'hearing'),
  {
    id: 'scooper',
    name: 'Scooper',
    basePrice: 100,
    category: 'handheld',
    asset: 'scooper',
    placement: { kind: 'equip', slot: 'handheld' },
  },
  decoration('deco-plant', 'Plant', 60, 'floor-left'),
  decoration('deco-flags', 'Party Flags', 70, 'window'),
  decoration('deco-lamp', 'Cloud Lamp', 90, 'counter-top'),
  decoration('deco-rug', 'Heart Rug', 100, 'floor-center'),
  decoration('deco-cafe', 'Café Set', 100, 'floor-right'),
  decoration('deco-frame', 'Cone Picture', 120, 'wall-right'),
  decoration('deco-sign', 'Cone Sign', 70, 'wall-left', 'sign'),
  decoration('deco-balloons', 'Balloon Bunch', 80, 'floor-back'),
  decoration('deco-cupcakes', 'Cupcake Stand', 90, 'counter-end'),
  decoration('wall-paint', 'Wall Paint', 150, 'wall', 'wallpaper'),
  decoration('door-cottage', 'Cottage Door', 180, 'door', 'furniture'),
  decoration('door-candy', 'Candy Door', 200, 'door', 'furniture'),
  decoration('door-arch', 'Arched Door', 220, 'door', 'furniture'),
];

export const itemId = (designId: string, tier: TierId): string => `${designId}.${tier}`;

export function tierPrice(design: CatalogDesign, tier: TierId): number {
  return Math.round(design.basePrice * TIER_INFO[tier].priceFactor);
}

/** A design in every tier, plain colours first. */
export function variantsOf(design: CatalogDesign): CatalogItem[] {
  return TIERS.map((tier) => ({
    id: itemId(design.id, tier),
    designId: design.id,
    tier,
    name: `${TIER_INFO[tier].name} ${design.name}`,
    price: tierPrice(design, tier),
    category: design.category,
    asset: design.asset,
    placement: design.placement,
  }));
}

export const CATALOG: readonly CatalogItem[] = DESIGNS.flatMap(variantsOf);

export function itemById(id: string, catalog: readonly CatalogItem[] = CATALOG): CatalogItem | undefined {
  return catalog.find((item) => item.id === id);
}

export function shopOf(design: Pick<CatalogDesign, 'placement'>): ShopId {
  return design.placement.kind === 'equip' ? 'closet' : 'decorate';
}

/** The designs one shop sells, cheapest first. */
export function designsIn(shop: ShopId, designs: readonly CatalogDesign[] = DESIGNS): CatalogDesign[] {
  return designs.filter((d) => shopOf(d) === shop).sort((a, b) => a.basePrice - b.basePrice);
}

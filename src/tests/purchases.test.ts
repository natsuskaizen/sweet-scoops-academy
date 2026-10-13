import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  DESIGNS,
  designsIn,
  itemById,
  itemId,
  shopOf,
  TIERS,
  tierPrice,
  variantsOf,
  type CatalogItem,
} from '../shop/catalog';
import {
  buyItem,
  isInUse,
  offerFor,
  owns,
  ownedTiers,
  sprinklesShort,
  stopUsing,
  takeOffer,
  useItem,
} from '../shop/purchases';
import { spend } from '../shop/rewards';
import { createSaveFile } from '../save/saveManager';
import { validateSaveFile } from '../save/saveValidation';

function player(sprinkles: number) {
  const save = createSaveFile(1);
  const p = save.profiles[save.activeProfileId]!;
  p.sprinkles = sprinkles;
  p.lifetimeSprinkles = sprinkles + 100;
  return { save, p };
}

const item = (id: string): CatalogItem => itemById(id)!;
const design = (id: string) => DESIGNS.find((d) => d.id === id)!;

describe('catalog', () => {
  it('has unique design and item ids with positive prices', () => {
    expect(new Set(DESIGNS.map((d) => d.id)).size).toBe(DESIGNS.length);
    expect(new Set(CATALOG.map((i) => i.id)).size).toBe(CATALOG.length);
    expect(CATALOG).toHaveLength(DESIGNS.length * TIERS.length);
    for (const i of CATALOG) expect(Number.isInteger(i.price) && i.price > 0).toBe(true);
  });

  it('prices plain colours at the base price and each later tier higher, rainbow highest', () => {
    for (const d of DESIGNS) {
      const prices = variantsOf(d).map((v) => v.price);
      expect(prices.slice(0, 3)).toEqual([d.basePrice, d.basePrice, d.basePrice]);
      for (let i = 3; i < prices.length; i++) expect(prices[i]).toBeGreaterThan(prices[i - 1]!);
    }
    expect(variantsOf(design('hat-beret')).map((v) => v.price)).toEqual([80, 80, 80, 200, 400, 800]);
  });

  it('names each item after its tier and design', () => {
    expect(item('hat-beret.golden').name).toBe('Golden Beret');
    expect(item('deco-rug.rainbow').name).toBe('Sparkly Rainbow Heart Rug');
    expect(tierPrice(design('bow-strawberry'), 'silver')).toBe(125);
  });

  it('sells wearables and scoopers in the closet and decorations in Decorate, cheapest first', () => {
    expect(shopOf(design('hat-crown'))).toBe('closet');
    expect(shopOf(design('scooper'))).toBe('closet');
    expect(shopOf(design('deco-lamp'))).toBe('decorate');
    const sold = [...designsIn('closet'), ...designsIn('decorate')];
    expect(sold).toHaveLength(DESIGNS.length);
    const prices = designsIn('decorate').map((d) => d.basePrice);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});

describe('spend', () => {
  it('takes Sprinkles but never the lifetime total, and never more than the balance', () => {
    const wallet = { sprinkles: 100, lifetimeSprinkles: 300 };
    expect(spend(wallet, 80)).toBe(true);
    expect(wallet).toEqual({ sprinkles: 20, lifetimeSprinkles: 300 });
    expect(spend(wallet, 21)).toBe(false);
    expect(spend(wallet, -5)).toBe(false);
    expect(spend(wallet, 1.5)).toBe(false);
    expect(wallet.sprinkles).toBe(20);
  });
});

describe('buyItem', () => {
  it('spends the price, keeps the item for good and puts it to use', () => {
    const { save, p } = player(100);
    const result = buyItem(p, 'hat-beret.mint');
    expect(result).toEqual({ ok: true, item: item('hat-beret.mint') });
    expect(p.sprinkles).toBe(20);
    expect(p.lifetimeSprinkles).toBe(200);
    expect(p.ownedItems).toEqual(['hat-beret.mint']);
    expect(p.equipped.hat).toBe('hat-beret.mint');
    expect(validateSaveFile(save)).toEqual([]);
  });

  it('charges only once when tapped again', () => {
    const { p } = player(200);
    buyItem(p, 'hat-beret.pink');
    expect(buyItem(p, 'hat-beret.pink')).toEqual({ ok: false, reason: 'owned' });
    expect(p.sprinkles).toBe(120);
    expect(p.ownedItems).toEqual(['hat-beret.pink']);
  });

  it('sells each tier on its own', () => {
    const { p } = player(500);
    buyItem(p, 'hat-beret.pink');
    buyItem(p, 'hat-beret.golden');
    expect(p.sprinkles).toBe(20);
    expect(ownedTiers(p, design('hat-beret'))).toEqual(['pink', 'golden']);
    expect(p.equipped.hat).toBe('hat-beret.golden');
  });

  it('says how many more Sprinkles are needed and changes nothing', () => {
    const { p } = player(340);
    expect(buyItem(p, 'hat-beret.rainbow')).toEqual({ ok: false, reason: 'short', short: 460 });
    expect(p.sprinkles).toBe(340);
    expect(p.ownedItems).toEqual([]);
    expect(p.equipped).toEqual({});
  });

  it('ignores ids that are not in the catalog', () => {
    const { p } = player(1000);
    expect(buyItem(p, 'hat-nope.pink')).toEqual({ ok: false, reason: 'unknown' });
    expect(p.sprinkles).toBe(1000);
  });

  it('accepts another catalog, for trying other prices', () => {
    const { p } = player(10);
    const cheap = [{ ...item('hat-crown.rainbow'), price: 5 }];
    expect(buyItem(p, 'hat-crown.rainbow', cheap).ok).toBe(true);
    expect(p.sprinkles).toBe(5);
  });

  it('places a decoration in its spot, replacing what stood there', () => {
    const { save, p } = player(1000);
    buyItem(p, 'deco-plant.pink');
    buyItem(p, 'deco-lamp.sky');
    buyItem(p, 'deco-plant.silver');
    expect(p.decorations).toEqual([
      { itemId: 'deco-lamp.sky', spot: 'counter-top' },
      { itemId: 'deco-plant.silver', spot: 'floor-left' },
    ]);
    expect(validateSaveFile(save)).toEqual([]);
  });
});

describe('using owned items', () => {
  it('wears glasses and hearing aids alongside a hat, each in its own slot', () => {
    const { p } = player(500);
    buyItem(p, 'hat-beret.pink');
    buyItem(p, 'glasses-round.sky');
    buyItem(p, 'hearing-aids.golden');
    expect(p.equipped).toEqual({ hat: 'hat-beret.pink', glasses: 'glasses-round.sky', hearing: 'hearing-aids.golden' });
  });

  it('swaps a worn item for another in the same slot', () => {
    const { p } = player(500);
    buyItem(p, 'hat-beret.pink');
    buyItem(p, 'hat-berry.pink');
    expect(p.equipped.hat).toBe('hat-berry.pink');
    useItem(p, item('hat-beret.pink'));
    expect(isInUse(p, item('hat-beret.pink'))).toBe(true);
    expect(isInUse(p, item('hat-berry.pink'))).toBe(false);
  });

  it('only uses items the player owns', () => {
    const { p } = player(0);
    useItem(p, item('hat-crown.pink'));
    useItem(p, item('deco-rug.pink'));
    expect(p.equipped).toEqual({});
    expect(p.decorations).toEqual([]);
  });

  it('takes items off without giving them up', () => {
    const { p } = player(500);
    buyItem(p, 'bow-strawberry.pink');
    buyItem(p, 'deco-frame.pink');
    stopUsing(p, item('bow-strawberry.pink'));
    stopUsing(p, item('deco-frame.pink'));
    stopUsing(p, item('hat-beret.pink')); // not worn: nothing to do
    expect(p.equipped).toEqual({});
    expect(p.decorations).toEqual([]);
    expect(owns(p, item('bow-strawberry.pink'))).toBe(true);
    expect(owns(p, item('deco-frame.pink'))).toBe(true);
  });

  it('counts nothing short for owned or affordable items', () => {
    const { p } = player(100);
    expect(sprinklesShort(p, item('hat-beret.pink'))).toBe(0);
    expect(sprinklesShort(p, item('hat-crown.pink'))).toBe(100);
    buyItem(p, 'hat-beret.pink');
    expect(sprinklesShort(p, item('hat-beret.pink'))).toBe(0);
    expect(itemId('scooper', 'golden')).toBe('scooper.golden');
  });
});

describe('offerFor and takeOffer', () => {
  it('walks an item from too dear, to buy, to in use, to put away and back', () => {
    const { p } = player(50);
    const lamp = item('deco-lamp.pink');
    expect(offerFor(p, lamp)).toEqual({ kind: 'short', short: 40 });
    expect(takeOffer(p, lamp)).toBe('none');
    p.sprinkles = 90;
    expect(offerFor(p, lamp)).toEqual({ kind: 'buy', price: 90 });
    expect(takeOffer(p, lamp)).toBe('bought');
    expect(offerFor(p, lamp)).toEqual({ kind: 'in-use' });
    expect(takeOffer(p, lamp)).toBe('removed');
    expect(offerFor(p, lamp)).toEqual({ kind: 'use' });
    expect(takeOffer(p, lamp)).toBe('used');
    expect(p.decorations).toEqual([{ itemId: 'deco-lamp.pink', spot: 'counter-top' }]);
    expect(p.sprinkles).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { CATALOG, itemById, itemsOnShelf, SHELVES, shelfOf, type CatalogItem } from '../shop/catalog';
import { buyItem, isInUse, owns, sprinklesShort, stopUsing, useItem } from '../shop/purchases';
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

describe('catalog shelves', () => {
  it('puts every item on exactly one shelf, cheapest first', () => {
    const shelved = SHELVES.flatMap((s) => itemsOnShelf(s));
    expect(shelved).toHaveLength(CATALOG.length);
    for (const shelf of SHELVES) {
      const prices = itemsOnShelf(shelf).map((i) => i.price);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    }
  });

  it('sorts hats and bows, scoopers and decorations onto their own shelves', () => {
    expect(shelfOf(item('hat-beret'))).toBe('wear');
    expect(shelfOf(item('scooper-golden'))).toBe('scoop');
    expect(shelfOf(item('deco-lamp'))).toBe('room');
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
    const result = buyItem(p, 'hat-beret');
    expect(result).toEqual({ ok: true, item: item('hat-beret') });
    expect(p.sprinkles).toBe(20);
    expect(p.lifetimeSprinkles).toBe(200);
    expect(p.ownedItems).toEqual(['hat-beret']);
    expect(p.equipped.hat).toBe('hat-beret');
    expect(validateSaveFile(save)).toEqual([]);
  });

  it('charges only once when tapped again', () => {
    const { p } = player(200);
    buyItem(p, 'hat-beret');
    expect(buyItem(p, 'hat-beret')).toEqual({ ok: false, reason: 'owned' });
    expect(p.sprinkles).toBe(120);
    expect(p.ownedItems).toEqual(['hat-beret']);
  });

  it('says how many more Sprinkles are needed and changes nothing', () => {
    const { p } = player(340);
    expect(buyItem(p, 'scooper-golden')).toEqual({ ok: false, reason: 'short', short: 160 });
    expect(p.sprinkles).toBe(340);
    expect(p.ownedItems).toEqual([]);
    expect(p.equipped).toEqual({});
  });

  it('ignores ids that are not in the catalog', () => {
    const { p } = player(1000);
    expect(buyItem(p, 'hat-nope')).toEqual({ ok: false, reason: 'unknown' });
    expect(p.sprinkles).toBe(1000);
  });

  it('accepts another catalog, for trying other prices', () => {
    const { p } = player(10);
    const cheap = [{ ...item('hat-crown'), price: 5 }];
    expect(buyItem(p, 'hat-crown', cheap).ok).toBe(true);
    expect(p.sprinkles).toBe(5);
  });

  it('places a decoration in its spot, replacing what stood there', () => {
    const { save, p } = player(500);
    buyItem(p, 'deco-plant');
    buyItem(p, 'deco-lamp');
    expect(p.decorations).toEqual([
      { itemId: 'deco-plant', spot: 'floor-left' },
      { itemId: 'deco-lamp', spot: 'counter-top' },
    ]);
    const otherPlant = {
      ...item('deco-rug'),
      id: 'deco-fern',
      placement: { kind: 'shop' as const, spot: 'floor-left' as const },
    };
    p.ownedItems.push(otherPlant.id);
    useItem(p, otherPlant);
    expect(p.decorations.map((d) => d.itemId)).toEqual(['deco-lamp', 'deco-fern']);
    expect(validateSaveFile(save)).toEqual([]);
  });
});

describe('using owned items', () => {
  it('swaps a worn item for another in the same slot', () => {
    const { p } = player(500);
    buyItem(p, 'hat-beret');
    buyItem(p, 'hat-berry');
    expect(p.equipped.hat).toBe('hat-berry');
    useItem(p, item('hat-beret'));
    expect(isInUse(p, item('hat-beret'))).toBe(true);
    expect(isInUse(p, item('hat-berry'))).toBe(false);
  });

  it('only uses items the player owns', () => {
    const { p } = player(0);
    useItem(p, item('hat-crown'));
    useItem(p, item('deco-rug'));
    expect(p.equipped).toEqual({});
    expect(p.decorations).toEqual([]);
  });

  it('takes items off without giving them up', () => {
    const { p } = player(500);
    buyItem(p, 'bow-strawberry');
    buyItem(p, 'deco-frame');
    stopUsing(p, item('bow-strawberry'));
    stopUsing(p, item('deco-frame'));
    stopUsing(p, item('hat-beret')); // not worn: nothing to do
    expect(p.equipped).toEqual({});
    expect(p.decorations).toEqual([]);
    expect(owns(p, item('bow-strawberry'))).toBe(true);
    expect(owns(p, item('deco-frame'))).toBe(true);
  });

  it('counts nothing short for owned or affordable items', () => {
    const { p } = player(100);
    expect(sprinklesShort(p, item('hat-beret'))).toBe(0);
    expect(sprinklesShort(p, item('hat-crown'))).toBe(300);
    buyItem(p, 'hat-beret');
    expect(sprinklesShort(p, item('hat-beret'))).toBe(0);
  });
});

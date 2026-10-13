import { describe, expect, it } from 'vitest';
import { LAYER_ART, SPECIES_ART, SPRITE_H, SPRITE_W } from '../characters/sprites';
import { CATALOG } from '../shop/catalog';
import { CUSTOMERS, lineup } from '../shop/customerManager';
import { createRng } from '../core/rng';
import { numberToWords } from '../ui/numberWords';

describe('pixel art', () => {
  it('every species and layer uses the shared 16x20 grid', () => {
    for (const [name, rows] of Object.entries({ ...SPECIES_ART, ...LAYER_ART })) {
      expect(rows, name).toHaveLength(SPRITE_H);
      for (const row of rows) expect(row.length, `${name}: "${row}"`).toBe(SPRITE_W);
    }
  });
});

describe('catalog and customers', () => {
  it('has unique item ids with positive prices', () => {
    expect(new Set(CATALOG.map((i) => i.id)).size).toBe(CATALOG.length);
    for (const item of CATALOG) expect(item.price).toBeGreaterThan(0);
  });

  it('never sends the same customer twice in a row', () => {
    const ids = lineup(createRng(4), 50);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    expect(new Set(ids).size).toBe(CUSTOMERS.length);
  });
});

describe('numberToWords (parent gate)', () => {
  it.each([
    [101, 'one hundred one'],
    [212, 'two hundred twelve'],
    [340, 'three hundred forty'],
    [999, 'nine hundred ninety-nine'],
  ])('%i -> %s', (n, words) => expect(numberToWords(n)).toBe(words));
});

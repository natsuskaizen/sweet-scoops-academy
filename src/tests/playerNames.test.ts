import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { BACK, letterAs, rollShopName, SHOP_NAME_IDEAS, SPACE, typeKey } from '../shop/playerNames';

const type = (keys: string[], max = 12) => keys.reduce((text, key) => typeKey(text, key, max), '');

describe('typeKey', () => {
  it('capitalises each word and makes the other letters small', () => {
    expect(type(['A', 'V', 'A'])).toBe('Ava');
    expect(type(['M', 'I', 'A', SPACE, 'R', 'O', 'S', 'E'])).toBe('Mia Rose');
  });

  it('never starts with or doubles a space, and backs up one letter', () => {
    expect(type([SPACE, 'L', SPACE, SPACE, 'O'])).toBe('L O');
    expect(type(['L', 'E', 'O', BACK])).toBe('Le');
    expect(type([BACK])).toBe('');
  });

  it('ignores taps past the longest name', () => {
    expect(type(['A', 'B', 'C', 'D'], 3)).toBe('Abc');
    expect(type(['A', 'B', 'C', BACK], 3)).toBe('Ab');
  });
});

describe('rollShopName', () => {
  it("puts the owner's name in front when it fits", () => {
    const name = rollShopName(createRng(1), 'Ava', 28);
    expect(name).toMatch(/^Ava's [A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("leaves the owner's name out when the whole name would be too long", () => {
    const name = rollShopName(createRng(1), 'Alexandrina', 20);
    expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(name.length).toBeLessThanOrEqual(20);
    expect(rollShopName(createRng(1), '', 28)).toBe(name);
  });

  it('rolls the same name for the same seed and different names over many rolls', () => {
    expect(rollShopName(createRng(7), 'Leo', 28)).toBe(rollShopName(createRng(7), 'Leo', 28));
    const rng = createRng(3);
    const names = new Set(Array.from({ length: 20 }, () => rollShopName(rng, 'Leo', 28)));
    expect(names.size).toBeGreaterThan(10);
  });

  it('offers ideas that fit the sign', () => {
    for (const idea of SHOP_NAME_IDEAS) expect(idea.length).toBeLessThanOrEqual(28);
  });
});

describe('letterAs', () => {
  it('shows capitals at the start of each word and small letters after, as typeKey types them', () => {
    expect(letterAs('', 'a')).toBe('A');
    expect(letterAs('Av', 'A')).toBe('a');
    expect(letterAs('Ava ', 'm')).toBe('M');
    for (const current of ['', 'Av', 'Ava ']) expect(typeKey(current, 'q', 12)).toBe(current + letterAs(current, 'q'));
  });
});

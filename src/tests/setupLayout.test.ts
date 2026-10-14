import { describe, expect, it } from 'vitest';
import { gridCells, letterKeyCells, setupLayout } from '../ui/setupLayout';
import { inside, overlaps, PANEL_SCREENS } from './rects';

describe('gridCells', () => {
  it('fills the area in rows, left to right', () => {
    const cells = gridCells({ x: 0, y: 0, w: 210, h: 100 }, 5, 3, 10);
    expect(cells[0]).toEqual({ x: 0, y: 0, w: 63.333333333333336, h: 45 });
    expect(cells[3]).toMatchObject({ x: 0, y: 55 });
    expect(cells[4]!.x).toBeCloseTo(73.33);
  });
});

describe('letterKeyCells', () => {
  it('has every letter in QWERTY rows, a wide space, back and done, without overlaps', () => {
    const cells = letterKeyCells({ x: 0, y: 0, w: 800, h: 400 }, 8);
    expect(cells.map((c) => c.key).join('')).toBe('QWERTYUIOPASDFGHJKLZXCVBNMback done');
    // QWERTY rows: A sits half a key in from Q, Z a key and a half in, and each row ends inside the area.
    const at = (key: string) => cells.find((c) => c.key === key)!.rect;
    expect(at('A').x).toBeCloseTo(at('Q').x + (at('Q').w + 8) / 2);
    expect(at('Z').x).toBeCloseTo(at('Q').x + ((at('Q').w + 8) * 3) / 2);
    expect(at('P').x + at('P').w).toBeCloseTo(800);
    expect(at('done').x + at('done').w).toBeCloseTo(800);
    cells.forEach((c) => expect(inside(c.rect, { x: 0, y: 0, w: 800, h: 400 }, 0.01)).toBe(true));
    const space = cells.find((c) => c.key === ' ')!;
    expect(space.rect.w).toBeGreaterThan(cells[0]!.rect.w * 2.5);
    cells.forEach((a, i) => cells.slice(i + 1).forEach((b) => expect(overlaps(a.rect, b.rect)).toBe(false)));
  });
});

describe.each(Object.entries(PANEL_SCREENS))('setupLayout on %s', (_, layout) => {
  const setup = setupLayout(layout.panel, layout.orientation === 'portrait');

  it('keeps every area inside the register panel, in order down the panel', () => {
    for (const r of [setup.nameBox, setup.keys, setup.body, setup.next])
      expect(inside(r, layout.panel, 0.01)).toBe(true);
    expect(setup.titleY).toBeLessThan(setup.nameBox.y);
    expect(setup.nameBox.y + setup.nameBox.h).toBeLessThanOrEqual(setup.keys.y);
    expect(setup.body.y + setup.body.h).toBeLessThanOrEqual(setup.next.y);
  });

  it('gives letter keys and shopkeeper cards room for a finger', () => {
    // Ten QWERTY keys to a row make them narrower than tall, as on a tablet keyboard.
    const key = letterKeyCells(setup.keys, 6)[0]!.rect;
    expect(key.w).toBeGreaterThanOrEqual(38);
    expect(key.h).toBeGreaterThanOrEqual(52);
    const card = gridCells(setup.body, 6, setup.keeperCols, 12)[0]!;
    expect(card.w).toBeGreaterThanOrEqual(setup.keeperScale * 32 + 16);
    expect(card.h).toBeGreaterThanOrEqual(setup.keeperScale * 40 + 30);
  });
});

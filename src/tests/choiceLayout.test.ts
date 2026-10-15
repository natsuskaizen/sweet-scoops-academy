import { describe, expect, it } from 'vitest';
import { choiceLayout } from '../ui/choiceLayout';
import { inside, overlaps, PANEL_SCREENS } from './rects';

describe.each(Object.entries(PANEL_SCREENS))('choiceLayout on %s', (_, layout) => {
  const { x, y, cellW, cellH, gap } = layout.keypad;
  const area = { x, y, w: 3 * cellW + 2 * gap, h: 4 * cellH + 3 * gap };

  it.each([1, 2, 3, 4])('fits %i buttons in the keypad’s place without overlaps', (count) => {
    const cells = choiceLayout(area, count);
    expect(cells).toHaveLength(count);
    cells.forEach((c) => expect(inside(c, area, 0.5)).toBe(true));
    cells.forEach((a, i) => cells.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)));
  });

  it('keeps every button big enough for a small finger', () => {
    for (const count of [2, 3, 4]) {
      for (const c of choiceLayout(area, count)) {
        expect(c.h).toBeGreaterThanOrEqual(80);
        expect(c.w).toBeGreaterThanOrEqual(160);
      }
    }
  });
});

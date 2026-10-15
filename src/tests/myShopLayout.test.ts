import { describe, expect, it } from 'vitest';
import { myShopLayout } from '../ui/myShopLayout';
import { inside, overlaps, PANEL_SCREENS } from './rects';

describe.each(Object.entries(PANEL_SCREENS))('myShopLayout on %s', (_, layout) => {
  const my = myShopLayout(layout.panel, layout.orientation === 'portrait');
  const boxes = [...my.rows, my.switchPlayer, my.back, my.grownUps];

  it('keeps every row and button inside the panel, below the title, without overlaps', () => {
    boxes.forEach((box) => expect(inside(box, layout.panel)).toBe(true));
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)));
    expect(my.rows[0]!.y).toBeGreaterThan(my.titleY + 20);
  });

  it('has a row for each of the five settings', () => {
    expect(my.rows).toHaveLength(5);
  });

  it('keeps every target big enough for a small finger', () => {
    boxes.forEach((box) => expect(box.h).toBeGreaterThanOrEqual(44));
    my.rows.forEach((row) => expect(row.h).toBeGreaterThanOrEqual(56));
  });
});

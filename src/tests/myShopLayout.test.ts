import { describe, expect, it } from 'vitest';
import { myShopLayout } from '../ui/myShopLayout';
import { layoutFor, PORTRAIT_MAX_H, PORTRAIT_MIN_H, SHOP_W, type Rect } from '../ui/theme';

const inside = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const screens = {
  landscape: layoutFor(1180, 820),
  'iPad portrait': layoutFor(SHOP_W, PORTRAIT_MIN_H),
  'iPhone portrait': layoutFor(SHOP_W, PORTRAIT_MAX_H),
};

describe.each(Object.entries(screens))('myShopLayout on %s', (_, layout) => {
  const my = myShopLayout(layout.panel, layout.orientation === 'portrait');
  const boxes = [...my.rows, my.switchPlayer, my.back, my.grownUps];

  it('keeps every row and button inside the panel, below the title, without overlaps', () => {
    boxes.forEach((box) => expect(inside(box, layout.panel)).toBe(true));
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)));
    expect(my.rows[0]!.y).toBeGreaterThan(my.titleY + 20);
  });

  it('keeps every target big enough for a small finger', () => {
    boxes.forEach((box) => expect(box.h).toBeGreaterThanOrEqual(44));
    my.rows.forEach((row) => expect(row.h).toBeGreaterThanOrEqual(56));
  });
});

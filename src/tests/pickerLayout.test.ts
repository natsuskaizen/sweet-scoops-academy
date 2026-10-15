import { describe, expect, it } from 'vitest';
import { pickerLayout } from '../ui/pickerLayout';
import { inside, overlaps, PANEL_SCREENS } from './rects';

describe.each(Object.entries(PANEL_SCREENS))('pickerLayout on %s', (_, layout) => {
  const portrait = layout.orientation === 'portrait';
  it.each([2, 3, 4])('fits %i cards, the hearts and the foot inside the panel without overlaps', (count) => {
    const p = pickerLayout(layout.panel, portrait, count);
    const heartRow = { x: p.hearts.x - 100, y: p.hearts.y - 17, w: 200, h: 34 };
    const boxes = [heartRow, ...p.cards, p.foot];
    boxes.forEach((box) => expect(inside(box, layout.panel)).toBe(true));
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)));
    expect(p.title.y).toBeLessThan(p.hearts.y);
    expect(p.hearts.y + 17).toBeLessThan(p.cards[0]!.y);
  });

  it('keeps every card big enough for a small finger', () => {
    pickerLayout(layout.panel, portrait, 3).cards.forEach((c) => {
      expect(c.h).toBeGreaterThanOrEqual(100);
      expect(c.w).toBeGreaterThanOrEqual(160);
    });
  });
});

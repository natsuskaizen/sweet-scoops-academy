import { describe, expect, it } from 'vitest';
import { layoutFor, paradeSpots, PORTRAIT_MAX_H, PORTRAIT_MIN_H, SHOP_H, SHOP_W, type Rect } from '../ui/theme';

const inside = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

const keypadRect = (k: { x: number; y: number; cellW: number; cellH: number; gap: number }): Rect => ({
  x: k.x,
  y: k.y,
  w: 3 * k.cellW + 2 * k.gap,
  h: 4 * k.cellH + 3 * k.gap,
});

describe('layoutFor', () => {
  it('keeps the side-by-side shop on landscape screens', () => {
    const l = layoutFor(1180, 820); // iPad landscape
    expect(l.orientation).toBe('landscape');
    expect([l.width, l.height]).toEqual([1280, 880]);
  });

  const screens = {
    'iPhone SE': [375, 667],
    'iPhone 15': [393, 852],
    'iPhone Pro Max': [430, 932],
    'iPad portrait': [820, 1180],
    'iPad mini portrait': [744, 1133],
  } as const;

  for (const [name, [w, h]] of Object.entries(screens)) {
    it(`puts the shop on top and the register below on ${name}`, () => {
      const l = layoutFor(w, h);
      expect(l.orientation).toBe('portrait');
      expect(l.height).toBeGreaterThanOrEqual(PORTRAIT_MIN_H);
      expect(l.height).toBeLessThanOrEqual(PORTRAIT_MAX_H);
      expect(l.registerArea.y).toBe(SHOP_H);
      const keypad = keypadRect(l.keypad);
      expect(inside(l.ticket, l.panel)).toBe(true);
      expect(inside(keypad, l.panel)).toBe(true);
      expect(l.ticket.x + l.ticket.w).toBeLessThan(keypad.x); // side by side, no overlap
      expect(l.keypad.cellH).toBeGreaterThanOrEqual(90); // big enough for small fingers
      expect(l.ticket.h).toBeGreaterThanOrEqual(300);
    });
  }
});

describe('paradeSpots', () => {
  it('lines ten customers up in two rows on the shop floor, front row between the back row', () => {
    const spots = paradeSpots(10);
    expect(spots).toHaveLength(10);
    expect(new Set(spots.map((s) => s.y)).size).toBe(2);
    for (const s of spots) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(SHOP_W);
      expect(s.y).toBeLessThanOrEqual(SHOP_H);
    }
    expect(spots[5]!.x).toBeGreaterThan(spots[0]!.x);
    expect(spots[5]!.x).toBeLessThan(spots[1]!.x);
  });

  it('handles a short round', () => {
    expect(paradeSpots(1)).toHaveLength(1);
    expect(paradeSpots(0)).toEqual([]);
  });
});

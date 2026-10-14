import { describe, expect, it } from 'vitest';
import { decorSize, pieceRect } from '../scenes/decorArt';
import { tubSpot } from '../scenes/shopRoom';
import { designsIn, isRoomSurface } from '../shop/catalog';
import {
  closetLayout,
  decorTrayRect,
  decorTraySlots,
  layoutFor,
  paradeSpots,
  PORTRAIT_MAX_H,
  PORTRAIT_MIN_H,
  SHOP_H,
  SHOP_W,
  tierCardRect,
  type Rect,
} from '../ui/theme';
import { inside, overlaps } from './rects';

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

describe('tubSpot', () => {
  it('finds each flavour its own tub inside the shop, and uses the middle tub otherwise', () => {
    const spots = ['strawberry', 'honey-lavender', 'blueberry', 'lemon', 'chocolate', 'mint'].map(tubSpot);
    expect(new Set(spots.map((s) => `${s.x},${s.y}`)).size).toBe(6);
    for (const s of spots) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(SHOP_W);
      expect(s.y).toBeLessThan(SHOP_H);
    }
    expect(tubSpot('vanilla')).toEqual(tubSpot('honey-lavender'));
  });
});

describe('decorating layout', () => {
  const screens = [layoutFor(1180, 820), layoutFor(393, 852), layoutFor(375, 667), layoutFor(820, 1180)];

  it('keeps every decoration on screen and clear of the tray and the colour card', () => {
    for (const l of screens) {
      const tray = decorTrayRect(l);
      for (const design of designsIn('decorate')) {
        if (design.placement.kind !== 'shop') continue;
        const at = l.decorSpots[design.placement.spot];
        const r = pieceRect(design, l);
        // The piece as drawn, with the preview outline's margin (the wall gets no outline).
        const m = design.placement.spot === 'wall' ? 0 : 12;
        const piece = { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
        const card = tierCardRect(l, r);
        const name = `${l.orientation} ${design.id}`;
        expect(r.w * r.h, name).toBeGreaterThan(0);
        expect(piece.x, name).toBeGreaterThanOrEqual(0);
        expect(piece.x + piece.w, name).toBeLessThanOrEqual(l.width);
        expect(r.y, name).toBeGreaterThanOrEqual(l.shop.y);
        expect(at.y, name).toBeLessThanOrEqual(tray.y);
        expect(overlaps(card, tray), name).toBe(false);
        // In landscape the card always sits on the wall, so wall paint shows around it.
        if (design.placement.spot === 'wall' && l.orientation === 'landscape') continue;
        expect(overlaps(piece, card), name).toBe(false);
      }
    }
  });

  it('gives each piece standing in the room a spot of its own', () => {
    const spots = designsIn('decorate').map((d) => (d.placement.kind === 'shop' ? d.placement.spot : ''));
    const standing = spots.filter((s) => s && !isRoomSurface(s));
    expect(new Set(standing).size).toBe(standing.length);
    for (const l of screens) {
      const rects = designsIn('decorate')
        .filter((d) => d.placement.kind === 'shop' && !['wall', 'floor-center'].includes(d.placement.spot))
        .map((d) => ({ id: d.id, r: pieceRect(d, l) }));
      const doors = (a: string, b: string) => a.startsWith('door-') && b.startsWith('door-');
      const pairs = rects.flatMap((a) => rects.filter((b) => a.id < b.id && !doors(a.id, b.id)).map((b) => [a, b]));
      for (const [a, b] of pairs) expect(overlaps(a!.r, b!.r), `${l.orientation} ${a!.id} / ${b!.id}`).toBe(false);
    }
  });

  it('pages the tray with big bubbles that fit between the arrows', () => {
    for (const l of screens) {
      const tray = decorTrayRect(l);
      const { perPage, d, slots, prev, next, dotsY } = decorTraySlots(l);
      expect(slots).toHaveLength(perPage);
      expect(d).toBeGreaterThanOrEqual(110); // big enough for small fingers
      const bubbles = slots.map((s) => ({ x: s.x - d / 2, y: s.y - d / 2, w: d, h: d + 5 }));
      for (const r of [...bubbles, prev, next]) expect(inside(r, tray), l.orientation).toBe(true);
      for (const b of bubbles) {
        expect(overlaps(b, prev) || overlaps(b, next)).toBe(false);
        expect(b.y + b.h).toBeLessThan(dotsY - 8);
      }
      for (let i = 1; i < bubbles.length; i++) {
        for (let j = 0; j < i; j++) expect(overlaps(bubbles[i]!, bubbles[j]!)).toBe(false);
      }
      expect(dotsY + 8).toBeLessThanOrEqual(tray.y + tray.h);
      expect(prev.w).toBeGreaterThanOrEqual(80);
      // Every design is on some page.
      expect(Math.ceil(designsIn('decorate').length / perPage)).toBeGreaterThanOrEqual(1);
    }
  });

  it('draws the café set big enough to sit at, next to the customers', () => {
    const { w, h } = decorSize('deco-cafe');
    expect(h).toBeGreaterThanOrEqual(120);
    expect(w).toBeGreaterThanOrEqual(300);
  });
});

describe('closet layout', () => {
  const screens = [layoutFor(1180, 820), layoutFor(393, 852), layoutFor(820, 1180)];

  it('keeps Momo, her caption and the panel on screen without overlapping', () => {
    for (const l of screens) {
      const c = closetLayout(l);
      const screen = { x: 0, y: 0, w: l.width, h: l.height };
      for (const part of [c.panel, c.stage]) expect(inside(part, screen), l.orientation).toBe(true);
      for (const part of [c.tabs, c.grid, c.card]) expect(inside(part, c.panel), l.orientation).toBe(true);
      expect(c.tabs.y + c.tabs.h).toBeLessThanOrEqual(c.grid.y);
      expect(c.grid.y + c.grid.h).toBeLessThanOrEqual(c.card.y);
      // Momo (40 pixels tall) stands below the top bar, and her caption (two lines) fits on the stage.
      expect(c.momo.y - 40 * c.momo.scale).toBeGreaterThan(c.stage.y);
      const caption = { x: c.stage.x, y: c.captionY, w: c.stage.w, h: 70 };
      expect(inside(caption, c.stage), l.orientation).toBe(true);
    }
  });
});

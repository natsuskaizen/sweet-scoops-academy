/**
 * Where the start screen's pieces go in the register panel: a column in
 * landscape; in portrait the friend beside the greeting and Open button,
 * with the other players underneath. Plain rectangles, so tests can check
 * everything fits.
 */
import type { Point, Rect } from './theme';

export interface StartLayout {
  /** Centre line of "Welcome back!" and "Hi, Ava!", and the greeting's size. */
  textX: number;
  welcomeY: number;
  helloY: number;
  helloFont: number;
  /** The player's friend: feet, and how much bigger than in the shop. */
  friend: Point & { scale: number };
  open: Rect;
  sprinklesY: number;
  /** "Not Ava?" and the other players' cards (with New) under it. */
  othersLabel: Point;
  others: Rect;
  grownUps: Rect;
}

export function startLayout(panel: Rect, portrait: boolean): StartLayout {
  return portrait ? portraitStart(panel) : landscapeStart(panel);
}

function landscapeStart({ x, y, w, h }: Rect): StartLayout {
  const cx = x + w / 2;
  const bottom = y + h - 10;
  return {
    textX: cx,
    welcomeY: y + 40,
    helloY: y + 92,
    helloFont: 46,
    friend: { x: cx, y: y + 330, scale: 1.4 },
    open: { x: x + 40, y: y + 356, w: w - 80, h: 104 },
    sprinklesY: y + 488,
    othersLabel: { x: cx, y: y + 532 },
    others: { x: x + 30, y: y + 556, w: w - 60, h: bottom - 90 - (y + 556) },
    grownUps: { x: cx - 120, y: bottom - 72, w: 240, h: 60 },
  };
}

function portraitStart({ x, y, w, h }: Rect): StartLayout {
  const bottom = y + h - 10;
  const band = Math.min(300, Math.round(h * 0.6));
  const col = { x: x + 290, w: w - 310 };
  const below = y + band + 40;
  return {
    textX: col.x + col.w / 2,
    welcomeY: y + 34,
    helloY: y + 82,
    helloFont: 42,
    friend: { x: x + 145, y: y + band - 12, scale: 1.3 },
    open: { x: col.x, y: y + 118, w: col.w, h: 96 },
    sprinklesY: y + 240,
    othersLabel: { x: x + 20 + (w - 300) / 2, y: y + band + 16 },
    others: { x: x + 20, y: below, w: w - 300, h: bottom - 10 - below },
    grownUps: { x: x + w - 260, y: below, w: 240, h: 72 },
  };
}

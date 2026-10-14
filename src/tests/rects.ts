import { layoutFor, PORTRAIT_MAX_H, PORTRAIT_MIN_H, SHOP_W, type Rect } from '../ui/theme';

/** True when `inner` sits wholly in `outer`, allowing `slack` for fractional cell sizes. */
export const inside = (inner: Rect, outer: Rect, slack = 0) =>
  inner.x >= outer.x - slack &&
  inner.y >= outer.y - slack &&
  inner.x + inner.w <= outer.x + outer.w + slack &&
  inner.y + inner.h <= outer.y + outer.h + slack;

export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The register panel's three shapes: iPad landscape, and the shortest and tallest portrait screens. */
export const PANEL_SCREENS = {
  landscape: layoutFor(1180, 820),
  'iPad portrait': layoutFor(SHOP_W, PORTRAIT_MIN_H),
  'iPhone portrait': layoutFor(SHOP_W, PORTRAIT_MAX_H),
};

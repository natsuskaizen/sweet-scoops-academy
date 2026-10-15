/**
 * Where My shop's pieces go in the register panel: five setting rows under
 * the title (one column in landscape, two in the wider, shorter portrait
 * panel), then Switch player, Back to the shop and the grown-ups link:
 * stacked in landscape, one row along the bottom in portrait. Plain
 * rectangles, so tests can check everything fits.
 */
import { gridCells } from './setupLayout';
import type { Rect } from './theme';

export interface MyShopLayout {
  titleY: number;
  /** My name, Shop name, Shopkeeper, Hints and Calm mode, in reading order. */
  rows: Rect[];
  switchPlayer: Rect;
  back: Rect;
  grownUps: Rect;
}

const PAD = 20;
const GAP = 12;
const ROWS = 5;
const LINK_H = 48;

export function myShopLayout(panel: Rect, portrait: boolean): MyShopLayout {
  const bottom = panel.y + panel.h - 10;
  const x = panel.x + PAD;
  const w = panel.w - 2 * PAD;
  const buttons = portrait ? oneRow(x, w, bottom - 8) : stacked(panel, bottom);
  const top = panel.y + (portrait ? 62 : 86);
  const rowsBottom = buttons.top - (portrait ? 12 : 24);
  const cols = portrait ? 2 : 1;
  const lines = Math.ceil(ROWS / cols);
  const rowH = Math.min(portrait ? 80 : 84, (rowsBottom - top - (lines - 1) * GAP) / lines);
  const rows = gridCells({ x, y: top, w, h: lines * rowH + (lines - 1) * GAP }, ROWS, cols, GAP);
  return {
    titleY: panel.y + (portrait ? 32 : 46),
    rows,
    switchPlayer: buttons.switchPlayer,
    back: buttons.back,
    grownUps: buttons.grownUps,
  };
}

/** Landscape: Switch player above a bigger Back to the shop, both full width, and the grown-ups link under them. */
function stacked(panel: Rect, bottom: number) {
  const x = panel.x + PAD;
  const w = panel.w - 2 * PAD;
  const grownUps = { x: panel.x + panel.w / 2 - 140, y: bottom - LINK_H - 8, w: 280, h: LINK_H };
  const back = { x, y: grownUps.y - 10 - 84, w, h: 84 };
  const switchPlayer = { x, y: back.y - 14 - 72, w, h: 72 };
  return { switchPlayer, back, grownUps, top: switchPlayer.y };
}

/** Portrait: Switch player, Back to the shop and a smaller grown-ups button share the bottom row. */
function oneRow(x: number, w: number, bottom: number) {
  const h = 72;
  const y = bottom - h;
  const linkW = 200;
  const half = (w - linkW - 2 * GAP) / 2;
  return {
    switchPlayer: { x, y, w: half, h },
    back: { x: x + half + GAP, y, w: half, h },
    grownUps: { x: x + w - linkW, y, w: linkW, h },
    top: y,
  };
}

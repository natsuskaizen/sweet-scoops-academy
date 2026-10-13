/**
 * Phaser-free layout maths for the hint and explanation board: where cups go
 * and how big the pixel-art scoops can be drawn. Kept apart from
 * VisualAidView so it can be unit tested.
 */
import type { Rect } from './theme';

export type Point = { x: number; y: number };
export type Cell = { cx: number; top: number; cellW: number; cellH: number };

/** Scoop art is 8x6 pixels; scoops sit 9 apart across and 7 apart down, one pixel of space between. */
export const SCOOP_W = 9;
const SCOOP_H = 7;
/** Cup art height in art pixels. */
export const CUP_H = 6;
/** Room under each cup (or pile) for its number, in game pixels. */
export const LABEL_H = 26;
const CELL_PAD = 12;
const MAX_SCALE = 5;
const MIN_READABLE_SCALE = 2;

export interface AidFit {
  /** Cups per row on the board. */
  perRow: number;
  /** Scoops per row inside one cup. */
  cols: number;
  /** Whole-number pixel scale for scoops and cups (at least 1). */
  scale: number;
}

/** Pixel scale at which `count` scoops in `cols` columns (plus a cup, if any) fit a w x h cell. */
function scaleFor(count: number, cols: number, w: number, h: number, withCup: boolean): number {
  const rows = Math.ceil(Math.max(count, 1) / cols);
  const artW = cols * SCOOP_W + (withCup ? 3 : 0);
  const artH = rows * SCOOP_H + 1 + (withCup ? CUP_H : 0);
  return Math.min((w - CELL_PAD) / artW, (h - LABEL_H - 8) / artH);
}

/** Scoops per row to try: rows of up to 5 (like a ten frame), down to 3 when space is tight. Big piles use rows of up to 10. */
function colChoices(count: number, withCup: boolean): number[] {
  const most = Math.max(1, Math.min(count, withCup || count <= 25 ? 5 : 10));
  const least = Math.max(1, Math.min(most, withCup ? 3 : 5));
  return Array.from({ length: most - least + 1 }, (_, i) => most - i);
}

/** Best cups-per-row for scoop rows of `cols`. */
function bestForCols(groups: number, count: number, cols: number, area: Rect, withCup: boolean): AidFit {
  let best: AidFit = { perRow: groups, cols, scale: 0 };
  for (let perRow = groups; perRow >= 1; perRow--) {
    const cellW = area.w / perRow;
    const cellH = area.h / Math.ceil(groups / perRow);
    const scale = Math.floor(Math.min(MAX_SCALE, scaleFor(count, cols, cellW, cellH, withCup)));
    if (scale > best.scale) best = { perRow, cols, scale };
  }
  return best;
}

/**
 * Picks cups-per-row and scoops-per-row for `groups` cells of `count`
 * scoops. Long rows (5, like a ten frame) win as long as scoops stay at
 * least 2x; shorter rows are only used when they are needed to reach that.
 */
export function fitAid(groups: number, count: number, area: Rect, withCup = true): AidFit {
  const fits = colChoices(count, withCup).map((cols) => bestForCols(groups, count, cols, area, withCup));
  const readable = fits.find((f) => f.scale >= MIN_READABLE_SCALE);
  const best = readable ?? fits.reduce((a, b) => (b.scale > a.scale ? b : a));
  return { ...best, scale: Math.max(1, best.scale) };
}

/** `n` equal cells, `perRow` to a row, centred in the area. */
export function layoutCells(n: number, perRow: number, area: Rect): Cell[] {
  const rows = Math.ceil(n / perRow);
  const cellW = area.w / perRow;
  const cellH = area.h / rows;
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, n - row * perRow);
    const startX = area.x + (area.w - cellW * inRow) / 2;
    return { cx: startX + (i % perRow) * cellW + cellW / 2, top: area.y + row * cellH, cellW, cellH };
  });
}

/**
 * Centres of `count` scoops in a grid centred on cx, filled from the bottom
 * row (resting on `bottom`) upwards. Rows fill left to right like a ten
 * frame, so 7 in rows of 5 reads as "5 and 2 more".
 */
export function gridPositions(cx: number, bottom: number, count: number, cols: number, s: number): Point[] {
  const width = Math.min(cols, count);
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols);
    return {
      x: cx + ((i % cols) - (width - 1) / 2) * SCOOP_W * s,
      y: bottom - 3 * s - row * SCOOP_H * s,
    };
  });
}

/**
 * Where the "pick your next game" screen's pieces go in the register panel:
 * the cards stacked in landscape, in a row in portrait. Plain rectangles, so
 * tests can check everything fits.
 */
import { gridCells } from './setupLayout';
import type { Point, Rect } from './theme';

export interface PickerLayout {
  title: Point & { font: number };
  /** Centre of the row of heart slices, and how big each heart is drawn. */
  hearts: Point & { scale: number; gap: number };
  cards: Rect[];
  /** The line under the cards. */
  foot: Rect;
}

const GAP = 14;
const MAX_CARD_H = 170;

export function pickerLayout(panel: Rect, portrait: boolean, count: number): PickerLayout {
  const { x, y, w, h } = panel;
  const cx = x + w / 2;
  const bottom = y + h - 10;
  const top = y + (portrait ? 130 : 160);
  const footH = portrait ? 56 : 96;
  const area = { x: x + 20, y: top, w: w - 40, h: bottom - footH - 12 - top };
  const cols = portrait ? count : 1;
  const grid = gridCells(area, count, cols, GAP);
  const cards = grid.map((cell) => ({ ...cell, h: Math.min(cell.h, portrait ? 280 : MAX_CARD_H) }));
  return {
    title: { x: cx, y: y + (portrait ? 34 : 44), font: portrait ? 32 : 38 },
    hearts: { x: cx, y: y + (portrait ? 92 : 112), scale: 3, gap: 10 },
    cards,
    foot: { x: x + 24, y: bottom - footH, w: w - 48, h: footH },
  };
}

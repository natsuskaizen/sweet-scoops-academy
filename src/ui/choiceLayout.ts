/**
 * Where a question's answer buttons go in the keypad's spot: two columns, or
 * a single column for three (so each stays wide and tall enough to tap).
 * Plain rectangles, so tests can check they fit.
 */
import { gridCells } from './setupLayout';
import type { Rect } from './theme';

const GAP = 14;
/** The tallest a button gets: a few big buttons are easier than a few huge ones. */
const MAX_H = 200;

export function choiceLayout(area: Rect, count: number): Rect[] {
  const cols = count === 3 || count === 1 ? 1 : 2;
  const rows = Math.ceil(count / cols);
  // Short grids sit in the middle of the area rather than stretching to fill it.
  const used = Math.min(area.h, rows * MAX_H + (rows - 1) * GAP);
  const top = area.y + (area.h - used) / 2;
  return gridCells({ ...area, y: top, h: used }, count, cols, GAP);
}

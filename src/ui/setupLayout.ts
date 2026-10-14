/**
 * Where the new-player setup's pieces go inside the register panel, for
 * either screen shape. Plain rectangles, so tests can check everything fits.
 */
import { BACK, SPACE, type LetterKey } from '../shop/playerNames';
import type { Rect } from './theme';

/** `count` equal cells filling `area`, left to right then down, `cols` to a row. */
export function gridCells(area: Rect, count: number, cols: number, gap: number): Rect[] {
  const rows = Math.ceil(count / cols);
  const w = (area.w - gap * (cols - 1)) / cols;
  const h = (area.h - gap * (rows - 1)) / rows;
  return Array.from({ length: count }, (_, i) => ({
    x: area.x + (i % cols) * (w + gap),
    y: area.y + Math.floor(i / cols) * (h + gap),
    w,
    h,
  }));
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
/** Letter keys in ABC order, eight to a row; the last row ends with a wide space, back and done. */
const KEY_SPANS: [LetterKey | 'done', number][] = [
  ...LETTERS.map((l): [LetterKey, number] => [l, 1]),
  [SPACE, 3],
  [BACK, 1],
  ['done', 2],
];
const KEY_COLS = 8;

export interface KeyCell {
  key: LetterKey | 'done';
  rect: Rect;
}

/** The letter keys laid out over `area`. */
export function letterKeyCells(area: Rect, gap: number): KeyCell[] {
  const unit = gridCells(area, KEY_COLS * 4, KEY_COLS, gap);
  const cells: KeyCell[] = [];
  let slot = 0;
  for (const [key, span] of KEY_SPANS) {
    const first = unit[slot]!;
    const last = unit[slot + span - 1]!;
    cells.push({ key, rect: { x: first.x, y: first.y, w: last.x + last.w - first.x, h: first.h } });
    slot += span;
  }
  return cells;
}

export interface SetupLayout {
  /** The step dots' centre line, and the title's. */
  dotsY: number;
  titleY: number;
  titleFont: number;
  /** The box showing what has been typed or picked. */
  nameBox: Rect;
  /** Letter keys, under the name box. */
  keys: Rect;
  /** Everything else a step shows, between the name box (or title) and the Next button. */
  body: Rect;
  next: Rect;
  /** Shopkeepers to choose from: columns, and how big each friend is drawn. */
  keeperCols: number;
  keeperScale: number;
}

/** Splits the register panel into the setup's areas. */
export function setupLayout(panel: Rect, portrait: boolean): SetupLayout {
  const pad = 22;
  const inner = { x: panel.x + pad, w: panel.w - 2 * pad };
  const short = panel.h < 560;
  const dotsY = panel.y + 30;
  const titleY = dotsY + (short ? 40 : 50);
  const boxH = short ? 62 : 76;
  const nameBox = { ...inner, y: titleY + (short ? 32 : 44), h: boxH };
  const nextH = short ? 66 : 90;
  const nextW = Math.min(inner.w, 340);
  const next = { x: panel.x + (panel.w - nextW) / 2, y: panel.y + panel.h - pad - nextH - 10, w: nextW, h: nextH };
  const keysTop = nameBox.y + boxH + 18;
  const keysH = Math.min(portrait ? 360 : 330, panel.y + panel.h - pad - 10 - keysTop);
  return {
    dotsY,
    titleY,
    titleFont: short ? 32 : 38,
    nameBox,
    keys: { ...inner, y: keysTop, h: keysH },
    body: { ...inner, y: keysTop, h: next.y - 16 - keysTop },
    next,
    keeperCols: portrait && short ? 6 : 3,
    keeperScale: short ? 2.25 : 3,
  };
}

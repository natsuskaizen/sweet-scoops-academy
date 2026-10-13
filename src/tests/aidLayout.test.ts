import { describe, expect, it } from 'vitest';
import { fitAid, gridPositions, layoutCells } from '../ui/aidLayout';

const BOARD = { x: 20, y: 70, w: 570, h: 230 };

describe('fitAid', () => {
  it('uses rows of up to five scoops, like a ten frame', () => {
    expect(fitAid(3, 4, BOARD).cols).toBe(4);
    expect(fitAid(6, 7, BOARD).cols).toBeGreaterThanOrEqual(3);
    expect(fitAid(6, 7, BOARD).cols).toBeLessThanOrEqual(5);
    expect(fitAid(1, 96, BOARD, false).cols).toBe(10);
    // Two cups of 10 read as 5 + 5, not 3 + 3 + 3 + 1, even on a short board.
    expect(fitAid(2, 10, { x: 0, y: 0, w: 380, h: 230 }).cols).toBe(5);
  });

  it('shortens scoop rows only when long rows would be too small to read', () => {
    const tight = { x: 0, y: 0, w: 90, h: 300 };
    expect(fitAid(1, 10, tight).cols).toBeLessThan(5);
    expect(fitAid(1, 10, tight).scale).toBeGreaterThanOrEqual(2);
  });

  it('draws small questions big and still fits the largest ones', () => {
    const small = fitAid(2, 2, BOARD);
    const large = fitAid(10, 10, BOARD);
    expect(small.scale).toBeGreaterThan(large.scale);
    expect(large.scale).toBeGreaterThanOrEqual(1);
    for (const fit of [small, large, fitAid(12, 8, BOARD), fitAid(1, 1, BOARD)]) {
      expect(Number.isInteger(fit.scale)).toBe(true);
    }
  });

  it('wraps many cups onto more than one row', () => {
    expect(fitAid(10, 10, BOARD).perRow).toBeLessThan(10);
  });
});

describe('layoutCells', () => {
  it('keeps every cell inside the board and centres a short last row', () => {
    const cells = layoutCells(5, 3, BOARD);
    for (const c of cells) {
      expect(c.cx - c.cellW / 2).toBeGreaterThanOrEqual(BOARD.x - 1e-9);
      expect(c.cx + c.cellW / 2).toBeLessThanOrEqual(BOARD.x + BOARD.w + 1e-9);
      expect(c.top + c.cellH).toBeLessThanOrEqual(BOARD.y + BOARD.h + 1e-9);
    }
    const middle = BOARD.x + BOARD.w / 2;
    expect((cells[3]!.cx + cells[4]!.cx) / 2).toBeCloseTo(middle);
  });
});

describe('gridPositions', () => {
  it('fills the bottom row first, left to right', () => {
    const p = gridPositions(100, 200, 7, 5, 2);
    expect(p).toHaveLength(7);
    expect(p[0]!.y).toBeGreaterThan(p[5]!.y); // the 6th scoop starts a row above
    expect(p[0]!.x).toBe(p[5]!.x); // and lines up with the first
    expect(p[4]!.x).toBeGreaterThan(p[0]!.x);
  });
});

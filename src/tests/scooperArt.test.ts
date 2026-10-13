import { describe, expect, it } from 'vitest';
import { SCOOPER_GRID, SCOOPER_LOOKS } from '../characters/scooperArt';

describe('scooper art', () => {
  it('has a rectangular grid', () => {
    const width = SCOOPER_GRID[0]!.length;
    expect(SCOOPER_GRID.every((row) => row.length === width)).toBe(true);
  });

  it('colours every pixel of the grid for every scooper', () => {
    const used = new Set(SCOOPER_GRID.join('').replace(/[.ob]/g, ''));
    for (const look of Object.values(SCOOPER_LOOKS)) {
      for (const ch of used) expect(look.colors[ch], ch).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

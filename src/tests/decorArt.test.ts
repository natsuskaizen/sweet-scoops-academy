import { describe, expect, it } from 'vitest';
import { tierSwatch, tint } from '../characters/tierColors';
import { DECOR_ART, decorSize, lookWith, roomLookOf } from '../scenes/decorArt';
import { DOOR_ART, DOOR_H, DOOR_W } from '../scenes/doorArt';
import { counterColors, doorFrame, PLAIN_ROOM, wallColors } from '../scenes/shopRoom';
import { DESIGNS, itemById, shopOf, TIERS } from '../shop/catalog';

const HEX = /^#[0-9a-f]{6}$/;

describe('decoration art', () => {
  it('has a rectangular grid of known pixels for every design sold in Decorate', () => {
    for (const design of DESIGNS.filter((d) => shopOf(d) === 'decorate')) {
      const rows = DECOR_ART[design.asset];
      expect(rows, design.id).toBeDefined();
      const width = rows![0]!.length;
      expect(
        rows!.every((r) => r.length === width),
        design.id,
      ).toBe(true);
      expect(rows!.join('').replace(/[.oLlwgGBpPkxtsSr]/g, ''), design.id).toBe('');
      expect(rows!.join('')).toMatch(/[Ll]/); // something takes the tier's colours
    }
  });

  it('draws every door the size of the room door frame', () => {
    const frame = doorFrame();
    expect([frame.w, frame.h]).toEqual([DOOR_W, DOOR_H]);
    for (const rows of Object.values(DOOR_ART)) {
      expect(rows).toHaveLength(DOOR_H);
      // The OPEN sign is in the same place on every door.
      expect(rows[33]!.slice(8, 29)).toBe('S'.repeat(21));
    }
  });

  it('reports the drawn size of a design', () => {
    expect(decorSize('deco-plant')).toEqual({ w: 80, h: 95 });
    expect(decorSize('no-such-art')).toEqual({ w: 0, h: 0 });
  });
});

describe('room look', () => {
  it('reads the wall paint, door and counter paint in use from the placed decorations', () => {
    expect(roomLookOf([])).toEqual(PLAIN_ROOM);
    const look = roomLookOf([
      { itemId: 'deco-plant.pink', spot: 'floor-left' },
      { itemId: 'wall-paint.golden', spot: 'wall' },
      { itemId: 'door-arch.sky', spot: 'door' },
      { itemId: 'counter-paint.charcoal', spot: 'counter' },
    ]);
    expect(look).toEqual({ wall: 'golden', door: itemById('door-arch.sky'), counter: 'charcoal' });
  });

  it('tries wall paint, a door or counter paint on over the look in use, leaving the rest', () => {
    const look = roomLookOf([{ itemId: 'wall-paint.mint', spot: 'wall' }]);
    expect(lookWith(look, itemById('counter-paint.rainbow')!)).toEqual({ ...look, counter: 'rainbow' });
    expect(lookWith(look, itemById('wall-paint.sky')!)).toEqual({ ...look, wall: 'sky' });
    expect(lookWith(look, itemById('door-candy.pink')!)).toEqual({ ...look, door: itemById('door-candy.pink') });
    expect(lookWith(look, itemById('deco-plant.pink')!)).toEqual(look);
  });

  it('paints the counter front in the tier colours, and keeps the parlour pink otherwise', () => {
    const plain = counterColors(null);
    expect(plain.front(0)).toBe('#ff8fb3');
    for (const tier of TIERS) {
      const c = counterColors(tier);
      for (const color of [c.front(0), c.stripe(2), c.base(1.5)]) expect(color, tier).toMatch(HEX);
      expect(c.front(0)).toBe(tierSwatch(tier));
    }
    const rainbow = counterColors('rainbow');
    expect(new Set([0, 1, 2, 3, 4, 5].map(rainbow.front)).size).toBe(6);
  });

  it('has a soft black that is a grey, not black', () => {
    const n = parseInt(tierSwatch('charcoal').slice(1), 16);
    const channels = [n >> 16, (n >> 8) & 0xff, n & 0xff];
    for (const c of channels) expect(c).toBeGreaterThan(0x50);
  });

  it('paints the wall in the tier colours, Sparkly Rainbow in bands, and keeps the plain wall otherwise', () => {
    const plain = wallColors(null);
    expect(plain.base).toBe('#fff6e8');
    for (const tier of TIERS) {
      const c = wallColors(tier);
      for (const color of [c.base, c.heart, c.rail, c.wainscot, c.stripe(0), c.valance(3), c.panel(1.2)]) {
        expect(color, tier).toMatch(HEX);
      }
      expect(c.stripe(0)).not.toBe(plain.stripe(0));
    }
    expect(wallColors('mint').valance(0)).toBe(tierSwatch('mint'));
    const rainbow = wallColors('rainbow');
    expect(new Set([0, 1, 2, 3, 4, 5].map(rainbow.stripe)).size).toBe(6);
  });

  it('mixes colours towards white', () => {
    expect(tint('#ff0000', 0)).toBe('#ff0000');
    expect(tint('#ff0000', 1)).toBe('#ffffff');
    expect(tint('#000000', 0.5)).toBe('#808080');
  });
});

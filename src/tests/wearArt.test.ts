import { describe, expect, it } from 'vitest';
import { FRIEND_ART, FRIEND_EYES, FRIEND_H, FRIEND_IDS, FRIEND_W } from '../characters/friendArt';
import { SCOOPER_LOOKS } from '../characters/scooperArt';
import { bareArt, onFrame, TOPPERS, WEAR_ART } from '../characters/wearArt';
import { designsIn, TIERS } from '../shop/catalog';

const LETTERS = /^[.oLlwgGyrBk]+$/;

describe('wear art', () => {
  it('draws every Closet design: worn ones on Momo, scoopers in her paw', () => {
    for (const d of designsIn('closet')) {
      const slot = d.placement.kind === 'equip' ? d.placement.slot : null;
      if (slot === 'handheld') continue;
      expect(WEAR_ART[d.asset], d.id).toBeDefined();
    }
    for (const tier of TIERS) expect(SCOOPER_LOOKS[tier], tier).toBeDefined();
  });

  it('fits each piece on Momo’s frame without losing a pixel, using only known colours', () => {
    for (const [asset, art] of Object.entries(WEAR_ART)) {
      const rows = onFrame(art);
      expect(rows, asset).toHaveLength(FRIEND_H);
      expect(rows.every((r) => r.length === FRIEND_W)).toBe(true);
      const drawn = (rs: readonly string[]) => rs.join('').replace(/\./g, '').length;
      expect(drawn(rows), asset).toBe(drawn(art.rows));
      for (const r of [...art.rows, ...(art.icon ?? [])]) expect(r, asset).toMatch(LETTERS);
    }
  });

  it('keeps Momo’s eyes clear behind her glasses', () => {
    const { left, right, top } = FRIEND_EYES;
    for (const asset of ['glasses-round', 'glasses-heart']) {
      const rows = onFrame(WEAR_ART[asset]!);
      for (let y = top; y <= top + 2; y++) {
        for (const x of [left, left + 1, right, right + 1]) expect(rows[y]![x], `${asset} ${x},${y}`).toBe('.');
      }
    }
  });

  it('takes off the chef hat and leaves the rest of Momo as she was', () => {
    const before = FRIEND_ART.momo.rows;
    const after = bareArt('momo')!.rows;
    expect(after.slice(0, 10).join('')).not.toContain('a');
    expect(after.slice(10)).toEqual(before.slice(10));
    // Her ears keep their outline.
    expect(after[4]).toBe('...oobbo................obboo...');
  });

  it("takes off each friend's topper (Bonbon's flower, Kiki's star...) and nothing below it", () => {
    for (const id of FRIEND_IDS) {
      const topper = TOPPERS[id];
      if (!topper) {
        expect(bareArt(id), id).toBeNull();
        continue;
      }
      const before = FRIEND_ART[id].rows;
      const after = bareArt(id)!.rows;
      const top = after.slice(0, topper.rows).join('');
      for (const ch of topper.chars) expect(top, `${id} ${ch}`).not.toContain(ch);
      expect(after.slice(topper.rows), id).toEqual(before.slice(topper.rows));
      // Only the topper and its outline go: the head and ears above the cut stay.
      for (const ch of topper.edge) {
        const count = (rows: readonly string[]) => rows.slice(0, topper.rows).join('').split(ch).length;
        if (!topper.chars.includes(ch)) expect(count(after), `${id} ${ch}`).toBe(count(before));
      }
    }
  });
});

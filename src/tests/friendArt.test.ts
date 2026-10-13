import { describe, expect, it } from 'vitest';
import {
  FRIEND_ART,
  FRIEND_EYES,
  FRIEND_H,
  FRIEND_IDS,
  FRIEND_OUTLINE,
  FRIEND_W,
  friendColor,
  friendFrames,
} from '../characters/friendArt';
import { CUSTOMERS } from '../shop/customerManager';

describe('built-in friends', () => {
  it.each(FRIEND_IDS)('%s is a 32x40 grid using only its own colours', (id) => {
    const art = FRIEND_ART[id];
    expect(art.rows).toHaveLength(FRIEND_H);
    for (const row of art.rows) {
      expect(row).toHaveLength(FRIEND_W);
      for (const ch of row) if (ch !== '.') expect(friendColor(art, ch)).not.toBeNull();
    }
  });

  it.each(FRIEND_IDS)('%s has two-pixel eyes where the faces are drawn', (id) => {
    const { rows } = FRIEND_ART[id];
    for (const x of [FRIEND_EYES.left, FRIEND_EYES.right]) {
      const eye = rows[FRIEND_EYES.top + 1]!.slice(x, x + 2);
      expect(eye[0]).toBe(eye[1]);
      expect(rows[FRIEND_EYES.top]!.slice(x, x + 2)).toBe(eye);
    }
  });

  it.each(FRIEND_IDS)('%s changes only its face for happy and thinking', (id) => {
    const [stand, happy, thinking] = friendFrames(FRIEND_ART[id]);
    for (const pose of [happy!, thinking!]) {
      expect(pose).not.toEqual(stand);
      pose.forEach((row, y) => {
        if (y < FRIEND_EYES.top - 1 || y > FRIEND_EYES.top + 5) expect(row).toBe(stand![y]);
      });
    }
  });

  it('draws the outline in the shared ink colour', () => {
    expect(friendColor(FRIEND_ART.momo, 'o')).toBe(FRIEND_OUTLINE);
    expect(friendColor(FRIEND_ART.momo, '?')).toBeNull();
  });

  it('every customer has art, with names unique and Momo behind the counter', () => {
    const arts = CUSTOMERS.map((c) => c.art);
    expect(arts.every((a) => a !== undefined && a in FRIEND_ART)).toBe(true);
    expect(new Set(CUSTOMERS.map((c) => c.name)).size).toBe(CUSTOMERS.length);
    expect(arts).not.toContain('momo');
    expect(CUSTOMERS).toHaveLength(FRIEND_IDS.length - 1);
  });
});

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
  friendName,
  isFriendId,
  keeperOrMomo,
} from '../characters/friendArt';
import { GAME_CONFIG } from '../config/gameConfig';
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

  it.each(FRIEND_IDS)('%s lifts one foot at a time to walk, and nothing else moves', (id) => {
    const [stand, , , walkA, walkB] = friendFrames(FRIEND_ART[id]);
    for (const [step, still] of [
      [walkA!, (x: number) => x >= FRIEND_W / 2],
      [walkB!, (x: number) => x < FRIEND_W / 2],
    ] as const) {
      expect(step).not.toEqual(stand);
      step.forEach((row, y) => {
        for (let x = 0; x < FRIEND_W; x++) if (y < 33 || still(x)) expect(row[x]).toBe(stand![y]![x]);
      });
      // The lifted foot leaves the bottom row clear on its side.
      const bottom = step[FRIEND_H - 1]!;
      expect([...bottom].filter((ch, x) => !still(x) && ch !== '.')).toEqual([]);
    }
  });

  it.each(FRIEND_IDS)('%s blinks by closing its eyes to a line', (id) => {
    const frames = friendFrames(FRIEND_ART[id]);
    expect(frames).toHaveLength(6);
    const [stand, , , , , blink] = frames;
    const { left, top } = FRIEND_EYES;
    expect(blink![top + 2]!.slice(left, left + 2)).toBe(stand![top + 1]!.slice(left, left + 2));
    expect(blink![top]!.slice(left, left + 2)).not.toBe(stand![top]!.slice(left, left + 2));
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

describe('shopkeepers a player can choose', () => {
  it('offers only built-in friends, with the default shopkeeper among them', () => {
    const { starterKeepers, defaultShop } = GAME_CONFIG.players;
    for (const id of starterKeepers) expect(isFriendId(id), id).toBe(true);
    expect(starterKeepers).toContain(defaultShop.keeper);
  });

  it('names a friend, and falls back to Momo for a saved id the game does not know', () => {
    expect(friendName('bonbon')).toBe('Bonbon');
    expect(keeperOrMomo('kiki')).toBe('kiki');
    expect(keeperOrMomo('gone-friend')).toBe('momo');
  });
});

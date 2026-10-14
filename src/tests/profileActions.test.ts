import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import { mathSubject } from '../learning/mathSubject';
import {
  addPlayer,
  canAddPlayer,
  choosePlayer,
  cleanName,
  playersInOrder,
  removePlayer,
  resetLearning,
  resetProfile,
  updatePlayer,
} from '../save/profileActions';
import { createProfile, createSaveFile } from '../save/saveManager';
import { subjectProgress } from '../save/saveTypes';
import { validateSaveFile } from '../save/saveValidation';

function playedSave() {
  const save = createSaveFile(1);
  const p = save.profiles[save.activeProfileId]!;
  p.sprinkles = p.lifetimeSprinkles = 50;
  p.ownedItems = ['bow-strawberry'];
  p.learning.roundsStarted = 4;
  subjectProgress(p, mathSubject);
  (p.learning.math as Record<string, unknown>).multiplication = { facts: {} };
  return { save, p };
}

describe('resetLearning', () => {
  it('clears practice progress and the round in play, and keeps Sprinkles and items', () => {
    const { save, p } = playedSave();
    resetLearning(p, mathSubject);
    expect(p.learning.roundsStarted).toBe(0);
    expect(p.currentRound).toBeNull();
    expect(p.learning.math).toEqual(mathSubject.createProgress());
    expect(p.sprinkles).toBe(50);
    expect(p.ownedItems).toEqual(['bow-strawberry']);
    expect(validateSaveFile(save)).toEqual([]);
  });
});

describe('resetProfile', () => {
  it('starts the active player over under the same name', () => {
    const { save, p } = playedSave();
    const fresh = resetProfile(save, 2);
    expect(save.activeProfileId).toBe(fresh.id);
    expect(fresh.displayName).toBe(p.displayName);
    expect(fresh.sprinkles).toBe(0);
    expect(save.profiles[p.id]).toBeUndefined();
    expect(validateSaveFile(save)).toEqual([]);
  });

  it('leaves other players alone', () => {
    const { save } = playedSave();
    const other = createProfile('Player 2', 3);
    save.profiles[other.id] = other;
    resetProfile(save, 4);
    expect(save.profiles[other.id]).toBe(other);
    expect(Object.keys(save.profiles)).toHaveLength(2);
  });
});

const ava = { name: 'Ava', shop: { name: "Ava's Rainbow Scoops", keeper: 'bonbon' } };

describe('players', () => {
  it('adds a player with their own shop and makes them the one playing', () => {
    const save = createSaveFile(1);
    const p = addPlayer(save, ava, 10)!;
    expect(save.activeProfileId).toBe(p.id);
    expect(p).toMatchObject({ displayName: 'Ava', sprinkles: 0, ownedItems: [], lastPlayedAt: 10 });
    expect(p.shop).toEqual(ava.shop);
    expect(Object.keys(save.profiles)).toHaveLength(2);
    expect(validateSaveFile(save)).toEqual([]);
  });

  it('gives players added in the same moment different ids', () => {
    const save = createSaveFile(1);
    const a = addPlayer(save, ava, 10)!;
    const b = addPlayer(save, { ...ava, name: 'Leo' }, 10)!;
    expect(a.id).not.toBe(b.id);
  });

  it('tidies names and refuses blank ones or a full device', () => {
    const save = createSaveFile(1);
    expect(addPlayer(save, { ...ava, name: '   ' }, 2)).toBeNull();
    expect(addPlayer(save, { ...ava, shop: { name: '', keeper: 'kiki' } }, 2)).toBeNull();
    const p = addPlayer(save, { ...ava, name: '  Mia   Rose  ' }, 2)!;
    expect(p.displayName).toBe('Mia Rose');
    const config = { ...GAME_CONFIG.players, maxPlayers: 2 };
    expect(canAddPlayer(save, config)).toBe(false);
    expect(addPlayer(save, ava, 3, config)).toBeNull();
    expect(cleanName('Alexandrina-Rose', 12)).toBe('Alexandrina-');
  });

  it('puts whoever played most recently first, and choosing a player marks them as just played', () => {
    const save = createSaveFile(1);
    const first = save.activeProfileId;
    const leo = addPlayer(save, { ...ava, name: 'Leo' }, 5)!;
    expect(playersInOrder(save).map((p) => p.id)).toEqual([leo.id, first]);
    expect(choosePlayer(save, first, 9)!.lastPlayedAt).toBe(9);
    expect(save.activeProfileId).toBe(first);
    expect(playersInOrder(save).map((p) => p.id)).toEqual([first, leo.id]);
    expect(choosePlayer(save, 'nobody', 10)).toBeNull();
    expect(save.activeProfileId).toBe(first);
  });

  it('removes a player and hands over to whoever played last, but never the last player', () => {
    const save = createSaveFile(1);
    const first = save.activeProfileId;
    const leo = addPlayer(save, { ...ava, name: 'Leo' }, 5)!;
    expect(removePlayer(save, 'nobody')).toBe(false);
    expect(removePlayer(save, leo.id)).toBe(true);
    expect(save.activeProfileId).toBe(first);
    expect(removePlayer(save, first)).toBe(false);
    expect(validateSaveFile(save)).toEqual([]);
  });

  it('changes a name, shop name or shopkeeper, ignoring blanks', () => {
    const save = createSaveFile(1);
    const p = addPlayer(save, ava, 2)!;
    updatePlayer(p, { shopName: '  Sugar   Cloud ', keeper: 'kiki' });
    expect(p.shop).toEqual({ name: 'Sugar Cloud', keeper: 'kiki' });
    updatePlayer(p, { name: ' ', shopName: '' });
    expect(p.displayName).toBe('Ava');
    expect(p.shop.name).toBe('Sugar Cloud');
    updatePlayer(p, { name: 'Avery' });
    expect(p.displayName).toBe('Avery');
  });

  it('keeps the shop when a player starts over', () => {
    const save = createSaveFile(1);
    addPlayer(save, ava, 2);
    expect(resetProfile(save, 3).shop).toEqual(ava.shop);
  });
});

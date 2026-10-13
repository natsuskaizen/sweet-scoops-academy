import { describe, expect, it } from 'vitest';
import { mathSubject } from '../learning/mathSubject';
import { resetLearning, resetProfile } from '../save/profileActions';
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

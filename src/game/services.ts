/**
 * Wires the Phaser-free core (save system, learning subject) for the game.
 * Scenes read this from the Phaser registry under SERVICES_KEY.
 */
import { GAME_CONFIG } from '../config/gameConfig';
import { createOperations } from '../learning/math/registry';
import { createMathSubject, mathSubject } from '../learning/mathSubject';
import type { ChallengeSpec, LearningSubject } from '../learning/types';
import { MemoryStorage, SaveManager, type LoadResult, type StorageLike } from '../save/saveManager';

export const SERVICES_KEY = 'services';

export interface GameServices {
  saves: SaveManager;
  load: LoadResult;
  /** False when the browser blocks localStorage (e.g. some private modes). */
  persistent: boolean;
  /** The subject the shop is practising. Swap here to play a different subject. */
  subject: LearningSubject<ChallengeSpec, unknown>;
}

function browserStorage(): StorageLike | null {
  try {
    const probe = '__sweet_scoops_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The subject to play. In development, `?ops=addition,subtraction` tries other
 * operations without editing GAME_CONFIG.
 */
function chooseSubject(): LearningSubject<ChallengeSpec, unknown> {
  const ops = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('ops') : null;
  if (!ops) return mathSubject;
  return createMathSubject({
    operations: createOperations({ ...GAME_CONFIG.math, enabledOperations: ops.split(',') }),
  });
}

export function createServices(): GameServices {
  const storage = browserStorage();
  const saves = new SaveManager(storage ?? new MemoryStorage());
  let load: LoadResult;
  try {
    load = saves.load();
  } catch {
    // Storage is full and the old save could not be quarantined: play this
    // session in memory rather than risk overwriting it.
    const memory = new SaveManager(new MemoryStorage());
    return { saves: memory, load: memory.load(), persistent: false, subject: chooseSubject() };
  }
  return { saves, load, persistent: storage !== null, subject: chooseSubject() };
}

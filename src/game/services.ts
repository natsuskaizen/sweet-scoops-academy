/**
 * Wires the Phaser-free core (save system, learning subject) for the game.
 * Scenes read this from the Phaser registry under SERVICES_KEY.
 */
import { mathSubject } from '../learning/mathSubject';
import { MemoryStorage, SaveManager, type LoadResult, type StorageLike } from '../save/saveManager';

export const SERVICES_KEY = 'services';

export interface GameServices {
  saves: SaveManager;
  load: LoadResult;
  /** False when the browser blocks localStorage (e.g. some private modes). */
  persistent: boolean;
  subject: typeof mathSubject;
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
    return { saves: memory, load: memory.load(), persistent: false, subject: mathSubject };
  }
  return { saves, load, persistent: storage !== null, subject: mathSubject };
}

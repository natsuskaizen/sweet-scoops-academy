/**
 * Wires the Phaser-free core (save system, learning subject) for the game.
 * Scenes read this from the Phaser registry under SERVICES_KEY.
 */
import { GAME_CONFIG } from '../config/gameConfig';
import { createOperations } from '../learning/math/registry';
import { subjectForGrade } from '../learning/grades';
import { createMathSubject } from '../learning/mathSubject';
import type { ChallengeSpec, LearningSubject } from '../learning/types';
import { CharacterLibrary } from '../save/characterLibrary';
import { MemoryStorage, SaveManager, type LoadResult, type LoadStatus, type StorageLike } from '../save/saveManager';
import type { Profile, SaveFile } from '../save/saveTypes';

export const SERVICES_KEY = 'services';

type Subject = LearningSubject<ChallengeSpec, unknown>;

export type GameStage = 'setup' | 'start' | 'play';

export interface GameServices {
  saves: SaveManager;
  /** The game being played. Whatever replaces it (a backup, a reset) also writes it through `saves`. */
  save: SaveFile;
  /** How the save was found at startup, until the shop has told the player (then null). */
  loadNotice: LoadStatus | null;
  /** False when the browser blocks localStorage (e.g. some private modes). */
  persistent: boolean;
  /** The subject a player practises, from their grade and math mode. Swap here to play a different subject. */
  subjectFor: (profile: Profile) => Subject;
  /** False when a developer's `?ops=` plays fixed operations, so there is no game to pick. */
  picksGame: boolean;
  /** Set when a child has just picked a game, so the restarted shop starts that round without asking again. */
  justPicked?: boolean;
  /** Characters a grown-up added on this device. */
  characters: CharacterLibrary;
  /**
   * Where the shop is: setting up a brand new game's first player, on the
   * start screen choosing who plays, or playing. Kept here so rotating the
   * screen (which restarts the scene) stays put.
   */
  stage: GameStage;
  /** Set when changing the shop name or shopkeeper finishes, so My shop opens again once the shop is rebuilt. */
  reopenMyShop?: boolean;
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
 * Each player's subject comes from their grade. In development,
 * `?ops=addition,subtraction` plays those operations for everyone instead,
 * without editing GAME_CONFIG.
 */
const devOps = (): string | null =>
  import.meta.env.DEV ? new URLSearchParams(window.location.search).get('ops') : null;

function chooseSubject(): (profile: Profile) => Subject {
  const ops = devOps();
  if (!ops) return (profile) => subjectForGrade(profile.settings);
  const subject = createMathSubject({
    operations: createOperations({ ...GAME_CONFIG.math, enabledOperations: ops.split(',') }),
  });
  return () => subject;
}

const fromLoad = (load: LoadResult) => ({
  save: load.save,
  loadNotice: load.status,
  stage: (load.status === 'fresh' ? 'setup' : 'start') as GameStage,
});

export function createServices(): GameServices {
  const storage = browserStorage();
  const saves = new SaveManager(storage ?? new MemoryStorage());
  let load: LoadResult;
  try {
    load = saves.load();
  } catch {
    // Storage is full and the old save could not be quarantined: play this
    // session in memory rather than risk overwriting it.
    const memory = new MemoryStorage();
    const saves = new SaveManager(memory);
    const characters = new CharacterLibrary(memory);
    return {
      ...fromLoad(saves.load()),
      saves,
      persistent: false,
      picksGame: !devOps(),
      subjectFor: chooseSubject(),
      characters,
    };
  }
  const characters = new CharacterLibrary(storage ?? new MemoryStorage());
  return {
    ...fromLoad(load),
    saves,
    persistent: storage !== null,
    picksGame: !devOps(),
    subjectFor: chooseSubject(),
    characters,
  };
}

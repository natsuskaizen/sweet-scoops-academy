/**
 * Local save system.
 *
 *   primary  - the live save, written after every meaningful change
 *   backup   - the previous known-good primary, refreshed on each write
 *   quarantine.<time> - raw copies of anything unreadable, never overwritten
 *
 * Nothing invalid is ever loaded, and nothing recoverable is ever silently
 * overwritten: bad data is copied to quarantine before the game moves on.
 */
import { GAME_CONFIG } from '../config/gameConfig';
import { mathSubject } from '../learning/mathSubject';
import { randomSeed } from '../core/rng';
import { migrateToVersion } from './migrations';
import { SAVE_SCHEMA_VERSION, type Profile, type SaveFile, type ShopDetails } from './saveTypes';
import { dropUnplayableRounds, validateSaveFile } from './saveValidation';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

export const SAVE_KEYS = {
  primary: 'sweet-scoops-academy.save',
  backup: 'sweet-scoops-academy.save.backup',
  quarantinePrefix: 'sweet-scoops-academy.save.quarantine.',
} as const;

export type LoadStatus =
  | 'fresh' // no save existed
  | 'loaded' // primary was valid
  | 'restored-from-backup' // primary was bad, backup was good
  | 'reset-after-corrupt'; // nothing usable; bad data quarantined, new save created

export interface LoadResult {
  save: SaveFile;
  status: LoadStatus;
  problems: string[];
}

export type WriteResult = { ok: true } | { ok: false; error: string };

export type Parsed = { ok: true; save: SaveFile } | { ok: false; problems: string[] };

export function createProfile(
  displayName: string,
  now: number,
  seed = randomSeed(),
  shop: ShopDetails = GAME_CONFIG.players.defaultShop,
): Profile {
  return {
    id: `p-${now.toString(36)}-${(seed % 46656).toString(36)}`,
    displayName,
    createdAt: now,
    lastPlayedAt: now,
    shop: { ...shop },
    sprinkles: 0,
    lifetimeSprinkles: 0,
    ownedItems: [],
    equipped: {},
    decorations: [],
    learning: { seed, roundsStarted: 0, math: mathSubject.createProgress() },
    currentRound: null,
    roundHistory: [],
    dailyLog: {},
    achievements: [],
    settings: { showHints: true, reduceMotion: false, dailyGoal: GAME_CONFIG.calendar.defaultDailyGoal },
  };
}

export function createSaveFile(
  now: number,
  profile = createProfile(GAME_CONFIG.players.firstPlayerName, now),
): SaveFile {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: now,
    activeProfileId: profile.id,
    profiles: { [profile.id]: profile },
  };
}

/** Upgrades older saves in place (steps live in migrations.ts), drops rounds that can't be resumed, then validates. */
function migrate(data: Record<string, unknown>): Parsed {
  const version = data.schemaVersion;
  if (typeof version !== 'number') return { ok: false, problems: ['schemaVersion missing'] };
  if (version > SAVE_SCHEMA_VERSION) {
    return { ok: false, problems: [`save is from a newer game version (${version})`] };
  }
  if (!migrateToVersion(data, SAVE_SCHEMA_VERSION)) {
    return { ok: false, problems: [`no migration from save version ${version}`] };
  }
  dropUnplayableRounds(data);
  const problems = validateSaveFile(data);
  return problems.length === 0 ? { ok: true, save: data as unknown as SaveFile } : { ok: false, problems };
}

/** Reads save JSON from any source (storage or a backup file): parse, migrate, validate. */
export function parseSave(raw: string): Parsed {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, problems: ['not valid JSON'] };
  }
  if (typeof data !== 'object' || data === null) return { ok: false, problems: ['not an object'] };
  return migrate(data as Record<string, unknown>);
}

export class SaveManager {
  constructor(
    private readonly storage: StorageLike,
    private readonly now: () => number = () => Date.now(),
  ) {}

  load(): LoadResult {
    const primaryRaw = this.read(SAVE_KEYS.primary);
    if (primaryRaw === null) {
      const backup = this.tryBackup();
      if (backup) return { save: backup, status: 'restored-from-backup', problems: ['primary save missing'] };
      const save = createSaveFile(this.now());
      this.write(save);
      return { save, status: 'fresh', problems: [] };
    }

    const primary = parseSave(primaryRaw);
    if (primary.ok) return { save: primary.save, status: 'loaded', problems: [] };

    // Keep the unreadable data before doing anything else.
    this.quarantine(primaryRaw);
    const backup = this.tryBackup();
    if (backup) {
      this.storage.setItem(SAVE_KEYS.primary, JSON.stringify(backup));
      return { save: backup, status: 'restored-from-backup', problems: primary.problems };
    }

    const save = createSaveFile(this.now());
    this.storage.setItem(SAVE_KEYS.primary, JSON.stringify(save));
    return { save, status: 'reset-after-corrupt', problems: primary.problems };
  }

  /** Validates, rotates the previous good save into the backup slot, then writes. */
  write(save: SaveFile): WriteResult {
    save.schemaVersion = SAVE_SCHEMA_VERSION;
    save.savedAt = this.now();
    const problems = validateSaveFile(save);
    if (problems.length > 0) return { ok: false, error: `refusing to write invalid save: ${problems[0]}` };

    try {
      const previous = this.read(SAVE_KEYS.primary);
      if (previous !== null && parseSave(previous).ok) {
        this.storage.setItem(SAVE_KEYS.backup, previous);
      }
      this.storage.setItem(SAVE_KEYS.primary, JSON.stringify(save));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `storage write failed: ${String(err)}` };
    }
  }

  /** Parent action: replace the live save with the backup copy (live copy is quarantined first). */
  restoreBackup(): SaveFile | null {
    const backup = this.tryBackup();
    if (!backup) return null;
    const current = this.read(SAVE_KEYS.primary);
    if (current !== null) this.quarantine(current);
    this.storage.setItem(SAVE_KEYS.primary, JSON.stringify(backup));
    return backup;
  }

  /** Parent action: replace the live save with an imported one (live copy is quarantined first). */
  replaceWith(save: SaveFile): WriteResult {
    const problems = validateSaveFile(save);
    if (problems.length > 0) return { ok: false, error: `refusing to import invalid save: ${problems[0]}` };
    const current = this.read(SAVE_KEYS.primary);
    try {
      if (current !== null) this.quarantine(current);
    } catch (err) {
      return { ok: false, error: String(err) };
    }
    return this.write(save);
  }

  hasBackup(): boolean {
    return this.tryBackup() !== null;
  }

  quarantineKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(SAVE_KEYS.quarantinePrefix)) keys.push(key);
    }
    return keys.sort();
  }

  private tryBackup(): SaveFile | null {
    const raw = this.read(SAVE_KEYS.backup);
    if (raw === null) return null;
    const parsed = parseSave(raw);
    return parsed.ok ? parsed.save : null;
  }

  private quarantine(raw: string): void {
    let key = `${SAVE_KEYS.quarantinePrefix}${this.now()}`;
    for (let n = 1; this.read(key) !== null; n++) key = `${SAVE_KEYS.quarantinePrefix}${this.now()}-${n}`;
    try {
      this.storage.setItem(key, raw);
    } catch {
      // Storage full: leave the primary untouched rather than lose it.
      throw new Error('Could not preserve unreadable save data; refusing to overwrite it.');
    }
  }

  private read(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }
}

/** In-memory StorageLike for tests and for browsers with storage disabled. */
export class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

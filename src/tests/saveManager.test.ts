import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import type { ChallengeSpec } from '../learning/types';
import { MemoryStorage, SAVE_KEYS, SaveManager, createSaveFile, parseSave } from '../save/saveManager';
import { migrateToVersion } from '../save/migrations';
import { SAVE_SCHEMA_VERSION, type SaveFile } from '../save/saveTypes';
import { validateSaveFile } from '../save/saveValidation';

let clock = 1_700_000_000_000;
const now = () => ++clock;

function setup() {
  const storage = new MemoryStorage();
  return { storage, saves: new SaveManager(storage, now) };
}

describe('SaveManager', () => {
  it('creates a fresh versioned save when none exists', () => {
    const { storage, saves } = setup();
    const { save, status } = saves.load();
    expect(status).toBe('fresh');
    expect(save.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(validateSaveFile(save)).toEqual([]);
    expect(storage.getItem(SAVE_KEYS.primary)).not.toBeNull();
  });

  it('round-trips progress across a "reload"', () => {
    const { storage, saves } = setup();
    const { save } = saves.load();
    const profile = save.profiles[save.activeProfileId]!;
    profile.sprinkles = 42;
    profile.lifetimeSprinkles = 42;
    expect(saves.write(save)).toEqual({ ok: true });

    const reloaded = new SaveManager(storage, now).load();
    expect(reloaded.status).toBe('loaded');
    expect(reloaded.save.profiles[save.activeProfileId]!.sprinkles).toBe(42);
  });

  it('keeps the previous good save as a backup', () => {
    const { storage, saves } = setup();
    const { save } = saves.load();
    const p = save.profiles[save.activeProfileId]!;
    p.sprinkles = p.lifetimeSprinkles = 10;
    saves.write(save);
    p.sprinkles = p.lifetimeSprinkles = 20;
    saves.write(save);
    const backup = JSON.parse(storage.getItem(SAVE_KEYS.backup)!);
    expect(backup.profiles[save.activeProfileId].sprinkles).toBe(10);
  });

  it('restores from backup and quarantines a corrupt primary instead of overwriting it', () => {
    const { storage, saves } = setup();
    const { save } = saves.load();
    const p = save.profiles[save.activeProfileId]!;
    p.sprinkles = p.lifetimeSprinkles = 30;
    saves.write(save);
    saves.write(save); // backup now holds the 30-sprinkle save

    storage.setItem(SAVE_KEYS.primary, '{"schemaVersion":1, "profiles": oops');
    const result = new SaveManager(storage, now).load();
    expect(result.status).toBe('restored-from-backup');
    expect(result.save.profiles[save.activeProfileId]!.sprinkles).toBe(30);

    const quarantined = new SaveManager(storage, now).quarantineKeys();
    expect(quarantined).toHaveLength(1);
    expect(storage.getItem(quarantined[0]!)).toContain('oops');
  });

  it('rejects structurally invalid data even when it is valid JSON', () => {
    const { storage, saves } = setup();
    const bad = createSaveFile(1);
    (bad.profiles[bad.activeProfileId] as unknown as { sprinkles: number }).sprinkles = -5;
    storage.setItem(SAVE_KEYS.primary, JSON.stringify(bad));
    const result = saves.load();
    expect(result.status).toBe('reset-after-corrupt');
    expect(result.problems.join()).toMatch(/sprinkles/);
    expect(saves.quarantineKeys()).toHaveLength(1);
  });

  it('drops a saved round the rules no longer allow, and keeps the rest of the save', () => {
    const { storage, saves } = setup();
    const save = createSaveFile(1);
    const p = save.profiles[save.activeProfileId]!;
    p.sprinkles = 42;
    p.lifetimeSprinkles = 42;
    p.currentRound = {
      id: 'r1',
      roundNumber: 1,
      seed: 1,
      startedAt: 1,
      playMs: 0,
      lastActiveAt: 1,
      currentIndex: 0,
      bonusPaid: false,
      bonus: null,
      orders: [
        {
          spec: {
            subjectId: 'math',
            skillId: 'division',
            factKey: 'div:99/9',
            left: 99,
            right: 9,
            answer: 11,
          } as ChallengeSpec,
          customerId: 'berry',
          attempts: 0,
          outcome: null,
          paid: false,
          sprinklesPaid: 0,
        },
      ],
    };
    storage.setItem(SAVE_KEYS.primary, JSON.stringify(save));
    const loaded = saves.load();
    expect(loaded.status).toBe('loaded');
    const profile = loaded.save.profiles[save.activeProfileId]!;
    expect(profile.currentRound).toBeNull();
    expect(profile.sprinkles).toBe(42);
  });

  it('does not load or overwrite a save from a newer game version', () => {
    const { storage, saves } = setup();
    const future = { ...createSaveFile(1), schemaVersion: SAVE_SCHEMA_VERSION + 1 };
    const raw = JSON.stringify(future);
    storage.setItem(SAVE_KEYS.primary, raw);
    const result = saves.load();
    expect(result.status).toBe('reset-after-corrupt');
    expect(result.problems[0]).toMatch(/newer/);
    expect(storage.getItem(saves.quarantineKeys()[0]!)).toBe(raw);
  });

  it('refuses to write invalid data', () => {
    const { saves } = setup();
    const { save } = saves.load();
    save.activeProfileId = 'missing';
    expect(saves.write(save).ok).toBe(false);
  });

  it('lets a parent restore the backup, keeping the live copy in quarantine', () => {
    const { saves } = setup();
    const { save } = saves.load();
    const p = save.profiles[save.activeProfileId]!;
    p.sprinkles = p.lifetimeSprinkles = 5;
    saves.write(save);
    p.sprinkles = p.lifetimeSprinkles = 9;
    saves.write(save);
    const restored = saves.restoreBackup();
    expect(restored!.profiles[save.activeProfileId]!.sprinkles).toBe(5);
    expect(saves.quarantineKeys()).toHaveLength(1);
  });

  it('upgrades a version 1 save: older rounds keep their results but have no time', () => {
    const v1 = {
      ...createSaveFile(1),
      schemaVersion: 1,
    };
    const p = v1.profiles[v1.activeProfileId]!;
    const { roundHistory, currentRound } = {
      roundHistory: [
        { roundNumber: 1, finishedAt: 5000, ordersCompleted: 10, firstTryCorrect: 9, retryCorrect: 1, missed: 0 },
      ].map((r) => ({ ...r, orderSprinkles: 95, completionBonus: 10, perfectBonus: 0, total: 105, perfect: false })),
      currentRound: {
        id: 'r2',
        roundNumber: 2,
        seed: 1,
        startedAt: 6000,
        currentIndex: 0,
        bonusPaid: false,
        bonus: null,
      },
    };
    const order = { customerId: 'berry', attempts: 0, outcome: null, paid: false, sprinklesPaid: 0 };
    const spec = { subjectId: 'math', skillId: 'multiplication', factKey: 'mul:2x3', left: 2, right: 3, answer: 6 };
    Object.assign(p, { roundHistory, currentRound: { ...currentRound, orders: [{ ...order, spec }] } });

    const parsed = parseSave(JSON.stringify(v1));
    if (!parsed.ok) throw new Error(parsed.problems.join());
    expect(parsed.save.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    const profile = parsed.save.profiles[parsed.save.activeProfileId]!;
    expect(profile.roundHistory[0]).toMatchObject({
      total: 105,
      startedAt: null,
      playMs: null,
      retryFacts: [],
      missFacts: [],
    });
    expect(profile.currentRound).toMatchObject({ playMs: null, lastActiveAt: 6000 });
  });

  it('upgrades a version 2 save: the calendar is rebuilt from round history', () => {
    const v2 = { ...createSaveFile(1), schemaVersion: 2 };
    const p = v2.profiles[v2.activeProfileId]! as unknown as Record<string, unknown> & { settings: object };
    const finished = (hour: number, playMs: number | null) => ({
      ...{ roundNumber: 1, startedAt: null, finishedAt: new Date(2026, 9, 12, hour).getTime(), playMs },
      ...{ ordersCompleted: 10, firstTryCorrect: 10, retryCorrect: 0, missed: 0, orderSprinkles: 100 },
      ...{ completionBonus: 10, perfectBonus: 50, total: 160, perfect: true, retryFacts: [], missFacts: [] },
    });
    p.roundHistory = [finished(9, 60_000), finished(10, null), finished(11, 120_000)];
    delete p.dailyLog;
    p.settings = { showHints: true, reduceMotion: false };

    const parsed = parseSave(JSON.stringify(v2));
    if (!parsed.ok) throw new Error(parsed.problems.join());
    const profile = parsed.save.profiles[parsed.save.activeProfileId]!;
    expect(profile.settings.dailyGoal).toBe(GAME_CONFIG.calendar.defaultDailyGoal);
    expect(profile.dailyLog).toEqual({
      '2026-10-12': { rounds: 3, playMs: 180_000, subjects: { math: 3 }, heart: true },
    });
  });

  it('rejects a calendar log or daily goal that is malformed', () => {
    const save = createSaveFile(1);
    const p = save.profiles[save.activeProfileId]!;
    p.settings.dailyGoal = 0;
    p.dailyLog = { yesterday: { rounds: 1 } as never, '2026-10-12': 'oops' as never };
    expect(validateSaveFile(save).map((problem) => problem.replace(/^profiles\[[^\]]+\]\./, ''))).toEqual([
      'settings.dailyGoal invalid',
      'dailyLog[yesterday] not a date',
      'dailyLog[yesterday].playMs invalid',
      'dailyLog[yesterday].heart invalid',
      'dailyLog[yesterday].subjects invalid',
      'dailyLog[2026-10-12] not an object',
    ]);
    p.dailyLog = [] as never;
    expect(validateSaveFile(save).join()).toContain('dailyLog invalid');
  });

  it('upgrades a version 3 save: each player keeps Sweet Scoops with Momo and last played at their last round', () => {
    const v3 = createSaveFile(1000) as unknown as Record<string, unknown> & SaveFile;
    v3.schemaVersion = 3;
    const p = v3.profiles[v3.activeProfileId]! as unknown as Record<string, unknown>;
    delete p.shop;
    delete p.lastPlayedAt;
    p.roundHistory = [3000, 9000].map((finishedAt, i) => ({
      ...{ roundNumber: i + 1, startedAt: null, playMs: null, ordersCompleted: 10, firstTryCorrect: 10 },
      ...{ retryCorrect: 0, missed: 0, orderSprinkles: 100, completionBonus: 10, perfectBonus: 5, total: 115 },
      ...{ perfect: true, retryFacts: [], missFacts: [], finishedAt },
    }));

    const parsed = parseSave(JSON.stringify(v3));
    if (!parsed.ok) throw new Error(parsed.problems.join());
    const profile = parsed.save.profiles[parsed.save.activeProfileId]!;
    expect(profile.shop).toEqual({ name: 'Sweet Scoops', keeper: 'momo' });
    expect(profile.lastPlayedAt).toBe(9000);
  });

  it('upgrades a version 4 save: every player practises 3rd grade multiplication and division', () => {
    const v4 = createSaveFile(1000);
    v4.schemaVersion = 4;
    const settings = v4.profiles[v4.activeProfileId]!.settings as unknown as Record<string, unknown>;
    delete settings.grade;
    delete settings.mathMode;

    const parsed = parseSave(JSON.stringify(v4));
    if (!parsed.ok) throw new Error(parsed.problems.join());
    expect(parsed.save.profiles[v4.activeProfileId]!.settings).toMatchObject({ grade: 'grade3', mathMode: 'mixed' });
  });

  it('rejects a player with no grade, but loads a grade this game does not know', () => {
    const save = createSaveFile(1);
    const settings = save.profiles[save.activeProfileId]!.settings;
    settings.grade = 'grade7';
    expect(validateSaveFile(save)).toEqual([]);
    settings.grade = '';
    settings.mathMode = 3 as never;
    expect(validateSaveFile(save).map((problem) => problem.replace(/^profiles\[[^\]]+\]\./, ''))).toEqual([
      'settings.grade invalid',
      'settings.mathMode invalid',
    ]);
  });

  it('rejects a player whose shop has no name', () => {
    const save = createSaveFile(1);
    save.profiles[save.activeProfileId]!.shop.name = '  ';
    expect(validateSaveFile(save).join()).toMatch(/shop invalid/);
  });

  it('refuses a save whose version has no migration step', () => {
    expect(migrateToVersion({ schemaVersion: 0 }, SAVE_SCHEMA_VERSION)).toBe(false);
    expect(parseSave(JSON.stringify({ ...createSaveFile(1), schemaVersion: 0 }))).toMatchObject({ ok: false });
  });

  it('rejects round history with a malformed play time', () => {
    const save = createSaveFile(1);
    const p = save.profiles[save.activeProfileId]!;
    p.roundHistory = [{ playMs: -1 } as never, 'oops' as never];
    const problems = validateSaveFile(save).join();
    expect(problems).toMatch(/roundHistory\[0\]\.playMs invalid/);
    expect(problems).toMatch(/roundHistory\[1\] not an object/);
    (p as unknown as { roundHistory: unknown }).roundHistory = 'none';
    expect(validateSaveFile(save).join()).toMatch(/roundHistory invalid/);
  });
});

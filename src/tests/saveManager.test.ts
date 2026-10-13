import { describe, expect, it } from 'vitest';
import type { ChallengeSpec } from '../learning/types';
import { MemoryStorage, SAVE_KEYS, SaveManager, createSaveFile, parseSave } from '../save/saveManager';
import { migrateToVersion } from '../save/migrations';
import { SAVE_SCHEMA_VERSION } from '../save/saveTypes';
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

  it('rejects saved rounds containing invalid questions', () => {
    const { storage, saves } = setup();
    const save = createSaveFile(1);
    const p = save.profiles[save.activeProfileId]!;
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
    expect(saves.load().status).toBe('reset-after-corrupt');
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

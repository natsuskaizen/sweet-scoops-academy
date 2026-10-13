import { describe, expect, it } from 'vitest';
import { backupFileName, describeBackup, exportBackup, readBackup } from '../save/backup';
import { MemoryStorage, SAVE_KEYS, SaveManager, createSaveFile } from '../save/saveManager';

let clock = 1_700_000_000_000;
const now = () => ++clock;

function savedGame(sprinkles: number) {
  const storage = new MemoryStorage();
  const saves = new SaveManager(storage, now);
  const { save } = saves.load();
  const p = save.profiles[save.activeProfileId]!;
  p.sprinkles = p.lifetimeSprinkles = sprinkles;
  saves.write(save);
  return { storage, saves, save };
}

describe('backup files', () => {
  it('round-trips a save through export and import', () => {
    const { save } = savedGame(42);
    const parsed = readBackup(exportBackup(save));
    expect(parsed).toEqual({ ok: true, save });
  });

  it('refuses files that are not a valid save', () => {
    expect(readBackup('not json')).toEqual({ ok: false, problems: ['not valid JSON'] });
    expect(readBackup('[1, 2]').ok).toBe(false);
    expect(readBackup('{"schemaVersion": 1}').ok).toBe(false);
  });

  it('refuses a backup from a newer game version', () => {
    const { save } = savedGame(5);
    const parsed = readBackup(exportBackup({ ...save, schemaVersion: 99 }));
    expect(parsed).toEqual({ ok: false, problems: ['save is from a newer game version (99)'] });
  });

  it('names files by date and describes what a backup holds', () => {
    expect(backupFileName(Date.UTC(2026, 9, 13, 12))).toBe('sweet-scoops-backup-2026-10-13.json');
    const { save } = savedGame(70);
    expect(describeBackup(save)).toMatch(/^Player 1, saved .+: 70 Sprinkles, 0 rounds finished\.$/);
  });
});

describe('SaveManager.replaceWith', () => {
  it('replaces the live save and keeps the old one in quarantine', () => {
    const { storage, saves, save: current } = savedGame(10);
    const imported = createSaveFile(now());
    expect(saves.replaceWith(imported)).toEqual({ ok: true });

    const reloaded = new SaveManager(storage, now).load();
    expect(reloaded.save.activeProfileId).toBe(imported.activeProfileId);
    const kept = saves.quarantineKeys().map((k) => JSON.parse(storage.getItem(k)!));
    expect(kept.map((s) => s.activeProfileId)).toContain(current.activeProfileId);
    expect(storage.getItem(SAVE_KEYS.backup)).not.toBeNull();
  });

  it('refuses an invalid save without touching the live one', () => {
    const { storage, saves } = savedGame(10);
    const before = storage.getItem(SAVE_KEYS.primary);
    const broken = { ...createSaveFile(now()), activeProfileId: 'nobody' };
    expect(saves.replaceWith(broken).ok).toBe(false);
    expect(storage.getItem(SAVE_KEYS.primary)).toBe(before);
    expect(saves.quarantineKeys()).toEqual([]);
  });
});

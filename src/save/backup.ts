/**
 * Backup files: the whole save as pretty JSON, so a parent can keep a copy
 * outside the browser and bring it back after Safari clears site data or on
 * a new device. Importing goes through the same parse, migrate and validate
 * steps as loading from storage, so a bad file is refused before it can
 * replace anything.
 */
import { parseSave, type Parsed } from './saveManager';
import type { SaveFile } from './saveTypes';

export const BACKUP_MIME = 'application/json';

export function backupFileName(now: number): string {
  return `sweet-scoops-backup-${new Date(now).toISOString().slice(0, 10)}.json`;
}

export function exportBackup(save: SaveFile): string {
  return `${JSON.stringify(save, null, 2)}\n`;
}

export function readBackup(raw: string): Parsed {
  return parseSave(raw);
}

/** What the restore confirmation shows, so a parent can tell backups apart. */
export function describeBackup(save: SaveFile): string {
  const p = save.profiles[save.activeProfileId]!;
  const saved = new Date(save.savedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return `${p.displayName}, saved ${saved}: ${p.sprinkles} Sprinkles, ${p.roundHistory.length} rounds finished.`;
}

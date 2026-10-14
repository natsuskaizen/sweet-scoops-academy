/**
 * Backup files: the whole save as pretty JSON, so a parent can keep a copy
 * outside the browser and bring it back after Safari clears site data or on
 * a new device. Importing goes through the same parse, migrate and validate
 * steps as loading from storage, so a bad file is refused before it can
 * replace anything.
 */
import type { AddedCharacter } from '../shop/addedCharacters';
import { readCharacterList } from './characterLibrary';
import { playersInOrder, playerStats } from './profileActions';
import { parseSave } from './saveManager';
import type { SaveFile } from './saveTypes';

/** A backup file is the save plus, when there are any, the characters added on that device. */
export type BackupContents =
  { ok: true; save: SaveFile; characters: AddedCharacter[] } | { ok: false; problems: string[] };

export const BACKUP_MIME = 'application/json';

export function backupFileName(now: number): string {
  return `sweet-scoops-backup-${new Date(now).toISOString().slice(0, 10)}.json`;
}

export function exportBackup(save: SaveFile, characters: readonly AddedCharacter[] = []): string {
  const contents = characters.length > 0 ? { ...save, addedCharacters: characters } : save;
  return `${JSON.stringify(contents, null, 2)}\n`;
}

/** Added characters that fail their checks are left out; the rest of the backup still loads. */
export function readBackup(raw: string): BackupContents {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, problems: ['not valid JSON'] };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return parseSave(raw) as BackupContents;
  const { addedCharacters, ...save } = data as Record<string, unknown>;
  const parsed = parseSave(JSON.stringify(save));
  if (!parsed.ok) return parsed;
  return { ...parsed, characters: readCharacterList(addedCharacters).characters };
}

/** What the restore confirmation shows, so a parent can tell backups apart. */
export function describeBackup(save: SaveFile, characters: readonly AddedCharacter[] = []): string {
  const saved = new Date(save.savedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const added =
    characters.length > 0 ? ` ${characters.length} added character${characters.length === 1 ? '' : 's'}.` : '';
  const players = playersInOrder(save).map((p) => `${p.displayName}: ${playerStats(p)}.`);
  return `Saved ${saved}. ${players.join(' ')}${added}`;
}

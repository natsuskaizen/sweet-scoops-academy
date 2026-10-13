/**
 * Grown-ups area actions for backup files: save the whole game to a file, and
 * load one back after checking it and asking for confirmation.
 */
import type { GameServices } from '../game/services';
import { backupFileName, describeBackup, exportBackup, readBackup } from '../save/backup';
import { pickBackupFile, saveBackupFile } from '../game/backupTransfer';
import type { SaveFile } from '../save/saveTypes';
import type { ParentAction, ParentGate } from '../ui/ParentGate';

export function backupActions(services: GameServices, onRestored: () => void): ParentAction[] {
  return [
    { label: 'Save a backup file', enabled: true, run: (gate) => void saveBackup(services, gate) },
    { label: 'Load a backup file', enabled: true, run: (gate) => void loadBackup(services, gate, onRestored) },
  ];
}

async function saveBackup(services: GameServices, gate: ParentGate): Promise<void> {
  const { save } = services.load;
  try {
    await saveBackupFile(backupFileName(Date.now()), exportBackup(save));
    gate.notice('Backup saved', 'Keep the file somewhere safe, like Files or iCloud Drive.');
  } catch (err) {
    gate.notice('Backup not saved', `Something went wrong: ${String(err)}`);
  }
}

async function loadBackup(services: GameServices, gate: ParentGate, onRestored: () => void): Promise<void> {
  const picked = await pickBackupFile();
  if (picked === null) return;
  if (!picked.ok) return gate.notice('Backup not loaded', picked.error);
  const parsed = readBackup(picked.text);
  if (!parsed.ok)
    return gate.notice('Backup not loaded', `That file is not a Sweet Scoops backup (${parsed.problems[0]}).`);
  gate.ask(restoreAction(services, parsed.save, onRestored));
}

function restoreAction(services: GameServices, save: SaveFile, onRestored: () => void): ParentAction {
  return {
    label: 'Load this backup?',
    confirm: `${describeBackup(save)}\n\nThis replaces the progress on this device. The current progress is kept aside, not deleted.`,
    enabled: true,
    run: (gate) => {
      const result = services.saves.replaceWith(save);
      if (!result.ok) return gate.notice('Backup not loaded', result.error);
      services.load = { save, status: 'loaded', problems: [] };
      onRestored();
    },
  };
}

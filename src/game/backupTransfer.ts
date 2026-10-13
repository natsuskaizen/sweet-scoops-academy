/**
 * Moves backup files in and out of the browser. On iPad and iPhone the share
 * sheet offers "Save to Files", AirDrop and Mail; elsewhere the file downloads.
 */
import { GAME_CONFIG } from '../config/gameConfig';
import { BACKUP_MIME } from '../save/backup';

export type PickResult = { ok: true; text: string } | { ok: false; error: string } | null;

/** Resolves once the file is handed over; rejects only on real failures, not a closed share sheet. */
export async function saveBackupFile(name: string, json: string): Promise<void> {
  const file = new File([json], name, { type: BACKUP_MIME });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return;
      // Some browsers refuse sharing files outright; fall back to a download.
    }
  }
  downloadFile(file);
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Opens the file picker; resolves null if the parent cancels. Must run inside a tap. */
export function pickBackupFile(): Promise<PickResult> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: `${BACKUP_MIME},.json` });
    input.addEventListener('cancel', () => resolve(null));
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      if (file.size > GAME_CONFIG.backup.maxImportBytes)
        return resolve({ ok: false, error: 'That file is too big to be a backup.' });
      file.text().then(
        (text) => resolve({ ok: true, text }),
        () => resolve({ ok: false, error: 'That file could not be read.' }),
      );
    });
    input.click();
  });
}

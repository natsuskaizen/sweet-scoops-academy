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

const PICKER_ATTR = 'data-backup-picker';
const BACKUP_ACCEPT = `${BACKUP_MIME},.json,text/plain,.txt`;

/**
 * Opens the file picker; resolves null if the parent cancels. Must run inside a tap.
 *
 * The input is attached to the page while the picker is open: Safari on iPad and
 * iPhone (most often the Home Screen app) can drop a detached input before the
 * parent picks a file, so the choice never arrives and nothing loads. iOS also
 * greys out files whose type it can't match to `accept`, so plain-text copies
 * of a backup stay pickable; the contents are checked before anything is loaded.
 */
export function pickBackupFile(): Promise<PickResult> {
  document.querySelectorAll(`input[${PICKER_ATTR}]`).forEach((old) => old.remove());
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: BACKUP_ACCEPT, hidden: true });
  input.setAttribute(PICKER_ATTR, '');
  document.body.append(input);
  return new Promise<PickResult>((resolve) => {
    input.addEventListener('cancel', () => resolve(null));
    input.addEventListener('change', () => void readPicked(input.files?.[0]).then(resolve));
    input.click();
  }).finally(() => input.remove());
}

async function readPicked(file: File | undefined): Promise<PickResult> {
  if (!file) return null;
  if (file.size > GAME_CONFIG.backup.maxImportBytes)
    return { ok: false, error: 'That file is too big to be a backup.' };
  try {
    return { ok: true, text: await file.text() };
  } catch {
    return { ok: false, error: 'That file could not be read.' };
  }
}

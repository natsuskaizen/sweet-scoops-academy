/**
 * Grown-ups "Players" screen: everyone who plays on this device, each with
 * their totals, to rename or remove. A plain HTML overlay (like Characters)
 * so renaming uses the device's own keyboard. Children add players on the
 * start screen. The checks and the saving happen in the host.
 */
import { el, openDialog, type Children } from './domDialog';

export interface PlayerRow {
  id: string;
  name: string;
  /** Shop name and totals, in one line. */
  detail: string;
  playing: boolean;
}

export interface PlayersHost {
  rows: () => PlayerRow[];
  maxNameLength: number;
  /** Renames and saves: null when done, or why not. */
  rename: (id: string, name: string) => string | null;
  /** Removes and saves: null when done, or why not. */
  remove: (id: string) => string | null;
  onClose: (changed: boolean) => void;
}

export class PlayersDialog {
  private readonly root: HTMLDivElement;
  private readonly panel = el('div', { className: 'panel' });
  private changed = false;

  constructor(private readonly host: PlayersHost) {
    this.root = openDialog('ssa-players', this.panel);
    this.showList();
  }

  private close(): void {
    this.root.remove();
    this.host.onClose(this.changed);
  }

  private screen(title: string, children: Children): void {
    const close = el('button', { textContent: 'Close', onclick: () => this.close() });
    this.panel.replaceChildren(el('h2', {}, [title, close]), ...children.filter((c): c is Node => c !== null));
  }

  private showList(error = ''): void {
    const rows = this.host.rows();
    this.screen('Players', [
      el('p', { className: 'hint' }, [
        'Each player has their own shop, Sprinkles, items and progress. ',
        'Children add a new player from the start screen.',
      ]),
      ...rows.map((row) => this.row(row, rows.length > 1)),
      error ? el('p', { className: 'error', textContent: error }) : null,
    ]);
  }

  private row(row: PlayerRow, removable: boolean): HTMLElement {
    const rename = el('button', { textContent: 'Rename', onclick: () => this.showRename(row) });
    const remove = el('button', { className: 'warn', textContent: 'Remove', disabled: !removable });
    remove.onclick = () => {
      if (remove.dataset.armed) return this.apply(this.host.remove(row.id));
      remove.dataset.armed = '1';
      remove.textContent = 'Tap again to remove';
    };
    const detail = row.playing ? `${row.detail} · playing now` : row.detail;
    const who = el('div', { className: 'who' }, [row.name, el('small', { textContent: detail })]);
    return el('div', { className: 'row' }, [who, rename, remove]);
  }

  private showRename(row: PlayerRow, error = ''): void {
    const input = el('input', { value: row.name, maxLength: this.host.maxNameLength, autocomplete: 'off' });
    const save = el('button', { className: 'main', textContent: 'Save' });
    save.onclick = () => {
      const problem = this.host.rename(row.id, input.value);
      if (problem) return this.showRename(row, problem);
      this.changed = true;
      this.showList();
    };
    this.screen(`Rename ${row.name}`, [
      el('label', { textContent: 'Name' }),
      input,
      error ? el('p', { className: 'error', textContent: error }) : null,
      el('div', { className: 'buttons' }, [
        el('button', { textContent: 'Back', onclick: () => this.showList() }),
        save,
      ]),
    ]);
    input.focus();
  }

  private apply(problem: string | null): void {
    if (!problem) this.changed = true;
    this.showList(problem ?? '');
  }
}

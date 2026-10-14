/**
 * Grown-ups "Characters" screen: add a character from a picture, switch added
 * ones on and off, remove them. It is a plain HTML overlay rather than Phaser
 * objects because it needs a file picker, text fields and dropdowns.
 *
 * Checks live in shop/addedCharacters.ts; this file only collects the draft.
 */
import { FLAVOR_COLORS } from '../characters/sprites';
import { GAME_CONFIG } from '../config/gameConfig';
import type { CharacterLibrary } from '../save/characterLibrary';
import { el, openDialog, type Children } from './domDialog';
import { sheetLayout, type AddedCharacter, type ArtPoint, type CharacterDraft } from '../shop/addedCharacters';

const FLAVOR_NAMES = Object.keys(FLAVOR_COLORS);
const titleCase = (s: string): string =>
  s.replace(/(^|-)(\w)/g, (_, dash: string, c: string) => `${dash ? ' ' : ''}${c.toUpperCase()}`);

/** Draws frame 0 of a picture into a canvas `height` pixels tall, with optional head and neck markers. */
function preview(img: CanvasImageSource, frameW: number, frameH: number, height: number, marks: ArtPoint[] = []) {
  const zoom = Math.max(1, Math.floor(height / frameH));
  const canvas = el('canvas', { width: frameW * zoom, height: frameH * zoom });
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, frameW, frameH, 0, 0, frameW * zoom, frameH * zoom);
  marks.forEach((m, i) => {
    ctx.strokeStyle = i === 0 ? '#e0607e' : '#4f86cc';
    ctx.lineWidth = 3;
    ctx.strokeRect(m.x * zoom - 2, m.y * zoom - 2, zoom + 4, zoom + 4);
  });
  return { canvas, zoom };
}

async function decode(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/** Re-encodes the picture as PNG, which keeps pixel art tiny and strips anything but pixels. */
function reencode(img: HTMLImageElement): string {
  const canvas = el('canvas', { width: img.naturalWidth, height: img.naturalHeight });
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

const lines = (text: string): string[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');

export class CharacterDialog {
  private root: HTMLDivElement;
  private panel: HTMLDivElement;
  private changed = false;

  constructor(
    private readonly library: CharacterLibrary,
    private readonly onClose: (changed: boolean) => void,
  ) {
    this.panel = el('div', { className: 'panel' });
    this.root = openDialog('ssa-chars', this.panel);
    this.showList();
  }

  private close(): void {
    this.root.remove();
    this.onClose(this.changed);
  }

  private screen(title: string, children: Children): void {
    const close = el('button', { textContent: 'Close', onclick: () => this.close() });
    this.panel.replaceChildren(el('h2', {}, [title, close]), ...children.filter((c): c is Node => c !== null));
  }

  // -------------------------------------------------------------------------
  // The list
  // -------------------------------------------------------------------------

  private showList(error = ''): void {
    const all = this.library.list();
    const { maxCharacters } = GAME_CONFIG.addedCharacters;
    const add = el('button', {
      className: 'main',
      textContent: 'Add a character',
      disabled: all.length >= maxCharacters,
      onclick: () => this.pickPicture(),
    });
    this.screen('Characters', [
      el('p', { className: 'hint' }, [
        'Characters you add stay in this browser on this device and are included in backup files. ',
        `Up to ${maxCharacters}.`,
      ]),
      ...all.map((c) => this.row(c)),
      all.length === 0 ? el('p', { textContent: 'No added characters yet.' }) : null,
      error ? el('p', { className: 'error', textContent: error }) : null,
      el('div', { className: 'buttons' }, [add]),
    ]);
  }

  private row(c: AddedCharacter): HTMLElement {
    const thumb = el('div');
    void decode(c.image).then((img) => thumb.append(preview(img, c.frameW, c.frameH, 60).canvas));
    const role = c.role === 'shopkeeper' ? 'Shopkeeper' : 'Customer';
    const toggle = el('button', {
      textContent: c.enabled ? 'On' : 'Off',
      className: c.enabled ? 'main' : '',
      onclick: () => this.apply(this.library.setEnabled(c.id, !c.enabled)),
    });
    const remove = el('button', { className: 'warn', textContent: 'Remove' });
    remove.onclick = () => {
      if (remove.dataset.armed) return this.apply(this.library.remove(c.id));
      remove.dataset.armed = '1';
      remove.textContent = 'Tap again to remove';
    };
    const who = el('div', { className: 'who' }, [
      c.name,
      el('small', { textContent: `${role} · ${titleCase(c.favoriteFlavor)}` }),
    ]);
    return el('div', { className: 'row' }, [thumb, who, toggle, remove]);
  }

  private apply(result: { ok: true } | { ok: false; error: string }): void {
    if (result.ok) this.changed = true;
    this.showList(result.ok ? '' : `Could not save: ${result.error}`);
  }

  // -------------------------------------------------------------------------
  // Adding one
  // -------------------------------------------------------------------------

  private pickPicture(): void {
    const input = el('input', { type: 'file', accept: 'image/png' });
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void this.readPicture(file);
    };
    input.click();
  }

  private async readPicture(file: File): Promise<void> {
    if (file.size > GAME_CONFIG.addedCharacters.maxFileBytes) return this.showList('That picture file is too big.');
    let img: HTMLImageElement;
    try {
      img = await decode(URL.createObjectURL(file));
    } catch {
      return this.showList('That file could not be read as a picture.');
    }
    const layout = sheetLayout(img.naturalWidth, img.naturalHeight);
    if (!layout.ok) return this.showList(layout.error);
    const image = reencode(img);
    this.showForm(await decode(image), {
      name: '',
      role: 'customer',
      favoriteFlavor: 'strawberry',
      greetings: [],
      thanks: [],
      image,
      width: img.naturalWidth,
      height: img.naturalHeight,
      head: null,
      neck: null,
    });
  }

  /** The text fields and dropdowns, plus a function that reads them back into a draft. */
  private fields(draft: CharacterDraft): { nodes: Node[]; read: () => CharacterDraft } {
    const rules = GAME_CONFIG.addedCharacters;
    const name = el('input', { value: draft.name, maxLength: rules.maxNameLength, placeholder: 'Puffy' });
    const role = el('select', {}, [
      el('option', { value: 'customer', textContent: 'Customer (visits the shop)' }),
      el('option', { value: 'shopkeeper', textContent: 'Shopkeeper (behind the counter)' }),
    ]);
    role.value = draft.role;
    const options = FLAVOR_NAMES.map((f) => el('option', { value: f, textContent: titleCase(f) }));
    const flavor = el('select', {}, options);
    flavor.value = draft.favoriteFlavor;
    const hello = el('textarea', { rows: 2, value: draft.greetings.join('\n'), placeholder: 'Hi hi!' });
    const thanks = el('textarea', { rows: 2, value: draft.thanks.join('\n'), placeholder: 'Yummy!' });
    const label = (textContent: string) => el('label', { textContent });
    return {
      nodes: [
        ...[label('Name'), name, label('Role'), role, label('Favourite flavour'), flavor],
        ...[label(`Hello lines (optional, one per line, up to ${rules.maxLines})`), hello],
        ...[label('Thank-you lines (optional)'), thanks],
      ],
      read: () => ({
        ...draft,
        name: name.value,
        role: role.value as CharacterDraft['role'],
        favoriteFlavor: flavor.value,
        greetings: lines(hello.value),
        thanks: lines(thanks.value),
      }),
    };
  }

  private showForm(img: HTMLImageElement, draft: CharacterDraft, error = ''): void {
    const { nodes, read } = this.fields(draft);
    const save = el('button', { className: 'main', textContent: 'Add character' });
    save.onclick = () => {
      const result = this.library.add(read());
      if (!result.ok) return this.showForm(img, read(), result.error);
      this.changed = true;
      this.showList();
    };
    const back = el('button', { textContent: 'Back', onclick: () => this.showList() });
    this.screen('Add a character', [
      this.pointPicker(img, draft, (next) => this.showForm(img, { ...read(), head: next.head, neck: next.neck })),
      ...nodes,
      error ? el('p', { className: 'error', textContent: `Not added: ${error}.` }) : null,
      el('div', { className: 'buttons' }, [back, save]),
    ]);
  }

  /** Tap the top of the head, then the neck; tapping again starts over. */
  private pointPicker(img: HTMLImageElement, draft: CharacterDraft, onPick: (d: CharacterDraft) => void): HTMLElement {
    const layout = sheetLayout(draft.width, draft.height);
    if (!layout.ok) return el('p', { className: 'error', textContent: layout.error });
    const marks = [draft.head, draft.neck].filter((p): p is ArtPoint => p !== null);
    const { canvas, zoom } = preview(img, layout.frameW, layout.frameH, 200, marks);
    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const at = {
        x: Math.min(layout.frameW - 1, Math.floor(((e.clientX - rect.left) * (canvas.width / rect.width)) / zoom)),
        y: Math.min(layout.frameH - 1, Math.floor(((e.clientY - rect.top) * (canvas.height / rect.height)) / zoom)),
      };
      const next =
        draft.head === null || draft.neck !== null ? { head: at, neck: null } : { head: draft.head, neck: at };
      onPick({ ...draft, ...next });
    };
    const step =
      draft.head === null
        ? 'Tap the top of the head.'
        : draft.neck === null
          ? 'Now tap the neck.'
          : 'Done. Tap again to start over.';
    return el('div', {}, [
      canvas,
      el('p', { className: 'hint' }, [
        `${layout.frames} frame${layout.frames === 1 ? '' : 's'} of ${layout.frameW}×${layout.frameH}. `,
        step,
        ' This shows where hats and bows will go (optional).',
      ]),
    ]);
  }
}

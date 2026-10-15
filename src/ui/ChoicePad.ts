/**
 * The answer buttons for a question you answer by tapping (a letter, a
 * colour, a picture) in place of the number keypad. Tapping one answers at
 * once; a wrong one is dimmed so the retry is a different choice.
 */
import type Phaser from 'phaser';
import { wordTexture, WORD_ART_SIZE } from '../characters/wordArt';
import type { ChoiceOption } from '../learning/types';
import { Button } from './Button';
import { choiceLayout } from './choiceLayout';
import { COLORS, CSS, text, type Rect } from './theme';

export interface ChoicePadOptions {
  /** Where the buttons go: the keypad's spot. */
  area: Rect;
  onPick: (id: string) => void;
}

/** The biggest a picture is drawn on a button. */
const PICTURE_MAX_SCALE = 8;
const SWATCH_R = 26;
/** A colour tub on its own is bigger than one beside a label. */
const SWATCH_MAX_R = 60;

export class ChoicePad {
  private buttons = new Map<string, Button>();
  private enabled = false;
  private depth = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: ChoicePadOptions,
  ) {}

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** The buttons by option id (the e2e test taps them). */
  get spots(): Record<string, { x: number; y: number }> {
    return Object.fromEntries([...this.buttons].map(([id, b]) => [id, { x: b.x, y: b.y }]));
  }

  /** Replaces the buttons with one per option; they stay off until the shop is ready for an answer. */
  show(options: readonly ChoiceOption[]): void {
    this.hide();
    const cells = choiceLayout(this.opts.area, options.length);
    options.forEach((option, i) => {
      const button = Button.inRect(this.scene, cells[i]!, {
        label: '',
        fontSize: 40,
        onTap: () => this.pick(option.id),
      });
      this.decorate(button, option, cells[i]!);
      button.setDepth(this.depth);
      this.buttons.set(option.id, button);
    });
    this.setEnabled(false);
  }

  hide(): void {
    for (const b of this.buttons.values()) b.destroy();
    this.buttons.clear();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    for (const b of this.buttons.values()) b.setEnabled(enabled && !b.getData('dimmed'));
  }

  setVisible(visible: boolean): void {
    for (const b of this.buttons.values()) b.setVisible(visible);
  }

  setDepth(depth: number): void {
    this.depth = depth;
    for (const b of this.buttons.values()) b.setDepth(depth);
  }

  /** Greys out a wrong answer so it can't be chosen again. */
  dim(id: string): void {
    const button = this.buttons.get(id);
    if (!button) return;
    button.setData('dimmed', true);
    button.setEnabled(false);
  }

  private pick(id: string): void {
    if (!this.enabled) return;
    // Lock at once: the scene re-enables when it is ready for another answer.
    this.setEnabled(false);
    this.opts.onPick(id);
  }

  /** The picture, colour disc and words on a button, stacked in its middle. */
  private decorate(button: Button, option: ChoiceOption, cell: Rect): void {
    const label = option.label
      ? this.scene.add.text(0, 0, option.label, text(Math.min(96, Math.round(cell.h * 0.5)), CSS.ink)).setOrigin(0.5)
      : null;
    const art = this.art(option, cell, label !== null);
    if (label) {
      const textW = Math.min(1, (cell.w - 24) / label.width);
      label.setScale(textW).setY(art ? cell.h * 0.22 : 0);
    }
    button.add([...(art ? [art] : []), ...(label ? [label] : [])]);
  }

  private art(option: ChoiceOption, cell: Rect, withLabel: boolean): Phaser.GameObjects.GameObject | null {
    const y = withLabel ? -cell.h * 0.2 : 0;
    if (option.picture) {
      const s = Math.max(
        1,
        Math.min(PICTURE_MAX_SCALE, Math.floor((cell.h * (withLabel ? 0.5 : 0.7)) / WORD_ART_SIZE)),
      );
      return this.scene.add.image(0, y, wordTexture(this.scene, option.picture)).setScale(s);
    }
    if (!option.swatch) return null;
    const g = this.scene.add.graphics();
    const color = Number.parseInt(option.swatch.slice(1), 16);
    const r = withLabel ? SWATCH_R : Math.min(SWATCH_MAX_R, Math.round(Math.min(cell.w, cell.h) * 0.3));
    g.fillStyle(color, 1).fillCircle(0, y, r);
    g.lineStyle(4, COLORS.ink, 1).strokeCircle(0, y, r);
    return g;
  }
}

import Phaser from 'phaser';
import { Button } from './Button';
import { COLORS } from './theme';

export interface KeypadOptions {
  x: number;
  y: number;
  cellW: number;
  cellH: number;
  gap: number;
  maxDigits: number;
  fontSize?: number;
  /** Optional parent container (e.g. a modal overlay). */
  container?: Phaser.GameObjects.Container;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

/**
 * On-screen 0-9 keypad with backspace and submit.
 *
 *   1 2 3
 *   4 5 6
 *   7 8 9
 *   ⌫ 0 ✓
 *
 * Disabling the keypad is how the scene blocks repeat submissions while an
 * answer is being processed (the OrderManager also ignores them).
 */
export class NumberKeypad {
  private value = '';
  private enabled = false;
  private buttons: Button[] = [];
  private submitButton!: Button;
  private keyHandler?: (e: KeyboardEvent) => void;

  constructor(
    private scene: Phaser.Scene,
    private opts: KeypadOptions,
  ) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'];
    keys.forEach((key, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = opts.x + col * (opts.cellW + opts.gap) + opts.cellW / 2;
      const y = opts.y + row * (opts.cellH + opts.gap) + opts.cellH / 2;
      const isOk = key === 'ok';
      const isBack = key === 'back';
      const button = new Button(scene, x, y, {
        width: opts.cellW,
        height: opts.cellH,
        label: isOk ? '✓' : isBack ? '⌫' : key,
        fontSize: opts.fontSize ?? (isOk || isBack ? 52 : 56),
        fill: isOk ? COLORS.mint : isBack ? COLORS.peach : COLORS.cream,
        shade: isOk ? COLORS.mintDark : isBack ? 0xe8a888 : COLORS.creamDark,
        onTap: () => this.press(key),
      });
      opts.container?.add(button);
      if (isOk) this.submitButton = button;
      this.buttons.push(button);
    });

    // Optional physical keyboard support (handy on desktop; never required).
    this.keyHandler = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) this.press(e.key);
      else if (e.key === 'Backspace') this.press('back');
      else if (e.key === 'Enter') this.press('ok');
    };
    scene.input.keyboard?.on('keydown', this.keyHandler);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.setEnabled(false);
  }

  get current(): string {
    return this.value;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  clear(): void {
    this.value = '';
    this.opts.onChange(this.value);
    this.refresh();
  }

  setMaxDigits(maxDigits: number): void {
    this.opts.maxDigits = maxDigits;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    for (const b of this.buttons) b.setEnabled(enabled);
    this.refresh();
  }

  setVisible(visible: boolean): void {
    for (const b of this.buttons) b.setVisible(visible);
  }

  get visible(): boolean {
    return this.buttons.some((b) => b.visible);
  }

  setDepth(depth: number): void {
    for (const b of this.buttons) b.setDepth(depth);
  }

  destroy(): void {
    if (this.keyHandler) this.scene.input.keyboard?.off('keydown', this.keyHandler);
    this.keyHandler = undefined;
  }

  private press(key: string): void {
    if (!this.enabled) return;
    if (key === 'ok') {
      if (this.value.length === 0) return;
      // Lock immediately: the scene re-enables when it is ready for input.
      this.setEnabled(false);
      this.opts.onSubmit(this.value);
      return;
    }
    if (key === 'back') this.value = this.value.slice(0, -1);
    else if (this.value.length < this.opts.maxDigits) this.value = (this.value + key).replace(/^0+(?=\d)/, '');
    this.opts.onChange(this.value);
    this.refresh();
  }

  private refresh(): void {
    this.submitButton?.setEnabled(this.enabled && this.value.length > 0);
  }
}

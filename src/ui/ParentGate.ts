import Phaser from 'phaser';
import { Button } from './Button';
import { NumberKeypad } from './NumberKeypad';
import { numberToWords } from './numberWords';
import { COLORS, CSS, LAYOUT, text } from './theme';

export interface ParentAction {
  label: string;
  /** Shown on the confirmation step. */
  confirm: string;
  enabled: boolean;
  run: () => void;
}

export interface ParentGateOptions {
  /** Lines of read-only info for the parent area (progress summary, save status). */
  info: () => string[];
  actions: () => ParentAction[];
  onClose: () => void;
}

/**
 * Grown-ups area. Getting in requires reading a three-digit number written in
 * words and typing it, which stops accidental taps by young children. This is
 * a safeguard, not security: nothing secret is stored.
 *
 * Every destructive action then needs a second "Yes" on a confirmation step.
 */
export class ParentGate {
  private root: Phaser.GameObjects.Container;
  private content: Phaser.GameObjects.Container;
  private keypad?: NumberKeypad;
  private target = 0;

  constructor(private scene: Phaser.Scene, private opts: ParentGateOptions) {
    this.root = scene.add.container(0, 0).setDepth(1000);
    const shade = scene.add.rectangle(0, 0, LAYOUT.width, LAYOUT.height, COLORS.ink, 0.45).setOrigin(0).setInteractive();
    // Everything below is laid out on a 1280x880 canvas, centred on (640, 440),
    // then scaled to fit narrower screens.
    const scale = Math.min(1, (LAYOUT.width - 24) / 940);
    const box = scene.add.container(LAYOUT.width / 2 - 640 * scale, LAYOUT.height / 2 - 440 * scale).setScale(scale);
    const panel = scene.add.graphics();
    panel.fillStyle(COLORS.cream, 1).fillRoundedRect(170, 60, 940, 760, 30);
    panel.lineStyle(6, COLORS.lavenderDark, 1).strokeRoundedRect(170, 60, 940, 760, 30);
    this.content = scene.add.container(0, 0);
    box.add([panel, this.content]);
    this.root.add([shade, box]);
    this.showChallenge();
  }

  private reset(): void {
    this.keypad?.destroy();
    this.keypad = undefined;
    this.content.removeAll(true);
  }

  private add<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.content.add(obj);
    return obj;
  }

  private closeButton(label = 'Close'): void {
    this.add(new Button(this.scene, 1000, 110, { width: 160, height: 70, label, fontSize: 28, onTap: () => this.close() }));
  }

  private showChallenge(): void {
    this.reset();
    this.target = Phaser.Math.Between(101, 989);
    this.add(this.scene.add.text(640, 100, 'Grown-ups only', text(40)).setOrigin(0.5, 0));
    this.add(this.scene.add.text(640, 160, 'Type this number:', text(28, CSS.inkSoft)).setOrigin(0.5, 0));
    this.add(this.scene.add.text(640, 205, numberToWords(this.target), text(36, CSS.strawberry)).setOrigin(0.5, 0));
    const entry = this.add(this.scene.add.text(640, 270, '___', text(48, CSS.sky)).setOrigin(0.5, 0));
    this.closeButton('Cancel');

    const pad = new NumberKeypad(this.scene, {
      x: 640 - (3 * 110 + 2 * 12) / 2,
      y: 350,
      cellW: 110,
      cellH: 98,
      gap: 12,
      maxDigits: 3,
      fontSize: 44,
      container: this.content,
      onChange: (v) => entry.setText(v || '___'),
      onSubmit: (v) => {
        if (Number(v) === this.target) this.showMenu();
        else {
          entry.setText('Try again').setColor(CSS.strawberry);
          this.scene.time.delayedCall(700, () => {
            if (!this.keypad) return;
            entry.setText('___').setColor(CSS.sky);
            pad.clear();
            pad.setEnabled(true);
          });
        }
      },
    });
    pad.setEnabled(true);
    this.keypad = pad;
  }

  private showMenu(): void {
    this.reset();
    this.add(this.scene.add.text(640, 90, 'Grown-ups area', text(40)).setOrigin(0.5, 0));
    this.closeButton();
    this.add(
      this.scene.add
        .text(220, 160, this.opts.info().join('\n'), text(24, CSS.ink, { lineSpacing: 8, wordWrap: { width: 840 } }))
        .setOrigin(0, 0),
    );
    this.opts.actions().forEach((action, i) => {
      const b = this.add(
        new Button(this.scene, 640, 540 + i * 88, {
          width: 560,
          height: 76,
          label: action.label,
          fontSize: 28,
          fill: COLORS.peach,
          shade: 0xe8a888,
          onTap: () => this.showConfirm(action),
        }),
      );
      b.setEnabled(action.enabled);
    });
  }

  private showConfirm(action: ParentAction): void {
    this.reset();
    this.add(this.scene.add.text(640, 200, action.label, text(40)).setOrigin(0.5, 0));
    this.add(
      this.scene.add
        .text(640, 280, action.confirm, text(28, CSS.inkSoft, { align: 'center', wordWrap: { width: 760 } }))
        .setOrigin(0.5, 0),
    );
    this.add(
      new Button(this.scene, 500, 560, {
        width: 240, height: 90, label: 'Yes, do it', fontSize: 30, fill: COLORS.strawberry, shade: COLORS.strawberryDark,
        onTap: () => {
          action.run();
          this.close();
        },
      }),
    );
    this.add(new Button(this.scene, 780, 560, { width: 240, height: 90, label: 'Go back', fontSize: 30, onTap: () => this.showMenu() }));
  }

  close(): void {
    this.reset();
    this.root.destroy(true);
    this.opts.onClose();
  }
}

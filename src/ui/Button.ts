import Phaser from 'phaser';
import { COLORS, text } from './theme';

export interface ButtonOptions {
  width: number;
  height: number;
  label: string;
  fontSize?: number;
  fill?: number;
  shade?: number;
  textColor?: string;
  onTap: () => void;
}

/**
 * Big chunky touch button. Fires on release (so a finger can slide off to
 * cancel), shows a pressed state on touch, and never relies on hover.
 */
export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private enabled = true;
  private pressed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, private opts: ButtonOptions) {
    super(scene, x, y);
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, opts.label, text(opts.fontSize ?? 40, opts.textColor ?? '#4a3a58'))
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.setSize(opts.width, opts.height);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.draw();
    });
    this.on('pointerout', () => {
      this.pressed = false;
      this.draw();
    });
    this.on('pointerup', () => {
      if (!this.enabled || !this.pressed) return;
      this.pressed = false;
      this.draw();
      opts.onTap();
    });
    this.draw();
    scene.add.existing(this);
  }

  setLabel(label: string): this {
    this.label.setText(label);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.pressed = false;
    this.draw();
    return this;
  }

  private draw(): void {
    const { width: w, height: h } = this.opts;
    const fill = this.opts.fill ?? COLORS.cream;
    const shade = this.opts.shade ?? COLORS.creamDark;
    const lift = this.pressed ? 2 : 8;
    const g = this.bg;
    g.clear();
    g.fillStyle(shade, 1).fillRoundedRect(-w / 2, -h / 2 + 8, w, h - 8, 22);
    g.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2 + 8 - lift, w, h - 8, 22);
    g.lineStyle(4, COLORS.ink, 0.85).strokeRoundedRect(-w / 2, -h / 2 + 8 - lift, w, h - 8, 22);
    this.label.y = 4 - lift / 2;
    this.setAlpha(this.enabled ? 1 : 0.45);
  }
}

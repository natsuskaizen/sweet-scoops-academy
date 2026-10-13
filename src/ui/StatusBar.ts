import Phaser from 'phaser';
import { COLORS, CSS, GAME_W, LAYOUT, text } from './theme';

/**
 * Top strip: order number, round progress dots, Sprinkles balance, and the
 * grown-ups button (press and hold so a stray tap does nothing).
 */
export class StatusBar extends Phaser.GameObjects.Container {
  private orderText: Phaser.GameObjects.Text;
  private dots: Phaser.GameObjects.Graphics;
  private sprinklesText: Phaser.GameObjects.Text;
  private balance = 0;
  private holdRing: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, onParentHold: () => void) {
    super(scene, 0, 0);
    const { h } = LAYOUT.statusBar;
    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.lavender, 1).fillRect(0, 0, GAME_W, h);
    bg.fillStyle(COLORS.lavenderDark, 1).fillRect(0, h - 6, GAME_W, 6);
    this.orderText = scene.add.text(24, h / 2 - 3, '', text(30, CSS.ink)).setOrigin(0, 0.5);
    this.dots = scene.add.graphics();

    const pill = scene.add.graphics();
    pill.fillStyle(COLORS.cream, 1).fillRoundedRect(910, 10, 230, 48, 24);
    pill.lineStyle(4, COLORS.strawberry, 1).strokeRoundedRect(910, 10, 230, 48, 24);
    const icon = scene.add.image(944, h / 2 - 3, 'sprinkle-icon').setScale(4);
    this.sprinklesText = scene.add.text(1124, h / 2 - 3, '0', text(30, CSS.strawberry)).setOrigin(1, 0.5);

    // Grown-ups button: hold for 1.2 s.
    const gear = scene.add.text(1214, h / 2 - 3, '⚙', text(40, CSS.inkSoft)).setOrigin(0.5);
    this.holdRing = scene.add.graphics();
    const hit = scene.add.zone(1214, h / 2 - 3, 76, 64).setInteractive();
    let holdTween: Phaser.Tweens.Tween | undefined;
    const cancel = () => {
      holdTween?.stop();
      holdTween = undefined;
      this.holdRing.clear();
    };
    hit.on('pointerdown', () => {
      const progress = { t: 0 };
      holdTween = scene.tweens.add({
        targets: progress,
        t: 1,
        duration: 1200,
        onUpdate: () => {
          this.holdRing.clear();
          this.holdRing.lineStyle(5, COLORS.strawberryDark, 1);
          this.holdRing.beginPath();
          this.holdRing.arc(1214, h / 2 - 3, 28, -Math.PI / 2, -Math.PI / 2 + progress.t * Math.PI * 2);
          this.holdRing.strokePath();
        },
        onComplete: () => {
          cancel();
          onParentHold();
        },
      });
    });
    hit.on('pointerup', cancel);
    hit.on('pointerout', cancel);

    this.add([bg, this.orderText, this.dots, pill, icon, this.sprinklesText, gear, this.holdRing, hit]);
    this.setDepth(400);
    scene.add.existing(this);
  }

  setProgress(index: number, total: number, doneCount: number): void {
    this.orderText.setText(`Order ${Math.min(index + 1, total)} of ${total}`);
    const g = this.dots;
    g.clear();
    const startX = 290;
    for (let i = 0; i < total; i++) {
      const x = startX + i * 52;
      const y = LAYOUT.statusBar.h / 2 - 3;
      if (i < doneCount) {
        g.fillStyle(COLORS.mint, 1).fillCircle(x, y, 16);
        g.lineStyle(3, COLORS.mintDark, 1).strokeCircle(x, y, 16);
      } else if (i === index) {
        g.fillStyle(COLORS.white, 1).fillCircle(x, y, 16);
        g.lineStyle(4, COLORS.strawberry, 1).strokeCircle(x, y, 16);
      } else {
        g.fillStyle(COLORS.cream, 0.7).fillCircle(x, y, 13);
      }
    }
  }

  setSprinkles(value: number, animate = false): void {
    if (!animate) {
      this.balance = value;
      this.sprinklesText.setText(String(value));
      return;
    }
    const counter = { v: this.balance };
    this.balance = value;
    this.scene.tweens.add({
      targets: counter,
      v: value,
      duration: 600,
      onUpdate: () => this.sprinklesText.setText(String(Math.round(counter.v))),
    });
    this.scene.tweens.add({ targets: this.sprinklesText, scale: 1.25, duration: 150, yoyo: true });
  }
}

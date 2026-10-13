import Phaser from 'phaser';
import type { AttemptOutcome } from '../learning/types';
import { GAME_CONFIG } from '../config/gameConfig';
import { COLORS, CSS, LAYOUT, text } from './theme';

const OUTCOME_COLORS: Record<AttemptOutcome, [number, number]> = {
  first: [COLORS.mint, COLORS.mintDark],
  retry: [COLORS.sky, COLORS.skyDark],
  miss: [COLORS.peach, 0xe8a888],
};

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
    const { w, h, orderFont, pillX, pillW, gearX } = LAYOUT.statusBar;
    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.lavender, 1).fillRect(0, 0, w, h);
    bg.fillStyle(COLORS.lavenderDark, 1).fillRect(0, h - 6, w, 6);
    this.orderText = scene.add.text(24, h / 2 - 3, '', text(orderFont, CSS.ink)).setOrigin(0, 0.5);
    this.dots = scene.add.graphics();

    const pill = scene.add.graphics();
    pill.fillStyle(COLORS.cream, 1).fillRoundedRect(pillX, 10, pillW, 48, 24);
    pill.lineStyle(4, COLORS.strawberry, 1).strokeRoundedRect(pillX, 10, pillW, 48, 24);
    const icon = scene.add.image(pillX + 34, h / 2 - 3, 'sprinkle-icon').setScale(4);
    this.sprinklesText = scene.add.text(pillX + pillW - 16, h / 2 - 3, '0', text(30, CSS.strawberry)).setOrigin(1, 0.5);

    const gear = scene.add.text(gearX, h / 2 - 3, '⚙', text(40, CSS.inkSoft)).setOrigin(0.5);
    this.holdRing = scene.add.graphics();
    const hit = this.holdButton(gearX, h / 2 - 3, onParentHold);

    this.add([bg, this.orderText, this.dots, pill, icon, this.sprinklesText, gear, this.holdRing, hit]);
    this.setDepth(400);
    scene.add.existing(this);
  }

  /** Grown-ups button: a ring fills while held, and only a full hold opens it. */
  private holdButton(x: number, y: number, onParentHold: () => void): Phaser.GameObjects.Zone {
    const scene = this.scene;
    const hit = scene.add.zone(x, y, 76, 64).setInteractive();
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
        duration: GAME_CONFIG.timing.parentHoldMs,
        onUpdate: () => {
          this.holdRing.clear();
          this.holdRing.lineStyle(5, COLORS.strawberryDark, 1);
          this.holdRing.beginPath();
          this.holdRing.arc(x, y, 28, -Math.PI / 2, -Math.PI / 2 + progress.t * Math.PI * 2);
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
    return hit;
  }

  /**
   * One dot per order. Finished orders show how they went, gently:
   * mint star = first try, sky = got it on the retry, peach = answer shown.
   */
  setProgress(index: number, outcomes: readonly (AttemptOutcome | null)[]): void {
    const total = outcomes.length;
    this.orderText.setText(`Order ${Math.min(index + 1, total)} of ${total}`);
    const g = this.dots;
    g.clear();
    const { h, dotsX, dotStep, dotR: r } = LAYOUT.statusBar;
    const y = h / 2 - 3;
    outcomes.forEach((outcome, i) => {
      const x = dotsX + i * dotStep;
      if (outcome !== null) {
        const [fill, edge] = OUTCOME_COLORS[outcome];
        g.fillStyle(fill, 1).fillCircle(x, y, r);
        g.lineStyle(3, edge, 1).strokeCircle(x, y, r);
        if (outcome === 'first') this.star(x, y, r);
      } else if (i === index) {
        g.fillStyle(COLORS.white, 1).fillCircle(x, y, r);
        g.lineStyle(4, COLORS.strawberry, 1).strokeCircle(x, y, r);
      } else {
        g.fillStyle(COLORS.cream, 0.7).fillCircle(x, y, r - 3);
      }
    });
  }

  private star(x: number, y: number, size: number): void {
    const points: Phaser.Geom.Point[] = [];
    for (let i = 0; i < 10; i++) {
      const r = (i % 2 === 0 ? 0.62 : 0.28) * size;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      points.push(new Phaser.Geom.Point(x + Math.cos(a) * r, y + Math.sin(a) * r));
    }
    this.dots.fillStyle(COLORS.white, 1).fillPoints(points, true);
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

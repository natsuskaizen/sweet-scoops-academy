import Phaser from 'phaser';
import type { RoundSummary } from '../save/saveTypes';
import { Button } from '../ui/Button';
import { COLORS, CSS, GAME_H, text } from '../ui/theme';

/**
 * End-of-round card drawn over the shop (the shop stays visible around it;
 * this is not a separate scene). Only positive framing: orders served,
 * first-try stars, Sprinkles and bonuses.
 */
export class ResultsOverlay extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, summary: RoundSummary, onContinue: () => void) {
    const w = 640;
    const h = 600;
    const x = 400 - w / 2 + 40;
    const y = (GAME_H - h) / 2 + 20;
    super(scene, x, y);

    const g = scene.add.graphics();
    g.fillStyle(COLORS.shadow, 0.18).fillRoundedRect(8, 12, w, h, 32);
    g.fillStyle(COLORS.cream, 1).fillRoundedRect(0, 0, w, h, 32);
    g.lineStyle(8, summary.perfect ? COLORS.strawberry : COLORS.mintDark, 1).strokeRoundedRect(0, 0, w, h, 32);
    this.add(g);

    const title = summary.perfect ? 'Perfect round!' : 'Shop closed! Great job!';
    this.add(scene.add.text(w / 2, 30, title, text(46, summary.perfect ? CSS.strawberry : CSS.mint)).setOrigin(0.5, 0));

    const rows: [string, string][] = [
      ['Orders served', `${summary.ordersCompleted}`],
      ['First-try stars', `★ ${summary.firstTryCorrect}`],
      ['Sprinkles from orders', `+${summary.orderSprinkles}`],
      ['All orders bonus', `+${summary.completionBonus}`],
    ];
    if (summary.perfectBonus > 0) rows.push(['Perfect bonus', `+${summary.perfectBonus}`]);

    rows.forEach(([label, value], i) => {
      const ry = 120 + i * 58;
      this.add(scene.add.text(48, ry, label, text(28, CSS.inkSoft)));
      this.add(scene.add.text(w - 48, ry, value, text(30, CSS.ink)).setOrigin(1, 0));
    });

    const totalY = 120 + rows.length * 58 + 10;
    g.lineStyle(3, COLORS.creamDark, 1).lineBetween(40, totalY - 8, w - 40, totalY - 8);
    this.add(scene.add.text(48, totalY, 'Sprinkles earned', text(32)));
    this.add(scene.add.text(w - 48, totalY - 4, `✦ ${summary.total}`, text(40, CSS.strawberry)).setOrigin(1, 0));

    this.add(
      new Button(scene, w / 2, h - 70, {
        width: 360, height: 96, label: 'Keep scooping!', fontSize: 34,
        fill: COLORS.mint, shade: COLORS.mintDark, onTap: onContinue,
      }),
    );

    this.setDepth(500).setScale(0.8).setAlpha(0);
    scene.add.existing(this);
    scene.tweens.add({ targets: this, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    if (summary.perfect) this.confetti();
  }

  private confetti(): void {
    const colors = [COLORS.strawberry, COLORS.mint, COLORS.sky, COLORS.lavender, COLORS.peach];
    for (let i = 0; i < 60; i++) {
      const piece = this.scene.add
        .rectangle(Phaser.Math.Between(60, 760), -20, 10, 16, colors[i % colors.length])
        .setDepth(501)
        .setAngle(Phaser.Math.Between(0, 180));
      this.scene.tweens.add({
        targets: piece,
        y: GAME_H + 30,
        angle: piece.angle + 360,
        duration: Phaser.Math.Between(1600, 2800),
        delay: Phaser.Math.Between(0, 900),
        onComplete: () => piece.destroy(),
      });
    }
  }
}

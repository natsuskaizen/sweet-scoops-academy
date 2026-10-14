import Phaser from 'phaser';
import { CharacterView, type AnyLook } from '../characters/characterManager';
import type { RoundSummary } from '../save/saveTypes';
import { Button } from '../ui/Button';
import { isCalm } from '../ui/motion';
import { COLORS, CSS, DEPTH, LAYOUT, SHOP_W, text } from '../ui/theme';

/** A served customer as the card shows them. */
export interface ResultSticker {
  look: AnyLook;
  firstTry: boolean;
}

const W = 640;
const H = 700;
const TILE = { w: 104, h: 112, gap: 10, perRow: 5, top: 150 };
const STICKER_SCALE = 0.55;
const CONFETTI = { pieces: 70, perfectPieces: 120, colors: [0xff8fb3, 0x9ee6c4, 0x9cc8ff, 0xc7b3f0, 0xffd84d] };
const GOLD = '#f5b400';

/**
 * End-of-round sticker card drawn over the shop (the shop stays visible
 * around it; this is not a separate scene). Each customer served is a
 * sticker, with a gold star for a first-try answer and a heart otherwise.
 * Only positive framing: no misses are counted on the card.
 */
export interface ResultsActions {
  onDecorate: () => void;
  onCloset: () => void;
  onContinue: () => void;
}

export class ResultsOverlay extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, summary: RoundSummary, stickers: readonly ResultSticker[], actions: ResultsActions) {
    // Centred over the shop room in landscape, over the whole screen in portrait.
    const x = LAYOUT.orientation === 'landscape' ? SHOP_W / 2 - W / 2 + 40 : (LAYOUT.width - W) / 2;
    super(scene, x, (LAYOUT.height - H) / 2 + 30);

    this.drawCard(summary);
    this.drawStickers(stickers);
    this.drawSprinkles(summary);
    const button = (x: number, width: number, label: string, look: [number, number], onTap: () => void) =>
      new Button(scene, x, H - 70, {
        width,
        height: 96,
        label,
        fontSize: width > 200 ? 26 : 30,
        fill: look[0],
        shade: look[1],
        onTap,
      });
    const lavender: [number, number] = [COLORS.lavender, COLORS.lavenderDark];
    this.add([
      button(110, 180, 'Decorate', lavender, actions.onDecorate),
      button(302, 180, 'Closet', lavender, actions.onCloset),
      button(512, 216, 'Keep scooping!', [COLORS.mint, COLORS.mintDark], actions.onContinue),
    ]);

    this.setDepth(DEPTH.results).setScale(0.8).setAlpha(0);
    scene.add.existing(this);
    scene.tweens.add({ targets: this, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    confetti(scene, summary.perfect);
  }

  /** Card, title ribbon and the one-line summary under it. */
  private drawCard(summary: RoundSummary): void {
    const g = this.scene.add.graphics();
    const edge = summary.perfect ? COLORS.strawberry : COLORS.lavender;
    g.fillStyle(COLORS.shadow, 0.18).fillRoundedRect(8, 12, W, H, 34);
    g.fillStyle(COLORS.cream, 1).fillRoundedRect(0, 0, W, H, 34);
    g.lineStyle(8, edge, 1).strokeRoundedRect(0, 0, W, H, 34);
    g.fillStyle(COLORS.strawberryDark, 1).fillRoundedRect(W / 2 - 250, -30, 500, 84, 22);
    g.fillStyle(COLORS.strawberry, 1).fillRoundedRect(W / 2 - 250, -36, 500, 82, 22);
    this.add(g);

    const title = summary.perfect ? 'Perfect round!' : 'Shop closed! Great job!';
    this.add(this.scene.add.text(W / 2, 5, title, text(36, CSS.white)).setOrigin(0.5));
    const served = `${summary.ordersCompleted} happy customers  ·  ★ ${summary.firstTryCorrect} first-try stars`;
    this.add(this.scene.add.text(W / 2, 92, served, text(24, CSS.inkSoft)).setOrigin(0.5));
  }

  private drawStickers(stickers: readonly ResultSticker[]): void {
    const rowW = TILE.perRow * TILE.w + (TILE.perRow - 1) * TILE.gap;
    stickers.forEach((s, i) => {
      const tx = (W - rowW) / 2 + (i % TILE.perRow) * (TILE.w + TILE.gap);
      const ty = TILE.top + Math.floor(i / TILE.perRow) * (TILE.h + TILE.gap);
      const tile = this.scene.add.graphics().fillStyle(0xffe9f0, 1).fillRoundedRect(tx, ty, TILE.w, TILE.h, 18);
      const view = new CharacterView(this.scene, tx + TILE.w / 2, ty + TILE.h - 6, s.look).setExpression('happy');
      view.setScale(view.scaleX * STICKER_SCALE);
      const badge = this.scene.add
        .text(tx + TILE.w - 8, ty + 4, s.firstTry ? '★' : '♥', text(28, s.firstTry ? GOLD : CSS.strawberry))
        .setOrigin(1, 0);
      this.add([tile, view, badge]);
    });
  }

  /** The big total, with what it was made of as small tags. */
  private drawSprinkles(summary: RoundSummary): void {
    const y = TILE.top + 2 * (TILE.h + TILE.gap) + 50;
    this.add(this.scene.add.text(W / 2 - 40, y, `✦ +${summary.total}`, text(64, CSS.strawberry)).setOrigin(0.5));
    this.add(this.scene.add.text(W / 2 + 120, y + 8, 'Sprinkles', text(26, CSS.inkSoft)).setOrigin(0, 0.5));

    const tags = [`Orders +${summary.orderSprinkles}`, `All served +${summary.completionBonus}`];
    if (summary.perfectBonus > 0) tags.push(`Perfect +${summary.perfectBonus}`);
    const labels = tags.map((t) => this.scene.add.text(0, 0, t, text(20, CSS.white)).setOrigin(0.5));
    const widths = labels.map((l) => l.width + 28);
    let tx = (W - widths.reduce((a, b) => a + b + 10, -10)) / 2;
    const g = this.scene.add.graphics().fillStyle(COLORS.lavender, 1);
    this.add(g);
    labels.forEach((label, i) => {
      g.fillRoundedRect(tx, y + 50, widths[i]!, 38, 14);
      this.add(label.setPosition(tx + widths[i]! / 2, y + 69));
      tx += widths[i]! + 10;
    });
  }
}

/** Confetti falling over the whole screen; more for a perfect round. */
export function confetti(scene: Phaser.Scene, perfect: boolean): void {
  if (isCalm()) return;
  const { colors } = CONFETTI;
  const pieces = perfect ? CONFETTI.perfectPieces : CONFETTI.pieces;
  for (let i = 0; i < pieces; i++) {
    const piece = scene.add
      .rectangle(Phaser.Math.Between(20, LAYOUT.width - 20), -20, 10, 16, colors[i % colors.length])
      .setDepth(DEPTH.results + 1)
      .setAngle(Phaser.Math.Between(0, 180));
    scene.tweens.add({
      targets: piece,
      y: LAYOUT.height + 30,
      x: piece.x + Phaser.Math.Between(-60, 60),
      angle: piece.angle + 360,
      duration: Phaser.Math.Between(1800, 3000),
      delay: Phaser.Math.Between(0, 1200),
      onComplete: () => piece.destroy(),
    });
  }
}

import type Phaser from 'phaser';
import { Button } from './Button';
import { COLORS, LAYOUT, text } from './theme';

export interface ShopMenuOptions {
  onDecorate: () => void;
  onCloset: () => void;
  onClose: () => void;
}

const W = 560;
const H = 380;

/**
 * The Sprinkle Shop's front door, opened from the Sprinkles balance in the
 * top bar: two big buttons, Decorate and Momo's Closet. Tapping outside the
 * card, or ✕, closes it.
 */
export class ShopMenu {
  private readonly root: Phaser.GameObjects.Container;
  private closed = false;

  constructor(
    scene: Phaser.Scene,
    private readonly opts: ShopMenuOptions,
  ) {
    this.root = scene.add.container(0, 0).setDepth(700);
    const shade = scene.add
      .rectangle(0, 0, LAYOUT.width, LAYOUT.height, COLORS.ink, 0.45)
      .setOrigin(0)
      .setInteractive();
    shade.on('pointerup', () => this.close());
    const x = (LAYOUT.width - W) / 2;
    const y = (LAYOUT.height - H) / 2;
    const card = scene.add.graphics();
    card.fillStyle(COLORS.lavender, 1).fillRoundedRect(x, y + 8, W, H, 30);
    card.fillStyle(COLORS.cream, 1).fillRoundedRect(x, y, W, H, 30);
    card.lineStyle(6, COLORS.lavenderDark, 1).strokeRoundedRect(x, y, W, H, 30);
    // Taps on the card itself do not close it.
    const cardHit = scene.add.zone(x, y, W, H).setOrigin(0).setInteractive();
    const title = scene.add.text(LAYOUT.width / 2, y + 56, 'Sprinkle Shop', text(38)).setOrigin(0.5);
    const close = new Button(scene, x + W - 50, y + 50, {
      width: 64,
      height: 64,
      label: '✕',
      fontSize: 30,
      onTap: () => this.close(),
    });
    const big = (dy: number, label: string, fill: number, shade2: number, go: () => void) =>
      new Button(scene, LAYOUT.width / 2, y + dy, {
        width: W - 80,
        height: 100,
        label,
        fontSize: 34,
        fill,
        shade: shade2,
        onTap: () => this.go(go),
      });
    this.root.add([
      shade,
      card,
      cardHit,
      title,
      close,
      big(160, 'Decorate the shop', COLORS.lavender, COLORS.lavenderDark, opts.onDecorate),
      big(286, "Momo's Closet", COLORS.mint, COLORS.mintDark, opts.onCloset),
    ]);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.root.destroy();
    this.opts.onClose();
  }

  private go(open: () => void): void {
    this.close();
    open();
  }
}

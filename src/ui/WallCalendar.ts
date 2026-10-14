import Phaser from 'phaser';
import type { Profile } from '../save/saveTypes';
import { todayProgress, wallPage } from '../shop/progressCalendar';
import { COLORS, CSS, LAYOUT, text } from './theme';

const HEADER_H = 28;
const HEART_SCALE = 2;
const HEART_W = 11 * HEART_SCALE;
const HEART_GAP = 4;

/**
 * The little calendar pinned on the shop wall: today's date and one heart
 * per game toward the daily goal, filling in as rounds finish. Tapping it
 * opens the progress calendar. Part of the room, so it never leaves the shop.
 */
export class WallCalendar extends Phaser.GameObjects.Container {
  private readonly date: Phaser.GameObjects.Text;
  private readonly month: Phaser.GameObjects.Text;
  private hearts: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, onTap: () => void) {
    const { x, y, w, h } = LAYOUT.wallCalendar;
    super(scene, x, y);
    const g = scene.add.graphics();
    g.fillStyle(COLORS.shadow, 0.18).fillRoundedRect(4, 6, w, h, 8);
    g.fillStyle(COLORS.white, 1).fillRoundedRect(0, 0, w, h, 8);
    g.fillStyle(COLORS.strawberry, 1).fillRoundedRect(0, 0, w, HEADER_H, { tl: 8, tr: 8, bl: 0, br: 0 });
    g.lineStyle(4, COLORS.ink, 1).strokeRoundedRect(0, 0, w, h, 8);
    g.lineBetween(0, HEADER_H, w, HEADER_H);
    g.fillStyle(COLORS.strawberryDark, 1).fillCircle(w / 2, -4, 7);
    g.lineStyle(3, COLORS.ink, 1).strokeCircle(w / 2, -4, 7);
    this.month = scene.add.text(w / 2, HEADER_H / 2, '', text(18, CSS.white)).setOrigin(0.5);
    this.date = scene.add.text(w / 2, HEADER_H + 24, '', text(32, CSS.ink)).setOrigin(0.5);
    const hit = scene.add
      .zone(0, -12, w, h + 12)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerup', onTap);
    this.add([g, this.month, this.date, hit]);
    this.setDepth(1.5);
    scene.add.existing(this);
  }

  /** Redraws today's page; `pop` bounces the hearts when a round has just earned the day's heart. */
  refresh(profile: Profile, now: number, pop = false): void {
    const page = wallPage(now);
    this.month.setText(page.month);
    this.date.setText(page.date);
    this.hearts.forEach((h) => h.destroy());
    const { filled, goal } = todayProgress(profile, now);
    const { w, h } = LAYOUT.wallCalendar;
    const rowW = goal * HEART_W + (goal - 1) * HEART_GAP;
    this.hearts = Array.from({ length: goal }, (_, i) =>
      this.scene.add
        .image((w - rowW) / 2 + HEART_W / 2 + i * (HEART_W + HEART_GAP), h - 22, i < filled ? 'heart' : 'heart-empty')
        .setScale(HEART_SCALE),
    );
    this.add(this.hearts);
    if (pop) {
      this.scene.tweens.add({ targets: this.hearts, scale: HEART_SCALE * 1.5, duration: 220, yoyo: true, repeat: 1 });
    }
  }
}

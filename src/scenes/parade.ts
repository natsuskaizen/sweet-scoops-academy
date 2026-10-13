/**
 * The perfect-round parade: every customer from the round walks back in from
 * the door, lines up on the floor and cheers. Skip puts everyone in place at
 * once so the results card comes straight away.
 */
import type Phaser from 'phaser';
import { CharacterView, type AnyLook } from '../characters/characterManager';
import { GAME_CONFIG } from '../config/gameConfig';
import { Button } from '../ui/Button';
import { LAYOUT, paradeSpots, SHOP_W } from '../ui/theme';
import { delay, tweenAsync } from '../ui/tweenAsync';
import { confetti } from './ResultsOverlay';

export class Parade {
  /** Shown while the parade plays (the e2e test taps it through `__ssa`). */
  skipButton: Button | null = null;
  private skipped = false;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Plays the parade and returns the lined-up customers, for the caller to clear away later. */
  async play(looks: AnyLook[]): Promise<CharacterView[]> {
    const spots = paradeSpots(looks.length);
    const views = looks.map((look, i) => {
      const spot = spots[i]!;
      const view = new CharacterView(this.scene, LAYOUT.doorSpot.x, spot.y, look).setDepth(spot.y / 10).setAlpha(0);
      return view.setScale(view.scaleX * spot.scale);
    });
    await Promise.race([this.marchIn(views, spots), this.showSkip()]);
    this.skipButton?.destroy();
    this.skipButton = null;
    if (this.skipped) views.forEach((v, i) => v.arriveAt(spots[i]!.x, spots[i]!.y).setAlpha(1).setExpression('happy'));
    return views;
  }

  /** Resolves when Skip is tapped. */
  private showSkip(): Promise<void> {
    return new Promise((resolve) => {
      this.skipButton = new Button(this.scene, SHOP_W - 110, LAYOUT.shop.y + 56, {
        width: 180,
        height: 72,
        label: 'Skip ▸',
        fontSize: 28,
        onTap: () => {
          this.skipped = true;
          resolve();
        },
      }).setDepth(600);
    });
  }

  /** The parade itself; each step checks whether Skip was tapped meanwhile. */
  private async marchIn(views: CharacterView[], spots: { x: number }[]): Promise<void> {
    const { paradeStepMs, paradeCheerMs } = GAME_CONFIG.timing;
    await Promise.all(
      views.map(async (view, i) => {
        await delay(this.scene, i * paradeStepMs);
        if (this.skipped) return;
        void tweenAsync(this.scene, { targets: view, alpha: 1, duration: 200 });
        await view.walkTo(spots[i]!.x, 2);
        if (this.skipped) return;
        view.setExpression('happy');
        await view.hop();
      }),
    );
    if (this.skipped) return;
    confetti(this.scene, true);
    views.forEach((v) => void v.hop());
    await delay(this.scene, paradeCheerMs);
  }
}

/**
 * Promise versions of Phaser tweens and timers, so animation steps read as
 * plain `await`s. A tween settles when it completes or is stopped early, so
 * cutting an animation short (Skip) never leaves a caller waiting.
 */
import type Phaser from 'phaser';

export function tweenAsync(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.add({ ...config, onComplete: () => resolve(), onStop: () => resolve() });
  });
}

export function delay(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => scene.time.delayedCall(ms, resolve));
}

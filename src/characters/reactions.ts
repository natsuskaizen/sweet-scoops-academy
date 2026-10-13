/**
 * Little pop-ups over a character: hearts for a right answer and a
 * question bubble for a first miss. Drawn in world space so they keep their
 * size whatever the character's scale.
 */
import type Phaser from 'phaser';
import { makePixelTexture } from './pixelArt';
import { CSS, text } from '../ui/theme';

const HEART = ['.oo.oo.', 'ohhohho', 'ohhhhho', '.ohhho.', '..oho..', '...o...'];
const HEART_SCALE = 5;
const DEPTH = 60;

/** Three hearts float up from (x, y) and fade. */
export function hearts(scene: Phaser.Scene, x: number, y: number): void {
  const key = makePixelTexture(scene, 'reaction-heart', HEART, (ch) => ({ o: '#c94f75', h: '#ff8fb3' })[ch] ?? null);
  [-46, 0, 46].forEach((dx, i) => {
    const heart = scene.add
      .image(x + dx, y + Math.abs(dx) / 2, key)
      .setScale(HEART_SCALE)
      .setDepth(DEPTH);
    scene.tweens.add({
      targets: heart,
      y: heart.y - 70,
      alpha: 0,
      delay: i * 90,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => heart.destroy(),
    });
  });
}

/** A small "?" thought bubble at (x, y) that pops in, stays a moment and fades. */
export function questionBubble(scene: Phaser.Scene, x: number, y: number): void {
  const bubble = scene.add.container(x, y).setDepth(DEPTH).setScale(0);
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1).lineStyle(4, 0xc7b3f0, 1);
  g.fillCircle(0, 0, 34).strokeCircle(0, 0, 34);
  g.fillCircle(-30, 34, 8).strokeCircle(-30, 34, 8);
  bubble.add([g, scene.add.text(0, 0, '?', text(44, CSS.ink)).setOrigin(0.5)]);
  scene.tweens.chain({
    targets: bubble,
    tweens: [
      { scale: 1, duration: 220, ease: 'Back.easeOut' },
      { alpha: 0, delay: 1100, duration: 300 },
    ],
    onComplete: () => bubble.destroy(),
  });
}

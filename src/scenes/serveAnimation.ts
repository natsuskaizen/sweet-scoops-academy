/**
 * The shopkeeper serving: a paw reaches into the flavour's tub in the
 * display case, carries each scoop over and drops it on the cone, then the
 * shopkeeper cheers. The scoops end up inside the treat container, so the
 * treat travels to the customer as one piece afterwards.
 */
import type Phaser from 'phaser';
import type { CharacterView } from '../characters/characterManager';
import { makePixelTexture } from '../characters/pixelArt';
import { GAME_CONFIG } from '../config/gameConfig';
import { tubSpot } from './shopRoom';

const PAW = ['..ooo..', '.obbbo.', 'obbbbbo', 'obbbbbo', 'obbbbbo', '.obbbo.', '..ooo..'];
const PAW_SCALE = 6;
const SCOOP_SCALE = 6;
/** Each scoop sits this far above the one under it, in the treat's own coordinates. */
const SCOOP_STEP = 22;

const tween = (scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> =>
  new Promise((resolve) => scene.tweens.add({ ...config, onComplete: () => resolve() }));

function makePaw(scene: Phaser.Scene, keeper: CharacterView): Phaser.GameObjects.Image {
  const color = `#${keeper.bodyColor().toString(16).padStart(6, '0')}`;
  const key = makePixelTexture(scene, `paw-${color}`, PAW, (ch) => ({ o: '#3b2f45', b: color })[ch] ?? null);
  return scene.add
    .image(keeper.x - 40, keeper.y - 30, key)
    .setScale(PAW_SCALE)
    .setDepth(47);
}

/** Reaches into the tub, carries one scoop to the cone and drops it into the treat. */
async function oneScoop(
  scene: Phaser.Scene,
  paw: Phaser.GameObjects.Image,
  treat: Phaser.GameObjects.Container,
  flavor: string,
  index: number,
): Promise<void> {
  const { scoopReachMs, scoopCarryMs } = GAME_CONFIG.animation;
  const tub = tubSpot(flavor);
  await tween(scene, { targets: paw, x: tub.x, y: tub.y, duration: scoopReachMs, ease: 'Quad.easeOut' });
  const scoop = scene.add
    .image(tub.x, tub.y + 10, `scoop-${flavor}`)
    .setOrigin(0.5, 1)
    .setScale(SCOOP_SCALE)
    .setDepth(46);
  const local = { x: 0, y: -index * SCOOP_STEP + 4 };
  const target = { x: treat.x + local.x, y: treat.y + local.y };
  await tween(scene, {
    targets: [paw, scoop],
    x: target.x,
    y: (t: Phaser.GameObjects.Image) => target.y - (t === paw ? 10 : 0),
    duration: scoopCarryMs,
    ease: 'Quad.easeInOut',
  });
  treat.add(scoop.setPosition(local.x, local.y));
  void tween(scene, { targets: scoop, scaleY: SCOOP_SCALE * 0.85, duration: 70, yoyo: true });
}

/** Scoops `count` balls of `flavor` onto the cone in `treat`. */
export async function scoopOntoCone(
  scene: Phaser.Scene,
  keeper: CharacterView,
  treat: Phaser.GameObjects.Container,
  flavor: string,
  count: number,
): Promise<void> {
  const paw = makePaw(scene, keeper);
  for (let i = 0; i < count; i++) await oneScoop(scene, paw, treat, flavor, i);
  void tween(scene, { targets: paw, alpha: 0, x: keeper.x - 40, y: keeper.y - 30, duration: 200 }).then(() =>
    paw.destroy(),
  );
  await keeper.cheer();
}

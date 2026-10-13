/**
 * The shopkeeper serving: her scooper dips into the flavour's tub in the
 * display case, carries each scoop over in its bowl and drops it on the cone,
 * then the shopkeeper cheers. The scoops end up inside the treat container,
 * so the treat travels to the customer as one piece afterwards.
 */
import type Phaser from 'phaser';
import type { CharacterView } from '../characters/characterManager';
import { SCOOPER_BOWL, SCOOPER_LOOKS, scooperTexture, sparkleTexture, type ScooperId } from '../characters/scooperArt';
import { GAME_CONFIG } from '../config/gameConfig';
import { tweenAsync } from '../ui/tweenAsync';
import { tubSpot } from './shopRoom';

const SCOOPER_SCALE = 6;
const SCOOP_SCALE = 6;
/** Each scoop sits this far above the one under it, in the treat's own coordinates. */
const SCOOP_STEP = 22;

function makeScooper(scene: Phaser.Scene, keeper: CharacterView, id: ScooperId): Phaser.GameObjects.Image {
  const color = `#${keeper.bodyColor().toString(16).padStart(6, '0')}`;
  return scene.add
    .image(keeper.x - 40, keeper.y - 30, scooperTexture(scene, id, color))
    .setOrigin(SCOOPER_BOWL.x, SCOOPER_BOWL.y)
    .setScale(SCOOPER_SCALE)
    .setDepth(47);
}

/** The fancier scoopers throw a few sparkles as each scoop lands. */
function sparkle(scene: Phaser.Scene, id: ScooperId, x: number, y: number): void {
  SCOOPER_LOOKS[id].sparkles.forEach((color, i) => {
    const star = scene.add
      .image(x + (i - 1) * 26, y - (i % 2) * 18, sparkleTexture(scene))
      .setScale(4)
      .setTint(Number.parseInt(color.slice(1), 16))
      .setDepth(48);
    void tweenAsync(scene, { targets: star, y: star.y - 30, alpha: 0, duration: 500, delay: i * 60 }).then(() =>
      star.destroy(),
    );
  });
}

/** Dips into the tub, carries one scoop to the cone in the bowl and drops it into the treat. */
async function oneScoop(
  scene: Phaser.Scene,
  scooper: Phaser.GameObjects.Image,
  treat: Phaser.GameObjects.Container,
  flavor: string,
  index: number,
): Promise<void> {
  const { scoopReachMs, scoopCarryMs } = GAME_CONFIG.animation;
  const tub = tubSpot(flavor);
  await tweenAsync(scene, { targets: scooper, x: tub.x, y: tub.y, duration: scoopReachMs, ease: 'Quad.easeOut' });
  const scoop = scene.add
    .image(tub.x, tub.y + 10, `scoop-${flavor}`)
    .setOrigin(0.5, 1)
    .setScale(SCOOP_SCALE)
    .setDepth(46);
  const local = { x: 0, y: -index * SCOOP_STEP + 4 };
  const target = { x: treat.x + local.x, y: treat.y + local.y };
  await tweenAsync(scene, {
    targets: [scooper, scoop],
    x: target.x,
    y: target.y,
    duration: scoopCarryMs,
    ease: 'Quad.easeInOut',
  });
  sparkle(scene, scooper.getData('id') as ScooperId, target.x, target.y - 40);
  treat.add(scoop.setPosition(local.x, local.y));
  void tweenAsync(scene, { targets: scoop, scaleY: SCOOP_SCALE * 0.85, duration: 70, yoyo: true });
}

/** Scoops `count` balls of `flavor` onto the cone in `treat` with the shopkeeper's scooper. */
export async function scoopOntoCone(
  scene: Phaser.Scene,
  server: { keeper: CharacterView; scooper: ScooperId },
  treat: Phaser.GameObjects.Container,
  flavor: string,
  count: number,
): Promise<void> {
  const { keeper } = server;
  const scooper = makeScooper(scene, keeper, server.scooper).setData('id', server.scooper);
  for (let i = 0; i < count; i++) await oneScoop(scene, scooper, treat, flavor, i);
  void tweenAsync(scene, { targets: scooper, alpha: 0, x: keeper.x - 40, y: keeper.y - 30, duration: 200 }).then(() =>
    scooper.destroy(),
  );
  await keeper.cheer();
}

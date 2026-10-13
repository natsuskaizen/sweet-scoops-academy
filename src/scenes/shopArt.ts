/**
 * Shop art: small prop textures, the pixel-art room (painted in shopRoom.ts)
 * and the decorations placed in it.
 */
import type Phaser from 'phaser';
import { makePixelTexture } from '../characters/pixelArt';
import { FLAVOR_COLORS } from '../characters/sprites';
import { itemById, type ShopSpot } from '../shop/catalog';
import type { PlacedDecoration } from '../save/saveTypes';
import { Pixels } from './roomPixels';
import { COUNTER_ART, paintCounter, paintRoom, ROOM_ART, ROOM_OUTLINE, ROOM_SCALE, ROOM_TEXT } from './shopRoom';
import { COLORS, CSS, text } from '../ui/theme';

/** Small pixel textures used across the scene. */
export function createPropTextures(scene: Phaser.Scene): void {
  makePixelTexture(
    scene,
    'sprinkle-icon',
    ['...p...', '..ppp..', 'ppwppbp', '.pppppp', '..pbpp.', '.pp.pp.', '.p...p.'],
    (ch) => ({ p: '#ff8fb3', w: '#ffffff', b: '#7fb8f0' })[ch] ?? null,
  );
  makePixelTexture(
    scene,
    'cone',
    ['oooooooo', 'oyyyyyyo', '.oyxyyo.', '.oyyxyo.', '..oyyo..', '..oxyo..', '...oo...'],
    (ch) => ({ o: '#9a6b52', y: '#f5c27a', x: '#e0a65a' })[ch] ?? null,
  );
  // Cup for the hint and explanation board; stretched to fit its scoops.
  makePixelTexture(
    scene,
    'aid-cup',
    ['oooooooooooo', 'owwwwwwwwwwo', '.oppPppPppo.', '.oppPppPppo.', '..opPppPpo..', '..oooooooo..'],
    (ch) => ({ o: '#7a4a62', w: '#fffaf3', p: '#ff8fb3', P: '#ffd1df' })[ch] ?? null,
  );
  for (const [flavor, color] of Object.entries(FLAVOR_COLORS)) {
    makePixelTexture(
      scene,
      `scoop-${flavor}`,
      ['..oooo..', '.oSSSSo.', 'oSWSSSSo', 'oSSSSSSo', 'oSSSSSSo', '.oooooo.'],
      (ch) => ({ o: '#7a5a6a', S: color, W: '#ffffff' })[ch] ?? null,
    );
  }
}

/** Paints a pixel-art canvas texture once; later scenes (after a rotation) reuse it. */
function paintTexture(scene: Phaser.Scene, key: string, size: { w: number; h: number }, paint: (p: Pixels) => void) {
  if (scene.textures.exists(key)) return;
  const canvas = scene.textures.createCanvas(key, size.w, size.h);
  if (!canvas) throw new Error(`Could not create texture ${key}`);
  paint(new Pixels(canvas.getContext(), ROOM_OUTLINE));
  canvas.refresh();
}

export function drawShopRoom(scene: Phaser.Scene): void {
  paintTexture(scene, 'room', ROOM_ART, paintRoom);
  paintTexture(scene, 'room-counter', COUNTER_ART, paintCounter);
  scene.add.image(ROOM_ART.x, ROOM_ART.y, 'room').setOrigin(0).setScale(ROOM_SCALE).setDepth(0);
  // The counter sits on a higher layer so it hides the shopkeeper's legs.
  scene.add.image(COUNTER_ART.x, COUNTER_ART.y, 'room-counter').setOrigin(0).setScale(ROOM_SCALE).setDepth(30);
  const { sign, open } = ROOM_TEXT;
  scene.add
    .text(sign.x, sign.y, 'Sweet Scoops', text(40, CSS.white, { stroke: CSS.ink, strokeThickness: 6 }))
    .setOrigin(0.5)
    .setDepth(1);
  scene.add.text(open.x, open.y, 'OPEN', text(20, CSS.white)).setOrigin(0.5).setDepth(1);
}

const SPOTS: Record<ShopSpot, { x: number; y: number }> = {
  'wall-left': { x: 200, y: 420 },
  'wall-right': { x: 450, y: 250 },
  'floor-left': { x: 200, y: 640 },
  'floor-center': { x: 360, y: 790 },
  'counter-top': { x: 760, y: 486 },
  window: { x: 324, y: 330 },
};

/** Places owned decorations in the room (Milestone 3 adds buying them). */
export function drawDecorations(scene: Phaser.Scene, decorations: readonly PlacedDecoration[]): void {
  for (const deco of decorations) {
    const item = itemById(deco.itemId);
    if (!item) continue;
    const { x, y } = SPOTS[deco.spot];
    const g = scene.add.graphics().setDepth(deco.spot === 'counter-top' ? 31 : 2);
    if (item.asset === 'deco-plant') {
      g.fillStyle(COLORS.peach, 1).fillRoundedRect(x - 26, y - 40, 52, 44, 8);
      g.fillStyle(COLORS.mintDark, 1)
        .fillEllipse(x, y - 64, 70, 50)
        .fillEllipse(x - 22, y - 86, 34, 40)
        .fillEllipse(x + 20, y - 90, 30, 44);
    } else if (item.asset === 'deco-lamp') {
      g.fillStyle(COLORS.lavenderDark, 1).fillRect(x - 4, y - 50, 8, 50);
      g.fillStyle(COLORS.white, 1)
        .fillCircle(x - 14, y - 60, 16)
        .fillCircle(x + 8, y - 64, 20)
        .fillCircle(x + 22, y - 56, 13);
    } else if (item.asset === 'deco-frame') {
      g.fillStyle(COLORS.brown, 1).fillRect(x - 40, y - 50, 80, 100);
      g.fillStyle(COLORS.sky, 1).fillRect(x - 32, y - 42, 64, 84);
      g.fillStyle(COLORS.peach, 1).fillTriangle(x - 12, y, x + 12, y, x, y + 30);
      g.fillStyle(COLORS.strawberry, 1).fillCircle(x, y - 8, 14);
    }
  }
}

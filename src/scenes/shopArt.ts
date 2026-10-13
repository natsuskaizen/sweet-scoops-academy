/**
 * Shop art: small prop textures and the pixel-art room (painted in
 * shopRoom.ts). Decorations are drawn by decorArt.ts.
 */
import type Phaser from 'phaser';
import { makePixelTexture } from '../characters/pixelArt';
import { FLAVOR_COLORS } from '../characters/sprites';
import { Pixels } from './roomPixels';
import { COUNTER_ART, paintCounter, paintRoom, roomArt, ROOM_OUTLINE, ROOM_SCALE, ROOM_TEXT } from './shopRoom';
import { CSS, text } from '../ui/theme';

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
  const room = roomArt();
  // One texture per screen shape, so a rotation repaints at the new size.
  const key = `room-${room.w}x${room.h}`;
  paintTexture(scene, key, room, paintRoom);
  paintTexture(scene, 'room-counter', COUNTER_ART, paintCounter);
  scene.add.image(room.x, room.y, key).setOrigin(0).setScale(ROOM_SCALE).setDepth(0);
  // The counter sits on a higher layer so it hides the shopkeeper's legs.
  scene.add.image(COUNTER_ART.x, COUNTER_ART.y, 'room-counter').setOrigin(0).setScale(ROOM_SCALE).setDepth(30);
  const { sign, open } = ROOM_TEXT;
  scene.add
    .text(sign.x, sign.y, 'Sweet Scoops', text(40, CSS.white, { stroke: CSS.ink, strokeThickness: 6 }))
    .setOrigin(0.5)
    .setDepth(1);
  scene.add.text(open.x, open.y, 'OPEN', text(20, CSS.white)).setOrigin(0.5).setDepth(1);
}

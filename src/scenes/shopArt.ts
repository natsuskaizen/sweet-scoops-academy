/**
 * Procedural placeholder art for the shop room and small props. Drawn with
 * chunky, flat shapes in the pastel palette; real pixel-art textures can
 * replace any of these functions later.
 */
import type Phaser from 'phaser';
import { makePixelTexture } from '../characters/pixelArt';
import { FLAVOR_COLORS } from '../characters/sprites';
import { itemById, type ShopSpot } from '../shop/catalog';
import type { PlacedDecoration } from '../save/saveTypes';
import { COLORS, CSS, LAYOUT, text } from '../ui/theme';

const hex = (css: string): number => Number.parseInt(css.replace('#', ''), 16);

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

export function drawShopRoom(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(0);
  drawWallAndFloor(g);
  drawWindowAndDoor(scene, g);
  drawDisplayCase(g);
  drawSignAndCounter(scene, g);
}

function drawWallAndFloor(g: Phaser.GameObjects.Graphics): void {
  const { shop, wallBottom } = LAYOUT;
  // Wallpaper: cream with soft strawberry stripes.
  g.fillStyle(COLORS.cream, 1).fillRect(shop.x, shop.y, shop.w, wallBottom - shop.y);
  g.fillStyle(0xffe3ec, 1);
  for (let x = 0; x < shop.w; x += 48) g.fillRect(x, shop.y, 22, wallBottom - shop.y);
  g.fillStyle(COLORS.mint, 1).fillRect(0, wallBottom - 26, shop.w, 26);
  g.fillStyle(COLORS.mintDark, 1).fillRect(0, wallBottom - 6, shop.w, 6);

  // Checkered floor.
  const tile = 48;
  for (let y = wallBottom; y < shop.y + shop.h; y += tile) {
    for (let x = 0; x < shop.w; x += tile) {
      const even = (x / tile + Math.floor((y - wallBottom) / tile)) % 2 === 0;
      g.fillStyle(even ? 0xdff6ea : COLORS.cream, 1).fillRect(x, y, tile, tile);
    }
  }
}

function drawWindowAndDoor(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics): void {
  const { door } = LAYOUT;

  // Window with clouds.
  g.fillStyle(COLORS.brown, 1).fillRoundedRect(226, 196, 196, 150, 14);
  g.fillStyle(0xcfe8ff, 1).fillRoundedRect(236, 206, 176, 130, 10);
  g.fillStyle(COLORS.white, 1).fillCircle(290, 250, 18).fillCircle(312, 244, 22).fillCircle(334, 252, 16);
  g.fillStyle(COLORS.brown, 1).fillRect(320, 206, 8, 130).fillRect(236, 268, 176, 8);

  // Door.
  g.fillStyle(COLORS.brownDark, 1).fillRoundedRect(door.x - 8, door.y - 8, door.w + 16, door.h + 8, 16);
  g.fillStyle(COLORS.sky, 1).fillRoundedRect(door.x, door.y, door.w, door.h, 12);
  g.fillStyle(0xcfe8ff, 1).fillRoundedRect(door.x + 22, door.y + 22, door.w - 44, 80, 30);
  g.fillStyle(COLORS.cream, 1).fillCircle(door.x + door.w - 22, door.y + door.h / 2 + 20, 7);
  g.fillStyle(COLORS.strawberry, 1).fillRoundedRect(door.x + 20, door.y + 120, door.w - 40, 34, 8);
  scene.add
    .text(door.x + door.w / 2, door.y + 137, 'OPEN', text(20, CSS.white))
    .setOrigin(0.5)
    .setDepth(1);
}

function drawDisplayCase(g: Phaser.GameObjects.Graphics): void {
  // Display case of ice cream tubs behind the counter.
  const caseX = 470;
  const caseY = 330;
  g.fillStyle(COLORS.brown, 1).fillRoundedRect(caseX, caseY, 320, 150, 14);
  g.fillStyle(0xeaf6ff, 1).fillRoundedRect(caseX + 10, caseY + 10, 300, 130, 10);
  const tubColors = Object.values(FLAVOR_COLORS).map(hex);
  tubColors.slice(0, 6).forEach((c, i) => {
    const tx = caseX + 22 + (i % 3) * 98;
    const ty = caseY + 22 + Math.floor(i / 3) * 62;
    g.fillStyle(0xbfc7d6, 1).fillRect(tx, ty + 18, 82, 34);
    g.fillStyle(c, 1).fillEllipse(tx + 41, ty + 20, 80, 30);
  });
}

function drawSignAndCounter(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics): void {
  const { counter } = LAYOUT;
  // Shop sign.
  g.fillStyle(COLORS.strawberry, 1).fillRoundedRect(226, 100, 380, 70, 22);
  g.lineStyle(5, COLORS.strawberryDark, 1).strokeRoundedRect(226, 100, 380, 70, 22);
  scene.add.text(416, 135, 'Sweet Scoops', text(42, CSS.white)).setOrigin(0.5).setDepth(1);

  // Counter (drawn on a higher layer so it hides the shopkeeper's legs).
  const c = scene.add.graphics().setDepth(30);
  c.fillStyle(COLORS.creamDark, 1).fillRoundedRect(counter.x - 10, counter.y - 24, counter.w + 20, 34, 10);
  c.fillStyle(COLORS.cream, 1).fillRoundedRect(counter.x - 10, counter.y - 30, counter.w + 20, 26, 10);
  c.fillStyle(COLORS.strawberry, 1).fillRect(counter.x, counter.y + 4, counter.w, counter.h);
  c.fillStyle(0xffb3ca, 1);
  for (let x = counter.x + 10; x < counter.x + counter.w; x += 40) c.fillRect(x, counter.y + 4, 18, counter.h);
  c.fillStyle(COLORS.strawberryDark, 1).fillRect(counter.x, counter.y + counter.h - 2, counter.w, 8);
}

const SPOTS: Record<ShopSpot, { x: number; y: number }> = {
  'wall-left': { x: 200, y: 420 },
  'wall-right': { x: 450, y: 250 },
  'floor-left': { x: 200, y: 640 },
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

import type Phaser from 'phaser';

/**
 * Turns a text pixel map into a Phaser canvas texture at 1 texel per pixel.
 * Images using it are scaled up with nearest-neighbour filtering
 * (pixelArt: true in the game config) so edges stay crisp.
 */
export function makePixelTexture(
  scene: Phaser.Scene,
  key: string,
  rows: readonly string[],
  colorFor: (ch: string, x: number, y: number) => string | null,
): string {
  if (scene.textures.exists(key)) return key;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = scene.textures.createCanvas(key, w, h);
  if (!canvas) throw new Error(`Could not create texture ${key}`);
  const ctx = canvas.getContext();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      const color = colorFor(ch, x, y);
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  canvas.refresh();
  return key;
}

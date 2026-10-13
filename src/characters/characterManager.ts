/**
 * Layered character rendering.
 *
 *   base body (species + palette + expression)
 *   + outfit + hat + bow + handheld   (each its own texture on the same grid)
 *
 * Swapping clothes is just swapping one layer's texture, which is how
 * Milestone 3 equipment will plug in. Placeholder art comes from sprites.ts;
 * authorised art can replace a texture key without touching game logic.
 */
import Phaser from 'phaser';
import { makePixelTexture } from './pixelArt';
import {
  EYES,
  EYES_PUPPY,
  LAYER_ART,
  LAYER_COLORS,
  SPECIES_ART,
  SPECIES_PALETTE,
  SPRITE_H,
  SPRITE_W,
  type Expression,
  type LayerId,
  type Palette,
  type SpeciesId,
} from './sprites';
import { CHAR_SCALE } from '../ui/theme';

export type CharacterLayerSlot = 'outfit' | 'hat' | 'bow' | 'handheld';
const LAYER_ORDER: CharacterLayerSlot[] = ['outfit', 'bow', 'hat', 'handheld'];

export interface CharacterLook {
  species: SpeciesId;
  palette?: Partial<Palette>;
  layers?: Partial<Record<CharacterLayerSlot, LayerId>>;
}

function applyExpression(species: SpeciesId, rows: string[], expression: Expression): string[] {
  if (expression === 'neutral') return rows;
  const grid = rows.map((r) => r.split(''));
  const eyes = species === 'puppy' ? EYES_PUPPY : EYES;
  for (const eye of [eyes.left, eyes.right]) {
    // Clear the two-pixel tall eye...
    grid[eye.y]![eye.x] = 'B';
    grid[eye.y + 1]![eye.x] = 'B';
    if (expression === 'happy') {
      // ...and draw a ^ shape.
      grid[eye.y]![eye.x] = 'k';
      grid[eye.y + 1]![eye.x - 1] = 'k';
      grid[eye.y + 1]![eye.x + 1] = 'k';
    } else {
      // thinking: eyes glance up
      grid[eye.y]![eye.x] = 'k';
      grid[eye.y]![eye.x + 1] = 'k';
    }
  }
  return grid.map((r) => r.join(''));
}

function paletteKey(p: Partial<Palette>): string {
  return Object.entries(p)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}${v}`)
    .join('')
    .replace(/#/g, '');
}

export function bodyTextureKey(scene: Phaser.Scene, look: CharacterLook, expression: Expression): string {
  const palette: Palette = { ...SPECIES_PALETTE[look.species], ...look.palette };
  const key = `char-${look.species}-${paletteKey(look.palette ?? {})}-${expression}`;
  const rows = applyExpression(look.species, SPECIES_ART[look.species], expression);
  return makePixelTexture(scene, key, rows, (ch) => palette[ch as keyof Palette] ?? null);
}

export function layerTextureKey(scene: Phaser.Scene, layer: LayerId): string {
  return makePixelTexture(scene, `layer-${layer}`, LAYER_ART[layer], (ch) => LAYER_COLORS[ch] ?? null);
}

export class CharacterView extends Phaser.GameObjects.Container {
  private base: Phaser.GameObjects.Image;
  private layerImages = new Map<CharacterLayerSlot, Phaser.GameObjects.Image>();
  private bobTween?: Phaser.Tweens.Tween;
  private expression: Expression = 'neutral';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private look: CharacterLook,
  ) {
    super(scene, x, y);
    // Origin at the feet so y is "where they stand".
    this.base = scene.add.image(0, 0, bodyTextureKey(scene, look, 'neutral')).setOrigin(0.5, 1);
    this.add(this.base);
    for (const slot of LAYER_ORDER) {
      const layer = look.layers?.[slot];
      if (layer) this.setLayer(slot, layer);
    }
    this.setScale(CHAR_SCALE);
    this.setSize(SPRITE_W, SPRITE_H);
    scene.add.existing(this);
  }

  setExpression(expression: Expression): this {
    if (expression !== this.expression) {
      this.expression = expression;
      this.base.setTexture(bodyTextureKey(this.scene, this.look, expression));
    }
    return this;
  }

  /** Equip (or with null, remove) one clothing/accessory layer. */
  setLayer(slot: CharacterLayerSlot, layer: LayerId | null): this {
    this.layerImages.get(slot)?.destroy();
    this.layerImages.delete(slot);
    if (layer) {
      const img = this.scene.add.image(0, 0, layerTextureKey(this.scene, layer)).setOrigin(0.5, 1);
      this.layerImages.set(slot, img);
      this.add(img);
      // Keep stacking order stable regardless of equip order.
      for (const s of LAYER_ORDER) {
        const i = this.layerImages.get(s);
        if (i) this.bringToTop(i);
      }
    }
    return this;
  }

  /** Gentle idle bounce. */
  idle(on: boolean): this {
    this.bobTween?.stop();
    this.bobTween = undefined;
    this.base.y = 0;
    for (const img of this.layerImages.values()) img.y = 0;
    if (on) {
      this.bobTween = this.scene.tweens.add({
        targets: [this.base, ...this.layerImages.values()],
        y: -1,
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    return this;
  }

  /** Hop in place (happy reaction). */
  hop(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        y: this.y - 24,
        duration: 140,
        yoyo: true,
        repeat: 1,
        ease: 'Quad.easeOut',
        onComplete: () => resolve(),
      });
    });
  }

  /** Walk to x with a little waddle. */
  walkTo(x: number, msPerPixel = 3.2): Promise<void> {
    const distance = Math.abs(this.x - x);
    this.setFlipX(x < this.x);
    return new Promise((resolve) => {
      const waddle = this.scene.tweens.add({
        targets: this,
        angle: { from: -4, to: 4 },
        duration: 160,
        yoyo: true,
        repeat: -1,
      });
      this.scene.tweens.add({
        targets: this,
        x,
        duration: Math.max(200, distance * msPerPixel),
        ease: 'Linear',
        onComplete: () => {
          waddle.stop();
          this.angle = 0;
          this.setFlipX(false);
          resolve();
        },
      });
    });
  }

  private setFlipX(flip: boolean): void {
    this.scaleX = Math.abs(this.scaleX) * (flip ? -1 : 1);
  }
}

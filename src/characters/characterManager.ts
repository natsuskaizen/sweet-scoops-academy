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
import {
  FRIEND_ART,
  FRIEND_H,
  FRIEND_IDS,
  FRIEND_W,
  friendColor,
  friendFrames,
  type FriendArt,
  type FriendId,
} from './friendArt';
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
import { frameFor, hasWalkFrames, type AddedCharacter, type Pose } from '../shop/addedCharacters';
import { CHAR_SCALE } from '../ui/theme';

export type CharacterLayerSlot = 'outfit' | 'hat' | 'bow' | 'handheld';
const LAYER_ORDER: CharacterLayerSlot[] = ['outfit', 'bow', 'hat', 'handheld'];

export interface CharacterLook {
  species: SpeciesId;
  palette?: Partial<Palette>;
  layers?: Partial<Record<CharacterLayerSlot, LayerId>>;
}

/** A character drawn from a sprite sheet (the built-in friends, or a picture a grown-up added) instead of a species. */
export interface SheetLook {
  sheet: { key: string; frames: number; frameW: number; frameH: number };
}

export type AnyLook = CharacterLook | SheetLook;
const isSheet = (look: AnyLook): look is SheetLook => 'sheet' in look;

const POSES: Record<Expression, Pose> = { neutral: 'stand', happy: 'happy', thinking: 'thinking' };

export const addedTextureKey = (id: string): string => `added-char-${id}`;

/** Decodes added characters' pictures into sprite sheets; pictures that fail to decode are skipped. */
export async function registerAddedTextures(scene: Phaser.Scene, characters: readonly AddedCharacter[]): Promise<void> {
  await Promise.all(
    characters.map(async (c) => {
      const key = addedTextureKey(c.id);
      if (scene.textures.exists(key)) return;
      const img = new Image();
      img.src = c.image;
      try {
        await img.decode();
      } catch {
        console.warn(`Picture for ${c.name} could not be decoded.`);
        return;
      }
      if (!scene.textures.exists(key))
        scene.textures.addSpriteSheet(key, img, { frameWidth: c.frameW, frameHeight: c.frameH });
    }),
  );
}

/** How to draw an added character, or null if its picture isn't loaded. */
export function addedLook(scene: Phaser.Scene, c: AddedCharacter): SheetLook | null {
  const key = addedTextureKey(c.id);
  if (!scene.textures.exists(key)) return null;
  return { sheet: { key, frames: c.frames, frameW: c.frameW, frameH: c.frameH } };
}

const friendTextureKey = (id: FriendId): string => `friend-${id}`;

/** Draws each built-in friend's frames side by side into one sprite sheet. */
export function registerFriendTextures(scene: Phaser.Scene): void {
  for (const id of FRIEND_IDS) {
    const key = friendTextureKey(id);
    if (scene.textures.exists(key)) continue;
    const art: FriendArt = FRIEND_ART[id];
    const frames = friendFrames(art);
    const rows = Array.from({ length: FRIEND_H }, (_, y) => frames.map((f) => f[y]).join(''));
    const texture = scene.textures.get(makePixelTexture(scene, key, rows, (ch) => friendColor(art, ch)));
    frames.forEach((_, i) => texture.add(i, 0, i * FRIEND_W, 0, FRIEND_W, FRIEND_H));
  }
}

export function friendLook(id: FriendId): SheetLook {
  return { sheet: { key: friendTextureKey(id), frames: 3, frameW: FRIEND_W, frameH: FRIEND_H } };
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
  private stopStepping: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private look: AnyLook,
  ) {
    super(scene, x, y);
    // Origin at the feet so y is "where they stand".
    this.base = isSheet(look)
      ? scene.add.image(0, 0, look.sheet.key, 0).setOrigin(0.5, 1)
      : scene.add.image(0, 0, bodyTextureKey(scene, look, 'neutral')).setOrigin(0.5, 1);
    this.add(this.base);
    if (!isSheet(look)) {
      for (const slot of LAYER_ORDER) {
        const layer = look.layers?.[slot];
        if (layer) this.setLayer(slot, layer);
      }
    }
    // Sheets are the 16x20 grid times 1-4, drawn at the same height as the species characters.
    const frameW = isSheet(look) ? look.sheet.frameW : SPRITE_W;
    this.setScale((CHAR_SCALE * SPRITE_W) / frameW);
    this.setSize(frameW, isSheet(look) ? look.sheet.frameH : SPRITE_H);
    scene.add.existing(this);
  }

  setExpression(expression: Expression): this {
    if (expression === this.expression) return this;
    this.expression = expression;
    if (isSheet(this.look)) this.showPose(POSES[expression]);
    else this.base.setTexture(bodyTextureKey(this.scene, this.look, expression));
    return this;
  }

  private showPose(pose: Pose): void {
    if (isSheet(this.look)) this.base.setFrame(frameFor(this.look.sheet.frames, pose));
  }

  /** Equip (or with null, remove) one clothing/accessory layer. Added characters wear them from Milestone 3. */
  setLayer(slot: CharacterLayerSlot, layer: LayerId | null): this {
    if (isSheet(this.look)) return this;
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
      const stop = this.startStepping();
      this.stopStepping = stop;
      this.scene.tweens.add({
        targets: this,
        x,
        duration: Math.max(200, distance * msPerPixel),
        ease: 'Linear',
        onComplete: () => {
          stop();
          this.stopStepping = null;
          this.setFlipX(false);
          resolve();
        },
      });
    });
  }

  /** Walk frames when the picture has them, otherwise a little waddle. Returns a stop function. */
  /** Ends any walk or hop at once, standing at (x, y). A walk cut short this way never resolves its promise. */
  arriveAt(x: number, y: number): this {
    this.scene.tweens.killTweensOf(this);
    this.stopStepping?.();
    this.stopStepping = null;
    this.angle = 0;
    this.setFlipX(false);
    return this.setPosition(x, y);
  }

  private startStepping(): () => void {
    if (isSheet(this.look) && hasWalkFrames(this.look.sheet.frames)) {
      let step = 0;
      const timer = this.scene.time.addEvent({
        delay: 160,
        loop: true,
        callback: () => this.showPose(++step % 2 === 0 ? 'walkA' : 'walkB'),
      });
      this.showPose('walkA');
      return () => {
        timer.remove();
        this.showPose(POSES[this.expression]);
      };
    }
    const waddle = this.scene.tweens.add({
      targets: this,
      angle: { from: -4, to: 4 },
      duration: 160,
      yoyo: true,
      repeat: -1,
    });
    return () => {
      waddle.stop();
      this.angle = 0;
    };
  }

  private setFlipX(flip: boolean): void {
    this.scaleX = Math.abs(this.scaleX) * (flip ? -1 : 1);
  }
}

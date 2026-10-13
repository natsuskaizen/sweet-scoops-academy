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
import { MOMO_HATLESS } from './wearArt';
import { hearts, questionBubble } from './reactions';
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
import { GAME_CONFIG } from '../config/gameConfig';
import { CHAR_SCALE } from '../ui/theme';
import { tweenAsync } from '../ui/tweenAsync';

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
const FRIEND_FRAMES = 6;

/** Momo's picture with and without her chef hat, for dressMomo(). */
export const MOMO_SHEETS = { withHat: friendTextureKey('momo'), hatless: 'friend-momo-hatless' } as const;

/** Draws a friend's frames side by side into one sprite sheet. */
function registerSheet(scene: Phaser.Scene, key: string, art: FriendArt): void {
  if (scene.textures.exists(key)) return;
  const frames = friendFrames(art);
  const rows = Array.from({ length: FRIEND_H }, (_, y) => frames.map((f) => f[y]).join(''));
  const texture = scene.textures.get(makePixelTexture(scene, key, rows, (ch) => friendColor(art, ch)));
  frames.forEach((_, i) => texture.add(i, 0, i * FRIEND_W, 0, FRIEND_W, FRIEND_H));
}

export function registerFriendTextures(scene: Phaser.Scene): void {
  for (const id of FRIEND_IDS) registerSheet(scene, friendTextureKey(id), FRIEND_ART[id]);
  registerSheet(scene, MOMO_SHEETS.hatless, MOMO_HATLESS);
}

export function friendLook(id: FriendId): SheetLook {
  return { sheet: { key: friendTextureKey(id), frames: FRIEND_FRAMES, frameW: FRIEND_W, frameH: FRIEND_H } };
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
  /** Closet items drawn over a sheet character. */
  private worn: Phaser.GameObjects.Image[] = [];
  private idling = false;
  private bobTween?: Phaser.Tweens.Tween;
  private blinkTimer?: Phaser.Time.TimerEvent;
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
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.bobTween?.stop();
      this.blinkTimer?.remove();
    });
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

  /** Swaps a sheet character's picture for another the same size (Momo without her chef hat). */
  setSheet(key: string): this {
    if (!isSheet(this.look) || this.look.sheet.key === key) return this;
    this.look = { sheet: { ...this.look.sheet, key } };
    this.base.setTexture(key, this.base.frame.name);
    return this;
  }

  /** Dresses a sheet character in items drawn on its own frame, back to front, replacing what it wore. */
  dress(textureKeys: readonly string[]): this {
    for (const img of this.worn) img.destroy();
    this.worn = textureKeys.map((key) => this.scene.add.image(0, 0, key).setOrigin(0.5, 1));
    this.add(this.worn);
    if (this.idling) this.idle(true);
    return this;
  }

  /** Waiting: slow breathing, and a blink now and then for characters that have the frame. */
  idle(on: boolean): this {
    this.idling = on;
    this.bobTween?.stop();
    this.bobTween = undefined;
    this.blinkTimer?.remove();
    this.blinkTimer = undefined;
    const parts = [this.base, ...this.layerImages.values(), ...this.worn];
    for (const part of parts) part.setScale(1);
    if (on) {
      this.bobTween = this.scene.tweens.add({
        targets: parts,
        scaleX: 1.02,
        scaleY: 0.97,
        duration: GAME_CONFIG.animation.breatheMs,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.scheduleBlink();
    }
    return this;
  }

  private scheduleBlink(): void {
    const { blinkMs, blinkGapMs } = GAME_CONFIG.animation;
    const canBlink = () => this.scene && this.expression === 'neutral' && !this.stopStepping;
    this.blinkTimer = this.scene.time.delayedCall(Phaser.Math.Between(blinkGapMs.min, blinkGapMs.max), () => {
      if (canBlink()) {
        this.showPose('blink');
        this.scene.time.delayedCall(blinkMs, () => {
          if (canBlink()) this.showPose('stand');
        });
      }
      this.scheduleBlink();
    });
  }

  /** Jump for joy with a few hearts (a right answer). */
  cheer(): Promise<void> {
    hearts(this.scene, this.x, this.y - this.displayHeight - 10);
    return tweenAsync(this.scene, { targets: this, y: this.y - 40, duration: 180, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** A kind, puzzled head tilt with a question bubble (a first miss). */
  puzzled(): void {
    this.setExpression('thinking');
    questionBubble(this.scene, this.x + this.displayWidth * 0.75, this.y - this.displayHeight * 0.8);
    this.scene.tweens.add({
      targets: this,
      angle: { from: -7, to: 7 },
      duration: 320,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.angle = 0;
      },
    });
  }

  /** This character's body colour (sampled low on the left side), for a paw that reaches out. */
  bodyColor(): number {
    const { width, height, name } = this.base.frame;
    const pixel = this.scene.textures.getPixel(
      Math.floor(width * 0.3),
      Math.floor(height * 0.75),
      this.base.texture.key,
      name,
    );
    return pixel && pixel.alpha > 0 ? pixel.color : 0xffffff;
  }

  /** Hop in place (happy reaction). */
  hop(): Promise<void> {
    return tweenAsync(this.scene, {
      targets: this,
      y: this.y - 24,
      duration: 140,
      yoyo: true,
      repeat: 1,
      ease: 'Quad.easeOut',
    });
  }

  /** Walk to x with a little waddle. Settles when the walk ends, or early if arriveAt() cuts it short. */
  async walkTo(x: number, msPerPixel = 3.2): Promise<void> {
    const distance = Math.abs(this.x - x);
    this.setFlipX(x < this.x);
    this.stopStepping = this.startStepping();
    await tweenAsync(this.scene, { targets: this, x, duration: Math.max(200, distance * msPerPixel), ease: 'Linear' });
    this.endWalk();
  }

  /** Ends any walk or hop at once, standing at (x, y). */
  arriveAt(x: number, y: number): this {
    for (const tween of this.scene.tweens.getTweensOf(this)) tween.stop();
    this.endWalk();
    return this.setPosition(x, y);
  }

  private endWalk(): void {
    this.stopStepping?.();
    this.stopStepping = null;
    this.angle = 0;
    this.setFlipX(false);
  }

  /**
   * A gentle sway, plus stepping feet when the picture has walk frames: the
   * feet swap at each end of the sway, so the two always stay in step.
   * Returns a stop function.
   */
  private startStepping(): () => void {
    const feet = isSheet(this.look) && hasWalkFrames(this.look.sheet.frames);
    let left = true;
    const stepFoot = () => {
      if (!feet) return;
      left = !left;
      this.showPose(left ? 'walkA' : 'walkB');
    };
    stepFoot();
    const sway = this.scene.tweens.add({
      targets: this,
      angle: { from: -3, to: 3 },
      duration: GAME_CONFIG.animation.stepMs,
      yoyo: true,
      repeat: -1,
      onYoyo: stepFoot,
      onRepeat: stepFoot,
    });
    return () => {
      sway.stop();
      this.angle = 0;
      if (feet) this.showPose(POSES[this.expression]);
    };
  }

  private setFlipX(flip: boolean): void {
    this.scaleX = Math.abs(this.scaleX) * (flip ? -1 : 1);
  }
}

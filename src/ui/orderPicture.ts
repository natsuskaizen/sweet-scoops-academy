/**
 * Draws an OrderPicture (an order for players who can't read yet) with the
 * shop's pixel-art scoops, in the speech bubble or on the ticket. Every
 * scoop is whole and sits clear of the cone and of its neighbours, so a
 * child counting them never has to guess whether a half-hidden one counts.
 */
import type Phaser from 'phaser';
import type { OrderPicture } from '../learning/types';
import { wordTexture, WORD_ART_SIZE } from '../characters/wordArt';
import { SCOOP_W, gridPositions } from './aidLayout';
import { CSS, text, type Rect } from './theme';

/** Scoop art is 8x6 and the cone 8x7, in art pixels. */
const SCOOP_H = 6;
const CONE_H = 7;
/** A cone holds scoops in one column, then two side by side. */
const CONE_COLUMN = 5;
/** Room for a "+" between piles, in art pixels. */
const PLUS_W = 8;
const MAX_SCALE = 6;
/** Piles sit in rows of up to 5, like a ten frame. */
const PILE_ROW = 5;

type Objects = Phaser.GameObjects.GameObject[];

export function drawOrderPicture(scene: Phaser.Scene, picture: OrderPicture, area: Rect, flavor: string): Objects {
  if (picture.kind === 'sprite') return drawSprite(scene, picture, area);
  const key = scene.textures.exists(`scoop-${flavor}`) ? `scoop-${flavor}` : 'scoop-vanilla';
  return picture.kind === 'cone'
    ? drawCone(scene, picture.scoops, area, key)
    : drawPiles(scene, picture.parts, area, key);
}

/** The biggest a word picture is drawn: alone in a bubble, or beside its word on the ticket. */
const SPRITE_MAX_SCALE = 10;
const SPRITE_WITH_WORD_MAX_SCALE = 7;
/** Beside its word, a picture takes at most this much of the width. */
const PICTURE_SHARE = 0.4;
const WORD_GAP = 18;

/** A word's picture, with the word beside it (a missing first letter shows as "_") when there is one. */
function drawSprite(scene: Phaser.Scene, picture: Extract<OrderPicture, { kind: 'sprite' }>, area: Rect): Objects {
  const max = picture.word ? SPRITE_WITH_WORD_MAX_SCALE : SPRITE_MAX_SCALE;
  const byWidth = picture.word ? Math.floor((area.w * PICTURE_SHARE) / WORD_ART_SIZE) : max;
  const s = Math.max(1, Math.min(max, byWidth, Math.floor(area.h / WORD_ART_SIZE)));
  const size = WORD_ART_SIZE * s;
  const cy = area.y + area.h / 2;
  const image = scene.add.image(0, cy, wordTexture(scene, picture.key)).setScale(s);
  if (!picture.word) return [image.setX(area.x + area.w / 2)];
  const word = scene.add.text(0, cy, picture.word, text(Math.round(size * 0.9), CSS.ink)).setOrigin(0, 0.5);
  const room = area.w - size - WORD_GAP;
  if (word.width > room) word.setScale(room / word.width);
  const left = area.x + (area.w - size - WORD_GAP - word.displayWidth) / 2;
  image.setX(left + size / 2);
  return [image, word.setX(left + size + WORD_GAP)];
}

/** Largest whole-number scale (at most MAX_SCALE, at least 1) at which art of this size fits. */
function fitScale(artW: number, artH: number, area: Rect): number {
  return Math.max(1, Math.min(MAX_SCALE, Math.floor(Math.min(area.w / artW, area.h / artH))));
}

/** A cone with `scoops` stacked on it: one column up to 5, then two. */
function drawCone(scene: Phaser.Scene, scoops: number, area: Rect, key: string): Objects {
  const cols = scoops > CONE_COLUMN ? 2 : 1;
  const rows = Math.ceil(scoops / cols);
  const s = fitScale(cols * SCOOP_W, rows * SCOOP_H + CONE_H, area);
  const cx = area.x + area.w / 2;
  const height = (rows * SCOOP_H + CONE_H) * s;
  const coneTop = area.y + (area.h + height) / 2 - CONE_H * s;
  const cone = scene.add
    .image(cx, coneTop, 'cone')
    .setOrigin(0.5, 0)
    .setDisplaySize(cols * SCOOP_W * s, CONE_H * s);
  const balls = Array.from({ length: scoops }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = cx + (col - (cols - 1) / 2) * SCOOP_W * s;
    const y = coneTop - (SCOOP_H / 2) * s - row * SCOOP_H * s;
    return scene.add.image(x, y, key).setScale(s);
  });
  return [cone, ...balls];
}

/** Piles of scoops side by side with a "+" between each. */
function drawPiles(scene: Phaser.Scene, parts: number[], area: Rect, key: string): Objects {
  const cols = parts.map((n) => Math.max(1, Math.min(PILE_ROW, n)));
  const rows = Math.max(1, ...parts.map((n, i) => Math.ceil(n / cols[i]!)));
  const artW = cols.reduce((sum, c) => sum + c * SCOOP_W, 0) + (parts.length - 1) * PLUS_W;
  const s = fitScale(artW, rows * (SCOOP_H + 1), area);
  const bottom = area.y + (area.h + rows * (SCOOP_H + 1) * s) / 2;
  let x = area.x + (area.w - artW * s) / 2;
  const out: Objects = [];
  parts.forEach((n, i) => {
    if (i > 0) {
      const plus = scene.add.text(
        x + (PLUS_W * s) / 2,
        bottom - (rows * (SCOOP_H + 1) * s) / 2,
        '+',
        text(10 * s, CSS.ink),
      );
      out.push(plus.setOrigin(0.5));
      x += PLUS_W * s;
    }
    const pileW = cols[i]! * SCOOP_W * s;
    for (const p of gridPositions(x + pileW / 2, bottom, n, cols[i]!, s))
      out.push(scene.add.image(p.x, p.y, key).setScale(s));
    x += pileW;
  });
  return out;
}

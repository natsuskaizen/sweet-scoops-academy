import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import { wordTexture, WORD_ART_SIZE } from '../characters/wordArt';
import { aidBeats, type AidBeat } from '../learning/aidBeats';
import type { VisualAid } from '../learning/types';
import { CUP_H, LABEL_H, SCOOP_W, fitAid, gridPositions, layoutCells, type Point } from './aidLayout';
import { COLORS, CSS, text, type Rect } from './theme';

/**
 * Renders a subject's VisualAid (hint or explanation) on a board hung on the
 * shop wall, with the same pixel-art scoops and cups as the shop.
 *
 * Hints are drawn at once. Explanations play out step by step (the beats
 * come from learning/aidBeats.ts): multiplication fills one cup at a time
 * while the skip-count total grows under each cup; division deals the pile
 * into the cups one round at a time until it is gone. Addition and
 * subtraction are drawn at once. Counting numbers the scoops one at a time.
 */
type Area = Rect;

const WORD_PICTURE_MAX_SCALE = 6;
const WORD_FONT_MAX = 84;
const WORD_GAP = 24;
/** A letter's width as a share of its font size, to fit a word to its board before it is drawn. */
const LETTER_WIDTH = 0.62;

/** True when the aid reveals the answer (drawn with the "explanation" border). */
const revealsAnswer = (aid: VisualAid): boolean =>
  (aid.kind === 'groups' && aid.showTotal) ||
  (aid.kind === 'share' && aid.perGroup !== null) ||
  (aid.kind === 'combine' && aid.showTotal) ||
  (aid.kind === 'takeAway' && aid.showResult) ||
  (aid.kind === 'count' && aid.showNumbers) ||
  (aid.kind === 'word' && aid.lit > 0);

export class VisualAidView extends Phaser.GameObjects.Container {
  private board: Phaser.GameObjects.Graphics;
  private marks: Phaser.GameObjects.Graphics;
  private caption: Phaser.GameObjects.Text;
  private items: Phaser.GameObjects.GameObject[] = [];
  private scoopKey = 'scoop-vanilla';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private boxW: number,
    private boxH: number,
  ) {
    super(scene, x, y);
    const w = boxW;
    this.board = scene.add.graphics();
    this.marks = scene.add.graphics();
    this.caption = scene.add
      .text(w / 2, 16, '', text(26, CSS.ink, { align: 'center', wordWrap: { width: w - 40 } }))
      .setOrigin(0.5, 0);
    this.add([this.board, this.caption, this.marks]);
    this.setVisible(false);
    scene.add.existing(this);
  }

  /** Shows the aid with scoops of `flavor` (any FLAVOR_COLORS key). */
  show(aid: VisualAid, flavor = 'vanilla'): void {
    const key = `scoop-${flavor}`;
    this.scoopKey = this.scene.textures.exists(key) ? key : 'scoop-vanilla';
    this.clear();
    this.drawBoard(revealsAnswer(aid));
    this.caption.setText(aid.caption);
    this.drawAid(aid, {
      x: 20,
      y: this.caption.height + 30,
      w: this.boxW - 40,
      h: this.boxH - this.caption.height - 44,
    });
    this.bringToTop(this.marks);
    this.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this, alpha: 1, duration: 220 });
  }

  hide(): void {
    this.setVisible(false);
    this.clear();
  }

  private drawAid(aid: VisualAid, area: Area): void {
    const beats = aidBeats(aid);
    switch (aid.kind) {
      case 'groups':
        return this.drawGroups(aid.groups, aid.perGroup, beats, area);
      case 'share':
        return aid.perGroup === null
          ? this.drawShareHint(aid.total, aid.groups, area)
          : this.drawShare(aid.total, aid.groups, aid.perGroup, beats, area);
      case 'combine':
        return this.drawCombine(aid.parts, aid.showTotal, area);
      case 'takeAway':
        return this.drawTakeAway(aid.total, aid.remove, aid.showResult, area);
      case 'count':
        return this.drawCount(aid.total, beats, area);
      case 'word':
        return this.drawWord(aid, beats, area);
      case 'text':
        return;
    }
  }

  private clear(): void {
    this.scene.tweens.killTweensOf(this.items);
    this.marks.clear();
    for (const item of this.items) item.destroy();
    this.items = [];
  }

  private drawBoard(isExplanation: boolean): void {
    const g = this.board;
    g.clear();
    g.fillStyle(COLORS.shadow, 0.15).fillRoundedRect(6, 8, this.boxW, this.boxH, 20);
    g.fillStyle(COLORS.cream, 1).fillRoundedRect(0, 0, this.boxW, this.boxH, 20);
    g.lineStyle(6, isExplanation ? COLORS.strawberry : COLORS.lavenderDark, 1);
    g.strokeRoundedRect(0, 0, this.boxW, this.boxH, 20);
  }

  // -------------------------------------------------------------------------
  // Pieces
  // -------------------------------------------------------------------------

  private keep<T extends Phaser.GameObjects.GameObject>(item: T): T {
    this.items.push(item);
    this.add(item);
    return item;
  }

  private label(x: number, y: number, value: string, size = 22, color: string = CSS.ink): Phaser.GameObjects.Text {
    return this.keep(this.scene.add.text(x, y, value, text(size, color)).setOrigin(0.5, 0));
  }

  private scoop(p: Point, s: number): Phaser.GameObjects.Image {
    return this.keep(this.scene.add.image(p.x, p.y, this.scoopKey).setScale(s));
  }

  /** A cup whose rim sits at `rimY`, wide enough for `cols` scoops. */
  private cup(cx: number, rimY: number, cols: number, s: number): Phaser.GameObjects.Image {
    const w = (Math.max(cols, 1) * SCOOP_W + 3) * s;
    return this.keep(
      this.scene.add
        .image(cx, rimY, 'aid-cup')
        .setOrigin(0.5, 0)
        .setDisplaySize(w, CUP_H * s),
    );
  }

  /** Pops objects in after `delay` ms (they start hidden). */
  private popIn(targets: Phaser.GameObjects.GameObject[], delay: number): void {
    for (const t of targets) {
      const obj = t as Phaser.GameObjects.Image;
      const scaleX = obj.scaleX;
      const scaleY = obj.scaleY;
      obj.setAlpha(0).setScale(scaleX * 0.4, scaleY * 0.4);
      this.scene.tweens.add({ targets: obj, alpha: 1, scaleX, scaleY, delay, duration: 220, ease: 'Back.easeOut' });
    }
  }

  private cheer(label: Phaser.GameObjects.Text, delay: number): void {
    this.scene.tweens.add({ targets: label, scale: 1.35, delay, duration: 180, yoyo: true, ease: 'Quad.easeOut' });
  }

  // -------------------------------------------------------------------------
  // Multiplication: equal groups
  // -------------------------------------------------------------------------

  /** Hint: every cup with its count. Explanation: cups fill one by one with a skip-count total. */
  private drawGroups(groups: number, perGroup: number, beats: AidBeat[], area: Area): void {
    const { perRow, cols, scale: s } = fitAid(groups, perGroup, area);
    const step = GAME_CONFIG.timing.aidFillMs;
    layoutCells(groups, perRow, area).forEach((cell, i) => {
      const labelY = cell.top + cell.cellH - LABEL_H;
      const rimY = labelY - CUP_H * s - 2;
      const scoops = gridPositions(cell.cx, rimY + s, perGroup, cols, s).map((p) => this.scoop(p, s));
      const cup = this.cup(cell.cx, rimY, cols, s);
      const beat = beats[i];
      if (!beat) {
        this.label(cell.cx, labelY + 2, String(perGroup), 20, CSS.inkSoft);
        return;
      }
      const label = this.label(cell.cx, labelY + 2, beat.label, 22, CSS.strawberry);
      this.popIn([cup, ...scoops, label], i * step);
      if (beat.final) this.cheer(label, i * step + 260);
    });
  }

  // -------------------------------------------------------------------------
  // Division: sharing a pile into cups
  // -------------------------------------------------------------------------

  /** Shared layout for both division boards: the pile on the left, cups on the right. */
  private shareLayout(total: number, groups: number, perCup: number, area: Area) {
    const pileArea = { ...area, w: Math.round(area.w * 0.34) };
    const cupArea = { ...area, x: area.x + pileArea.w + 16, w: area.w - pileArea.w - 16 };
    const pileFit = fitAid(1, total, pileArea, false);
    const cupFit = fitAid(groups, Math.max(perCup, 1), cupArea);
    const s = Math.min(pileFit.scale, cupFit.scale);
    const pileX = pileArea.x + pileArea.w / 2;
    const pileBottom = area.y + area.h - LABEL_H;
    const pile = gridPositions(pileX, pileBottom, total, pileFit.cols, s).map((p) => this.scoop(p, s));
    const cups = layoutCells(groups, cupFit.perRow, cupArea).map((cell) => {
      const labelY = cell.top + cell.cellH - LABEL_H;
      const rimY = labelY - CUP_H * s - 2;
      this.cup(cell.cx, rimY, cupFit.cols, s);
      return { cell, labelY, slots: gridPositions(cell.cx, rimY + s, perCup, cupFit.cols, s) };
    });
    return { pile, cups, pileX, pileBottom };
  }

  /** Hint: the whole pile beside empty cups waiting to be filled. */
  private drawShareHint(total: number, groups: number, area: Area): void {
    const { cups, pileX, pileBottom } = this.shareLayout(total, groups, 0, area);
    this.label(pileX, pileBottom + 2, `${total} scoops`, 20, CSS.inkSoft);
    for (const cup of cups) this.label(cup.cell.cx, cup.labelY + 2, '?', 22, CSS.sky);
  }

  /** Explanation: deal one scoop into every cup per round until the pile is empty. */
  private drawShare(total: number, groups: number, perGroup: number, beats: AidBeat[], area: Area): void {
    const { pile, cups, pileX, pileBottom } = this.shareLayout(total, groups, perGroup, area);
    const pileLabel = this.label(pileX, pileBottom + 2, `${total} scoops`, 20, CSS.inkSoft);
    const labels = cups.map((cup) => this.label(cup.cell.cx, cup.labelY + 2, '0', 22, CSS.inkSoft));
    const roundMs = GAME_CONFIG.timing.aidDealMs;
    const queue = [...pile];
    beats.forEach((beat, r) => {
      if (beat.kind !== 'deal') return;
      cups.forEach((cup, g) => {
        const scoop = queue.pop();
        const slot = cup.slots[r];
        if (scoop && slot) this.deal(scoop, slot, 300 + r * roundMs + (g * roundMs * 0.5) / groups);
      });
      const at = 300 + r * roundMs + roundMs * 0.75;
      this.scene.time.delayedCall(at, () => this.afterRound(beat, labels, pileLabel));
    });
  }

  private deal(scoop: Phaser.GameObjects.Image, slot: Point, delay: number): void {
    this.scene.tweens.add({ targets: scoop, x: slot.x, y: slot.y, delay, duration: 260, ease: 'Quad.easeInOut' });
  }

  private afterRound(beat: AidBeat, labels: Phaser.GameObjects.Text[], pileLabel: Phaser.GameObjects.Text): void {
    if (beat.kind !== 'deal' || !this.items.includes(pileLabel)) return;
    pileLabel.setText(beat.pileLeft === 0 ? 'all shared!' : `${beat.pileLeft} left`);
    for (const l of labels) {
      l.setText(beat.label);
      if (beat.final) {
        l.setColor(CSS.strawberry);
        this.cheer(l, 0);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Addition and subtraction
  // -------------------------------------------------------------------------

  /** Addition: one pile per part, then (explanation) the running total under each pile. */
  private drawCombine(parts: number[], showTotal: boolean, area: Area): void {
    const largest = Math.max(1, ...parts);
    const { cols, scale: s } = fitAid(parts.length, largest, area, false);
    let runningTotal = 0;
    layoutCells(parts.length, parts.length, area).forEach((cell, i) => {
      const count = parts[i] ?? 0;
      runningTotal += count;
      const bottom = cell.top + cell.cellH - LABEL_H;
      for (const p of gridPositions(cell.cx, bottom, count, cols, s)) this.scoop(p, s);
      if (showTotal) this.label(cell.cx, bottom + 2, String(runningTotal), 22, CSS.strawberry);
      else this.label(cell.cx, bottom + 2, String(count), 20, CSS.inkSoft);
    });
  }

  /** Subtraction: the whole pile; the explanation crosses out the scoops taken away. */
  private drawTakeAway(total: number, remove: number, showResult: boolean, area: Area): void {
    const { cols, scale: s } = fitAid(1, total, area, false);
    const positions = gridPositions(area.x + area.w / 2, area.y + area.h - LABEL_H, total, cols, s);
    positions.forEach((p, i) => {
      this.scoop(p, s);
      if (showResult && i >= total - remove) this.crossOut(p.x, p.y, 3 * s);
    });
    const label = showResult ? `${total - remove} left` : `${total} scoops, take away ${remove}`;
    this.label(area.x + area.w / 2, area.y + area.h - 24, label, 20, showResult ? CSS.strawberry : CSS.inkSoft);
  }

  /** Counting: scoops in rows of 5. The explanation numbers them one at a time, the last number being the answer. */
  private drawCount(total: number, beats: AidBeat[], area: Area): void {
    const { cols, scale: s } = fitAid(1, total, { ...area, h: area.h - LABEL_H }, false);
    const bottom = area.y + area.h - 2 * LABEL_H;
    const positions = gridPositions(area.x + area.w / 2, bottom, total, cols, s);
    for (const p of positions) this.scoop(p, s);
    if (beats.length === 0) {
      this.label(area.x + area.w / 2, area.y + area.h - LABEL_H, '?', 22, CSS.sky);
      return;
    }
    const step = GAME_CONFIG.timing.aidFillMs;
    beats.forEach((beat) => {
      if (beat.kind !== 'count') return;
      const p = positions[beat.index]!;
      // The number sits on its scoop, so rows stacked above each other stay readable.
      const label = this.label(p.x, p.y, beat.label, 22, beat.final ? CSS.strawberry : CSS.ink).setOrigin(0.5);
      this.popIn([label], beat.index * step);
      if (beat.final) this.cheer(label, beat.index * step + 260);
    });
  }

  // -------------------------------------------------------------------------
  // Words: a picture and its word, with the first letters lit
  // -------------------------------------------------------------------------

  private drawWord(aid: Extract<VisualAid, { kind: 'word' }>, beats: AidBeat[], area: Area): void {
    const s = Math.max(1, Math.min(WORD_PICTURE_MAX_SCALE, Math.floor(area.h / WORD_ART_SIZE)));
    const disc = Math.round(area.h * 0.7);
    const size = aid.picture ? WORD_ART_SIZE * s : aid.swatch ? disc : 0;
    const gap = size > 0 ? WORD_GAP : 0;
    const fit = (area.w - size - gap) / (aid.word.length * LETTER_WIDTH);
    const fontSize = Math.floor(Math.min(WORD_FONT_MAX, area.h * 0.7, fit));
    const letters = [...aid.word].map((ch, i) =>
      this.keep(
        this.scene.add.text(0, 0, ch, text(fontSize, i < aid.lit ? CSS.strawberry : CSS.ink)).setOrigin(0, 0.5),
      ),
    );
    const wordW = letters.reduce((sum, l) => sum + l.width, 0);
    const cy = area.y + area.h / 2;
    let x = area.x + (area.w - size - gap - wordW) / 2;
    if (aid.picture)
      this.keep(this.scene.add.image(x + size / 2, cy, wordTexture(this.scene, aid.picture)).setScale(s));
    else if (aid.swatch) this.drawDisc(x + size / 2, cy, size / 2, aid.swatch);
    x += size + gap;
    for (const letter of letters) {
      letter.setPosition(x, cy);
      x += letter.width;
    }
    this.popIn(letters.slice(0, aid.lit), 0);
    this.soundOut(letters, beats);
  }

  /** Sounding a word out: each letter lights up in turn, and stays lit. */
  private soundOut(letters: Phaser.GameObjects.Text[], beats: AidBeat[]): void {
    const step = GAME_CONFIG.timing.aidFillMs;
    for (const beat of beats) {
      if (beat.kind !== 'letter') continue;
      const letter = letters[beat.index]!;
      this.scene.tweens.add({
        targets: letter,
        scale: 1.35,
        delay: beat.index * step,
        duration: 180,
        yoyo: true,
        ease: 'Quad.easeOut',
        onStart: () => letter.setColor(CSS.strawberry),
      });
    }
  }

  private drawDisc(x: number, y: number, r: number, hex: string): void {
    const g = this.keep(this.scene.add.graphics());
    g.fillStyle(Number.parseInt(hex.slice(1), 16), 1).fillCircle(x, y, r);
    g.lineStyle(4, COLORS.ink, 1).strokeCircle(x, y, r);
  }

  private crossOut(x: number, y: number, r: number): void {
    const g = this.marks;
    g.lineStyle(Math.max(2, r / 3), COLORS.ink, 0.85);
    g.lineBetween(x - r, y - r, x + r, y + r);
    g.lineBetween(x + r, y - r, x - r, y + r);
  }
}

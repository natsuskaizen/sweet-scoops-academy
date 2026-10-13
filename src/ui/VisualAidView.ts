import Phaser from 'phaser';
import type { VisualAid } from '../learning/types';
import { COLORS, CSS, text } from './theme';

/**
 * Renders a subject's VisualAid (hint or explanation) on a board hung on the
 * shop wall. Multiplication shows equal groups of scoops with skip-count
 * labels; division shows a pile of scoops shared into cups; addition shows
 * piles put together; subtraction shows a pile with some taken away.
 */
type Area = { x: number; y: number; w: number; h: number };

/** True when the aid reveals the answer (drawn with the "explanation" border). */
const revealsAnswer = (aid: VisualAid): boolean =>
  (aid.kind === 'groups' && aid.showTotal) ||
  (aid.kind === 'share' && aid.perGroup !== null) ||
  (aid.kind === 'combine' && aid.showTotal) ||
  (aid.kind === 'takeAway' && aid.showResult);

export class VisualAidView extends Phaser.GameObjects.Container {
  private board: Phaser.GameObjects.Graphics;
  private art: Phaser.GameObjects.Graphics;
  private caption: Phaser.GameObjects.Text;
  private labels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, private boxW: number, private boxH: number, private scoopColor = 0xff9ec0) {
    super(scene, x, y);
    const w = boxW;
    this.board = scene.add.graphics();
    this.art = scene.add.graphics();
    this.caption = scene.add
      .text(w / 2, 16, '', text(26, CSS.ink, { align: 'center', wordWrap: { width: w - 40 } }))
      .setOrigin(0.5, 0);
    this.add([this.board, this.art, this.caption]);
    this.setVisible(false);
    scene.add.existing(this);
  }

  show(aid: VisualAid, scoopColor?: number): void {
    if (scoopColor !== undefined) this.scoopColor = scoopColor;
    this.clear();
    this.drawBoard(revealsAnswer(aid));
    this.caption.setText(aid.caption);
    this.drawAid(aid, { x: 20, y: this.caption.height + 30, w: this.boxW - 40, h: this.boxH - this.caption.height - 44 });
    this.setVisible(true).setAlpha(0).setY(this.y);
    this.scene.tweens.add({ targets: this, alpha: 1, duration: 220 });
  }

  private drawAid(aid: VisualAid, area: Area): void {
    switch (aid.kind) {
      case 'groups': return this.drawGroups(aid.groups, aid.perGroup, aid.showTotal, area);
      case 'share': return this.drawShare(aid.total, aid.groups, aid.perGroup, area);
      case 'combine': return this.drawCombine(aid.parts, aid.showTotal, area);
      case 'takeAway': return this.drawTakeAway(aid.total, aid.remove, aid.showResult, area);
      case 'text': return;
    }
  }

  hide(): void {
    this.setVisible(false);
    this.clear();
  }

  private clear(): void {
    this.art.clear();
    for (const l of this.labels) l.destroy();
    this.labels = [];
  }

  private drawBoard(isExplanation: boolean): void {
    const g = this.board;
    g.clear();
    g.fillStyle(COLORS.shadow, 0.15).fillRoundedRect(6, 8, this.boxW, this.boxH, 20);
    g.fillStyle(COLORS.cream, 1).fillRoundedRect(0, 0, this.boxW, this.boxH, 20);
    g.lineStyle(6, isExplanation ? COLORS.strawberry : COLORS.lavenderDark, 1).strokeRoundedRect(0, 0, this.boxW, this.boxH, 20);
  }

  private label(x: number, y: number, value: string, size = 22, color: string = CSS.ink): void {
    const t = this.scene.add.text(x, y, value, text(size, color)).setOrigin(0.5, 0);
    this.labels.push(t);
    this.add(t);
  }

  private scoop(x: number, y: number, r: number): void {
    const g = this.art;
    g.fillStyle(this.scoopColor, 1).fillCircle(x, y, r);
    g.lineStyle(Math.max(1.5, r / 6), COLORS.ink, 0.6).strokeCircle(x, y, r);
    g.fillStyle(COLORS.white, 0.8).fillCircle(x - r / 3, y - r / 3, Math.max(1.5, r / 4));
  }

  private cup(cx: number, bottom: number, w: number, h: number): void {
    const g = this.art;
    g.fillStyle(COLORS.strawberry, 1);
    g.fillPoints(
      [
        new Phaser.Geom.Point(cx - w / 2, bottom - h),
        new Phaser.Geom.Point(cx + w / 2, bottom - h),
        new Phaser.Geom.Point(cx + w / 2 - w * 0.15, bottom),
        new Phaser.Geom.Point(cx - w / 2 + w * 0.15, bottom),
      ],
      true,
    );
    g.fillStyle(COLORS.white, 0.6).fillRect(cx - w / 2 + 4, bottom - h + 4, w - 8, 4);
  }

  /** Centres of `count` scoops in a small grid, centred on cx, sitting on `bottom`. */
  private gridPositions(cx: number, bottom: number, count: number, cols: number, r: number): { x: number; y: number }[] {
    const rows = Math.ceil(count / cols);
    return Array.from({ length: count }, (_, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, count - row * cols);
      return {
        x: cx + ((i % cols) - (inRow - 1) / 2) * r * 2.1,
        y: bottom - r - (rows - 1 - row) * r * 2.05,
      };
    });
  }

  private scoopGrid(cx: number, bottom: number, count: number, cols: number, r: number): void {
    for (const p of this.gridPositions(cx, bottom, count, cols, r)) this.scoop(p.x, p.y, r);
  }

  /** Scoop radius that fits `count` scoops in `cols` columns inside a w x h box. */
  private fitRadius(count: number, cols: number, w: number, h: number, max: number): number {
    return Math.max(4, Math.min(max, w / (cols * 2.1), h / (Math.ceil(count / cols) * 2.05)));
  }

  private layoutCells(n: number, area: Area, maxCellW = 118) {
    const perRow = n <= 6 ? n : Math.ceil(n / 2);
    const rows = Math.ceil(n / perRow);
    const cellW = Math.min(maxCellW, area.w / perRow);
    const cellH = area.h / rows;
    const startX = area.x + (area.w - cellW * perRow) / 2;
    return Array.from({ length: n }, (_, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      return { cx: startX + col * cellW + cellW / 2, top: area.y + row * cellH, cellW, cellH };
    });
  }

  private drawGroups(groups: number, perGroup: number, showTotal: boolean, area: Area): void {
    const cells = this.layoutCells(groups, area);
    const cols = Math.min(perGroup, 4);
    const scoopRows = Math.ceil(perGroup / cols);
    cells.forEach((cell, i) => {
      const labelH = 26;
      const cupH = Math.min(26, cell.cellH * 0.18);
      const cupBottom = cell.top + cell.cellH - labelH;
      const r = Math.max(4, Math.min(11, (cell.cellW - 16) / (cols * 2.1), (cell.cellH - labelH - cupH - 8) / (scoopRows * 2.05)));
      this.scoopGrid(cell.cx, cupBottom - cupH + r * 0.6, perGroup, cols, r);
      this.cup(cell.cx, cupBottom, Math.min(cell.cellW - 14, cols * r * 2.1 + 14), cupH);
      // Hint: how many in each cup. Explanation: skip-count running total.
      if (showTotal) this.label(cell.cx, cupBottom + 2, String(perGroup * (i + 1)), 22, CSS.strawberry);
      else this.label(cell.cx, cupBottom + 2, String(perGroup), 20, CSS.inkSoft);
    });
  }

  private drawShare(total: number, groups: number, perGroup: number | null, area: Area): void {
    if (perGroup === null) {
      // Hint: the whole pile beside empty cups waiting to be filled.
      const pileW = 210;
      const cols = 10;
      const r = Math.min(9, (area.h - 30) / (Math.ceil(total / cols) * 2.05));
      this.scoopGrid(area.x + pileW / 2, area.y + area.h - 26, total, cols, r);
      this.label(area.x + pileW / 2, area.y + area.h - 24, `${total} scoops`, 20, CSS.inkSoft);
      const cells = this.layoutCells(groups, { x: area.x + pileW + 20, y: area.y, w: area.w - pileW - 20, h: area.h });
      for (const cell of cells) {
        const bottom = cell.top + cell.cellH - 26;
        this.cup(cell.cx, bottom, Math.min(cell.cellW - 14, 60), Math.min(26, cell.cellH * 0.25));
        this.label(cell.cx, bottom + 2, '?', 22, CSS.sky);
      }
      return;
    }
    this.drawGroups(groups, perGroup, false, area);
    // Replace the per-cup labels with "N each" emphasis.
    for (const l of this.labels) l.setColor(CSS.strawberry).setFontSize(22);
  }

  /** Addition: one pile per part, then (explanation) the running total under each pile. */
  private drawCombine(parts: number[], showTotal: boolean, area: Area): void {
    const cells = this.layoutCells(parts.length, area, 260);
    const largest = Math.max(1, ...parts);
    const cols = Math.min(largest, 5);
    let runningTotal = 0;
    cells.forEach((cell, i) => {
      const count = parts[i] ?? 0;
      runningTotal += count;
      const bottom = cell.top + cell.cellH - 26;
      const r = this.fitRadius(largest, cols, cell.cellW - 24, cell.cellH - 40, 22);
      this.scoopGrid(cell.cx, bottom, count, cols, r);
      if (showTotal) this.label(cell.cx, bottom + 2, String(runningTotal), 22, CSS.strawberry);
      else this.label(cell.cx, bottom + 2, String(count), 20, CSS.inkSoft);
    });
  }

  /** Subtraction: the whole pile; the explanation crosses out the scoops taken away. */
  private drawTakeAway(total: number, remove: number, showResult: boolean, area: Area): void {
    const cols = Math.min(Math.max(total, 1), 10);
    const r = this.fitRadius(Math.max(total, 1), cols, area.w, area.h - 30, 22);
    const positions = this.gridPositions(area.x + area.w / 2, area.y + area.h - 26, total, cols, r);
    positions.forEach((p, i) => {
      this.scoop(p.x, p.y, r);
      if (showResult && i >= total - remove) this.crossOut(p.x, p.y, r);
    });
    const label = showResult ? `${total - remove} left` : `${total} scoops, take away ${remove}`;
    this.label(area.x + area.w / 2, area.y + area.h - 24, label, 20, showResult ? CSS.strawberry : CSS.inkSoft);
  }

  private crossOut(x: number, y: number, r: number): void {
    const g = this.art;
    g.lineStyle(Math.max(2, r / 3), COLORS.ink, 0.85);
    g.lineBetween(x - r, y - r, x + r, y + r);
    g.lineBetween(x + r, y - r, x - r, y + r);
  }
}

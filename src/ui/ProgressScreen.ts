/**
 * The grown-ups progress screen, drawn inside the ParentGate panel (laid out
 * on its 1280x880 canvas). Two views share one screen: "Rounds" (summary
 * tiles and a 2x2 grid of round cards, paged) and "Overview" (tiles for the
 * last few days, a bar per recent round, and questions to practise). The
 * switch sits top left, mirroring Close. All numbers and words come from
 * src/shop/progressReport.ts; this file only draws them.
 */
import type Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import type { RoundSummary } from '../save/saveTypes';
import {
  NO_VALUE,
  overviewView,
  roundsView,
  type ChartBar,
  type OutcomeCounts,
  type RoundCard,
  type StatTile,
} from '../shop/progressReport';
import { Button } from './Button';
import type { ParentGate } from './ParentGate';
import { COLORS, CSS, text } from './theme';

export type ProgressMode = 'rounds' | 'overview';
type Add = <T extends Phaser.GameObjects.GameObject>(obj: T) => T;

interface Ctx {
  scene: Phaser.Scene;
  add: Add;
  gate: ParentGate;
  history: readonly RoundSummary[];
}

/** Content area inside the panel, and the pieces laid out in it. */
const LEFT = 210;
const WIDTH = 860;
const GAP = 16;
const TILES = { y: 160, h: 90 };
const CARDS = { y: 270, h: 200 };
const CHART = { y: 270, h: 290, barTop: 325, barH: 190 };
const PRACTICE = { y: 580, h: 110 };
const NAV_Y = 750;
const OUTCOME_COLORS: Record<keyof OutcomeCounts, number> = {
  first: COLORS.mint,
  retry: COLORS.sky,
  miss: COLORS.strawberry,
};
const PILL_BLUE = 0xe6f0ff;
const CHIP_PINK = 0xffe3ec;

/** The view last chosen, so reopening the screen shows it again (until the page reloads). */
let lastMode: ProgressMode = 'rounds';

export function showProgress(
  gate: ParentGate,
  scene: Phaser.Scene,
  history: readonly RoundSummary[],
  mode: ProgressMode = lastMode,
  page = 0,
): void {
  lastMode = mode;
  gate.custom((add) => {
    const ctx: Ctx = { scene, add, gate, history };
    add(scene.add.text(640, 90, 'Progress', text(40)).setOrigin(0.5, 0));
    drawToggle(ctx, mode);
    if (mode === 'rounds') drawRounds(ctx, page);
    else drawOverview(ctx);
  });
}

function drawToggle(ctx: Ctx, mode: ProgressMode): void {
  const options: [ProgressMode, string, number][] = [
    ['rounds', 'Rounds', 270],
    ['overview', 'Overview', 426],
  ];
  for (const [value, label, x] of options) {
    const selected = value === mode;
    ctx.add(
      new Button(ctx.scene, x, 110, {
        width: 140,
        height: 70,
        label,
        fontSize: 24,
        fill: selected ? COLORS.lavender : COLORS.cream,
        shade: selected ? COLORS.lavenderDark : COLORS.creamDark,
        onTap: () => {
          if (!selected) showProgress(ctx.gate, ctx.scene, ctx.history, value);
        },
      }),
    );
  }
}

function panel(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  const g = ctx.add(ctx.scene.add.graphics());
  g.fillStyle(COLORS.white, 1).fillRoundedRect(x, y, w, h, 22);
  g.lineStyle(3, COLORS.creamDark, 1).strokeRoundedRect(x, y, w, h, 22);
}

function drawTiles(ctx: Ctx, tiles: StatTile[]): void {
  const w = (WIDTH - 2 * GAP) / tiles.length;
  tiles.forEach((tile, i) => {
    const x = LEFT + i * (w + GAP);
    panel(ctx, x, TILES.y, w, TILES.h);
    ctx.add(ctx.scene.add.text(x + w / 2, TILES.y + 10, tile.value, text(34)).setOrigin(0.5, 0));
    ctx.add(ctx.scene.add.text(x + w / 2, TILES.y + 54, tile.label, text(18, CSS.inkSoft)).setOrigin(0.5, 0));
  });
}

function navButton(ctx: Ctx, label: string, x: number, enabled: boolean, onTap: () => void): void {
  ctx.add(new Button(ctx.scene, x, NAV_Y, { width: 200, height: 76, label, fontSize: 28, onTap })).setEnabled(enabled);
}

// ---------------------------------------------------------------------------
// Rounds view
// ---------------------------------------------------------------------------

function drawRounds(ctx: Ctx, page: number): void {
  const view = roundsView(ctx.history, Date.now());
  drawTiles(ctx, view.tiles);
  const cards = view.pages[page] ?? [];
  const w = (WIDTH - GAP) / 2;
  cards.forEach((card, i) => {
    drawCard(ctx, card, LEFT + (i % 2) * (w + GAP), CARDS.y + Math.floor(i / 2) * (CARDS.h + GAP), w);
  });
  if (cards.length === 0) {
    const empty = `No rounds finished yet. A round shows up here once all ${GAME_CONFIG.round.ordersPerRound} orders are served.`;
    ctx.add(
      ctx.scene.add
        .text(640, CARDS.y + 120, empty, text(24, CSS.inkSoft, { align: 'center', wordWrap: { width: 700 } }))
        .setOrigin(0.5, 0),
    );
  }
  const show = (p: number) => () => showProgress(ctx.gate, ctx.scene, ctx.history, 'rounds', p);
  navButton(ctx, 'Newer', 420, page > 0, show(page - 1));
  navButton(ctx, 'Back', 640, true, () => ctx.gate.showMenu());
  navButton(ctx, 'Older', 860, page < view.pages.length - 1, show(page + 1));
}

function drawCard(ctx: Ctx, card: RoundCard, x: number, y: number, w: number): void {
  const { scene, add } = ctx;
  panel(ctx, x, y, w, CARDS.h);
  add(scene.add.text(x + 20, y + 18, card.when, text(22)));
  timePill(ctx, card.time, x + w - 20, y + 16);
  const stars = add(scene.add.text(x + 20, y + 54, `★ ${card.outcomes.first}`, text(36)));
  const ofTotal = `of ${card.ordersCompleted} first try`;
  add(scene.add.text(stars.x + stars.width + 10, y + 68, ofTotal, text(20, CSS.inkSoft)));
  outcomeDots(ctx, card.outcomes, x + 29, y + 128);
  const footer = card.perfect ? 'Perfect round!' : card.practice;
  add(scene.add.text(x + 20, y + 156, footer, text(18, card.perfect ? CSS.mint : CSS.inkSoft)));
}

/** A rounded label right-aligned at `right`: the play time, or a dash for untimed rounds. */
function timePill(ctx: Ctx, time: string | null, right: number, y: number): void {
  const label = ctx.scene.add.text(0, y + 5, time ?? NO_VALUE, text(19, time ? CSS.sky : CSS.inkSoft));
  label.setX(right - 14 - label.width);
  const g = ctx.add(ctx.scene.add.graphics());
  g.fillStyle(time ? PILL_BLUE : COLORS.creamDark, 1).fillRoundedRect(label.x - 14, y, label.width + 28, 34, 14);
  ctx.add(label);
}

/** One dot per order: first try, then 2nd try, then answer shown. */
function outcomeDots(ctx: Ctx, outcomes: OutcomeCounts, x: number, y: number): void {
  const g = ctx.add(ctx.scene.add.graphics());
  let i = 0;
  for (const kind of ['first', 'retry', 'miss'] as const) {
    for (let n = 0; n < outcomes[kind]; n++, i++) g.fillStyle(OUTCOME_COLORS[kind], 1).fillCircle(x + i * 27, y, 10);
  }
}

// ---------------------------------------------------------------------------
// Overview view
// ---------------------------------------------------------------------------

function drawOverview(ctx: Ctx): void {
  const view = overviewView(ctx.history, Date.now());
  drawTiles(ctx, view.tiles);
  drawChart(ctx, view.bars);
  drawPractice(ctx, view.practice);
  navButton(ctx, 'Back', 640, true, () => ctx.gate.showMenu());
}

function drawChart(ctx: Ctx, bars: ChartBar[]): void {
  const { scene, add } = ctx;
  panel(ctx, LEFT, CHART.y, WIDTH, CHART.h);
  const slots = GAME_CONFIG.parentArea.chartRounds;
  add(scene.add.text(LEFT + 22, CHART.y + 14, `Last ${slots} rounds`, text(21)));
  chartLegend(ctx, LEFT + WIDTH - 22, CHART.y + 18);
  const inner = WIDTH - 44;
  const barW = (inner - (slots - 1) * 14) / slots;
  const unit = CHART.barH / GAME_CONFIG.round.ordersPerRound;
  const g = add(scene.add.graphics());
  g.fillStyle(COLORS.creamDark, 1).fillRect(LEFT + 22, CHART.barTop + CHART.barH, inner, 3);
  bars.forEach((bar, i) => {
    const x = LEFT + 22 + i * (barW + 14);
    stackedBar(g, bar, x, barW, unit);
    add(
      scene.add.text(x + barW / 2, CHART.barTop + CHART.barH + 8, bar.label, text(15, CSS.inkSoft)).setOrigin(0.5, 0),
    );
  });
  if (bars.length === 0) {
    const empty = 'Finished rounds will show up here.';
    add(scene.add.text(640, CHART.barTop + 80, empty, text(22, CSS.inkSoft)).setOrigin(0.5, 0));
  }
}

/** First try at the bottom, then 2nd try, then answer shown; only the top segment gets rounded corners. */
function stackedBar(g: Phaser.GameObjects.Graphics, bar: ChartBar, x: number, w: number, unit: number): void {
  let bottom = CHART.barTop + CHART.barH;
  const kinds = (['first', 'retry', 'miss'] as const).filter((kind) => bar[kind] > 0);
  kinds.forEach((kind, i) => {
    const h = bar[kind] * unit;
    const top = i === kinds.length - 1 ? 10 : 0;
    g.fillStyle(OUTCOME_COLORS[kind], 1).fillRoundedRect(x, bottom - h, w, h, { tl: top, tr: top, bl: 0, br: 0 });
    bottom -= h;
  });
}

/** Right-aligned key: a dot and a word for each outcome. */
function chartLegend(ctx: Ctx, right: number, y: number): void {
  const entries: [keyof OutcomeCounts, string][] = [
    ['miss', 'shown'],
    ['retry', '2nd try'],
    ['first', 'first try'],
  ];
  const g = ctx.add(ctx.scene.add.graphics());
  let x = right;
  for (const [kind, word] of entries) {
    const label = ctx.add(ctx.scene.add.text(x, y, word, text(17, CSS.inkSoft)).setOrigin(1, 0));
    x -= label.width + 10;
    g.fillStyle(OUTCOME_COLORS[kind], 1).fillCircle(x, y + 11, 7);
    x -= 30;
  }
}

/** Questions to practise as pink chips on one row; any that do not fit are left off. */
function drawPractice(ctx: Ctx, facts: string[]): void {
  const { scene, add } = ctx;
  panel(ctx, LEFT, PRACTICE.y, WIDTH, PRACTICE.h);
  add(scene.add.text(LEFT + 22, PRACTICE.y + 14, 'Needs practice', text(21)));
  if (facts.length === 0) {
    const none = 'Nothing right now: recent questions were all answered first try.';
    add(scene.add.text(LEFT + 22, PRACTICE.y + 56, none, text(19, CSS.inkSoft)));
    return;
  }
  const g = add(scene.add.graphics());
  let x = LEFT + 22;
  for (const fact of facts) {
    const label = scene.add.text(x + 14, PRACTICE.y + 58, fact, text(21, CSS.strawberry));
    if (x + label.width + 28 > LEFT + WIDTH - 22) {
      label.destroy();
      break;
    }
    g.fillStyle(CHIP_PINK, 1).fillRoundedRect(x, PRACTICE.y + 52, label.width + 28, 38, 16);
    add(label);
    x += label.width + 38;
  }
}

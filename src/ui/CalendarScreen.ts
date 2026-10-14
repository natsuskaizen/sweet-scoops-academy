import type Phaser from 'phaser';
import type { Profile } from '../save/saveTypes';
import { dayKey, dayView, monthOf, monthView, shiftMonth, type DayView, type MonthRef } from '../shop/progressCalendar';
import { Button } from './Button';
import { COLORS, CSS, DEPTH, LAYOUT, text, type Rect } from './theme';

export interface CalendarSubject {
  id: string;
  badge: string;
}

export interface CalendarScreenOptions {
  profile: () => Profile;
  /** Subjects that can appear on a day, for their badges. */
  subjects: readonly CalendarSubject[];
  now: () => number;
  onClose: () => void;
}

type Add = <T extends Phaser.GameObjects.GameObject>(obj: T) => T;

interface Grid {
  x: number;
  w: number;
  headerY: number;
  weekdaysY: number;
  top: number;
  bottom: number;
}

interface Geometry {
  portrait: boolean;
  card: Rect;
  day: Rect;
  grid: Grid;
  close: { x: number; y: number };
}

const GAP = 8;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const BADGE_COLORS: [number, number][] = [
  [COLORS.mint, COLORS.mintDark],
  [COLORS.sky, COLORS.skyDark],
  [COLORS.peach, 0xe8a888],
  [COLORS.lavender, COLORS.lavenderDark],
];
/** The heart texture is 11x10 art pixels. */
const HEART_ROWS = 10;
const TODAY_FILL = 0xfff0f5;

/** Landscape: the chosen day on the left, the month on the right. Portrait: the day on top. */
function geometry(): Geometry {
  if (LAYOUT.orientation === 'landscape') {
    return {
      portrait: false,
      card: { x: 40, y: 96, w: 1200, h: 768 },
      day: { x: 72, y: 128, w: 400, h: 704 },
      grid: { x: 504, w: 704, headerY: 168, weekdaysY: 226, top: 250, bottom: 840 },
      close: { x: 1194, y: 142 },
    };
  }
  const h = LAYOUT.height;
  return {
    portrait: true,
    card: { x: 16, y: 92, w: 768, h: h - 112 },
    day: { x: 40, y: 116, w: 640, h: 320 },
    grid: { x: 40, w: 720, headerY: 490, weekdaysY: 548, top: 572, bottom: h - 44 },
    close: { x: 732, y: 150 },
  };
}

/**
 * The kids' progress calendar, layered over the shop: the chosen day (today
 * at first) with its big heart, and the month of heart stamps. Tapping a day
 * shows it in the big card; the arrows page through months. Everything it
 * shows comes from src/shop/progressCalendar.ts.
 */
export class CalendarScreen {
  private readonly root: Phaser.GameObjects.Container;
  private content: Phaser.GameObjects.Container;
  private readonly geo = geometry();
  private month: MonthRef;
  private selected: string;
  private closed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: CalendarScreenOptions,
  ) {
    this.month = monthOf(opts.now());
    this.selected = dayKey(opts.now());
    this.root = scene.add.container(0, 0).setDepth(DEPTH.menu);
    this.content = scene.add.container(0, 0);
    this.drawFrame();
    this.render();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.root.destroy();
    this.opts.onClose();
  }

  private drawFrame(): void {
    const { scene } = this;
    const { x, y, w, h } = this.geo.card;
    const shade = scene.add.rectangle(0, 0, LAYOUT.width, LAYOUT.height, COLORS.ink, 0.45).setOrigin(0);
    shade.setInteractive().on('pointerup', () => this.close());
    const card = scene.add.graphics();
    card.fillStyle(COLORS.lavender, 1).fillRoundedRect(x, y + 8, w, h, 30);
    card.fillStyle(COLORS.cream, 1).fillRoundedRect(x, y, w, h, 30);
    card.lineStyle(6, COLORS.lavenderDark, 1).strokeRoundedRect(x, y, w, h, 30);
    // Taps on the card itself do not close it.
    const cardHit = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    const close = new Button(scene, this.geo.close.x, this.geo.close.y, {
      width: 64,
      height: 64,
      label: '✕',
      fontSize: 30,
      onTap: () => this.close(),
    });
    this.root.add([shade, card, cardHit, this.content, close]);
  }

  private render(): void {
    this.content.removeAll(true);
    const add: Add = (obj) => {
      this.content.add(obj);
      return obj;
    };
    const { profile, now } = this.opts;
    const p = profile();
    this.drawDay(add, dayView(p.dailyLog, this.selected, p.settings.dailyGoal, now()));
    this.drawMonth(add);
  }

  // -------------------------------------------------------------------------
  // The chosen day
  // -------------------------------------------------------------------------

  private drawDay(add: Add, day: DayView): void {
    const { scene, geo } = this;
    const { x, y, w, h } = geo.day;
    const g = add(scene.add.graphics());
    g.fillStyle(day.isToday ? TODAY_FILL : COLORS.white, 1).fillRoundedRect(x, y, w, h, 24);
    g.lineStyle(6, day.isToday ? COLORS.strawberryDark : COLORS.lavenderDark, 1).strokeRoundedRect(x, y, w, h, 24);
    if (geo.portrait) this.dayRow(add, day);
    else this.dayColumn(add, day);
  }

  /** Landscape: everything stacked and centred. */
  private dayColumn(add: Add, day: DayView): void {
    const { x, y, w } = this.geo.day;
    const cx = x + w / 2;
    add(this.scene.add.text(cx, y + 60, day.title, text(44)).setOrigin(0.5));
    this.bigHeart(add, day, cx, y + 230, 16);
    this.pips(add, day, { x: cx, y: y + 360, r: 18, align: 0.5 });
    add(
      this.message(day, cx, y + 420, w - 48)
        .setAlign('center')
        .setOrigin(0.5, 0),
    );
    this.details(add, day, cx, y + 540, 0.5);
  }

  /** Portrait: the heart on the left, the words on the right. */
  private dayRow(add: Add, day: DayView): void {
    const { x, y, h } = this.geo.day;
    const left = x + 260;
    this.bigHeart(add, day, x + 130, y + h / 2, 17);
    add(this.scene.add.text(left, y + 34, day.title, text(40)).setOrigin(0, 0));
    this.pips(add, day, { x: left, y: y + 116, r: 15, align: 0 });
    add(this.message(day, left, y + 146, 350).setOrigin(0, 0));
    this.details(add, day, left, y + 262, 0);
  }

  private message(day: DayView, x: number, y: number, width: number): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, day.message, text(28, CSS.inkSoft, { wordWrap: { width } }));
  }

  /** A pale heart that fills from the bottom, one slice per game; solid once earned. */
  private bigHeart(add: Add, day: DayView, x: number, y: number, scale: number): void {
    add(this.scene.add.image(x, y, 'heart-empty').setScale(scale));
    const rows = day.heart ? HEART_ROWS : Math.round((HEART_ROWS * Math.min(day.rounds, day.goal)) / day.goal);
    if (rows === 0) return;
    const fill = add(this.scene.add.image(x, y, 'heart').setScale(scale));
    if (!day.heart) fill.setCrop(0, HEART_ROWS - rows, 11, rows);
  }

  /** One dot per game toward the goal, filled for each game played. */
  private pips(add: Add, day: DayView, at: { x: number; y: number; r: number; align: number }): void {
    const { x, y, r, align } = at;
    const step = r * 2 + 10;
    const start = x - align * (day.goal * step - 10) + r;
    const g = add(this.scene.add.graphics());
    for (let i = 0; i < day.goal; i++) {
      const on = i < day.rounds;
      g.fillStyle(on ? COLORS.strawberry : COLORS.white, 1).fillCircle(start + i * step, y, r);
      g.lineStyle(3, on ? COLORS.strawberryDark : COLORS.strawberry, 1).strokeCircle(start + i * step, y, r);
    }
  }

  /** The time pill and a badge per subject played. */
  private details(add: Add, day: DayView, x: number, y: number, align: number): void {
    if (day.minutes === '') return;
    const minutes = add(this.scene.add.text(0, y, day.minutes, text(28, CSS.strawberry)).setOrigin(0, 0.5));
    const badges = day.subjects.map((id) => this.badge(add, id, 24));
    const items = [minutes, ...badges.filter((b) => b !== null)];
    const widths = items.map((item) => item.width + (item === minutes ? 32 : 0));
    const total = widths.reduce((sum, wd) => sum + wd, 0) + (items.length - 1) * 14;
    let left = x - align * total;
    const pill = add(this.scene.add.graphics());
    pill.fillStyle(COLORS.white, 1).fillRoundedRect(left, y - 24, widths[0]!, 48, 24);
    pill.lineStyle(4, COLORS.strawberry, 1).strokeRoundedRect(left, y - 24, widths[0]!, 48, 24);
    this.content.bringToTop(minutes);
    items.forEach((item, i) => {
      item.setPosition(left + (i === 0 ? 16 : 0), y);
      left += widths[i]! + 14;
    });
  }

  /** A subject's badge ("123") as a coloured chip; null for a subject this game no longer has. */
  private badge(add: Add, subjectId: string, size: number): Phaser.GameObjects.Container | null {
    const index = this.opts.subjects.findIndex((s) => s.id === subjectId);
    if (index < 0) return null;
    const [fill, edge] = BADGE_COLORS[index % BADGE_COLORS.length]!;
    const label = this.scene.add.text(10, 0, this.opts.subjects[index]!.badge, text(size, CSS.ink)).setOrigin(0, 0.5);
    const w = label.width + 20;
    const h = size + 16;
    const g = this.scene.add.graphics();
    g.fillStyle(fill, 1).fillRoundedRect(0, -h / 2, w, h, 10);
    g.lineStyle(3, edge, 1).strokeRoundedRect(0, -h / 2, w, h, 10);
    const chip = add(this.scene.add.container(0, 0, [g, label]));
    chip.setSize(w, h);
    return chip;
  }

  // -------------------------------------------------------------------------
  // The month
  // -------------------------------------------------------------------------

  private drawMonth(add: Add): void {
    const { profile, now } = this.opts;
    const p = profile();
    const view = monthView(p.dailyLog, this.month, p.settings.dailyGoal, now());
    this.monthHeader(add, view.title, view.canGoBack, view.canGoForward);
    const { grid } = this.geo;
    const cellW = (grid.w - 6 * GAP) / 7;
    const rows = view.weeks.length;
    const cellH = Math.min(130, (grid.bottom - grid.top - (rows - 1) * GAP) / rows);
    WEEKDAYS.forEach((d, i) =>
      add(
        this.scene.add.text(grid.x + i * (cellW + GAP) + cellW / 2, grid.weekdaysY, d, text(22, CSS.inkSoft)),
      ).setOrigin(0.5),
    );
    view.weeks.forEach((week, row) =>
      week.forEach((day, col) => {
        const cell = { x: grid.x + col * (cellW + GAP), y: grid.top + row * (cellH + GAP), w: cellW, h: cellH };
        if (day) this.cell(add, day, cell);
      }),
    );
  }

  private monthHeader(add: Add, title: string, canGoBack: boolean, canGoForward: boolean): void {
    const { grid } = this.geo;
    const cx = grid.x + grid.w / 2;
    add(this.scene.add.text(cx, grid.headerY, title, text(36)).setOrigin(0.5));
    const arrow = (dx: number, label: string, enabled: boolean, delta: number) =>
      add(
        new Button(this.scene, cx + dx, grid.headerY, {
          width: 72,
          height: 64,
          label,
          fontSize: 28,
          fill: COLORS.lavender,
          shade: COLORS.lavenderDark,
          textColor: CSS.white,
          onTap: () => this.showMonth(delta),
        }).setEnabled(enabled),
      );
    arrow(-250, '◀', canGoBack, -1);
    arrow(250, '▶', canGoForward, 1);
  }

  private showMonth(delta: number): void {
    this.month = shiftMonth(this.month, delta);
    this.render();
  }

  private cell(add: Add, day: DayView, r: Rect): void {
    const { scene } = this;
    const chosen = day.key === this.selected;
    const g = add(scene.add.graphics());
    if (!day.isFuture) g.fillStyle(day.isToday ? TODAY_FILL : COLORS.white, 1).fillRoundedRect(r.x, r.y, r.w, r.h, 14);
    const edge = day.isToday ? COLORS.strawberryDark : chosen ? COLORS.lavenderDark : COLORS.creamDark;
    g.lineStyle(day.isToday || chosen ? 5 : 3, edge, 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 14);
    add(scene.add.text(r.x + 10, r.y + 6, String(day.date), text(20, CSS.inkSoft)));
    if (day.heart) this.stamp(add, day, r);
    else if (day.rounds > 0) this.smallPips(g, day, r);
    if (day.isFuture) return;
    const hit = add(scene.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive({ useHandCursor: true }));
    hit.on('pointerup', () => this.select(day.key));
  }

  /** A heart stamped on at a slight tilt, with the minutes played under it. */
  private stamp(add: Add, day: DayView, r: Rect): void {
    const scale = r.h >= 100 ? 4.4 : 3.6;
    const cx = r.x + r.w / 2;
    add(
      this.scene.add
        .image(cx, r.y + r.h * 0.45, 'heart')
        .setScale(scale)
        .setRotation(-0.14),
    );
    add(this.scene.add.text(cx, r.y + r.h - 16, day.minutes, text(17, CSS.strawberry)).setOrigin(0.5));
  }

  private smallPips(g: Phaser.GameObjects.Graphics, day: DayView, r: Rect): void {
    const step = 18;
    const start = r.x + r.w / 2 - ((day.goal - 1) * step) / 2;
    for (let i = 0; i < day.goal; i++) {
      const on = i < day.rounds;
      g.fillStyle(on ? COLORS.strawberry : COLORS.white, 1).fillCircle(start + i * step, r.y + r.h * 0.55, 7);
      g.lineStyle(2, on ? COLORS.strawberryDark : COLORS.strawberry, 1).strokeCircle(
        start + i * step,
        r.y + r.h * 0.55,
        7,
      );
    }
  }

  private select(key: string): void {
    this.selected = key;
    this.render();
  }
}

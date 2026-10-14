/** Shared look-and-feel constants: palette, type, and the screen layouts. */
import type { ShopSpot } from '../shop/catalog';

export const COLORS = {
  strawberry: 0xff8fb3,
  strawberryDark: 0xe0607e,
  cream: 0xfff6e8,
  creamDark: 0xf3e2c7,
  mint: 0x9ee6c4,
  mintDark: 0x5fbf98,
  sky: 0x9cc8ff,
  skyDark: 0x6c9fe0,
  lavender: 0xc7b3f0,
  lavenderDark: 0x9b84d1,
  peach: 0xffc9a8,
  brown: 0x9a6b52,
  brownDark: 0x6b4a3a,
  ink: 0x4a3a58,
  white: 0xffffff,
  shadow: 0x000000,
  // The chosen card in a set, e.g. the new player's shopkeeper.
  lemon: 0xffe680,
  // The register panel's card, where the ticket, start screen, setup and My shop sit.
  panel: 0xffe9d6,
  // Something switched off or not reached yet: a setup step dot, an off switch.
  off: 0xe2d6cc,
} as const;

/**
 * What draws over what, bottom to top, for the bar and the cards and screens
 * that open over the shop. The shop room's own pieces sit below all of these.
 */
export const DEPTH = {
  /** A new player's setup, over the ticket and keypad. */
  setup: 80,
  statusBar: 400,
  /** The start screen and Decorate cover the top bar. */
  startScreen: 450,
  decorate: 450,
  results: 500,
  closet: 600,
  /** My shop and the step it opens can both open over the results card. */
  myShop: 650,
  changeShop: 660,
  menu: 700,
  toast: 900,
  parentGate: 1000,
} as const;

export const CSS = {
  ink: '#4a3a58',
  inkSoft: '#7a6a88',
  strawberry: '#e0607e',
  mint: '#3f9f78',
  white: '#ffffff',
  sky: '#4f86cc',
} as const;

export const FONT = '"Trebuchet MS", "Avenir Next Rounded", "Nunito", "Segoe UI", system-ui, sans-serif';

export const text = (size: number, color: string = CSS.ink, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  fontStyle: 'bold',
  color,
  ...extra,
});

/** Pixel scale for character sprites (16x20 art -> 112x140 on screen). */
export const CHAR_SCALE = 7;

/**
 * The shop room is always drawn in the same 800x880 area at the top left. What
 * changes with the screen is where the register (ticket + keypad) goes:
 *
 *   landscape (iPad, 1280x880)      portrait (iPhone/iPad, 800 x 1360-1600)
 *   +--------------+--------+       +--------------+
 *   |              | ticket |       |     shop     |
 *   |     shop     |        |       |              |
 *   |              | keypad |       +--------------+
 *   +--------------+--------+       | ticket keypad|
 *                                   +--------------+
 */
export const SHOP_W = 800;
export const SHOP_H = 880;

export type Orientation = 'landscape' | 'portrait';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  orientation: Orientation;
  width: number;
  height: number;
  statusBar: Rect & {
    orderFont: number;
    dotsX: number;
    dotStep: number;
    dotR: number;
    pillX: number;
    pillW: number;
    gearX: number;
  };
  shop: Rect;
  wallBottom: number;
  door: Rect;
  counter: Rect;
  shopkeeper: { x: number; y: number };
  customerSpot: { x: number; y: number };
  doorSpot: { x: number; y: number };
  bubble: Rect;
  board: Rect;
  /** The wall calendar between the window and the display case; tapping it opens the progress calendar. */
  wallCalendar: Rect;
  /** Brown backdrop behind the register. */
  registerArea: Rect;
  panel: Rect;
  ticket: Rect;
  keypad: { x: number; y: number; cellW: number; cellH: number; gap: number };
  /**
   * Where each decoration stands (bottom centre). Spots past the shop room
   * (under the register) only show while decorating, when the register
   * slides away and the room fills the screen.
   */
  decorSpots: Record<ShopSpot, Point>;
}

export interface Point {
  x: number;
  y: number;
}

const DECOR_SPOTS: Omit<Record<ShopSpot, Point>, 'wall-right' | 'floor-right'> = {
  // Above the door.
  'wall-left': { x: 105, y: 282 },
  'floor-left': { x: 232, y: 640 },
  'floor-center': { x: 360, y: 812 },
  // Between the window and the display case, floating over where customers wait.
  'floor-back': { x: 412, y: 600 },
  'counter-top': { x: 528, y: 496 },
  // The counter's far end, past the shopkeeper.
  'counter-end': { x: 748, y: 496 },
  window: { x: 324, y: 236 },
  // Room surfaces (wall paint, doors) repaint the room; their spot is the bottom centre of what they cover.
  wall: { x: 400, y: 560 },
  door: { x: 105, y: 560 },
};

const SHOP_PARTS = {
  shop: { x: 0, y: 72, w: SHOP_W, h: SHOP_H - 72 },
  wallBottom: 560,
  door: { x: 40, y: 300, w: 130, h: 260 },
  counter: { x: 470, y: 520, w: 330, h: 190 },
  shopkeeper: { x: 655, y: 610 },
  customerSpot: { x: 360, y: 770 },
  doorSpot: { x: 105, y: 600 },
  bubble: { x: 140, y: 400, w: 440, h: 150 },
  board: { x: 180, y: 86, w: 610, h: 290 },
  wallCalendar: { x: 452, y: 200, w: 136, h: 112 },
};

function landscapeLayout(): Layout {
  const width = 1280;
  const height = SHOP_H;
  return {
    orientation: 'landscape',
    width,
    height,
    statusBar: {
      x: 0,
      y: 0,
      w: width,
      h: 72,
      orderFont: 30,
      dotsX: 290,
      dotStep: 52,
      dotR: 16,
      pillX: 910,
      pillW: 230,
      gearX: 1214,
    },
    ...SHOP_PARTS,
    decorSpots: {
      ...DECOR_SPOTS,
      'wall-right': { x: 1040, y: 340 },
      'floor-right': { x: 1030, y: 690 },
      // Clear of Decorate's tray, just behind where customers stand.
      'floor-center': { x: 360, y: 696 },
    },
    registerArea: { x: SHOP_W, y: 72, w: width - SHOP_W, h: height - 72 },
    panel: { x: 812, y: 80, w: 458, h: 790 },
    ticket: { x: 832, y: 92, w: 418, h: 300 },
    keypad: { x: 834, y: 412, cellW: 128, cellH: 100, gap: 14 },
  };
}

/** Portrait game heights: iPad portrait is ~1.44 tall, iPhones ~2.16. */
export const PORTRAIT_MIN_H = 1360;
export const PORTRAIT_MAX_H = 1600;

function portraitLayout(screenAspect: number): Layout {
  const width = SHOP_W;
  const height = Math.round(Math.min(PORTRAIT_MAX_H, Math.max(PORTRAIT_MIN_H, width * screenAspect)));
  const area = { x: 0, y: SHOP_H, w: width, h: height - SHOP_H };
  const panel = { x: 12, y: area.y + 10, w: width - 24, h: area.h - 20 };
  const gap = 12;
  const cellW = 120;
  const pad = 18;
  const cellH = Math.min(120, Math.floor((panel.h - 2 * pad - 3 * gap) / 4));
  const keypadW = 3 * cellW + 2 * gap;
  const keypadH = 4 * cellH + 3 * gap;
  const keypadX = panel.x + panel.w - pad - keypadW;
  const ticketH = Math.min(panel.h - 2 * pad, 420);
  return {
    orientation: 'portrait',
    width,
    height,
    statusBar: {
      x: 0,
      y: 0,
      w: width,
      h: 72,
      orderFont: 26,
      dotsX: 226,
      dotStep: 32,
      dotR: 12,
      pillX: 552,
      pillW: 160,
      gearX: 762,
    },
    ...SHOP_PARTS,
    // The café set stands on the floor below the counter, clear of the rug and the tray.
    decorSpots: { ...DECOR_SPOTS, 'wall-right': { x: 708, y: 300 }, 'floor-right': { x: 440, y: 1000 } },
    registerArea: area,
    panel,
    ticket: { x: panel.x + pad, y: panel.y + (panel.h - ticketH) / 2, w: keypadX - panel.x - 2 * pad, h: ticketH },
    keypad: { x: keypadX, y: panel.y + (panel.h - keypadH) / 2, cellW, cellH, gap },
  };
}

/** Where a perfect round's parade lines up on the shop floor: a back row, then a front row offset between them. */
export function paradeSpots(count: number): { x: number; y: number; scale: number }[] {
  const perRow = Math.ceil(count / 2);
  const step = (SHOP_W - 160) / Math.max(1, perRow);
  return Array.from({ length: count }, (_, i) => {
    const front = i >= perRow;
    const col = front ? i - perRow : i;
    return { x: 100 + step * col + (front ? step / 2 : 0), y: front ? SHOP_H - 30 : SHOP_H - 130, scale: 0.7 };
  });
}

export function layoutFor(screenW: number, screenH: number): Layout {
  return screenH > screenW ? portraitLayout(screenH / screenW) : landscapeLayout();
}

/**
 * The active layout. Set once before the shop is built (and again when the
 * screen rotates, followed by a scene restart); modules read it live.
 */
export let LAYOUT: Layout = landscapeLayout();

export function setLayout(layout: Layout): void {
  LAYOUT = layout;
}

/** Decorate's tray of items along the bottom of the screen. */
export function decorTrayRect(layout: Layout): Rect {
  const h = layout.orientation === 'landscape' ? 180 : 300;
  return { x: 0, y: layout.height - h, w: layout.width, h };
}

/**
 * Where the shop's colour card goes so it never hides the item being tried
 * (`piece`, the area it covers): on the other side in landscape; in
 * portrait below it when there is room above the tray, else at the top.
 */
export function tierCardRect(layout: Layout, piece: Rect): Rect {
  if (layout.orientation === 'landscape') {
    const w = 700;
    const right = piece.x + piece.w / 2 > layout.width / 2;
    return { x: right ? 20 : layout.width - w - 20, y: 88, w, h: 260 };
  }
  const h = 270;
  const belowY = decorTrayRect(layout).y - h - 16;
  return { x: 20, y: piece.y + piece.h + 16 <= belowY ? belowY : 88, w: layout.width - 40, h };
}

/** Decorate's tray: a page of bubbles between two big arrows, and a dot per page. */
export interface TraySlots {
  perPage: number;
  /** Bubble diameter. */
  d: number;
  /** Centres of the bubbles on a page. */
  slots: Point[];
  prev: Rect;
  next: Rect;
  dotsY: number;
}

export function decorTraySlots(layout: Layout): TraySlots {
  const tray = decorTrayRect(layout);
  if (layout.orientation === 'landscape') {
    const y = tray.y + 84;
    const arrow = (x: number): Rect => ({ x, y: y - 60, w: 90, h: 120 });
    const slots = Array.from({ length: 7 }, (_, i) => ({ x: layout.width / 2 + (i - 3) * 150, y }));
    return { perPage: 7, d: 128, slots, prev: arrow(14), next: arrow(layout.width - 104), dotsY: tray.y + 164 };
  }
  const rows = [tray.y + 76, tray.y + 210];
  const slots = rows.flatMap((y) => [175, 325, 475, 625].map((x) => ({ x, y })));
  const arrow = (x: number): Rect => ({ x, y: tray.y + 83, w: 80, h: 120 });
  return { perPage: 8, d: 118, slots, prev: arrow(10), next: arrow(layout.width - 90), dotsY: tray.y + 284 };
}

/** Momo's Closet: Momo on a little stage, and a panel of tabs, item tiles and the colour card. */
export interface ClosetLayout {
  stage: Rect;
  /** Where Momo stands (her feet) and how many screen pixels each of her pixels takes. */
  momo: Point & { scale: number };
  /** The top of the line naming what she is trying on. */
  captionY: number;
  panel: Rect;
  tabs: Rect;
  grid: Rect;
  card: Rect;
}

const CLOSET_BAR_H = 72;
const CLOSET_CARD_H = 270;
const CLOSET_TILE_H = 150;
/** Tabs, two rows of tiles and the colour card, with the gaps around them. */
const CLOSET_PANEL_H = 18 + 64 + 18 + 2 * CLOSET_TILE_H + 14 + 24 + CLOSET_CARD_H + 16;

export function closetLayout(layout: Layout): ClosetLayout {
  const landscape = layout.orientation === 'landscape';
  const panel = landscape
    ? { x: 632, y: Math.round((layout.height + CLOSET_BAR_H - CLOSET_PANEL_H) / 2), w: 636, h: CLOSET_PANEL_H }
    : { x: 12, y: layout.height - 12 - CLOSET_PANEL_H, w: layout.width - 24, h: CLOSET_PANEL_H };
  const stage = landscape
    ? { x: 0, y: CLOSET_BAR_H, w: 620, h: layout.height - CLOSET_BAR_H }
    : { x: 0, y: CLOSET_BAR_H, w: layout.width, h: panel.y - 20 - CLOSET_BAR_H };
  const inner = { x: panel.x + 20, w: panel.w - 40 };
  const tabs = { ...inner, y: panel.y + 18, h: 64 };
  const grid = { ...inner, y: tabs.y + tabs.h + 18, h: 2 * CLOSET_TILE_H + 14 };
  const momoY = landscape ? 600 : stage.y + stage.h - 130;
  return {
    stage,
    momo: { x: stage.x + stage.w / 2, y: momoY, scale: 9 },
    captionY: momoY + 46,
    panel,
    tabs,
    grid,
    card: { ...inner, y: grid.y + grid.h + 24, h: CLOSET_CARD_H },
  };
}

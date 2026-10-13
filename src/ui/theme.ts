/** Shared look-and-feel constants: palette, type, and the fixed 1280x880 layout. */

export const GAME_W = 1280;
export const GAME_H = 880;

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

export const LAYOUT = {
  statusBar: { x: 0, y: 0, w: GAME_W, h: 72 },
  shop: { x: 0, y: 72, w: 800, h: GAME_H - 72 },
  wallBottom: 560,
  door: { x: 40, y: 300, w: 130, h: 260 },
  counter: { x: 470, y: 520, w: 330, h: 190 },
  shopkeeper: { x: 655, y: 610 },
  customerSpot: { x: 360, y: 770 },
  doorSpot: { x: 105, y: 600 },
  bubble: { x: 140, y: 400, w: 440, h: 150 },
  board: { x: 180, y: 86, w: 610, h: 290 },
  panel: { x: 812, y: 80, w: 458, h: 790 },
  ticket: { x: 832, y: 92, w: 418, h: 300 },
  keypad: { x: 834, y: 412, cellW: 128, cellH: 100, gap: 14 },
} as const;

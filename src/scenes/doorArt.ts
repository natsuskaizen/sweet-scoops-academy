/**
 * Art for the room surfaces sold in Decorate: the doors (text grids the
 * size of the room's door frame, painted into the room in place of the
 * plain door) and the wall paint's tray icon. As in decorArt.ts, `L` and
 * `l` pixels take the tier's colours.
 *
 * Every door keeps the hanging OPEN sign (`S`) and the knob (`k`) in the
 * same place, so the room's OPEN label still sits on it.
 */

/** The door frame in art pixels (room pixels), frame included; see doorFrame() in shopRoom.ts. */
export const DOOR_W = 37;
export const DOOR_H = 67;
const MID = (DOOR_W - 1) / 2;

type Paint = (x: number, y: number) => string;

/** Inside the door's outline shrunk by `inset`. `arch` is how tall its rounded top is (0 for a square top). */
function inside(x: number, y: number, inset: number, arch: number): boolean {
  if (x < inset || x > DOOR_W - 1 - inset || y < inset) return false;
  if (y >= arch) return true;
  const dx = (x - MID) / (MID + 0.5 - inset);
  const dy = (y + 0.5 - arch) / (arch - inset);
  return dx * dx + dy * dy <= 1;
}

type Box = { x0: number; x1: number; y0: number; y1: number };

const within = (x: number, y: number, b: Box): boolean => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
const onEdge = (x: number, y: number, b: Box): boolean => x === b.x0 || x === b.x1 || y === b.y0 || y === b.y1;

const SIGN: Box = { x0: 7, x1: 29, y0: 29, y1: 37 };
const KNOB: Box = { x0: 30, x1: 31, y0: 40, y1: 41 };

/** The OPEN sign (clipped corners) and the knob, the same on every door; null elsewhere. */
function fittings(x: number, y: number): string | null {
  if (within(x, y, KNOB)) return 'k';
  if (!within(x, y, SIGN)) return null;
  const corner = (x === SIGN.x0 || x === SIGN.x1) && (y === SIGN.y0 || y === SIGN.y1);
  if (corner) return null;
  return onEdge(x, y, SIGN) ? 'o' : 'S';
}

function doorCell(x: number, y: number, arch: number, inner: Paint): string {
  if (!inside(x, y, 0, arch)) return '.';
  if (y === DOOR_H - 1 || !inside(x, y, 1, arch)) return 'o';
  if (!inside(x, y, 3, arch)) return 't';
  if (!inside(x, y, 4, arch)) return 'o';
  return fittings(x, y) ?? inner(x, y);
}

function doorGrid(arch: number, inner: Paint): string[] {
  return Array.from({ length: DOOR_H }, (_, y) =>
    Array.from({ length: DOOR_W }, (_, x) => doorCell(x, y, arch, inner)).join(''),
  );
}

const dist = (x: number, y: number, cx: number, cy: number): number => Math.hypot(x - cx, y - cy);

/** A round-topped plank door with a porthole window and iron hinges. */
function cottage(x: number, y: number): string {
  const r = dist(x, y, MID, 15);
  if (r <= 4.6) return x === MID || y === 15 ? 't' : 'B';
  if (r <= 5.6) return 'o';
  if ((y === 21 || y === 54) && x >= 5 && x <= 12) return 'o';
  return x % 6 === 4 ? 'l' : 'L';
}

const HEART = ['.pp.pp.', 'ppppppp', '.ppppp.', '..ppp..', '...p...'];

/** Candy stripes inside a trim, with a heart in the round window. */
function candy(x: number, y: number): string {
  const r = dist(x, y, MID, 15);
  if (r <= 5.6) return HEART[y - 13]?.[x - 15] === 'p' ? 'p' : 'w';
  if (r <= 6.6) return 'o';
  if (!inside(x, y, 6, 0)) return 'l';
  return (x + y) % 8 < 4 ? 'L' : 'w';
}

const PANELS: Box[] = [
  { x0: 7, x1: 16, y0: 44, y1: 60 },
  { x0: 20, x1: 29, y0: 44, y1: 60 },
];

/** A tall arched door: a fanlight window over two panels. */
function arched(x: number, y: number): string {
  if (y < 19 && inside(x, y, 7, 14)) return (x - MID) % 5 === 0 ? 'o' : 'B';
  if (y === 19 || (y < 19 && inside(x, y, 6, 14))) return 'o';
  const panel = PANELS.find((b) => within(x, y, b));
  return panel && onEdge(x, y, panel) ? 'l' : 'L';
}

export const DOOR_ART: Readonly<Record<string, readonly string[]>> = {
  'door-cottage': doorGrid(18, cottage),
  'door-candy': doorGrid(0, candy),
  'door-arch': doorGrid(14, arched),
};

/** The wall paint's tray icon: a tin of paint. */
export const PAINT_TIN = [
  '..oooooooooooo..',
  '.oLLLLLLLLLLLLo.',
  'oLLwwLLLLLLLLLLo',
  'olLLLLLLLLLLLLlo',
  'oolllllllllllloo',
  'oLsssssssssssslo',
  'oLswssssssssssso',
  'olswsLLLLLLsssso',
  'osswsLwLLLLsssso',
  'osswsLLLLLLsssso',
  'osswssssssssssso',
  'osssssssssssssso',
  '.oooooooooooooo.',
];

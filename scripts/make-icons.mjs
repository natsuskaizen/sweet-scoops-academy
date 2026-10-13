// Draws the Home Screen icons from the pixel-art favicon, so there is one
// source of truth for the logo. Re-run after changing public/favicon.svg:
//
//   node scripts/make-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BACKGROUND = '#c7b3f0'; // matches theme_color in the manifest
const GRID = 16;
const ICONS = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
];

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const rects = [...svg.matchAll(/<rect ([^>]*)\/>/g)].map(([, attrs]) => {
  const get = (name) => attrs.match(new RegExp(`${name}="([^"]+)"`))[1];
  return { x: +get('x'), y: +get('y'), w: +get('width'), h: +get('height'), rgb: hexToRgb(get('fill')) };
});

function hexToRgb(color) {
  const hex = color === '#fff' ? 'ffffff' : color.slice(1);
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** RGB pixels: the background, with the 16x16 art scaled up to ~75% and centred (inside the maskable safe zone). */
function draw(size) {
  const pixels = Buffer.alloc(size * size * 3);
  const bg = hexToRgb(BACKGROUND);
  for (let i = 0; i < size * size; i++) pixels.set(bg, i * 3);
  const cell = Math.floor((size * 0.75) / GRID);
  const offset = Math.floor((size - cell * GRID) / 2);
  for (const r of rects) {
    for (let y = r.y * cell; y < (r.y + r.h) * cell; y++) {
      for (let x = r.x * cell; x < (r.x + r.w) * cell; x++) pixels.set(r.rgb, ((offset + y) * size + offset + x) * 3);
    }
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const rows = [];
  for (let y = 0; y < size; y++) rows.push(Buffer.from([0]), pixels.subarray(y * size * 3, (y + 1) * size * 3));
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const { file, size } of ICONS) {
  writeFileSync(new URL(`../public/icons/${file}`, import.meta.url), png(size, draw(size)));
  console.warn(`wrote public/icons/${file}`);
}

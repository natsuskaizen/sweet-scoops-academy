/**
 * A tiny pixel painter for the shop room. The room is painted on a small
 * canvas (one texel per art pixel) and shown scaled up with nearest-neighbour
 * filtering, so walls, props and characters all read as the same pixel art.
 */
export type BoxStyle = string | { fill: string; line: string };

export class Pixels {
  /** `outline` is the line colour boxes and rings use unless told otherwise. */
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly outline: string,
  ) {}

  rect(x: number, y: number, w: number, h: number, color: string): this {
    if (w <= 0 || h <= 0) return this;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return this;
  }

  /** Filled box with a 1px outline and clipped corners, the room's basic shape. A bare colour is the fill. */
  box(x: number, y: number, w: number, h: number, style: BoxStyle): this {
    const { fill, line } = typeof style === 'string' ? { fill: style, line: this.outline } : style;
    this.rect(x + 1, y, w - 2, 1, line).rect(x + 1, y + h - 1, w - 2, 1, line);
    this.rect(x, y + 1, 1, h - 2, line).rect(x + w - 1, y + 1, 1, h - 2, line);
    return this.rect(x + 1, y + 1, w - 2, h - 2, fill);
  }

  /** Pixel disc centred on (cx, cy). */
  disc(cx: number, cy: number, r: number, color: string): this {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy) + 0.3);
      this.rect(cx - half, cy + dy, 2 * half + 1, 1, color);
    }
    return this;
  }

  /** Disc with an outline ring. */
  ring(cx: number, cy: number, r: number, fill: string): this {
    return this.disc(cx, cy, r, this.outline).disc(cx, cy, r - 1, fill);
  }

  /** Stamps a text pixel map; characters missing from `colors` are transparent. */
  stamp(rows: readonly string[], x: number, y: number, colors: Record<string, string>): this {
    return this.paint(rows, x, y, (ch) => colors[ch] ?? null);
  }

  /** Stamps a text pixel map, asking `colorFor` for each pixel's colour (null is transparent). */
  paint(rows: readonly string[], x: number, y: number, colorFor: (ch: string, dx: number) => string | null): this {
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const color = colorFor(row[dx]!, dx);
        if (color) this.rect(x + dx, y + dy, 1, 1, color);
      }
    });
    return this;
  }
}

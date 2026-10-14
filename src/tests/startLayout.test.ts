import { describe, expect, it } from 'vitest';
import { startLayout } from '../ui/startLayout';
import { inside, overlaps, PANEL_SCREENS } from './rects';

describe.each(Object.entries(PANEL_SCREENS))('startLayout on %s', (_, layout) => {
  const start = startLayout(layout.panel, layout.orientation === 'portrait');
  // A friend is 112 x 140 at shop size, standing on their feet.
  const { friend } = start;
  const friendBox = {
    x: friend.x - 56 * friend.scale,
    y: friend.y - 140 * friend.scale,
    w: 112 * friend.scale,
    h: 140 * friend.scale,
  };
  const hello = { x: start.textX - 10, y: start.helloY - start.helloFont / 2, w: 20, h: start.helloFont };
  const boxes = { friend: friendBox, hello, open: start.open, others: start.others, grownUps: start.grownUps };

  it('keeps everything inside the panel', () => {
    Object.values(boxes).forEach((box) => expect(inside(box, layout.panel)).toBe(true));
  });

  it('never puts one piece on top of another', () => {
    const list = Object.entries(boxes);
    list.forEach(([a, boxA], i) =>
      list.slice(i + 1).forEach(([b, boxB]) => expect(overlaps(boxA, boxB), `${a} and ${b}`).toBe(false)),
    );
  });

  it('has a big Open button and room for a row of other players', () => {
    expect(start.open.h).toBeGreaterThanOrEqual(90);
    expect(start.open.w).toBeGreaterThanOrEqual(300);
    expect(start.others.h).toBeGreaterThanOrEqual(72);
    expect(start.othersLabel.y).toBeLessThan(start.others.y);
  });
});

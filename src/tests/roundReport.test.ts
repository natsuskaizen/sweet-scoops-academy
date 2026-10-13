import { describe, expect, it } from 'vitest';
import type { RoundSummary } from '../save/saveTypes';
import { formatDuration, formatWhen, roundLines, roundReportPages, totalsLine } from '../shop/roundReport';

const at = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute).getTime();

function summary(overrides: Partial<RoundSummary> = {}): RoundSummary {
  return {
    roundNumber: 3,
    startedAt: at(13, 14, 5),
    finishedAt: at(13, 14, 12),
    playMs: 380_000,
    ordersCompleted: 10,
    firstTryCorrect: 8,
    retryCorrect: 1,
    missed: 1,
    orderSprinkles: 87,
    completionBonus: 10,
    perfectBonus: 0,
    total: 97,
    perfect: false,
    retryFacts: ['54 ÷ 6'],
    missFacts: ['7 × 8'],
    ...overrides,
  };
}

describe('roundReport', () => {
  it('formats durations for grown-ups', () => {
    expect(formatDuration(44_600)).toBe('45 s');
    expect(formatDuration(380_000)).toBe('6 min 20 s');
    expect(formatDuration(360_000)).toBe('6 min');
    expect(formatDuration(3_900_000)).toBe('1 h 5 min');
  });

  it('formats local dates and times', () => {
    expect(formatWhen(at(13, 14, 5))).toBe('Tue 13 Oct, 2:05 pm');
    expect(formatWhen(at(11, 0, 30))).toBe('Sun 11 Oct, 12:30 am');
  });

  it('summarizes one round, listing the questions that needed help', () => {
    expect(roundLines(summary())).toEqual([
      'Tue 13 Oct, 2:05 pm   ·   Round 3   ·   6 min 20 s',
      '     8/10 first try, 1 on the 2nd try, 1 shown   ·   ✦ 97',
      '     2nd try: 54 ÷ 6',
      '     Answer shown: 7 × 8',
    ]);
  });

  it('shows older untimed rounds by their finish time, without a made-up duration', () => {
    const old = summary({ startedAt: null, playMs: null, retryFacts: [], missFacts: [], perfect: true });
    expect(roundLines(old)).toEqual([
      'Tue 13 Oct, 2:12 pm   ·   Round 3   ·   time not recorded',
      '     8/10 first try, 1 on the 2nd try, 1 shown   ·   ✦ 97   ·   perfect!',
    ]);
  });

  it('totals play time and says how many rounds were not timed', () => {
    expect(totalsLine([summary()])).toBe('1 round finished   ·   6 min 20 s of play');
    expect(totalsLine([summary({ playMs: null }), summary({ playMs: null }), summary()])).toBe(
      '3 rounds finished   ·   6 min 20 s of play (2 older rounds not timed)',
    );
    expect(totalsLine([summary({ playMs: null }), summary()])).toMatch(/1 older round not timed/);
  });

  it('pages newest first without splitting a round', () => {
    const history = [1, 2, 3, 4].map((n) => summary({ roundNumber: n }));
    const pages = roundReportPages(history, 12); // header 2 + 2 rounds of 4 lines + 1 blank between
    expect(pages).toHaveLength(2);
    for (const page of pages) {
      expect(page[0]).toMatch(/^4 rounds finished/);
      expect(page.length).toBeLessThanOrEqual(12);
      expect(page[page.length - 1]).not.toBe('');
    }
    expect(pages[0]![2]).toMatch(/Round 4/);
    expect(pages[1]![2]).toMatch(/Round 2/);
  });

  it('still shows a round taller than a page on its own page', () => {
    expect(roundReportPages([summary(), summary()], 3)).toHaveLength(2);
  });

  it('explains an empty history', () => {
    expect(roundReportPages([])).toEqual([[expect.stringMatching(/No rounds finished yet/)]]);
  });
});

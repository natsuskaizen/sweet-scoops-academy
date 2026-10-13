import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import type { RoundSummary } from '../save/saveTypes';
import {
  clockTime,
  dayLabel,
  formatDuration,
  overviewView,
  practiceFacts,
  practiceLine,
  roundsView,
} from '../shop/progressReport';

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const NOW = at(13, 18); // Tue 13 Oct, 6 pm
const settings = GAME_CONFIG.parentArea;

function round(overrides: Partial<RoundSummary> = {}): RoundSummary {
  return {
    roundNumber: 1,
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

describe('progressReport', () => {
  it('formats durations and times for grown-ups', () => {
    expect(formatDuration(44_600)).toBe('45 s');
    expect(formatDuration(380_000)).toBe('6 min');
    expect(formatDuration(4_680_000)).toBe('1 h 18 min');
    expect(clockTime(at(13, 14, 5))).toBe('2:05 pm');
    expect(clockTime(at(13, 0, 30))).toBe('12:30 am');
  });

  it('names recent days in words and older ones by date', () => {
    expect(dayLabel(at(13, 0, 1), NOW)).toBe('Today');
    expect(dayLabel(at(12, 23), NOW)).toBe('Yesterday');
    expect(dayLabel(at(11, 10), NOW)).toBe('Sun 11 Oct');
  });

  it('lists shown answers before 2nd tries on a card, capped with "+N more"', () => {
    expect(practiceLine(round(), 3)).toBe('Practise: 7 × 8, 54 ÷ 6');
    expect(practiceLine(round({ retryFacts: ['a', 'b', 'c'], missFacts: ['d'] }), 3)).toBe('Practise: d, a, b +1 more');
    expect(practiceLine(round({ retryFacts: [], missFacts: [] }), 3)).toBe('');
  });

  it('builds the rounds view: totals, then cards newest first, four to a page', () => {
    const history = [1, 2, 3, 4, 5].map((n) => round({ roundNumber: n, startedAt: at(8 + n, 9) }));
    history[0] = { ...history[0]!, startedAt: null, finishedAt: at(9, 14, 12), playMs: null };
    const view = roundsView(history, NOW, settings);
    expect(view.tiles).toEqual([
      { value: '5', label: 'rounds played' },
      { value: '25 min', label: 'time playing' },
      { value: '80%', label: 'right first try' },
    ]);
    expect(view.pages.map((p) => p.length)).toEqual([4, 1]);
    expect(view.pages[0]![0]).toMatchObject({
      when: 'Today, 9:00 am',
      time: '6 min',
      practice: 'Practise: 7 × 8, 54 ÷ 6',
    });
    expect(view.pages[1]![0]).toMatchObject({ when: 'Fri 9 Oct, 2:12 pm', time: null }); // untimed: finish time, no duration
  });

  it('has an empty first page and dashes when nothing has been played', () => {
    const view = roundsView([], NOW);
    expect(view.pages).toEqual([[]]);
    expect(view.tiles.map((t) => t.value)).toEqual(['0', '–', '–']);
  });

  it('builds the overview from the last 7 days and the last 10 rounds', () => {
    const history = [
      round({ startedAt: at(1, 9), playMs: 600_000 }), // too old for the tiles
      round({ startedAt: at(12, 9), playMs: 300_000 }),
      round({ startedAt: at(13, 9), playMs: null }), // counted, but has no time
      round({ startedAt: at(13, 10), playMs: 420_000, firstTryCorrect: 10, retryCorrect: 0, missed: 0 }),
    ];
    const view = overviewView(history, NOW, settings);
    expect(view.tiles).toEqual([
      { value: '3', label: 'rounds, last 7 days' },
      { value: '12 min', label: 'playing, last 7 days' },
      { value: '6 min', label: 'per round, on average' },
    ]);
    expect(view.bars.map((b) => b.label)).toEqual(['Thu', 'Mon', 'Tue', 'Tue']);
    expect(view.bars[3]).toMatchObject({ first: 10, retry: 0, miss: 0 });
    expect(overviewView(history, NOW, { ...settings, chartRounds: 2 }).bars).toHaveLength(2);
  });

  it('shows dashes in the overview when the last 7 days have no timed rounds', () => {
    expect(overviewView([round({ startedAt: at(1, 9) })], NOW).tiles.map((t) => t.value)).toEqual(['0', '–', '–']);
  });

  it('ranks practice questions: shown answers weigh more, recent rounds only, newest wins ties', () => {
    const history = [
      round({ missFacts: ['old'], retryFacts: [] }), // outside the lookback below
      round({ missFacts: [], retryFacts: ['6 × 7'] }),
      round({ missFacts: ['9 × 6'], retryFacts: ['6 × 7'] }),
      round({ missFacts: [], retryFacts: ['8 × 4'] }),
    ];
    expect(practiceFacts(history, { ...settings, practiceLookbackRounds: 3 })).toEqual(['9 × 6', '6 × 7', '8 × 4']);
    expect(practiceFacts(history, { ...settings, practiceLookbackRounds: 3, practiceFacts: 1 })).toEqual(['9 × 6']);
  });
});

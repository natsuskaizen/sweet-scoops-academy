import { describe, expect, it } from 'vitest';
import { createProfile } from '../save/saveManager';
import type { RoundSummary } from '../save/saveTypes';
import {
  addRound,
  dayKey,
  dayView,
  logFromHistory,
  minutesLabel,
  monthView,
  nextGoal,
  pruneLog,
  recordRound,
  shiftMonth,
  todayProgress,
  wallPage,
} from '../shop/progressCalendar';

/** Local time, so the tests agree with dayKey whatever the machine's time zone. */
const at = (month: number, date: number, hour = 15) => new Date(2026, month - 1, date, hour).getTime();
const MIN = 60_000;
const round = (finishedAt: number, playMs: number | null = 5 * MIN) => ({ finishedAt, playMs });

describe('progress calendar', () => {
  it('keys days by local date', () => {
    expect(dayKey(at(10, 3, 0))).toBe('2026-10-03');
    expect(dayKey(at(10, 3, 23))).toBe('2026-10-03');
  });

  it('counts games and time per day, and stamps a heart when the goal is reached', () => {
    const log = {};
    expect(addRound(log, round(at(10, 13)), 'math', 3)).toBe(false);
    expect(addRound(log, round(at(10, 13, 16)), 'vocab', 3)).toBe(false);
    expect(addRound(log, round(at(10, 13, 17), null), 'math', 3)).toBe(true);
    expect(addRound(log, round(at(10, 13, 18)), 'math', 3)).toBe(false); // already earned
    expect(log).toEqual({
      '2026-10-13': { rounds: 4, playMs: 15 * MIN, subjects: { math: 3, vocab: 1 }, heart: true },
    });
  });

  it('never takes a past heart away when the goal is raised', () => {
    const log = logFromHistory([round(at(10, 1)), round(at(10, 1))], 'math', 2);
    expect(dayView(log, '2026-10-01', 5, at(10, 13)).heart).toBe(true);
  });

  it('shows today with a heart as soon as a lowered goal is met', () => {
    const log = logFromHistory([round(at(10, 13)), round(at(10, 13))], 'math', 3);
    expect(dayView(log, '2026-10-13', 3, at(10, 13)).heart).toBe(false);
    expect(dayView(log, '2026-10-13', 2, at(10, 13))).toMatchObject({
      heart: true,
      message: 'You earned a heart today!',
    });
  });

  it('words each day gently', () => {
    const log = logFromHistory([round(at(10, 12)), round(at(10, 13, 9), 30_000)], 'math', 3);
    const now = at(10, 13);
    expect(dayView(log, '2026-10-13', 3, now)).toMatchObject({
      title: 'Today',
      isToday: true,
      rounds: 1,
      minutes: '1 min',
      subjects: ['math'],
      message: '2 more games for a heart!',
    });
    expect(dayView(log, '2026-10-13', 2, now).message).toBe('One more game for a heart!');
    expect(dayView(log, '2026-10-12', 3, now)).toMatchObject({ title: 'Mon 12', message: '1 game played' });
    expect(dayView(log, '2026-10-11', 3, now)).toMatchObject({ message: 'A rest day', minutes: '' });
    expect(dayView(log, '2026-10-14', 3, now).isFuture).toBe(true);
    expect(dayView(logFromHistory([round(at(10, 1))], 'math', 1), '2026-10-01', 1, now).message).toBe('Heart stamp!');
  });

  it('rounds play time to whole minutes a child can read', () => {
    expect(minutesLabel(0)).toBe('1 min');
    expect(minutesLabel(12.4 * MIN)).toBe('12 min');
  });

  it('lays a month out in Monday-first weeks', () => {
    const view = monthView({}, { year: 2026, month: 9 }, 3, at(10, 13));
    expect(view.title).toBe('October 2026');
    expect(view.weeks).toHaveLength(5);
    // 1 October 2026 is a Thursday.
    expect(view.weeks[0]!.slice(0, 3)).toEqual([null, null, null]);
    expect(view.weeks[0]![3]!.date).toBe(1);
    expect(view.weeks[4]![5]!.date).toBe(31);
    expect(view.weeks[4]![6]).toBeNull();
  });

  it('pages back only to the first month played, and forward only to this month', () => {
    const log = logFromHistory([round(at(9, 20))], 'math', 3);
    const now = at(10, 13);
    expect(monthView(log, { year: 2026, month: 9 }, 3, now)).toMatchObject({ canGoBack: true, canGoForward: false });
    expect(monthView(log, { year: 2026, month: 8 }, 3, now)).toMatchObject({ canGoBack: false, canGoForward: true });
    expect(monthView({}, { year: 2026, month: 9 }, 3, now).canGoBack).toBe(false);
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  });

  it('drops days older than the configured limit', () => {
    const log = logFromHistory([round(at(1, 1)), round(at(10, 1))], 'math', 3);
    pruneLog(log, at(10, 13), 30);
    expect(Object.keys(log)).toEqual(['2026-10-01']);
  });

  it('records a finished round on the profile with its goal', () => {
    const profile = createProfile('Kid', at(10, 1), 1);
    profile.settings.dailyGoal = 1;
    expect(recordRound(profile, round(at(10, 13)) as RoundSummary, 'math', { keepDays: 30 } as never)).toBe(true);
    expect(todayProgress(profile, at(10, 13, 20))).toEqual({ filled: 1, goal: 1, heart: true });
    expect(todayProgress(profile, at(10, 14))).toEqual({ filled: 0, goal: 1, heart: false });
  });

  it('cycles the daily goal through the allowed choices', () => {
    const settings = { dailyGoal: { min: 1, max: 3 } } as never;
    expect([1, 2, 3, 9].map((g) => nextGoal(g, settings))).toEqual([2, 3, 1, 1]);
  });

  it('labels the wall calendar page', () => {
    expect(wallPage(at(10, 13))).toEqual({ month: 'OCT', date: '13' });
  });
});

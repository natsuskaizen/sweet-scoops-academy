import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import { createProfile } from '../save/saveManager';
import type { RoundSummary } from '../save/saveTypes';
import {
  addRound,
  dayKey,
  dayView,
  gamesForHeart,
  logFromHistory,
  minutesLabel,
  monthView,
  nextGoal,
  pruneLog,
  recordRound,
  shiftMonth,
  todayProgress,
  typesToday,
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

  it('counts games and time per day, and stamps a heart when the goal is reached in different games', () => {
    const log = {};
    expect(addRound(log, round(at(10, 13)), 'math', 3, 'a')).toBe(false);
    expect(addRound(log, round(at(10, 13, 16)), 'math', 3, 'a')).toBe(false); // the same game again adds no slice
    expect(addRound(log, round(at(10, 13, 17), null), 'vocab', 3, 'b')).toBe(false);
    expect(addRound(log, round(at(10, 13, 18)), 'math', 3, 'c')).toBe(true);
    expect(addRound(log, round(at(10, 13, 19)), 'math', 3, 'd')).toBe(false); // already earned
    expect(log).toEqual({
      '2026-10-13': {
        rounds: 5,
        playMs: 20 * MIN,
        subjects: { math: 4, vocab: 1 },
        types: ['a', 'b', 'c', 'd'],
        heart: true,
      },
    });
  });

  it('counts every round as a game for a save from before game types', () => {
    const log = {};
    expect(addRound(log, round(at(10, 13)), 'math', 2)).toBe(false);
    expect(addRound(log, round(at(10, 13, 16)), 'math', 2)).toBe(true);
  });

  it('asks for as many different games as the grade offers, at most', () => {
    const profile = createProfile('Mo', at(10, 1), 1);
    profile.settings.dailyGoal = 5;
    expect(gamesForHeart(profile)).toBe(3);
    profile.settings.dailyGoal = 2;
    expect(gamesForHeart(profile)).toBe(2);
  });

  it('files a recorded round under its game and says when the heart is earned', () => {
    const profile = createProfile('Mo', at(10, 1), 1);
    profile.settings.dailyGoal = 2;
    const summary = { finishedAt: at(10, 13), playMs: MIN } as RoundSummary;
    expect(recordRound(profile, summary, 'math', 'grade3/division')).toBe(false);
    expect(recordRound(profile, summary, 'math', 'grade3/division')).toBe(false);
    expect(recordRound(profile, summary, 'math', 'grade3/mixed')).toBe(true);
    expect(typesToday(profile, at(10, 13))).toEqual(['grade3/division', 'grade3/mixed']);
    expect(todayProgress(profile, at(10, 13))).toEqual({ filled: 2, goal: 2, heart: true });
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
      message: '2 new games for a heart!',
    });
    expect(dayView(log, '2026-10-13', 2, now).message).toBe('One new game for a heart!');
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
    expect(
      recordRound(profile, round(at(10, 13)) as RoundSummary, 'math', 'g', { ...GAME_CONFIG.calendar, keepDays: 30 }),
    ).toBe(true);
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

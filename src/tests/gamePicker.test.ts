import { describe, expect, it } from 'vitest';
import { createProfile } from '../save/saveManager';
import type { RoundState, RoundSummary } from '../save/saveTypes';
import { offersChoice, pickerView, roundStarted } from '../shop/gamePicker';
import { recordRound } from '../shop/progressCalendar';

const NOW = new Date(2026, 9, 13, 15).getTime();
const summary = { finishedAt: NOW, playMs: 60_000 } as RoundSummary;
const profile = () => {
  const p = createProfile('Mo', NOW, 1);
  p.settings.dailyGoal = 3;
  return p;
};
const order = (attempts: number, outcome: string | null) => ({ attempts, outcome });
const round = (currentIndex: number, first = order(0, null)) =>
  ({ currentIndex, orders: [first, order(0, null)] }) as unknown as RoundState;

describe('game picker', () => {
  it('offers every game of the grade, none played, with an empty heart on a new day', () => {
    const view = pickerView(profile(), NOW);
    expect(view.cards.map((c) => [c.id, c.symbol, c.played])).toEqual([
      ['multiplication', '×', false],
      ['division', '÷', false],
      ['mixed', '×÷', false],
    ]);
    expect(view).toMatchObject({ filled: 0, goal: 3, title: 'What shall we play?' });
    expect(view.foot).toBe('Try a new kind of game to fill your heart!');
  });

  it('marks the games played today and fills a slice for each different one', () => {
    const p = profile();
    recordRound(p, summary, 'math', 'grade3/division');
    recordRound(p, summary, 'math', 'grade3/division');
    const view = pickerView(p, NOW);
    expect(view.cards.map((c) => c.played)).toEqual([false, true, false]);
    expect(view.filled).toBe(1);
  });

  it('celebrates the heart right after it is earned, and then just invites more play', () => {
    const p = profile();
    for (const type of ['grade3/multiplication', 'grade3/division', 'grade3/mixed'])
      recordRound(p, summary, 'math', type);
    expect(pickerView(p, NOW, true)).toMatchObject({ title: 'You earned a heart!', filled: 3 });
    expect(pickerView(p, NOW)).toMatchObject({ title: 'What shall we play?', foot: 'Play any game you like!' });
  });

  it('only asks when the grade has a choice, and not in the middle of a round', () => {
    const p = profile();
    expect(offersChoice(p)).toBe(true);
    expect(roundStarted(null)).toBe(false);
    expect(roundStarted(round(0))).toBe(false);
    expect(roundStarted(round(2))).toBe(true);
    expect(roundStarted(round(0, order(1, null)))).toBe(true);
    expect(roundStarted(round(0, order(0, 'first-try')))).toBe(true);
  });
});

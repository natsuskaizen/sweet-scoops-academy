/**
 * The kids' progress calendar. Each finished round (a "game", in any subject)
 * is added to the day it finished on, with which kind of game it was. Playing
 * the day's goal of different games (times tables, then sharing, then a mix)
 * stamps a heart on that date with the time played; the same game again
 * still counts as played but adds no slice. Phaser-free: src/ui/CalendarScreen.ts
 * and src/ui/WallCalendar.ts only draw what this returns.
 *
 * Gentle by design: days short of the goal show how many games were played,
 * never a cross, and a heart once earned is never taken away.
 */
import { GAME_CONFIG } from '../config/gameConfig';
import { gameCount } from '../learning/grades';
import type { DayRecord, Profile, RoundSummary } from '../save/saveTypes';

export type CalendarSettings = typeof GAME_CONFIG.calendar;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** A month on the calendar: `month` is 0-11, as in Date. */
export interface MonthRef {
  year: number;
  month: number;
}

/** What one day shows. */
export interface DayView {
  key: string;
  /** Day of the month. */
  date: number;
  /** "Today", or "Mon 12" for any other day. */
  title: string;
  isToday: boolean;
  /** After today: drawn faintly and can't be picked. */
  isFuture: boolean;
  heart: boolean;
  /** Rounds finished that day, of any game. */
  rounds: number;
  /** Different games played that day, at most `goal`: the slices of the heart filled. */
  progress: number;
  /** Different games the heart needs. */
  goal: number;
  /** "12 min", or '' when nothing was played. */
  minutes: string;
  /** Subject ids played that day, most played first. */
  subjects: string[];
  /** The encouraging line under the day's heart. */
  message: string;
}

export interface MonthView {
  /** "October 2026". */
  title: string;
  /** Monday-first weeks; null pads the days before the 1st and after the last. */
  weeks: (DayView | null)[][];
  canGoBack: boolean;
  canGoForward: boolean;
}

/** Local calendar date, "2026-10-13": sorts in date order as plain text. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Minutes a child can read: "12 min", never "0 min" once anything was played. */
export function minutesLabel(playMs: number): string {
  return `${Math.max(1, Math.round(playMs / 60_000))} min`;
}

const emptyDay = (): DayRecord => ({ rounds: 0, playMs: 0, subjects: {}, types: [], heart: false });

/** Different games played on a day; a day from before game types counts each round as a game. */
const gamesPlayed = (day: DayRecord): number => day.types.length || day.rounds;

/** A player's heart needs this many different games: the goal, but never more than their grade offers. */
export const gamesForHeart = (profile: Profile, settings: CalendarSettings = GAME_CONFIG.calendar): number =>
  Math.max(1, Math.min(profile.settings.dailyGoal, gameCount(profile.settings), settings.dailyGoal.max));

/**
 * Adds one finished round to its day. `gameType` is which game it was; a round with
 * none (a save from before game types) counts as a game of its own. Returns true
 * when this round earned the day's heart.
 */
export function addRound(
  log: Record<string, DayRecord>,
  round: Pick<RoundSummary, 'finishedAt' | 'playMs'>,
  subjectId: string,
  goal: number,
  gameType?: string,
): boolean {
  const day = (log[dayKey(round.finishedAt)] ??= emptyDay());
  day.rounds += 1;
  day.playMs += round.playMs ?? 0;
  day.subjects[subjectId] = (day.subjects[subjectId] ?? 0) + 1;
  if (gameType !== undefined && !day.types.includes(gameType)) day.types.push(gameType);
  const different = gamesPlayed(day);
  const earned = !day.heart && different >= goal;
  if (earned) day.heart = true;
  return earned;
}

/** Drops days older than `keepDays` before `now`. */
export function pruneLog(log: Record<string, DayRecord>, now: number, keepDays: number): void {
  const oldest = dayKey(now - keepDays * DAY_MS);
  for (const key of Object.keys(log)) if (key < oldest) delete log[key];
}

/** Records a finished round on the profile's calendar. Returns true when it earned today's heart. */
export function recordRound(
  profile: Profile,
  summary: RoundSummary,
  subjectId: string,
  gameType: string | undefined,
  settings: CalendarSettings = GAME_CONFIG.calendar,
): boolean {
  const earned = addRound(profile.dailyLog, summary, subjectId, gamesForHeart(profile, settings), gameType);
  pruneLog(profile.dailyLog, summary.finishedAt, settings.keepDays);
  return earned;
}

/** Builds a calendar log from round history, for saves made before the calendar existed. */
export function logFromHistory(
  history: readonly Pick<RoundSummary, 'finishedAt' | 'playMs'>[],
  subjectId: string,
  goal: number,
): Record<string, DayRecord> {
  const log: Record<string, DayRecord> = {};
  for (const round of history) addRound(log, round, subjectId, goal);
  return log;
}

/** The goal after `goal` in the grown-ups' list, wrapping back to the smallest. */
export function nextGoal(goal: number, settings: CalendarSettings = GAME_CONFIG.calendar): number {
  const { min, max } = settings.dailyGoal;
  return goal >= max || goal < min ? min : goal + 1;
}

function message(rounds: number, left: number, heart: boolean, isToday: boolean): string {
  if (heart) return isToday ? 'You earned a heart today!' : 'Heart stamp!';
  if (!isToday) return rounds === 0 ? 'A rest day' : `${rounds} ${rounds === 1 ? 'game' : 'games'} played`;
  return `${left === 1 ? 'One new game' : `${left} new games`} for a heart!`;
}

/** One day's view; `goal` is the different games a heart needs. Today shows a heart as soon as the current goal is reached, even if it was raised. */
export function dayView(log: Record<string, DayRecord>, key: string, goal: number, now: number): DayView {
  const record = log[key] ?? emptyDay();
  const [year, month, date] = key.split('-').map(Number) as [number, number, number];
  const today = dayKey(now);
  const isToday = key === today;
  const different = gamesPlayed(record);
  const heart = record.heart || (isToday && different >= goal);
  const weekday = WEEKDAYS[new Date(year, month - 1, date).getDay()]!;
  return {
    key,
    date,
    title: isToday ? 'Today' : `${weekday} ${date}`,
    isToday,
    isFuture: key > today,
    heart,
    rounds: record.rounds,
    progress: heart ? goal : Math.min(different, goal),
    goal,
    minutes: record.rounds > 0 ? minutesLabel(record.playMs) : '',
    subjects: Object.entries(record.subjects)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id),
    message: message(record.rounds, goal - different, heart, isToday),
  };
}

export const monthOf = (ms: number): MonthRef => {
  const d = new Date(ms);
  return { year: d.getFullYear(), month: d.getMonth() };
};

/** The month `delta` months from `ref`. */
export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const total = ref.year * 12 + ref.month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

const monthIndex = (ref: MonthRef) => ref.year * 12 + ref.month;

/** The earliest month worth showing: the first day played, or this month. */
function firstMonth(log: Record<string, DayRecord>, now: number): MonthRef {
  const first = Object.keys(log).sort()[0];
  if (!first) return monthOf(now);
  const [year, month] = first.split('-').map(Number) as [number, number];
  return { year, month: month - 1 };
}

function weeksOf(ref: MonthRef, day: (date: number) => DayView): (DayView | null)[][] {
  const days = new Date(ref.year, ref.month + 1, 0).getDate();
  // Monday first: Sunday (0) goes to the end of the week.
  const lead = (new Date(ref.year, ref.month, 1).getDay() + 6) % 7;
  const cells: (DayView | null)[] = Array.from({ length: lead }, () => null);
  for (let date = 1; date <= days; date++) cells.push(day(date));
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export function monthView(log: Record<string, DayRecord>, ref: MonthRef, goal: number, now: number): MonthView {
  const pad = (n: number) => String(n).padStart(2, '0');
  const keyFor = (date: number) => `${ref.year}-${pad(ref.month + 1)}-${pad(date)}`;
  return {
    title: `${MONTHS[ref.month]} ${ref.year}`,
    weeks: weeksOf(ref, (date) => dayView(log, keyFor(date), goal, now)),
    canGoBack: monthIndex(ref) > monthIndex(firstMonth(log, now)),
    canGoForward: monthIndex(ref) < monthIndex(monthOf(now)),
  };
}

/** What the wall calendar's page shows: "OCT" over "13". */
export function wallPage(now: number): { month: string; date: string } {
  const d = new Date(now);
  return { month: MONTHS[d.getMonth()]!.slice(0, 3).toUpperCase(), date: String(d.getDate()) };
}

/** Today's different games toward the heart, for the wall calendar's hearts: how many of `goal` are filled. */
export function todayProgress(profile: Profile, now: number): { filled: number; goal: number; heart: boolean } {
  const view = dayView(profile.dailyLog, dayKey(now), gamesForHeart(profile), now);
  return { filled: view.progress, goal: view.goal, heart: view.heart };
}

/** The games played today, in the order they were first played. */
export const typesToday = (profile: Profile, now: number): readonly string[] =>
  profile.dailyLog[dayKey(now)]?.types ?? [];

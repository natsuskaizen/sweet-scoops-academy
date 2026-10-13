/**
 * Data for the grown-ups progress screen, in two views: "Rounds" (summary
 * tiles plus one card per finished round) and "Overview" (this week's tiles,
 * a bar per recent round and the questions that need practice). Phaser-free;
 * src/ui/ProgressScreen.ts only draws what this returns. Never shown to the child.
 */
import { GAME_CONFIG } from '../config/gameConfig';
import type { RoundSummary } from '../save/saveTypes';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;
/** Shown wherever a number cannot be worked out (no rounds, or no timed rounds). */
export const NO_VALUE = '–';

export type ProgressSettings = typeof GAME_CONFIG.parentArea;

export interface StatTile {
  value: string;
  label: string;
}

export interface OutcomeCounts {
  first: number;
  retry: number;
  miss: number;
}

export interface RoundCard {
  /** "Today, 2:05 pm", "Yesterday, 4:30 pm" or "Sun 11 Oct, 10:15 am". */
  when: string;
  /** Play time, or null for rounds saved before play time was recorded. */
  time: string | null;
  ordersCompleted: number;
  outcomes: OutcomeCounts;
  perfect: boolean;
  /** "Practise: 7 × 8, 54 ÷ 6", or '' when every answer was right first try. */
  practice: string;
}

export interface RoundsView {
  tiles: StatTile[];
  /** Newest first. Always at least one page, possibly empty. */
  pages: RoundCard[][];
}

export interface ChartBar extends OutcomeCounts {
  /** Short day name under the bar, e.g. "Tue". */
  label: string;
}

export interface OverviewView {
  tiles: StatTile[];
  /** Oldest first, so the newest round is on the right. */
  bars: ChartBar[];
  /** Most in need of practice first. */
  practice: string[];
}

/** "45 s", "6 min" or "1 h 18 min". */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const startOfDay = (ms: number): number => new Date(ms).setHours(0, 0, 0, 0);

/** "Today", "Yesterday" or "Sun 11 Oct", in local time. */
export function dayLabel(ms: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / DAY_MS);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const d = new Date(ms);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "2:05 pm", in local time. */
export function clockTime(ms: number): string {
  const d = new Date(ms);
  const hour = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${hour}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'am' : 'pm'}`;
}

const playedAt = (s: RoundSummary): number => s.startedAt ?? s.finishedAt;
const timed = (history: readonly RoundSummary[]) => history.filter((s) => s.playMs !== null);
const totalPlayMs = (history: readonly RoundSummary[]) => timed(history).reduce((sum, s) => sum + s.playMs!, 0);
const plural = (n: number, word: string) => `${word}${n === 1 ? '' : 's'}`;

/** The questions that needed help (answers shown first), capped at `max` with "+N more". */
export function practiceLine(s: RoundSummary, max: number): string {
  const facts = [...new Set([...s.missFacts, ...s.retryFacts])];
  if (facts.length === 0) return '';
  const more = facts.length > max ? ` +${facts.length - max} more` : '';
  return `Practise: ${facts.slice(0, max).join(', ')}${more}`;
}

export function roundCard(s: RoundSummary, now: number, settings: ProgressSettings): RoundCard {
  return {
    when: `${dayLabel(playedAt(s), now)}, ${clockTime(playedAt(s))}`,
    time: s.playMs === null ? null : formatDuration(s.playMs),
    ordersCompleted: s.ordersCompleted,
    outcomes: { first: s.firstTryCorrect, retry: s.retryCorrect, miss: s.missed },
    perfect: s.perfect,
    practice: practiceLine(s, settings.cardPracticeFacts),
  };
}

function firstTryPercent(history: readonly RoundSummary[]): string {
  const orders = history.reduce((sum, s) => sum + s.ordersCompleted, 0);
  const first = history.reduce((sum, s) => sum + s.firstTryCorrect, 0);
  return orders === 0 ? NO_VALUE : `${Math.round((100 * first) / orders)}%`;
}

export function roundsView(
  history: readonly RoundSummary[],
  now: number,
  settings: ProgressSettings = GAME_CONFIG.parentArea,
): RoundsView {
  const cards = [...history].reverse().map((s) => roundCard(s, now, settings));
  const pages: RoundCard[][] = [];
  for (let i = 0; i < cards.length; i += settings.roundCardsPerPage) {
    pages.push(cards.slice(i, i + settings.roundCardsPerPage));
  }
  const playMs = totalPlayMs(history);
  return {
    tiles: [
      { value: `${history.length}`, label: `${plural(history.length, 'round')} played` },
      { value: timed(history).length === 0 ? NO_VALUE : formatDuration(playMs), label: 'time playing' },
      { value: firstTryPercent(history), label: 'right first try' },
    ],
    pages: pages.length > 0 ? pages : [[]],
  };
}

/**
 * Questions from recent rounds that needed help. A shown answer counts twice
 * as much as a 2nd try; ties go to the more recent question.
 */
export function practiceFacts(history: readonly RoundSummary[], settings: ProgressSettings): string[] {
  const weight = new Map<string, number>();
  const recent = history.slice(-settings.practiceLookbackRounds).reverse(); // newest first
  for (const s of recent) {
    for (const fact of s.missFacts) weight.set(fact, (weight.get(fact) ?? 0) + 2);
    for (const fact of s.retryFacts) weight.set(fact, (weight.get(fact) ?? 0) + 1);
  }
  // Map keeps insertion order (newest first) and sort is stable, so ties stay newest first.
  return [...weight.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, settings.practiceFacts)
    .map(([fact]) => fact);
}

export function overviewView(
  history: readonly RoundSummary[],
  now: number,
  settings: ProgressSettings = GAME_CONFIG.parentArea,
): OverviewView {
  const days = settings.overviewDays;
  const week = history.filter((s) => playedAt(s) > now - days * DAY_MS);
  const weekTimed = timed(week);
  const average = weekTimed.length === 0 ? NO_VALUE : formatDuration(totalPlayMs(week) / weekTimed.length);
  return {
    tiles: [
      { value: `${week.length}`, label: `${plural(week.length, 'round')}, last ${days} days` },
      {
        value: weekTimed.length === 0 ? NO_VALUE : formatDuration(totalPlayMs(week)),
        label: `playing, last ${days} days`,
      },
      { value: average, label: 'per round, on average' },
    ],
    bars: history.slice(-settings.chartRounds).map((s) => ({
      label: DAYS[new Date(playedAt(s)).getDay()]!,
      first: s.firstTryCorrect,
      retry: s.retryCorrect,
      miss: s.missed,
    })),
    practice: practiceFacts(history, settings),
  };
}

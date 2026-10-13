/**
 * Text for the grown-ups progress report: one block per finished round,
 * newest first, packed into pages. Phaser-free; the ParentGate only draws
 * the lines it is given. Nothing here is ever shown to the child.
 */
import { GAME_CONFIG } from '../config/gameConfig';
import type { RoundSummary } from '../save/saveTypes';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const INDENT = '     ';

/** "45 s", "6 min 20 s" or "1 h 5 min". */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return seconds % 60 === 0 ? `${minutes} min` : `${minutes} min ${seconds % 60} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** Local time, e.g. "Tue 13 Oct, 2:05 pm". */
export function formatWhen(epochMs: number): string {
  const d = new Date(epochMs);
  const hour = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  const minute = String(d.getMinutes()).padStart(2, '0');
  const ampm = d.getHours() < 12 ? 'am' : 'pm';
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${hour}:${minute} ${ampm}`;
}

/** The lines for one finished round: when and how long, the results, then any questions that needed help. */
export function roundLines(s: RoundSummary): string[] {
  const time = s.playMs === null ? 'time not recorded' : formatDuration(s.playMs);
  const lines = [
    `${formatWhen(s.startedAt ?? s.finishedAt)}   ·   Round ${s.roundNumber}   ·   ${time}`,
    `${INDENT}${s.firstTryCorrect}/${s.ordersCompleted} first try, ${s.retryCorrect} on the 2nd try, ` +
      `${s.missed} shown   ·   ✦ ${s.total}${s.perfect ? '   ·   perfect!' : ''}`,
  ];
  if (s.retryFacts.length > 0) lines.push(`${INDENT}2nd try: ${s.retryFacts.join(', ')}`);
  if (s.missFacts.length > 0) lines.push(`${INDENT}Answer shown: ${s.missFacts.join(', ')}`);
  return lines;
}

/** One line over the whole history: rounds finished and total recorded play time. */
export function totalsLine(history: readonly RoundSummary[]): string {
  const timed = history.filter((s) => s.playMs !== null);
  const playMs = timed.reduce((sum, s) => sum + (s.playMs ?? 0), 0);
  const untimed = history.length - timed.length;
  const note = untimed > 0 ? ` (${untimed} older round${untimed === 1 ? '' : 's'} not timed)` : '';
  return `${history.length} round${history.length === 1 ? '' : 's'} finished   ·   ${formatDuration(playMs)} of play${note}`;
}

/**
 * Newest round first. Each page starts with the totals line and a blank line,
 * and a round's lines are never split across pages.
 */
export function roundReportPages(
  history: readonly RoundSummary[],
  linesPerPage = GAME_CONFIG.parentArea.reportLinesPerPage,
): string[][] {
  if (history.length === 0) {
    return [
      [`No rounds finished yet. A round shows up here once all ${GAME_CONFIG.round.ordersPerRound} orders are served.`],
    ];
  }
  const header = [totalsLine(history), ''];
  const pages: string[][] = [];
  let page = [...header];
  for (const summary of [...history].reverse()) {
    const block = [...roundLines(summary), ''];
    if (page.length > header.length && page.length + block.length - 1 > linesPerPage) {
      pages.push(page);
      page = [...header];
    }
    page.push(...block);
  }
  pages.push(page);
  return pages.map((p) => p.slice(0, p.length - 1)); // drop each page's trailing blank line
}

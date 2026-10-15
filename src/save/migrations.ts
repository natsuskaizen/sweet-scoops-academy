/**
 * One step per save format change: `MIGRATIONS[n]` turns a version n save
 * into version n + 1, in place. Steps only fill in what is missing; the
 * result is still validated before anything uses it.
 */
import { GAME_CONFIG } from '../config/gameConfig';
import { defaultGradeChoice } from '../learning/grades';
import { logFromHistory } from '../shop/progressCalendar';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Profiles of a raw save, skipping anything malformed (validation reports it later). */
function profilesOf(data: Obj): Obj[] {
  return isObj(data.profiles) ? Object.values(data.profiles).filter(isObj) : [];
}

/**
 * Version 2 records when each round started, its play time and which
 * questions needed help. Older rounds get "not recorded" rather than a guess.
 */
function addRoundTiming(data: Obj): void {
  for (const profile of profilesOf(data)) {
    const history = Array.isArray(profile.roundHistory) ? profile.roundHistory.filter(isObj) : [];
    for (const summary of history) {
      summary.startedAt ??= null;
      summary.playMs ??= null;
      summary.retryFacts ??= [];
      summary.missFacts ??= [];
    }
    const round = profile.currentRound;
    if (isObj(round)) {
      // Part of this round was played untimed, so its total would be too low.
      round.playMs ??= null;
      round.lastActiveAt ??= round.startedAt;
    }
  }
}

/**
 * Version 3 adds the progress calendar: a daily goal setting and a log of
 * games per day, rebuilt from the round history (every round so far was math).
 */
function addDailyLog(data: Obj): void {
  for (const profile of profilesOf(data)) {
    if (isObj(profile.settings)) profile.settings.dailyGoal ??= GAME_CONFIG.calendar.defaultDailyGoal;
    if (isObj(profile.dailyLog)) continue;
    const history = Array.isArray(profile.roundHistory) ? profile.roundHistory.filter(isObj) : [];
    const rounds = history
      .filter((s) => typeof s.finishedAt === 'number')
      .map((s) => ({ finishedAt: s.finishedAt as number, playMs: typeof s.playMs === 'number' ? s.playMs : null }));
    profile.dailyLog = logFromHistory(rounds, 'math', GAME_CONFIG.calendar.defaultDailyGoal);
  }
}

/**
 * Version 4 gives every player their own shop. Players from before then
 * keep the shop they knew (Sweet Scoops, with Momo) and count as last
 * playing when they last finished a round.
 */
function addShops(data: Obj): void {
  for (const profile of profilesOf(data)) {
    profile.shop ??= { ...GAME_CONFIG.players.defaultShop };
    const history = Array.isArray(profile.roundHistory) ? profile.roundHistory.filter(isObj) : [];
    const finished = history.map((s) => s.finishedAt).filter((t): t is number => typeof t === 'number');
    profile.lastPlayedAt ??= Math.max(Number(profile.createdAt) || 0, ...finished);
  }
}

/** Version 5 gives every player a grade. Everyone so far practised 3rd grade multiplication and division. */
function addGrades(data: Obj): void {
  for (const profile of profilesOf(data)) {
    if (!isObj(profile.settings)) continue;
    const start = defaultGradeChoice();
    profile.settings.grade ??= start.grade;
    profile.settings.game ??= start.game;
  }
}

/**
 * Version 6 asks a heart for different games, so each day remembers which
 * kinds were played. Days before then didn't record it: their hearts stay,
 * and each of their rounds counts as a game (see gamesPlayed in progressCalendar).
 */
function addGameTypes(data: Obj): void {
  for (const profile of profilesOf(data)) {
    if (!isObj(profile.dailyLog)) continue;
    for (const day of Object.values(profile.dailyLog)) if (isObj(day)) day.types ??= [];
  }
}

/**
 * Version 7 calls the picked game just that: `mathMode` was named for when
 * math was the only subject. Saves from before grades got `game` already.
 */
function renameMathMode(data: Obj): void {
  for (const profile of profilesOf(data)) {
    const settings = profile.settings;
    if (!isObj(settings) || settings.mathMode === undefined) continue;
    settings.game ??= settings.mathMode;
    delete settings.mathMode;
  }
}

export const MIGRATIONS: Readonly<Record<number, (data: Obj) => void>> = {
  1: addRoundTiming,
  2: addDailyLog,
  3: addShops,
  4: addGrades,
  5: addGameTypes,
  6: renameMathMode,
};

/** Runs every step from the save's version up to `target`. Returns false if a step is missing. */
export function migrateToVersion(data: Obj, target: number): boolean {
  while ((data.schemaVersion as number) < target) {
    const step = MIGRATIONS[data.schemaVersion as number];
    if (!step) return false;
    step(data);
    data.schemaVersion = (data.schemaVersion as number) + 1;
  }
  return true;
}

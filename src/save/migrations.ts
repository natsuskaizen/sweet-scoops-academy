/**
 * One step per save format change: `MIGRATIONS[n]` turns a version n save
 * into version n + 1, in place. Steps only fill in what is missing; the
 * result is still validated before anything uses it.
 */
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

export const MIGRATIONS: Readonly<Record<number, (data: Obj) => void>> = {
  1: addRoundTiming,
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

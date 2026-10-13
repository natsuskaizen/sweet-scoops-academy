/**
 * Deterministic adaptive practice engine.
 *
 * Knows nothing about math: it works on "facts" identified by string keys
 * with a difficulty number, grouped into skills (multiplication, division,
 * later vocabulary...). Each skill keeps its own SkillProgress, so skills and
 * children adapt independently.
 *
 *   recordOutcome()  updates one fact after it is answered
 *   planRound()      picks the facts for the next round
 */
import { GAME_CONFIG, type AdaptiveConfig } from '../config/gameConfig';
import type { Rng } from '../core/rng';
import type { AttemptOutcome, FactRecord, LearningState, SkillProgress } from './types';

export type { AdaptiveConfig };

export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveConfig = GAME_CONFIG.adaptive;

export type SlotKind = LearningState | 'new';

export interface CatalogFact {
  key: string;
  difficulty: number;
}

export interface SkillPool {
  skillId: string;
  progress: SkillProgress;
  catalog: readonly CatalogFact[];
}

export interface PlannedItem {
  skillId: string;
  factKey: string;
  /** The slot this item was meant to fill. */
  slot: SlotKind;
  /** The category it actually came from (differs when a pool was empty). */
  source: SlotKind;
}

export interface PlanOptions {
  roundNumber: number;
  rng: Rng;
  count: number;
  config?: AdaptiveConfig;
}

// ---------------------------------------------------------------------------
// Recording outcomes
// ---------------------------------------------------------------------------

export function createFactRecord(key: string, roundNumber: number): FactRecord {
  return {
    key,
    state: 'learning', // new facts always start here
    presentations: 0,
    firstTryCorrect: 0,
    retryCorrect: 0,
    missed: 0,
    recent: [],
    lastPresentedAt: 0,
    lastPresentedRound: 0,
    nextDueRound: roundNumber,
    successStreak: 0,
    introducedRound: roundNumber,
  };
}

export function recordOutcome(
  progress: SkillProgress,
  key: string,
  outcome: AttemptOutcome,
  ctx: { roundNumber: number; now: number },
  config: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG,
): FactRecord {
  const round = ctx.roundNumber;
  const rec = progress.facts[key] ?? createFactRecord(key, round);
  progress.facts[key] = rec;

  // A round is one "session": the streak can grow at most once per round.
  const alreadySeenThisRound = rec.presentations > 0 && rec.lastPresentedRound === round;
  const previous = rec.recent[rec.recent.length - 1];

  rec.presentations += 1;
  rec.lastPresentedAt = ctx.now;
  rec.lastPresentedRound = round;
  rec.recent = [...rec.recent, outcome].slice(-config.recentWindow);

  switch (outcome) {
    case 'first': {
      rec.firstTryCorrect += 1;
      if (!alreadySeenThisRound) rec.successStreak += 1;
      if (rec.state === 'learning') rec.state = 'practicing';
      // A single correct answer can never master a fact: needs N separate rounds.
      if (rec.state === 'practicing' && rec.successStreak >= config.masterySessions) {
        rec.state = 'mastered';
      }
      break;
    }
    case 'retry': {
      // Progress, but weaker evidence than a first-try answer.
      rec.retryCorrect += 1;
      rec.successStreak = Math.max(0, rec.successStreak - 1);
      if (rec.state === 'learning' && (previous === 'first' || previous === 'retry')) {
        rec.state = 'practicing';
      }
      break;
    }
    case 'miss': {
      // Raise priority without wiping history: counts are kept, state drops one level at most.
      rec.missed += 1;
      if (rec.state === 'mastered') {
        rec.state = 'practicing';
        rec.successStreak = Math.max(0, config.masterySessions - 2);
      } else {
        rec.successStreak = 0;
        const recentMisses = rec.recent.slice(-3).filter((o) => o === 'miss').length;
        if (rec.state === 'practicing' && recentMisses >= 2) rec.state = 'learning';
      }
      break;
    }
  }

  rec.nextDueRound = round + nextInterval(rec, outcome, config);
  return rec;
}

function nextInterval(rec: FactRecord, outcome: AttemptOutcome, config: AdaptiveConfig): number {
  if (outcome !== 'first') return 1; // needs practice next round
  switch (rec.state) {
    case 'learning':
      return 1;
    case 'practicing': {
      // A clean first-try fact can wait a round; one that needed help comes back next round.
      const { afterStreak, struggled, clean } = config.practicingInterval;
      if (rec.successStreak >= 2) return afterStreak;
      return rec.recent.some((o) => o !== 'first') ? struggled : clean;
    }
    case 'mastered':
      return Math.min(
        config.masteredMaxInterval,
        config.masteredBaseInterval + (rec.successStreak - config.masterySessions),
      );
  }
}

// ---------------------------------------------------------------------------
// Planning a round
// ---------------------------------------------------------------------------

const FALLBACKS: Record<SlotKind, SlotKind[]> = {
  // An empty learning pile means the child is keeping up: introduce something new
  // rather than repeating facts that are not due yet.
  learning: ['learning', 'new', 'practicing', 'mastered'],
  practicing: ['practicing', 'learning', 'new', 'mastered'],
  mastered: ['mastered', 'practicing', 'learning', 'new'],
  new: ['new', 'learning', 'practicing', 'mastered'],
};

/** Order slots are filled in, so the most important slots get first pick. */
const FILL_ORDER: SlotKind[] = ['learning', 'practicing', 'mastered', 'new'];

/** Scale the composition to `count` slots (largest remainder goes to learning). */
export function slotsFor(count: number, composition: Record<SlotKind, number>): SlotKind[] {
  const total = FILL_ORDER.reduce((sum, k) => sum + composition[k], 0);
  const slots: SlotKind[] = [];
  for (const kind of FILL_ORDER) {
    const n = Math.floor((composition[kind] * count) / total);
    for (let i = 0; i < n; i++) slots.push(kind);
  }
  while (slots.length < count) slots.unshift('learning');
  return slots;
}

/** Spread slots evenly across skills, e.g. 5 multiplication + 5 division. */
function assignSkills(count: number, skills: string[], rng: Rng): string[] {
  const seq: string[] = [];
  for (let i = 0; i < count; i++) seq.push(skills[i % skills.length] as string);
  return rng.shuffle(seq);
}

interface PickState {
  round: number;
  rng: Rng;
  config: AdaptiveConfig;
  used: Set<string>;
  newCount: number;
}

function needScore(rec: FactRecord, round: number): number {
  const last3 = rec.recent.slice(-3);
  const misses = last3.filter((o) => o === 'miss').length;
  const retries = last3.filter((o) => o === 'retry').length;
  return round - rec.nextDueRound + misses * 2 + retries;
}

/** Recent first-try accuracy and the hardest fact known first-try, for one skill. */
export function skillPace(pool: SkillPool, round: number, config: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG) {
  const difficulty = new Map(pool.catalog.map((f) => [f.key, f.difficulty]));
  let samples = 0;
  let firstTry = 0;
  let frontier = -Infinity;
  for (const rec of Object.values(pool.progress.facts)) {
    const last = rec.recent[rec.recent.length - 1];
    if (last === 'first') frontier = Math.max(frontier, difficulty.get(rec.key) ?? -Infinity);
    if (rec.lastPresentedRound >= round - config.stretch.lookbackRounds && last) {
      samples += 1;
      if (last === 'first') firstTry += 1;
    }
  }
  const accuracy = samples > 0 ? firstTry / samples : 0;
  const fluent = samples >= config.stretch.minSamples && accuracy >= config.stretch.accuracy;
  return { samples, accuracy, frontier, fluent };
}

function pickFromCategory(pool: SkillPool, category: SlotKind, st: PickState, strict: boolean): string | null {
  return category === 'new' ? pickNewFact(pool, st, strict) : pickKnownFact(pool, category, st, strict);
}

/** In strict mode, holds back new facts while too many are new or still being learned. */
function newFactsAllowed(pool: SkillPool, st: PickState): boolean {
  if (st.newCount >= st.config.maxNewPerRound) return false;
  const learningCount = Object.values(pool.progress.facts).filter((r) => r.state === 'learning').length;
  return learningCount < st.config.maxLearningBeforeNew;
}

function pickNewFact(pool: SkillPool, st: PickState, strict: boolean): string | null {
  const { round, rng, config, used } = st;
  if (strict && !newFactsAllowed(pool, st)) return null;
  const unseen = pool.catalog
    .filter((f) => !pool.progress.facts[f.key] && !used.has(f.key))
    .sort((a, b) => a.difficulty - b.difficulty || (a.key < b.key ? -1 : 1));
  if (unseen.length === 0) return null;
  // Fluent learners skip ahead past facts that are clearly below their level.
  const pace = skillPace(pool, round, config);
  const target = pace.fluent ? pace.frontier + config.stretch.step : -Infinity;
  const stretched = unseen.filter((f) => f.difficulty >= target);
  const window = stretched.length > 0 ? stretched : unseen.slice(-config.newFactChoices);
  st.newCount += 1;
  return rng.pick(window.slice(0, config.newFactChoices)).key;
}

function pickKnownFact(pool: SkillPool, state: LearningState, st: PickState, strict: boolean): string | null {
  const { round, rng, used } = st;
  let candidates = Object.values(pool.progress.facts).filter((r) => r.state === state && !used.has(r.key));
  // Practicing and mastered facts wait until they are due.
  if (strict && state !== 'learning') candidates = candidates.filter((r) => r.nextDueRound <= round);
  if (candidates.length === 0) return null;

  // Highest need first; small seeded jitter breaks ties reproducibly.
  const scored = candidates
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((r) => ({ r, score: needScore(r, round) + rng.next() * 0.5 }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.r.key;
}

/**
 * Fills one slot: strict pass (due dates and new-fact caps) then relaxed pass,
 * trying each fallback category, primary skill first.
 */
function pickForSlot(slot: SlotKind, primary: SkillPool, pools: SkillPool[], st: PickState): PlannedItem | null {
  const order = [primary, ...pools.filter((p) => p !== primary)];
  for (const strict of [true, false]) {
    for (const category of FALLBACKS[slot]) {
      for (const pool of order) {
        const key = pickFromCategory(pool, category, st, strict);
        if (key) return { skillId: pool.skillId, factKey: key, slot, source: category };
      }
    }
  }
  return null;
}

export function planRound(pools: SkillPool[], opts: PlanOptions): PlannedItem[] {
  if (pools.length === 0) throw new Error('planRound needs at least one skill');
  const config = opts.config ?? DEFAULT_ADAPTIVE_CONFIG;
  const { rng, roundNumber, count } = opts;

  const slots = slotsFor(count, config.composition);
  const skillSeq = assignSkills(count, pools.map((p) => p.skillId), rng);
  const poolById = new Map(pools.map((p) => [p.skillId, p]));
  const st: PickState = { round: roundNumber, rng, config, used: new Set(), newCount: 0 };

  const items = slots.map((slot, i) => {
    const primary = poolById.get(skillSeq[i]!)!;
    // Catalog exhausted (tiny catalogs only): allow a repeat rather than fail.
    const picked = pickForSlot(slot, primary, pools, st)
      ?? { skillId: primary.skillId, factKey: rng.pick(primary.catalog).key, slot, source: 'learning' as const };
    st.used.add(picked.factKey);
    return picked;
  });

  return rng.shuffle(items);
}

// ---------------------------------------------------------------------------
// Reporting (parent area)
// ---------------------------------------------------------------------------

export interface SkillSummary {
  total: number;
  unseen: number;
  learning: number;
  practicing: number;
  mastered: number;
}

export function summarizeSkill(pool: SkillPool): SkillSummary {
  const summary: SkillSummary = { total: pool.catalog.length, unseen: 0, learning: 0, practicing: 0, mastered: 0 };
  for (const fact of pool.catalog) {
    const rec = pool.progress.facts[fact.key];
    if (!rec) summary.unseen += 1;
    else summary[rec.state] += 1;
  }
  return summary;
}

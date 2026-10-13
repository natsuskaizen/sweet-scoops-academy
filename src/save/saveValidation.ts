/**
 * Hand-rolled structural validation for save files (no runtime dependency).
 * Returns a list of problems; an empty list means the data is safe to use.
 */
import { GAME_CONFIG } from '../config/gameConfig';
import { mathSubject } from '../learning/mathSubject';
import type { SaveFile } from './saveTypes';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonNegInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const isNonNegIntOrNull = (v: unknown): boolean => v === null || isNonNegInt(v);

const STATES = new Set(['learning', 'practicing', 'mastered']);
const OUTCOMES = new Set(['first', 'retry', 'miss']);

function checkSkill(v: unknown, path: string, out: string[]): void {
  if (!isObj(v) || !isObj(v.facts)) {
    out.push(`${path}.facts missing`);
    return;
  }
  for (const [key, rec] of Object.entries(v.facts)) {
    const p = `${path}.facts[${key}]`;
    if (!isObj(rec)) {
      out.push(`${p} not an object`);
      continue;
    }
    if (rec.key !== key) out.push(`${p}.key mismatch`);
    if (!STATES.has(rec.state as string)) out.push(`${p}.state invalid`);
    for (const f of [
      'presentations',
      'firstTryCorrect',
      'retryCorrect',
      'missed',
      'lastPresentedRound',
      'nextDueRound',
      'successStreak',
      'introducedRound',
    ]) {
      if (!isNonNegInt(rec[f])) out.push(`${p}.${f} invalid`);
    }
    if (!isNum(rec.lastPresentedAt)) out.push(`${p}.lastPresentedAt invalid`);
    if (!Array.isArray(rec.recent) || !rec.recent.every((o) => OUTCOMES.has(o as string))) {
      out.push(`${p}.recent invalid`);
    }
  }
}

function checkRound(v: unknown, path: string, out: string[]): void {
  if (v === null) return;
  if (!isObj(v)) {
    out.push(`${path} not an object`);
    return;
  }
  if (!isStr(v.id)) out.push(`${path}.id invalid`);
  for (const f of ['roundNumber', 'seed', 'startedAt', 'currentIndex', 'lastActiveAt']) {
    if (!isNonNegInt(v[f])) out.push(`${path}.${f} invalid`);
  }
  if (!isNonNegIntOrNull(v.playMs)) out.push(`${path}.playMs invalid`);
  if (typeof v.bonusPaid !== 'boolean') out.push(`${path}.bonusPaid invalid`);
  if (!Array.isArray(v.orders) || v.orders.length === 0) {
    out.push(`${path}.orders invalid`);
    return;
  }
  if (isNonNegInt(v.currentIndex) && v.currentIndex >= v.orders.length) out.push(`${path}.currentIndex out of range`);
  v.orders.forEach((o, i) => {
    const p = `${path}.orders[${i}]`;
    if (!isObj(o)) {
      out.push(`${p} not an object`);
      return;
    }
    if (!mathSubject.isValidSpec(o.spec)) out.push(`${p}.spec invalid`);
    if (!isStr(o.customerId)) out.push(`${p}.customerId invalid`);
    if (!isNonNegInt(o.attempts) || o.attempts > GAME_CONFIG.round.attemptsPerOrder) out.push(`${p}.attempts invalid`);
    if (o.outcome !== null && !OUTCOMES.has(o.outcome as string)) out.push(`${p}.outcome invalid`);
    if (typeof o.paid !== 'boolean') out.push(`${p}.paid invalid`);
    if (!isNonNegInt(o.sprinklesPaid)) out.push(`${p}.sprinklesPaid invalid`);
    if (o.paid === true && o.outcome === null) out.push(`${p} paid but unresolved`);
  });
}

/** Per-field shape checks for one finished round in the history. */
const SUMMARY_FIELDS: Record<string, (v: unknown) => boolean> = {
  roundNumber: isNonNegInt,
  startedAt: isNonNegIntOrNull,
  finishedAt: isNonNegInt,
  playMs: isNonNegIntOrNull,
  ordersCompleted: isNonNegInt,
  firstTryCorrect: isNonNegInt,
  retryCorrect: isNonNegInt,
  missed: isNonNegInt,
  total: isNonNegInt,
  retryFacts: isStrArray,
  missFacts: isStrArray,
};

function checkHistory(history: unknown, path: string, out: string[]): void {
  if (!Array.isArray(history)) {
    out.push(`${path} invalid`);
    return;
  }
  history.forEach((s, i) => {
    if (isObj(s)) checkFields(s, `${path}[${i}]`, out, SUMMARY_FIELDS);
    else out.push(`${path}[${i}] not an object`);
  });
}

/** Simple per-field shape checks for a profile. */
const PROFILE_FIELDS: Record<string, (v: unknown) => boolean> = {
  createdAt: isNonNegInt,
  sprinkles: isNonNegInt,
  lifetimeSprinkles: isNonNegInt,
  ownedItems: isStrArray,
  achievements: isStrArray,
  equipped: isObj,
  decorations: Array.isArray,
};

function checkFields(v: Obj, path: string, out: string[], fields: Record<string, (v: unknown) => boolean>): void {
  for (const [field, ok] of Object.entries(fields)) if (!ok(v[field])) out.push(`${path}.${field} invalid`);
}

function checkProfile(v: unknown, id: string, out: string[]): void {
  const path = `profiles[${id}]`;
  if (!isObj(v)) {
    out.push(`${path} not an object`);
    return;
  }
  if (v.id !== id) out.push(`${path}.id mismatch`);
  if (!isStr(v.displayName) || v.displayName.length === 0) out.push(`${path}.displayName invalid`);
  checkFields(v, path, out, PROFILE_FIELDS);
  if (!isObj(v.settings) || typeof v.settings.showHints !== 'boolean' || typeof v.settings.reduceMotion !== 'boolean') {
    out.push(`${path}.settings invalid`);
  }
  checkHistory(v.roundHistory, `${path}.roundHistory`, out);
  checkLearning(v.learning, `${path}.learning`, out);
  checkRound(v.currentRound, `${path}.currentRound`, out);
}

function checkLearning(learning: unknown, path: string, out: string[]): void {
  if (!isObj(learning)) {
    out.push(`${path} missing`);
    return;
  }
  if (!isNonNegInt(learning.seed)) out.push(`${path}.seed invalid`);
  if (!isNonNegInt(learning.roundsStarted)) out.push(`${path}.roundsStarted invalid`);
  if (!isObj(learning.math)) {
    out.push(`${path}.math missing`);
    return;
  }
  // One record per operation; operations switched on later simply have none yet.
  for (const [skillId, skill] of Object.entries(learning.math)) checkSkill(skill, `${path}.math.${skillId}`, out);
}

/**
 * A saved round the game can no longer play (its questions fall outside
 * today's rules, or it is damaged) is dropped so the rest of the save still
 * loads: losing an unfinished round is better than losing the child's
 * Sprinkles and progress. Returns how many rounds were dropped.
 */
export function dropUnplayableRounds(data: unknown): number {
  if (!isObj(data) || !isObj(data.profiles)) return 0;
  let dropped = 0;
  for (const profile of Object.values(data.profiles)) {
    if (!isObj(profile) || profile.currentRound === null || profile.currentRound === undefined) continue;
    const problems: string[] = [];
    checkRound(profile.currentRound, 'currentRound', problems);
    if (problems.length === 0) continue;
    profile.currentRound = null;
    dropped++;
  }
  return dropped;
}

export function validateSaveFile(data: unknown): string[] {
  const out: string[] = [];
  if (!isObj(data)) return ['save is not an object'];
  if (!isNonNegInt(data.schemaVersion)) out.push('schemaVersion missing');
  if (!isNum(data.savedAt)) out.push('savedAt invalid');
  if (!isStr(data.activeProfileId)) out.push('activeProfileId invalid');
  if (!isObj(data.profiles)) return [...out, 'profiles missing'];
  for (const [id, profile] of Object.entries(data.profiles)) checkProfile(profile, id, out);
  if (isStr(data.activeProfileId) && !(data.activeProfileId in data.profiles)) {
    out.push('activeProfileId does not match a profile');
  }
  return out;
}

export function isSaveFile(data: unknown): data is SaveFile {
  return validateSaveFile(data).length === 0;
}

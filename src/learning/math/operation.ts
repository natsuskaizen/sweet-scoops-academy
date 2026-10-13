/**
 * The contract every math operation implements. An operation owns its fact
 * table, its validation rules, how its orders are worded and how its hints are
 * drawn; nothing outside its own file needs to know it exists, apart from the
 * registry that lists it.
 *
 * Adding an operation:
 *   1. write `myOperation.ts` exporting a `create...(rules)` that returns a MathOperation
 *   2. add it to `createOperations()` in registry.ts
 *   3. add its rules to `MathConfig` and turn it on in `math.enabledOperations`
 */
import type { Rng } from '../../core/rng';
import type { ChallengeSpec, VisualAid } from '../types';

export interface MathChallengeSpec extends ChallengeSpec {
  subjectId: 'math';
  /** The operation id, e.g. "multiplication". */
  skillId: string;
  /** Left operand as shown (factor, dividend, addend, minuend). */
  left: number;
  /** Right operand as shown (factor, divisor, addend, subtrahend). */
  right: number;
  /** Always computed, never typed by hand. */
  answer: number;
}

export interface MathFact {
  key: string;
  operation: string;
  left: number;
  right: number;
  answer: number;
  /** Lower is easier. Used to introduce accessible facts first. */
  difficulty: number;
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export interface OrderWording {
  orderLine: string;
  hint: VisualAid;
  explanation: VisualAid;
}

export interface MathOperation {
  /** Skill id, also the key of this operation's progress in the save. */
  readonly id: string;
  /** Shown to grown-ups, e.g. "Multiplication". */
  readonly label: string;
  /** Shown in expressions, e.g. "×". */
  readonly symbol: string;
  readonly maxDigits: number;
  /** Every fact this operation can ask, easiest first is not required. */
  facts(): readonly MathFact[];
  /** Checks operands as shown (and the answer, when given) against the rules. */
  validate(left: unknown, right: unknown, answer?: unknown): ValidationResult;
  /** The answer for operands as shown. */
  compute(left: number, right: number): number;
  /** Fact key for operands as shown (commutative operations share one key). */
  keyFor(left: number, right: number): string;
  /** Picks how a fact is shown, e.g. 5 × 6 or 6 × 5. Must not change the key. */
  orient(fact: MathFact, rng: Rng): [left: number, right: number];
  /** Customer line, hint and explanation for one question. */
  word(spec: MathChallengeSpec, flavor: string): OrderWording;
  /** Short form of a fact key for the grown-ups screen, e.g. "5×6". */
  formatKey(key: string): string;
}

// ---------------------------------------------------------------------------
// Small helpers shared by the operation files
// ---------------------------------------------------------------------------

export const OK: ValidationResult = { ok: true };
export const fail = (reason: string): ValidationResult => ({ ok: false, reason });
export const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function inRange(name: string, n: number, range: { min: number; max: number }): ValidationResult {
  return n >= range.min && n <= range.max ? OK : fail(`${name} ${n} outside ${range.min}-${range.max}`);
}

/** First failing check, or OK. Checks run lazily in order. */
export function firstFailure(...checks: (() => ValidationResult)[]): ValidationResult {
  for (const check of checks) {
    const result = check();
    if (!result.ok) return result;
  }
  return OK;
}

export function checkAnswer(expected: number, answer: unknown): ValidationResult {
  return answer === undefined || answer === expected ? OK : fail(`answer ${String(answer)} is not ${expected}`);
}

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Picks one of several phrasings, stable for the same numbers. */
export const variantOf = <T>(options: readonly T[], spec: { left: number; right: number }): T =>
  options[(spec.left + spec.right) % options.length]!;

/** Every (a, b) pair in two ranges, for building fact tables. */
export function* pairs(a: { min: number; max: number }, b: { min: number; max: number }): Generator<[number, number]> {
  for (let x = a.min; x <= a.max; x++) for (let y = b.min; y <= b.max; y++) yield [x, y];
}

/** Lazily builds and caches a fact table. */
export function cached(build: () => MathFact[]): () => readonly MathFact[] {
  let facts: MathFact[] | null = null;
  return () => (facts ??= build());
}

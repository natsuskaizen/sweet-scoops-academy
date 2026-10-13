/**
 * The single source of truth for what counts as a valid math question.
 * Every generated question passes through here before it can be displayed,
 * and saved questions are re-validated when a round is resumed.
 */
import type { ChallengeSpec } from './types';

export type MathOperation = 'multiplication' | 'division';

export interface MathChallengeSpec extends ChallengeSpec {
  subjectId: 'math';
  skillId: MathOperation;
  /** multiplication: first factor; division: dividend */
  left: number;
  /** multiplication: second factor; division: divisor */
  right: number;
  /** product or quotient, always computed, never typed by hand */
  answer: number;
}

/** Hard limits from the spec (section 5). */
export const MATH_RULES = {
  multiplication: { minFactor: 1, maxFactor: 11 },
  division: { minDividend: 10, maxDividend: 99, minQuotient: 1, maxQuotient: 10 },
} as const;

export type ValidationResult = { ok: true } | { ok: false; reason: string };

const ok: ValidationResult = { ok: true };
const fail = (reason: string): ValidationResult => ({ ok: false, reason });
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function validateMultiplication(a: unknown, b: unknown, answer?: unknown): ValidationResult {
  const { minFactor, maxFactor } = MATH_RULES.multiplication;
  if (!isInt(a) || !isInt(b)) return fail('factors must be integers');
  if (a < minFactor || a > maxFactor) return fail(`factor ${a} outside ${minFactor}-${maxFactor}`);
  if (b < minFactor || b > maxFactor) return fail(`factor ${b} outside ${minFactor}-${maxFactor}`);
  if (answer !== undefined && answer !== a * b) return fail(`answer ${String(answer)} is not ${a * b}`);
  return ok;
}

export function validateDivision(dividend: unknown, divisor: unknown, answer?: unknown): ValidationResult {
  const { minDividend, maxDividend, minQuotient, maxQuotient } = MATH_RULES.division;
  if (!isInt(dividend) || !isInt(divisor)) return fail('dividend and divisor must be integers');
  if (divisor <= 0) return fail('divisor must be positive');
  if (dividend < minDividend || dividend > maxDividend) {
    return fail(`dividend ${dividend} outside ${minDividend}-${maxDividend}`);
  }
  if (dividend % divisor !== 0) return fail(`${dividend} ÷ ${divisor} has a remainder`);
  const quotient = dividend / divisor;
  if (quotient < minQuotient || quotient > maxQuotient) {
    return fail(`quotient ${quotient} outside ${minQuotient}-${maxQuotient}`);
  }
  if (answer !== undefined && answer !== quotient) return fail(`answer ${String(answer)} is not ${quotient}`);
  return ok;
}

/** Validates a full spec, including that its factKey matches its numbers. */
export function validateMathSpec(spec: unknown): ValidationResult {
  if (typeof spec !== 'object' || spec === null) return fail('spec must be an object');
  const s = spec as Partial<MathChallengeSpec>;
  if (s.subjectId !== 'math') return fail('not a math spec');
  if (s.skillId === 'multiplication') {
    const result = validateMultiplication(s.left, s.right, s.answer);
    if (!result.ok) return result;
    if (s.factKey !== multiplicationKey(s.left!, s.right!)) return fail('factKey mismatch');
    return ok;
  }
  if (s.skillId === 'division') {
    const result = validateDivision(s.left, s.right, s.answer);
    if (!result.ok) return result;
    if (s.factKey !== divisionKey(s.left!, s.right!)) return fail('factKey mismatch');
    return ok;
  }
  return fail('unknown operation');
}

/** 5 × 6 and 6 × 5 share one mastery record. */
export function multiplicationKey(a: number, b: number): string {
  return `mul:${Math.min(a, b)}x${Math.max(a, b)}`;
}

export function divisionKey(dividend: number, divisor: number): string {
  return `div:${dividend}/${divisor}`;
}

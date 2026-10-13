/**
 * Enumerates the math fact space and turns a chosen fact into a concrete,
 * validated question. The adaptive engine decides *which* fact to practice;
 * this module decides *how* it is shown (e.g. 5 × 6 vs 6 × 5).
 */
import type { Rng } from '../core/rng';
import {
  MATH_RULES,
  divisionKey,
  multiplicationKey,
  validateMathSpec,
  type MathChallengeSpec,
  type MathOperation,
} from './mathValidator';

export interface MathFact {
  key: string;
  operation: MathOperation;
  /** multiplication: smaller factor; division: dividend */
  left: number;
  /** multiplication: larger factor; division: divisor */
  right: number;
  answer: number;
  /** Lower is easier. Used to introduce accessible facts first. */
  difficulty: number;
}

/**
 * Which divisors the *generator* offers. The validator only requires a
 * positive divisor, but third-grade practice sticks to "times table"
 * divisors, so 57 ÷ 57 never shows up.
 */
export const DIVISION_DIVISOR_RANGE = { min: 1, max: 12 } as const;

export class QuestionGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionGenerationError';
  }
}

/**
 * Rough difficulty per factor for young learners: ×1, ×2, ×10 are easiest,
 * then ×5 and ×11, then ×3 ×4, then ×9, then ×6 ×7 ×8 ×12.
 */
const FACTOR_TIER: Record<number, number> = {
  1: 0, 2: 1, 10: 1, 5: 2, 11: 2, 3: 3, 4: 3, 9: 4, 6: 5, 7: 5, 8: 5, 12: 5,
};
const tier = (n: number): number => FACTOR_TIER[n] ?? 6;

function multiplicationDifficulty(a: number, b: number): number {
  // The easier factor dominates: 2 × 8 is easier than 6 × 7.
  // Three-digit products (10 × 10, 11 × 11...) wait until later.
  return Math.min(tier(a), tier(b)) * 2 + Math.max(tier(a), tier(b)) + (a * b >= 100 ? 4 : 0);
}

let cachedMul: MathFact[] | null = null;
let cachedDiv: MathFact[] | null = null;

export function multiplicationFacts(): readonly MathFact[] {
  if (cachedMul) return cachedMul;
  const { minFactor, maxFactor } = MATH_RULES.multiplication;
  const facts: MathFact[] = [];
  for (let a = minFactor; a <= maxFactor; a++) {
    for (let b = a; b <= maxFactor; b++) {
      facts.push({
        key: multiplicationKey(a, b),
        operation: 'multiplication',
        left: a,
        right: b,
        answer: a * b,
        difficulty: multiplicationDifficulty(a, b),
      });
    }
  }
  return (cachedMul = facts);
}

export function divisionFacts(): readonly MathFact[] {
  if (cachedDiv) return cachedDiv;
  const { minDividend, maxDividend, minQuotient, maxQuotient } = MATH_RULES.division;
  const facts: MathFact[] = [];
  for (let divisor = DIVISION_DIVISOR_RANGE.min; divisor <= DIVISION_DIVISOR_RANGE.max; divisor++) {
    for (let quotient = minQuotient; quotient <= maxQuotient; quotient++) {
      const dividend = divisor * quotient;
      if (dividend < minDividend || dividend > maxDividend) continue;
      facts.push({
        key: divisionKey(dividend, divisor),
        operation: 'division',
        left: dividend,
        right: divisor,
        answer: quotient,
        // Division feels one step harder than the matching times fact.
        difficulty: multiplicationDifficulty(divisor, quotient) + 1,
      });
    }
  }
  return (cachedDiv = facts);
}

export function factsFor(operation: MathOperation): readonly MathFact[] {
  return operation === 'multiplication' ? multiplicationFacts() : divisionFacts();
}

const factIndex = new Map<string, MathFact>();
export function factByKey(key: string): MathFact | undefined {
  if (factIndex.size === 0) {
    for (const f of [...multiplicationFacts(), ...divisionFacts()]) factIndex.set(f.key, f);
  }
  return factIndex.get(key);
}

/**
 * Builds a displayable question for a fact. Multiplication facts are shown in
 * a random orientation so 5 × 6 and 6 × 5 both get practiced.
 * Throws QuestionGenerationError rather than ever returning an invalid question.
 */
export function buildQuestion(factKey: string, rng: Rng): MathChallengeSpec {
  const fact = factByKey(factKey);
  if (!fact) throw new QuestionGenerationError(`Unknown fact "${factKey}"`);

  const swap = fact.operation === 'multiplication' && fact.left !== fact.right && rng.next() < 0.5;
  const left = swap ? fact.right : fact.left;
  const right = swap ? fact.left : fact.right;
  // Recompute rather than trusting the table.
  const answer = fact.operation === 'multiplication' ? left * right : left / right;

  const spec: MathChallengeSpec = {
    subjectId: 'math',
    skillId: fact.operation,
    factKey: fact.key,
    left,
    right,
    answer,
  };
  const result = validateMathSpec(spec);
  if (!result.ok) throw new QuestionGenerationError(`Invalid question ${factKey}: ${result.reason}`);
  return spec;
}

/**
 * Asks `chooseFact` for a fact until one produces a valid question, up to
 * `maxAttempts`. Reports a controlled error instead of showing a bad problem.
 */
export function generateQuestion(
  chooseFact: () => string,
  rng: Rng,
  maxAttempts = 20,
): MathChallengeSpec {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return buildQuestion(chooseFact(), rng);
    } catch (err) {
      lastError = err;
    }
  }
  throw new QuestionGenerationError(
    `Could not generate a valid question after ${maxAttempts} attempts: ${String(lastError)}`,
  );
}

/** Uniformly random valid question for an operation (used by tests and fallbacks). */
export function randomQuestion(operation: MathOperation, rng: Rng): MathChallengeSpec {
  return generateQuestion(() => rng.pick(factsFor(operation)).key, rng);
}

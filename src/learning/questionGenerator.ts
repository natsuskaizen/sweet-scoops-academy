/**
 * Turns a chosen fact into a concrete, validated question. The adaptive
 * engine decides *which* fact to practice; the fact's operation decides *how*
 * it is shown (e.g. 5 × 6 vs 6 × 5).
 */
import type { Rng } from '../core/rng';
import type { MathChallengeSpec, MathFact } from './math/operation';
import { OPERATIONS, type OperationRegistry } from './math/registry';
import { validateMathSpec } from './mathValidator';

export type { MathFact } from './math/operation';

export class QuestionGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionGenerationError';
  }
}

/** Every fact for one operation id, e.g. "multiplication". */
export function factsFor(operationId: string, operations: OperationRegistry = OPERATIONS): readonly MathFact[] {
  const op = operations.get(operationId);
  if (!op) throw new QuestionGenerationError(`Unknown operation "${operationId}"`);
  return op.facts();
}

export const multiplicationFacts = (): readonly MathFact[] => factsFor('multiplication');
export const divisionFacts = (): readonly MathFact[] => factsFor('division');

const factIndexes = new WeakMap<OperationRegistry, Map<string, MathFact>>();

export function factByKey(key: string, operations: OperationRegistry = OPERATIONS): MathFact | undefined {
  let index = factIndexes.get(operations);
  if (!index) {
    index = new Map(operations.all.flatMap((op) => op.facts().map((f) => [f.key, f] as const)));
    factIndexes.set(operations, index);
  }
  return index.get(key);
}

/**
 * Builds a displayable question for a fact.
 * Throws QuestionGenerationError rather than ever returning an invalid question.
 */
export function buildQuestion(factKey: string, rng: Rng, operations: OperationRegistry = OPERATIONS): MathChallengeSpec {
  const fact = factByKey(factKey, operations);
  const op = fact && operations.get(fact.operation);
  if (!fact || !op) throw new QuestionGenerationError(`Unknown fact "${factKey}"`);

  const [left, right] = op.orient(fact, rng);
  // Recompute rather than trusting the table.
  const spec: MathChallengeSpec = {
    subjectId: 'math', skillId: op.id, factKey: fact.key, left, right, answer: op.compute(left, right),
  };
  const result = validateMathSpec(spec, operations);
  if (!result.ok) throw new QuestionGenerationError(`Invalid question ${factKey}: ${result.reason}`);
  return spec;
}

/**
 * Asks `chooseFact` for a fact until one produces a valid question, up to
 * `maxAttempts`. Reports a controlled error instead of showing a bad problem.
 */
export function generateQuestion(chooseFact: () => string, rng: Rng, maxAttempts = 20): MathChallengeSpec {
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
export function randomQuestion(operationId: string, rng: Rng): MathChallengeSpec {
  return generateQuestion(() => rng.pick(factsFor(operationId)).key, rng);
}

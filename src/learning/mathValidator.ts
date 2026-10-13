/**
 * The single entry point for checking a math question. Every generated
 * question passes through here before it can be displayed, and saved
 * questions are re-validated when a round is resumed. The rules themselves
 * live with each operation (src/learning/math/) and read their limits from
 * GAME_CONFIG.math.
 */
import { divisionKey } from './math/division';
import { multiplicationKey } from './math/multiplication';
import { fail, type MathChallengeSpec, type ValidationResult } from './math/operation';
import { OPERATIONS, type OperationRegistry } from './math/registry';

export type { MathChallengeSpec, ValidationResult } from './math/operation';
export { divisionKey, multiplicationKey };

export function validateMultiplication(a: unknown, b: unknown, answer?: unknown): ValidationResult {
  return OPERATIONS.get('multiplication')!.validate(a, b, answer);
}

export function validateDivision(dividend: unknown, divisor: unknown, answer?: unknown): ValidationResult {
  return OPERATIONS.get('division')!.validate(dividend, divisor, answer);
}

/** Validates a full spec, including that its factKey matches its numbers. */
export function validateMathSpec(spec: unknown, operations: OperationRegistry = OPERATIONS): ValidationResult {
  if (typeof spec !== 'object' || spec === null) return fail('spec must be an object');
  const s = spec as Partial<MathChallengeSpec>;
  if (s.subjectId !== 'math') return fail('not a math spec');
  const op = typeof s.skillId === 'string' ? operations.get(s.skillId) : undefined;
  if (!op) return fail('unknown operation');
  const result = op.validate(s.left, s.right, s.answer);
  if (!result.ok) return result;
  return s.factKey === op.keyFor(s.left!, s.right!) ? result : fail('factKey mismatch');
}

import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { validateMathSpec } from '../learning/mathValidator';
import {
  QuestionGenerationError,
  buildQuestion,
  divisionFacts,
  generateQuestion,
  multiplicationFacts,
  randomQuestion,
} from '../learning/questionGenerator';

describe('fact space', () => {
  it('has every commutative multiplication pair from 1 to 11 exactly once', () => {
    const facts = multiplicationFacts();
    expect(facts).toHaveLength(66); // 11 * 12 / 2
    expect(new Set(facts.map((f) => f.key)).size).toBe(66);
    for (const f of facts) {
      expect(f.left).toBeGreaterThanOrEqual(1);
      expect(f.right).toBeLessThanOrEqual(11);
      expect(f.answer).toBe(f.left * f.right);
    }
  });

  it('only contains division facts that satisfy every rule', () => {
    const facts = divisionFacts();
    expect(facts.length).toBeGreaterThan(50);
    for (const f of facts) {
      expect(f.left).toBeGreaterThanOrEqual(10);
      expect(f.left).toBeLessThanOrEqual(99);
      expect(f.left % f.right).toBe(0);
      expect(f.answer).toBe(f.left / f.right);
      expect(f.answer).toBeGreaterThanOrEqual(1);
      expect(f.answer).toBeLessThanOrEqual(10);
    }
    expect(facts.some((f) => f.key === 'div:99/9')).toBe(false);
  });
});

describe('question generation', () => {
  it('generates only valid questions across many seeds', () => {
    for (let seed = 0; seed < 300; seed++) {
      const rng = createRng(seed);
      for (const op of ['multiplication', 'division'] as const) {
        const q = randomQuestion(op, rng);
        expect(validateMathSpec(q)).toEqual({ ok: true });
        if (op === 'multiplication') {
          expect(q.left).toBeGreaterThanOrEqual(1);
          expect(q.left).toBeLessThanOrEqual(11);
          expect(q.right).toBeGreaterThanOrEqual(1);
          expect(q.right).toBeLessThanOrEqual(11);
        } else {
          expect(q.left).toBeGreaterThanOrEqual(10);
          expect(q.left).toBeLessThanOrEqual(99);
          expect(q.left % q.right).toBe(0);
          expect(q.answer).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it('shows both orientations of a commutative fact under one key', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const q = buildQuestion('mul:5x6', createRng(seed));
      expect(q.factKey).toBe('mul:5x6');
      seen.add(`${q.left}x${q.right}`);
    }
    expect(seen).toEqual(new Set(['5x6', '6x5']));
  });

  it('throws a controlled error for unknown or invalid facts', () => {
    expect(() => buildQuestion('mul:5x12', createRng(1))).toThrow(QuestionGenerationError);
    expect(() => buildQuestion('div:99/9', createRng(1))).toThrow(QuestionGenerationError);
  });

  it('retries until a valid fact is produced, then gives up cleanly', () => {
    const rng = createRng(3);
    const keys = ['mul:0x0', 'div:100/10', 'mul:3x4'];
    let i = 0;
    expect(generateQuestion(() => keys[i++]!, rng).factKey).toBe('mul:3x4');
    expect(() => generateQuestion(() => 'nope', rng, 5)).toThrow(/after 5 attempts/);
  });
});

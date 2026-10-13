import { describe, expect, it } from 'vitest';
import {
  validateDivision,
  validateMathSpec,
  validateMultiplication,
} from '../learning/mathValidator';

describe('validateMultiplication', () => {
  it.each([
    [1, 1],
    [11, 11],
    [5, 6],
    [11, 5],
    [3, 9],
  ])('accepts %i × %i', (a, b) => {
    expect(validateMultiplication(a, b, a * b).ok).toBe(true);
  });

  it.each([
    [0, 5],
    [12, 5],
    [5, 12],
    [23, 12],
    [-1, 3],
    [2.5, 4],
    [Number.NaN, 2],
  ])('rejects %s × %s', (a, b) => {
    expect(validateMultiplication(a, b).ok).toBe(false);
  });

  it('rejects a wrong answer', () => {
    expect(validateMultiplication(5, 6, 31).ok).toBe(false);
  });
});

describe('validateDivision', () => {
  it.each([
    [10, 2, 5],
    [15, 5, 3],
    [30, 5, 6],
    [10, 1, 10], // smallest dividend, largest quotient
    [99, 11, 9], // largest dividend
    [90, 9, 10],
    [12, 12, 1], // smallest quotient
  ])('accepts %i ÷ %i = %i', (dividend, divisor, quotient) => {
    expect(validateDivision(dividend, divisor, quotient).ok).toBe(true);
  });

  it.each([
    [99, 9, 'quotient exceeds 10'],
    [9, 3, 'dividend below 10'],
    [100, 10, 'three-digit dividend'],
    [25, 4, 'remainder'],
    [20, 0, 'zero divisor'],
    [20, -2, 'negative divisor'],
    [98, 2, 'quotient 49'],
    [10.5, 2, 'non-integer dividend'],
  ])('rejects %s ÷ %s (%s)', (dividend, divisor) => {
    expect(validateDivision(dividend, divisor).ok).toBe(false);
  });

  it('rejects a wrong answer', () => {
    expect(validateDivision(30, 5, 5).ok).toBe(false);
  });
});

describe('validateMathSpec', () => {
  it('accepts a well-formed spec in either orientation', () => {
    const base = { subjectId: 'math', skillId: 'multiplication', factKey: 'mul:5x6', answer: 30 };
    expect(validateMathSpec({ ...base, left: 5, right: 6 }).ok).toBe(true);
    expect(validateMathSpec({ ...base, left: 6, right: 5 }).ok).toBe(true);
  });

  it('rejects mismatched fact keys and junk', () => {
    expect(
      validateMathSpec({ subjectId: 'math', skillId: 'division', factKey: 'div:30/6', left: 30, right: 5, answer: 6 }).ok,
    ).toBe(false);
    expect(validateMathSpec(null).ok).toBe(false);
    expect(validateMathSpec({ subjectId: 'math', skillId: 'subtraction', left: 1, right: 1 }).ok).toBe(false);
  });
});

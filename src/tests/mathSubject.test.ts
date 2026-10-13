import { describe, expect, it } from 'vitest';
import { buildQuestion } from '../learning/questionGenerator';
import { createRng } from '../core/rng';
import { mathSubject } from '../learning/mathSubject';

describe('mathSubject presentation', () => {
  const mul = buildQuestion('mul:5x6', createRng(1));
  const div = buildQuestion('div:24/4', createRng(1));

  it('shows a prominent, unambiguous expression', () => {
    expect(mathSubject.present(mul, { flavor: 'strawberry' }).expression).toMatch(/^(5 × 6|6 × 5)$/);
    expect(mathSubject.present(div, { flavor: 'mint' }).expression).toBe('24 ÷ 4');
  });

  it('gives a hint without the answer and an explanation with it', () => {
    const p = mathSubject.present(div, { flavor: 'mint' });
    expect(p.hint).toMatchObject({ kind: 'share', perGroup: null });
    expect(p.explanation).toMatchObject({ kind: 'share', perGroup: 6 });
    expect(p.explanation.caption).toContain('= 6');
  });

  it('accepts only the exact integer answer', () => {
    expect(mathSubject.checkAnswer(mul, '30')).toBe(true);
    expect(mathSubject.checkAnswer(mul, '030')).toBe(true);
    expect(mathSubject.checkAnswer(mul, '31')).toBe(false);
    expect(mathSubject.checkAnswer(mul, '')).toBe(false);
    expect(mathSubject.checkAnswer(mul, '3a')).toBe(false);
  });

  it('keeps order lines short for young readers', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const op of ['mul:1x7', 'mul:11x11', 'div:10/1', 'div:96/12'] as const) {
        const q = buildQuestion(op, createRng(seed));
        const line = mathSubject.present(q, { flavor: 'blueberry' }).orderLine;
        expect(line.split(' ').length).toBeLessThanOrEqual(12);
        expect(line).not.toMatch(/\b1 (cones|scoops|cups|friends)\b/);
      }
    }
  });
});

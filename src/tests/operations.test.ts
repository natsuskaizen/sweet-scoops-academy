import { describe, expect, it } from 'vitest';
import { GAME_CONFIG, type MathConfig } from '../config/gameConfig';
import { createRng } from '../core/rng';
import { createOperations } from '../learning/math/registry';
import { createMathSubject } from '../learning/mathSubject';
import { validateMathSpec } from '../learning/mathValidator';
import { buildQuestion } from '../learning/questionGenerator';

const withOps = (enabledOperations: string[], extra: Partial<MathConfig> = {}) =>
  createOperations({ ...GAME_CONFIG.math, ...extra, enabledOperations });

describe('operation registry', () => {
  const ops = withOps(['multiplication', 'division', 'addition', 'subtraction']);

  it.each(ops.all.map((op) => [op.id, op] as const))('%s: every fact validates and has a unique key', (_id, op) => {
    const facts = op.facts();
    expect(facts.length).toBeGreaterThan(0);
    expect(new Set(facts.map((f) => f.key)).size).toBe(facts.length);
    for (const f of facts) {
      expect(op.validate(f.left, f.right, f.answer)).toEqual({ ok: true });
      expect(op.keyFor(f.left, f.right)).toBe(f.key);
      expect(op.compute(f.left, f.right)).toBe(f.answer);
    }
  });

  it('builds questions whose orientation never changes the fact', () => {
    for (const op of ops.all) {
      for (const f of op.facts().slice(0, 20)) {
        const spec = buildQuestion(f.key, createRng(f.answer), ops);
        expect(spec.factKey).toBe(f.key);
        expect(validateMathSpec(spec, ops).ok).toBe(true);
      }
    }
  });

  it('rejects an unknown operation in the config', () => {
    expect(() => withOps(['multiplication', 'exponents'])).toThrow(/exponents/);
    expect(() => withOps([])).toThrow(/at least one/);
  });

  it('keeps disabled operations known, so saved rounds stay valid', () => {
    const mulOnly = withOps(['multiplication']);
    const spec = buildQuestion('div:24/4', createRng(1), mulOnly);
    expect(validateMathSpec(spec, mulOnly).ok).toBe(true);
    expect(mulOnly.enabled.map((op) => op.id)).toEqual(['multiplication']);
  });

  it('reads its limits from the config', () => {
    const small = withOps(['multiplication'], { multiplication: { factor: { min: 2, max: 5 } } });
    const mul = small.get('multiplication')!;
    expect(mul.facts()).toHaveLength(10); // 4 * 5 / 2 pairs from 2..5
    expect(mul.validate(6, 2).ok).toBe(false);
  });
});

describe('addition', () => {
  const add = withOps(['addition']).get('addition')!;

  it('treats 3 + 5 and 5 + 3 as one fact within the sum limit', () => {
    expect(add.keyFor(3, 5)).toBe(add.keyFor(5, 3));
    expect(add.facts().every((f) => f.answer <= GAME_CONFIG.math.addition.maxSum)).toBe(true);
    expect(add.validate(3, 5, 9)).toMatchObject({ ok: false });
  });

  it('explains with piles put together', () => {
    const spec = { subjectId: 'math' as const, skillId: 'addition', factKey: 'add:3+5', left: 3, right: 5, answer: 8 };
    const words = add.word(spec, 'mint');
    expect(words.hint).toMatchObject({ kind: 'combine', parts: [3, 5], showTotal: false });
    expect(words.explanation.caption).toContain('3 + 5 = 8');
    expect(words.hint.caption).not.toContain('8');
  });
});

describe('subtraction', () => {
  const sub = withOps(['subtraction']).get('subtraction')!;

  it('never produces a negative answer', () => {
    expect(sub.facts().every((f) => f.answer >= 0)).toBe(true);
    expect(sub.validate(3, 5).ok).toBe(false);
  });

  it('rates borrowing across ten as harder', () => {
    const difficulty = (key: string) => sub.facts().find((f) => f.key === key)!.difficulty;
    expect(difficulty('sub:13-5')).toBeGreaterThan(difficulty('sub:13-2'));
  });
});

describe('turning on more operations', () => {
  const ops = withOps(['multiplication', 'division', 'addition', 'subtraction']);
  const subject = createMathSubject({ operations: ops });

  it('splits a round across every enabled operation', () => {
    const progress = subject.createProgress();
    const plan = subject.planRound(progress, { roundNumber: 1, rng: createRng(3), now: 0, count: 12 });
    const counts = new Map<string, number>();
    for (const q of plan) counts.set(q.skillId, (counts.get(q.skillId) ?? 0) + 1);
    expect([...counts.keys()].sort()).toEqual(['addition', 'division', 'multiplication', 'subtraction']);
    expect([...counts.values()]).toEqual([3, 3, 3, 3]);
  });

  it('starts an empty record for an operation turned on after the save was made', () => {
    const oldSave = { multiplication: { facts: {} }, division: { facts: {} } };
    const spec = buildQuestion('add:2+3', createRng(1), ops);
    subject.recordOutcome(oldSave, spec, 'first', { roundNumber: 1, now: 0 });
    expect(Object.keys(oldSave)).toContain('addition');
  });

  it('reports every enabled operation to grown-ups', () => {
    const report = subject.progressReport(subject.createProgress()).join('\n');
    for (const label of ['Multiplication', 'Division', 'Addition', 'Subtraction']) expect(report).toContain(label);
  });
});

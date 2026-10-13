import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { planRound, recordOutcome, skillPace } from '../learning/adaptiveEngine';
import { mathSubject, type MathProgress } from '../learning/mathSubject';
import { factsFor } from '../learning/questionGenerator';
import type { SkillProgress } from '../learning/types';

const ctx = (roundNumber: number) => ({ roundNumber, now: 1_000 * roundNumber });

/** Default config enables multiplication and division, so both records exist. */
type TwoOps = MathProgress & Record<'multiplication' | 'division', SkillProgress>;

function freshProgress(): TwoOps {
  return mathSubject.createProgress() as TwoOps;
}

/** Plays `rounds` rounds where `answer(key)` decides each outcome. */
function simulate(
  p: TwoOps,
  rounds: number,
  answer: (key: string) => 'first' | 'retry' | 'miss',
  seed = 1,
  startRound = 1,
) {
  const plans: string[][] = [];
  for (let r = startRound; r < startRound + rounds; r++) {
    const plan = mathSubject.planRound(p, { roundNumber: r, rng: createRng(seed + r), now: r, count: 10 });
    plans.push(plan.map((q) => q.factKey));
    for (const q of plan) mathSubject.recordOutcome(p, q, answer(q.factKey), ctx(r));
  }
  return plans;
}

describe('recordOutcome', () => {
  it('starts new facts in Learning and tracks first-try and retry separately', () => {
    const skill: SkillProgress = { facts: {} };
    const rec = recordOutcome(skill, 'mul:3x4', 'retry', ctx(1));
    expect(rec.state).toBe('learning');
    expect(rec.retryCorrect).toBe(1);
    expect(rec.firstTryCorrect).toBe(0);

    recordOutcome(skill, 'mul:3x4', 'first', ctx(2));
    expect(skill.facts['mul:3x4']).toMatchObject({ firstTryCorrect: 1, retryCorrect: 1, presentations: 2 });
  });

  it('never masters a fact from a single correct answer', () => {
    const skill: SkillProgress = { facts: {} };
    expect(recordOutcome(skill, 'mul:2x2', 'first', ctx(1)).state).toBe('practicing');
  });

  it('requires first-try success across multiple separate rounds to master', () => {
    const skill: SkillProgress = { facts: {} };
    // Many correct answers inside ONE round only count as one session.
    for (let i = 0; i < 5; i++) recordOutcome(skill, 'mul:2x3', 'first', ctx(1));
    expect(skill.facts['mul:2x3']!.state).toBe('practicing');

    recordOutcome(skill, 'mul:2x3', 'first', ctx(2));
    expect(skill.facts['mul:2x3']!.state).toBe('practicing');
    recordOutcome(skill, 'mul:2x3', 'first', ctx(3));
    expect(skill.facts['mul:2x3']!.state).toBe('mastered');
  });

  it('treats retry-assisted answers as weaker evidence than first-try answers', () => {
    const skill: SkillProgress = { facts: {} };
    for (let r = 1; r <= 6; r++) recordOutcome(skill, 'mul:4x6', 'retry', ctx(r));
    expect(skill.facts['mul:4x6']!.state).not.toBe('mastered');
  });

  it('a miss raises priority without resetting accumulated progress', () => {
    const skill: SkillProgress = { facts: {} };
    for (let r = 1; r <= 3; r++) recordOutcome(skill, 'mul:6x7', 'first', ctx(r));
    expect(skill.facts['mul:6x7']!.state).toBe('mastered');

    const rec = recordOutcome(skill, 'mul:6x7', 'miss', ctx(8));
    expect(rec.state).toBe('practicing'); // drops one level, not back to zero
    expect(rec.firstTryCorrect).toBe(3); // history kept
    expect(rec.nextDueRound).toBe(9); // due again next round
  });
});

describe('planRound', () => {
  it('reproduces the same sequence for the same state and seed', () => {
    const a = mathSubject.planRound(freshProgress(), { roundNumber: 1, rng: createRng(42), now: 0, count: 10 });
    const b = mathSubject.planRound(freshProgress(), { roundNumber: 1, rng: createRng(42), now: 0, count: 10 });
    expect(a).toEqual(b);
    const c = mathSubject.planRound(freshProgress(), { roundNumber: 1, rng: createRng(43), now: 0, count: 10 });
    expect(c).not.toEqual(a);
  });

  it('gives a brand-new player 10 distinct, accessible facts from both operations', () => {
    const plan = mathSubject.planRound(freshProgress(), { roundNumber: 1, rng: createRng(7), now: 0, count: 10 });
    expect(plan).toHaveLength(10);
    expect(new Set(plan.map((q) => q.factKey)).size).toBe(10);
    const mul = plan.filter((q) => q.skillId === 'multiplication');
    expect(mul.length).toBe(5);
    // Easiest facts first: nothing from the 6/7/8 tables in round one.
    for (const q of mul) expect(Math.min(q.left, q.right)).toBeLessThanOrEqual(5);
  });

  it('never repeats a fact within a round', () => {
    const p = freshProgress();
    const plans = simulate(p, 15, (k) => (k.length % 3 === 0 ? 'miss' : 'first'));
    for (const plan of plans) expect(new Set(plan).size).toBe(plan.length);
  });

  it('keeps multiplication and division records independent', () => {
    const p = freshProgress();
    simulate(p, 3, (k) => (k.startsWith('mul') ? 'first' : 'miss'));
    expect(Object.keys(p.multiplication.facts).every((k) => k.startsWith('mul:'))).toBe(true);
    expect(Object.keys(p.division.facts).every((k) => k.startsWith('div:'))).toBe(true);
    const divStates = Object.values(p.division.facts).map((r) => r.state);
    const mulStates = Object.values(p.multiplication.facts).map((r) => r.state);
    expect(divStates.every((s) => s === 'learning')).toBe(true);
    expect(mulStates.some((s) => s !== 'learning')).toBe(true);
  });

  it('brings a missed fact back in the next round', () => {
    const p = freshProgress();
    const [round1] = simulate(p, 1, () => 'first');
    const missedKey = round1![0]!;
    const skill = missedKey.startsWith('mul:') ? p.multiplication : p.division;
    recordOutcome(skill, missedKey, 'miss', ctx(1));
    const next = mathSubject.planRound(p, { roundNumber: 2, rng: createRng(99), now: 0, count: 10 });
    expect(next.map((q) => q.factKey)).toContain(missedKey);
  });

  it('introduces new facts gradually once a learner has a backlog', () => {
    const p = freshProgress();
    simulate(p, 2, () => 'miss'); // 20 facts stuck in learning
    const before = Object.keys(p.multiplication.facts).length + Object.keys(p.division.facts).length;
    simulate(p, 1, () => 'miss', 1, 3);
    const after = Object.keys(p.multiplication.facts).length + Object.keys(p.division.facts).length;
    expect(after - before).toBeLessThanOrEqual(1);
  });

  it('revisits a mastered fact periodically even when everything else needs work', () => {
    const p = freshProgress();
    for (let r = 1; r <= 3; r++) recordOutcome(p.multiplication, 'mul:2x5', 'first', ctx(r));
    expect(p.multiplication.facts['mul:2x5']!.state).toBe('mastered');

    const seenAt: number[] = [];
    for (let r = 4; r <= 20; r++) {
      const plan = mathSubject.planRound(p, { roundNumber: r, rng: createRng(r), now: 0, count: 10 });
      for (const q of plan) {
        if (q.factKey === 'mul:2x5') {
          seenAt.push(r);
          mathSubject.recordOutcome(p, q, 'first', ctx(r));
        } else {
          mathSubject.recordOutcome(p, q, 'miss', ctx(r));
        }
      }
    }
    expect(seenAt.length).toBeGreaterThanOrEqual(2);
    // ...but less often than every round.
    expect(seenAt.length).toBeLessThan(17);
  });

  it('copes with a child who already knows nearly everything', () => {
    const p = freshProgress();
    for (const op of ['multiplication', 'division'] as const) {
      for (const f of factsFor(op)) {
        for (let r = 1; r <= 3; r++) recordOutcome(p[op], f.key, 'first', ctx(r));
      }
    }
    const plan = mathSubject.planRound(p, { roundNumber: 6, rng: createRng(5), now: 0, count: 10 });
    expect(plan).toHaveLength(10);
    expect(new Set(plan.map((q) => q.factKey)).size).toBe(10);
  });

  it('mastery takes several rounds of steady play', () => {
    const p = freshProgress();
    const anyMastered = () =>
      [...Object.values(p.multiplication.facts), ...Object.values(p.division.facts)].some(
        (r) => r.state === 'mastered',
      );
    let round = 0;
    while (!anyMastered() && round < 20) simulate(p, 1, () => 'first', 1, ++round);
    expect(round).toBeGreaterThanOrEqual(3);
    expect(anyMastered()).toBe(true);
  });

  it('moves a child who gets everything right up to the harder tables quickly', () => {
    const p = freshProgress();
    const plans = simulate(p, 3, () => 'first');
    const keys = plans.flat();
    // Facts seen grows well beyond one new fact per round.
    expect(new Set(keys).size).toBeGreaterThanOrEqual(20);
    // By round 3 the 6/7/8 tables show up in both operations.
    const hard = (key: string) => {
      const [a, b] = key.slice(4).split(/[x/]/).map(Number) as [number, number];
      const factors = key.startsWith('mul:') ? [a, b] : [b, a / b];
      return factors.some((n) => n >= 6 && n <= 8);
    };
    expect(
      plans
        .slice(0, 3)
        .flat()
        .filter((k) => k.startsWith('mul:'))
        .some(hard),
    ).toBe(true);
    expect(
      plans
        .slice(0, 3)
        .flat()
        .filter((k) => k.startsWith('div:'))
        .some(hard),
    ).toBe(true);
  });

  it('keeps a struggling child on gentle questions', () => {
    const p = freshProgress();
    const plans = simulate(p, 5, () => 'miss');
    const difficulty = new Map(
      [...factsFor('multiplication'), ...factsFor('division')].map((f) => [f.key, f.difficulty]),
    );
    // Nothing from the 6, 7, 8 or 9 tables (6 × 2 already scores 7).
    for (const key of plans.flat()) expect(difficulty.get(key)).toBeLessThanOrEqual(5);
  });

  it('eases back after a run of misses', () => {
    const p = freshProgress();
    simulate(p, 3, () => 'first');
    const pool = { skillId: 'multiplication', progress: p.multiplication, catalog: factsFor('multiplication') };
    expect(skillPace(pool, 4).fluent).toBe(true);
    simulate(p, 1, () => 'miss', 1, 4);
    expect(skillPace(pool, 5).fluent).toBe(false);
  });

  it('works on a single generic skill (subject-agnostic)', () => {
    const catalog = ['cat', 'dog', 'sun'].map((key, difficulty) => ({ key, difficulty }));
    const plan = planRound([{ skillId: 'vocab', progress: { facts: {} }, catalog }], {
      roundNumber: 1,
      rng: createRng(1),
      count: 5,
    });
    expect(plan).toHaveLength(5); // tiny catalog: repeats allowed only when exhausted
  });
});

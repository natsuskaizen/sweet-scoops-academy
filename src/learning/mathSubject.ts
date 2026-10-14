/**
 * Math as a LearningSubject. Each operation keeps its own adaptive record, so
 * a child can be strong at multiplication and still learning division. All
 * operation-specific wording and visuals come from the operation itself
 * (src/learning/math/); this file only wires them into the subject contract.
 */
import { GAME_CONFIG, type AdaptiveConfig } from '../config/gameConfig';
import { planRound, recordOutcome, summarizeSkill, type SkillPool, type SkillSummary } from './adaptiveEngine';
import type { MathChallengeSpec, MathOperation } from './math/operation';
import { OPERATIONS, type OperationRegistry } from './math/registry';
import { validateMathSpec } from './mathValidator';
import { buildQuestion, factByKey } from './questionGenerator';
import type { ChallengePresentation, LearningSubject, OrderContext, PlanContext, SkillProgress } from './types';

/** One adaptive record per operation id. Operations turned on later start empty. */
export type MathProgress = Record<string, SkillProgress>;

export type MathSubject = LearningSubject<MathChallengeSpec, MathProgress>;

export interface MathSubjectOptions {
  adaptive?: AdaptiveConfig;
  operations?: OperationRegistry;
  /** Players can't read yet: draw orders as pictures (where the operation has one) and dot the number keys. */
  preReaders?: boolean;
}

/** The record for one operation, created on first use. */
function skillProgress(progress: MathProgress, operationId: string): SkillProgress {
  return (progress[operationId] ??= { facts: {} });
}

export function createMathSubject(options: MathSubjectOptions = {}): MathSubject {
  const adaptive = options.adaptive ?? GAME_CONFIG.adaptive;
  const operations = options.operations ?? OPERATIONS;

  const operation = (id: string) => {
    const op = operations.get(id);
    if (!op) throw new Error(`Unknown math operation "${id}"`);
    return op;
  };

  const pools = (progress: MathProgress, ops = operations.enabled): SkillPool[] =>
    ops.map((op) => ({ skillId: op.id, progress: skillProgress(progress, op.id), catalog: op.facts() }));

  return {
    id: 'math',
    badge: '123',

    createProgress: () => Object.fromEntries(operations.enabled.map((op) => [op.id, { facts: {} }])),

    planRound(progress: MathProgress, ctx: PlanContext): MathChallengeSpec[] {
      const plan = planRound(pools(progress), {
        roundNumber: ctx.roundNumber,
        rng: ctx.rng,
        count: ctx.count,
        config: adaptive,
      });
      // buildQuestion validates every question and throws on anything invalid.
      return plan.map((item) => buildQuestion(item.factKey, ctx.rng, operations));
    },

    isValidSpec: (spec: unknown): spec is MathChallengeSpec => validateMathSpec(spec, operations).ok,

    present: (spec: MathChallengeSpec, ctx: OrderContext) =>
      present(operation(spec.skillId), spec, ctx, options.preReaders ?? false),

    checkAnswer(spec: MathChallengeSpec, input: string): boolean {
      const trimmed = input.trim();
      return /^\d+$/.test(trimmed) && Number.parseInt(trimmed, 10) === spec.answer;
    },

    recordOutcome(progress, spec, outcome, ctx) {
      recordOutcome(skillProgress(progress, spec.skillId), spec.factKey, outcome, ctx, adaptive);
    },

    progressReport(progress: MathProgress): string[] {
      const summary = (id: string, s: SkillSummary) =>
        `${operation(id).label}: ${s.mastered} mastered · ${s.practicing} practicing · ${s.learning} learning · ${s.unseen} not seen yet`;
      const lines = pools(progress).map((pool) => summary(pool.skillId, summarizeSkill(pool)));
      const tricky = trickyFacts(progress).map((key) => {
        const fact = factByKey(key, operations);
        return fact ? operation(fact.operation).formatKey(key) : key;
      });
      return [...lines, `Facts to practice: ${tricky.length ? tricky.join(', ') : 'none yet'}`];
    },
  };
}

function present(
  op: MathOperation,
  spec: MathChallengeSpec,
  ctx: OrderContext,
  preReaders: boolean,
): ChallengePresentation {
  const presentation: ChallengePresentation = {
    expression: op.expression?.(spec) ?? `${spec.left} ${op.symbol} ${spec.right}`,
    answerInput: { kind: 'integer', maxDigits: op.maxDigits, ...(preReaders && { dots: true }) },
    correctAnswer: String(spec.answer),
    ...op.word(spec, ctx.flavor),
  };
  const picture = preReaders ? op.picture?.(spec) : undefined;
  if (picture) {
    presentation.orderPicture = picture.order;
    if (picture.onTicket) presentation.ticketPicture = picture.order;
  }
  return presentation;
}

/** Facts that needed help and are not yet mastered, most troublesome first. */
function trickyFacts(progress: MathProgress, limit = 6): string[] {
  const trouble = (r: { missed: number; retryCorrect: number }) => r.missed * 2 + r.retryCorrect;
  return Object.values(progress)
    .flatMap((skill) => Object.values(skill.facts))
    .filter((r) => trouble(r) > 0 && r.state !== 'mastered')
    .sort((a, b) => trouble(b) - trouble(a))
    .slice(0, limit)
    .map((r) => r.key);
}

export const mathSubject = createMathSubject();

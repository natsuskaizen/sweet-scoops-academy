/**
 * Math as a LearningSubject: multiplication and division with independent
 * adaptive records. This is the only place that knows how to phrase a math
 * order or explain it with scoops; the shop just renders what it returns.
 */
import {
  DEFAULT_ADAPTIVE_CONFIG,
  planRound,
  recordOutcome,
  summarizeSkill,
  type AdaptiveConfig,
  type SkillPool,
  type SkillSummary,
} from './adaptiveEngine';
import { validateMathSpec, type MathChallengeSpec, type MathOperation } from './mathValidator';
import { buildQuestion, factsFor } from './questionGenerator';
import type {
  ChallengePresentation,
  LearningSubject,
  OrderContext,
  PlanContext,
  SkillProgress,
} from './types';

export interface MathProgress {
  multiplication: SkillProgress;
  division: SkillProgress;
}

export const MATH_OPERATIONS: readonly MathOperation[] = ['multiplication', 'division'];

function pools(progress: MathProgress): SkillPool[] {
  return MATH_OPERATIONS.map((op) => ({ skillId: op, progress: progress[op], catalog: factsFor(op) }));
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function multiplicationLine(groups: number, each: number, flavor: string, variant: number): string {
  const lines = [
    `Can I get ${plural(groups, 'cone', 'cones')} with ${plural(each, 'scoop', 'scoops')} each?`,
    `I'd love ${plural(groups, `${flavor} cone`, `${flavor} cones`)} with ${plural(each, 'scoop', 'scoops')} on each!`,
    `${plural(groups, 'cup', 'cups')} please, ${plural(each, 'scoop', 'scoops')} in every cup!`,
  ];
  return lines[variant % lines.length]!;
}

function divisionLine(total: number, groups: number, flavor: string, variant: number): string {
  if (groups === 1) return `Please put ${total} ${flavor} scoops in 1 big cup!`;
  const lines = [
    `Please share ${total} scoops equally between ${groups} friends.`,
    `I have ${total} ${flavor} scoops for ${groups} cones. Same on each, please!`,
    `Can you split ${total} scoops into ${groups} cups evenly?`,
  ];
  return lines[variant % lines.length]!;
}

export function createMathSubject(
  config: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG,
): LearningSubject<MathChallengeSpec, MathProgress> & {
  summarize(progress: MathProgress): Record<MathOperation, SkillSummary>;
} {
  return {
    id: 'math',

    createProgress: () => ({ multiplication: { facts: {} }, division: { facts: {} } }),

    planRound(progress: MathProgress, ctx: PlanContext): MathChallengeSpec[] {
      const plan = planRound(pools(progress), {
        roundNumber: ctx.roundNumber,
        rng: ctx.rng,
        count: ctx.count,
        config,
      });
      // buildQuestion validates every question and throws on anything invalid.
      return plan.map((item) => buildQuestion(item.factKey, ctx.rng));
    },

    isValidSpec(spec: unknown): spec is MathChallengeSpec {
      return validateMathSpec(spec).ok;
    },

    present(spec: MathChallengeSpec, ctx: OrderContext): ChallengePresentation {
      // Variant is derived from the numbers so the same order always reads the same.
      const variant = spec.left + spec.right;
      if (spec.skillId === 'multiplication') {
        const groups = spec.left;
        const each = spec.right;
        return {
          expression: `${spec.left} × ${spec.right}`,
          orderLine: multiplicationLine(groups, each, ctx.flavor, variant),
          answerInput: { kind: 'integer', maxDigits: 3 },
          correctAnswer: String(spec.answer),
          hint: {
            kind: 'groups', groups, perGroup: each, showTotal: false,
            caption: `${plural(groups, 'cup', 'cups')} with ${each} in each. Count them all!`,
          },
          explanation: {
            kind: 'groups', groups, perGroup: each, showTotal: true,
            caption: `${plural(groups, 'group', 'groups')} of ${each} make${groups === 1 ? 's' : ''} ${spec.answer}.  ${spec.left} × ${spec.right} = ${spec.answer}`,
          },
        };
      }
      const total = spec.left;
      const groups = spec.right;
      return {
        expression: `${spec.left} ÷ ${spec.right}`,
        orderLine: divisionLine(total, groups, ctx.flavor, variant),
        answerInput: { kind: 'integer', maxDigits: 2 },
        correctAnswer: String(spec.answer),
        hint: {
          kind: 'share', total, groups, perGroup: null,
          caption: `Share ${total} scoops into ${plural(groups, 'cup', 'cups')}, one at a time.`,
        },
        explanation: {
          kind: 'share', total, groups, perGroup: spec.answer,
          caption: `${total} shared into ${groups} is ${spec.answer} each.  ${spec.left} ÷ ${spec.right} = ${spec.answer}`,
        },
      };
    },

    checkAnswer(spec: MathChallengeSpec, input: string): boolean {
      const trimmed = input.trim();
      if (!/^\d+$/.test(trimmed)) return false;
      return Number.parseInt(trimmed, 10) === spec.answer;
    },

    recordOutcome(progress, spec, outcome, ctx) {
      recordOutcome(progress[spec.skillId], spec.factKey, outcome, ctx, config);
    },

    summarize(progress: MathProgress) {
      const [mul, div] = pools(progress);
      return { multiplication: summarizeSkill(mul!), division: summarizeSkill(div!) };
    },
  };
}

export const mathSubject = createMathSubject();

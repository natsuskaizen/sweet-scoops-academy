import type { MathConfig } from '../../config/gameConfig';
import {
  cached, checkAnswer, fail, firstFailure, inRange, isInt, plural, variantOf,
  type MathFact, type MathOperation,
} from './operation';

/** 5 × 6 and 6 × 5 share one mastery record. */
export function multiplicationKey(a: number, b: number): string {
  return `mul:${Math.min(a, b)}x${Math.max(a, b)}`;
}

/** The easier factor dominates (2 × 8 is easier than 6 × 7); three-digit products wait. */
export function timesDifficulty(a: number, b: number, tiers: MathConfig['factorTiers']): number {
  const tier = (n: number) => tiers[n] ?? 6;
  const [easy, hard] = [Math.min(tier(a), tier(b)), Math.max(tier(a), tier(b))];
  return easy * 2 + hard + (a * b >= 100 ? 4 : 0);
}

export function createMultiplication(math: MathConfig): MathOperation {
  const { factor } = math.multiplication;

  const facts = cached(() => {
    const out: MathFact[] = [];
    for (let a = factor.min; a <= factor.max; a++) {
      for (let b = a; b <= factor.max; b++) {
        out.push({
          key: multiplicationKey(a, b), operation: 'multiplication', left: a, right: b,
          answer: a * b, difficulty: timesDifficulty(a, b, math.factorTiers),
        });
      }
    }
    return out;
  });

  return {
    id: 'multiplication',
    label: 'Multiplication',
    symbol: '×',
    maxDigits: 3,
    facts,
    compute: (a, b) => a * b,
    keyFor: multiplicationKey,

    validate(a, b, answer) {
      if (!isInt(a) || !isInt(b)) return fail('factors must be integers');
      return firstFailure(
        () => inRange('factor', a, factor),
        () => inRange('factor', b, factor),
        () => checkAnswer(a * b, answer),
      );
    },

    // Show both orientations so 5 × 6 and 6 × 5 both get practised.
    orient: (fact, rng) =>
      fact.left !== fact.right && rng.next() < 0.5 ? [fact.right, fact.left] : [fact.left, fact.right],

    word(spec, flavor) {
      const groups = spec.left;
      const each = spec.right;
      const scoops = plural(each, 'scoop', 'scoops');
      return {
        orderLine: variantOf([
          `Can I get ${plural(groups, 'cone', 'cones')} with ${scoops} each?`,
          `I'd love ${plural(groups, `${flavor} cone`, `${flavor} cones`)} with ${scoops} on each!`,
          `${plural(groups, 'cup', 'cups')} please, ${scoops} in every cup!`,
        ], spec),
        hint: {
          kind: 'groups', groups, perGroup: each, showTotal: false,
          caption: `${plural(groups, 'cup', 'cups')} with ${each} in each. Count them all!`,
        },
        explanation: {
          kind: 'groups', groups, perGroup: each, showTotal: true,
          caption: `${plural(groups, 'group', 'groups')} of ${each} make${groups === 1 ? 's' : ''} ${spec.answer}.  ${groups} × ${each} = ${spec.answer}`,
        },
      };
    },

    formatKey: (key) => key.replace('mul:', '').replace('x', '×'),
  };
}


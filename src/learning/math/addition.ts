import type { MathConfig } from '../../config/gameConfig';
import {
  cached, checkAnswer, fail, firstFailure, inRange, isInt, plural, variantOf,
  type MathChallengeSpec, type MathFact, type MathOperation, type OrderWording,
} from './operation';

/** 3 + 5 and 5 + 3 share one mastery record. */
export function additionKey(a: number, b: number): string {
  return `add:${Math.min(a, b)}+${Math.max(a, b)}`;
}

/** Bigger sums are harder, and crossing ten is a step up. */
const additionDifficulty = (a: number, b: number): number => Math.ceil((a + b) / 4) + (a + b > 10 ? 2 : 0);

function wordCombine(spec: MathChallengeSpec, flavor: string): OrderWording {
  const [a, b] = [spec.left, spec.right];
  return {
    orderLine: variantOf([
      `I'd like ${plural(a, 'scoop', 'scoops')}, then ${b} more please!`,
      `Can I get ${a} ${flavor} and ${b} more scoops in one big cup?`,
      `${plural(a, 'scoop', 'scoops')} for me and ${b} for my friend. How many altogether?`,
    ], spec),
    hint: { kind: 'combine', parts: [a, b], showTotal: false, caption: `${plural(a, 'scoop', 'scoops')} and ${plural(b, 'scoop', 'scoops')}. Count them all!` },
    explanation: {
      kind: 'combine', parts: [a, b], showTotal: true,
      caption: `${a} and ${b} more make ${spec.answer}.  ${a} + ${b} = ${spec.answer}`,
    },
  };
}

export function createAddition(math: MathConfig): MathOperation {
  const { addend, maxSum } = math.addition;

  const facts = cached(() => {
    const out: MathFact[] = [];
    for (let a = addend.min; a <= addend.max; a++) {
      for (let b = a; b <= addend.max; b++) {
        if (a + b > maxSum || a + b === 0) continue;
        out.push({ key: additionKey(a, b), operation: 'addition', left: a, right: b, answer: a + b, difficulty: additionDifficulty(a, b) });
      }
    }
    return out;
  });

  return {
    id: 'addition',
    label: 'Addition',
    symbol: '+',
    maxDigits: 2,
    facts,
    compute: (a, b) => a + b,
    keyFor: additionKey,
    orient: (fact, rng) =>
      fact.left !== fact.right && rng.next() < 0.5 ? [fact.right, fact.left] : [fact.left, fact.right],

    validate(a, b, answer) {
      if (!isInt(a) || !isInt(b)) return fail('addends must be integers');
      return firstFailure(
        () => inRange('addend', a, addend),
        () => inRange('addend', b, addend),
        () => (a + b <= maxSum ? checkAnswer(a + b, answer) : fail(`sum ${a + b} above ${maxSum}`)),
      );
    },

    word: wordCombine,
    formatKey: (key) => key.replace('add:', ''),
  };
}

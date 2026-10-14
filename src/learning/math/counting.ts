import type { MathConfig } from '../../config/gameConfig';
import {
  cached,
  checkAnswer,
  fail,
  firstFailure,
  inRange,
  isInt,
  plural,
  type MathChallengeSpec,
  type MathOperation,
  type OrderWording,
} from './operation';

/** One record per count: "count:4". */
export const countingKey = (n: number): string => `count:${n}`;

function wordCount(spec: MathChallengeSpec): OrderWording {
  const n = spec.left;
  return {
    orderLine: `How many scoops are on my cone?`,
    hint: { kind: 'count', total: n, showNumbers: false, caption: 'Touch each scoop and count them!' },
    explanation: { kind: 'count', total: n, showNumbers: true, caption: `${plural(n, 'scoop', 'scoops')}!` },
  };
}

/**
 * How many scoops? A cone of scoops and the player taps how many there are.
 * Counting has one number, so `right` is always 0 and the answer is `left`.
 */
export function createCounting(math: MathConfig): MathOperation {
  const { count } = math.counting;

  const facts = cached(() =>
    Array.from({ length: count.max - count.min + 1 }, (_, i) => count.min + i).map((n) => ({
      key: countingKey(n),
      operation: 'counting',
      left: n,
      right: 0,
      answer: n,
      difficulty: Math.ceil(n / 3),
    })),
  );

  return {
    id: 'counting',
    label: 'Counting',
    symbol: '',
    maxDigits: 2,
    facts,
    compute: (n) => n,
    keyFor: (n) => countingKey(n),
    orient: (fact) => [fact.left, 0],

    validate(n, zero, answer) {
      if (!isInt(n) || zero !== 0) return fail('counting takes one whole number');
      return firstFailure(
        () => inRange('count', n, count),
        () => checkAnswer(n, answer),
      );
    },

    word: wordCount,
    formatKey: (key) => `count ${key.replace('count:', '')}`,
    expression: (spec) => `count ${spec.left}`,
    picture: (spec) => ({ order: { kind: 'cone', scoops: spec.left }, onTicket: true }),
  };
}

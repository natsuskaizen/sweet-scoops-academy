import type { MathConfig } from '../../config/gameConfig';
import { timesDifficulty } from './multiplication';
import {
  OK, cached, checkAnswer, fail, firstFailure, inRange, isInt, plural, variantOf,
  type MathChallengeSpec, type MathFact, type MathOperation, type OrderWording,
} from './operation';

export function divisionKey(dividend: number, divisor: number): string {
  return `div:${dividend}/${divisor}`;
}

function wordShare(spec: MathChallengeSpec, flavor: string): OrderWording {
  const total = spec.left;
  const groups = spec.right;
  return {
    orderLine: groups === 1
      ? `Please put ${total} ${flavor} scoops in 1 big cup!`
      : variantOf([
        `Please share ${total} scoops equally between ${groups} friends.`,
        `I have ${total} ${flavor} scoops for ${groups} cones. Same on each, please!`,
        `Can you split ${total} scoops into ${groups} cups evenly?`,
      ], spec),
    hint: {
      kind: 'share', total, groups, perGroup: null,
      caption: `Share ${total} scoops into ${plural(groups, 'cup', 'cups')}, one at a time.`,
    },
    explanation: {
      kind: 'share', total, groups, perGroup: spec.answer,
      caption: `${total} shared into ${groups} is ${spec.answer} each.  ${total} ÷ ${groups} = ${spec.answer}`,
    },
  };
}

export function createDivision(math: MathConfig): MathOperation {
  const { dividend: dividendRange, quotient: quotientRange, divisor: divisorRange } = math.division;

  const facts = cached(() => {
    const out: MathFact[] = [];
    for (let divisor = divisorRange.min; divisor <= divisorRange.max; divisor++) {
      for (let quotient = quotientRange.min; quotient <= quotientRange.max; quotient++) {
        const dividend = divisor * quotient;
        if (dividend < dividendRange.min || dividend > dividendRange.max) continue;
        out.push({
          key: divisionKey(dividend, divisor), operation: 'division', left: dividend, right: divisor,
          answer: quotient,
          // Division feels one step harder than the matching times fact.
          difficulty: timesDifficulty(divisor, quotient, math.factorTiers) + 1,
        });
      }
    }
    return out;
  });

  return {
    id: 'division',
    label: 'Division',
    symbol: '÷',
    maxDigits: 2,
    facts,
    compute: (dividend, divisor) => dividend / divisor,
    keyFor: divisionKey,
    orient: (fact) => [fact.left, fact.right],

    validate(dividend, divisor, answer) {
      if (!isInt(dividend) || !isInt(divisor)) return fail('dividend and divisor must be integers');
      if (divisor <= 0) return fail('divisor must be positive');
      return firstFailure(
        () => inRange('dividend', dividend, dividendRange),
        () => (dividend % divisor === 0 ? OK : fail(`${dividend} ÷ ${divisor} has a remainder`)),
        () => inRange('quotient', dividend / divisor, quotientRange),
        () => checkAnswer(dividend / divisor, answer),
      );
    },

    word: wordShare,
    formatKey: (key) => key.replace('div:', '').replace('/', '÷'),
  };
}

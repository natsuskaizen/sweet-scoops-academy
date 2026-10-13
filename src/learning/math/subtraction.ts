import type { MathConfig } from '../../config/gameConfig';
import {
  cached, checkAnswer, fail, firstFailure, inRange, isInt, plural, variantOf,
  type MathChallengeSpec, type MathFact, type MathOperation, type OrderWording,
} from './operation';

export function subtractionKey(minuend: number, subtrahend: number): string {
  return `sub:${minuend}-${subtrahend}`;
}

/** Bigger numbers are harder, and borrowing across ten (13 - 5) is a step up. */
function subtractionDifficulty(minuend: number, subtrahend: number): number {
  const crossesTen = minuend > 10 && minuend - subtrahend < 10;
  return Math.ceil(minuend / 4) + (crossesTen ? 3 : 0);
}

function wordTakeAway(spec: MathChallengeSpec, flavor: string): OrderWording {
  const [total, taken] = [spec.left, spec.right];
  return {
    orderLine: variantOf([
      `My cup had ${plural(total, 'scoop', 'scoops')} and I ate ${taken}. How many are left?`,
      `I had ${total} ${flavor} scoops and gave ${taken} to a friend. How many do I have now?`,
      `There were ${total} scoops, then ${taken} melted! How many are left?`,
    ], spec),
    hint: { kind: 'takeAway', total, remove: taken, showResult: false, caption: `Start with ${total} scoops and take away ${taken}.` },
    explanation: {
      kind: 'takeAway', total, remove: taken, showResult: true,
      caption: `${total} take away ${taken} leaves ${spec.answer}.  ${total} − ${taken} = ${spec.answer}`,
    },
  };
}

export function createSubtraction(math: MathConfig): MathOperation {
  const { minuend: minuendRange, subtrahend: subtrahendRange, minDifference } = math.subtraction;

  const facts = cached(() => {
    const out: MathFact[] = [];
    for (let m = minuendRange.min; m <= minuendRange.max; m++) {
      for (let s = subtrahendRange.min; s <= Math.min(subtrahendRange.max, m - minDifference); s++) {
        out.push({ key: subtractionKey(m, s), operation: 'subtraction', left: m, right: s, answer: m - s, difficulty: subtractionDifficulty(m, s) });
      }
    }
    return out;
  });

  return {
    id: 'subtraction',
    label: 'Subtraction',
    symbol: '−',
    maxDigits: 2,
    facts,
    compute: (m, s) => m - s,
    keyFor: subtractionKey,
    orient: (fact) => [fact.left, fact.right],

    validate(m, s, answer) {
      if (!isInt(m) || !isInt(s)) return fail('numbers must be integers');
      return firstFailure(
        () => inRange('minuend', m, minuendRange),
        () => inRange('subtrahend', s, subtrahendRange),
        () => (m - s >= minDifference ? checkAnswer(m - s, answer) : fail(`difference ${m - s} below ${minDifference}`)),
      );
    },

    word: wordTakeAway,
    formatKey: (key) => key.replace('sub:', ''),
  };
}

/**
 * "Read the order": the customer's bubble and the ticket say "2 pink" in
 * words, with no picture, and the child taps the pink tub. The wrong tubs are
 * other colours, shown only as colours, so the only way to answer is to read.
 */
import { GAME_CONFIG, type VocabConfig } from '../../config/gameConfig';
import type { Rng } from '../../core/rng';
import type { ChallengePresentation } from '../types';
import type { VocabChallengeSpec, VocabSkill } from './skill';

const KEY_PREFIX = 'color:';

function isPlayable(spec: VocabChallengeSpec, vocab: VocabConfig): boolean {
  const { word, answer, options, count } = spec;
  const colors = vocab.colors.map((c) => c.word);
  return (
    spec.factKey === KEY_PREFIX + word &&
    answer === word &&
    colors.includes(word) &&
    options.length === vocab.colorChoices &&
    new Set(options).size === options.length &&
    options.includes(answer) &&
    options.every((o) => colors.includes(o)) &&
    Number.isInteger(count) &&
    count! >= vocab.orderCount.min &&
    count! <= vocab.orderCount.max
  );
}

function present(spec: VocabChallengeSpec, vocab: VocabConfig): ChallengePresentation {
  const hexOf = (word: string) => vocab.colors.find((c) => c.word === word)?.hex;
  const line = `${spec.count} ${spec.word}`;
  return {
    expression: line,
    orderLine: line,
    ticketPicture: { kind: 'words', text: line },
    answerInput: { kind: 'choice', options: spec.options.map((o) => ({ id: o, swatch: hexOf(o) })) },
    correctAnswer: spec.answer,
    hint: {
      kind: 'word',
      word: spec.word,
      lit: 0,
      caption: `Read it slowly: ${spec.word}. Which tub is ${spec.word}?`,
    },
    explanation: {
      kind: 'word',
      word: spec.word,
      swatch: hexOf(spec.word),
      lit: spec.word.length,
      caption: `${spec.word} is this colour!`,
    },
  };
}

export function createReadOrder(vocab: VocabConfig = GAME_CONFIG.vocab): VocabSkill {
  const words = vocab.colors.map((c) => c.word);

  return {
    id: 'readOrder',
    label: 'Read the order',
    facts: () => words.map((word) => ({ key: KEY_PREFIX + word, difficulty: word.length })),
    formatKey: (key) => key.slice(KEY_PREFIX.length),

    build(factKey, rng: Rng): VocabChallengeSpec {
      const word = factKey.slice(KEY_PREFIX.length);
      if (!words.includes(word)) throw new Error(`Unknown vocab fact "${factKey}"`);
      const others = rng.shuffle(words.filter((w) => w !== word)).slice(0, vocab.colorChoices - 1);
      return {
        subjectId: 'vocab',
        skillId: 'readOrder',
        factKey,
        word,
        answer: word,
        options: rng.shuffle([word, ...others]),
        count: rng.int(vocab.orderCount.min, vocab.orderCount.max),
      };
    },

    validate: (spec) => isPlayable(spec, vocab),
    present: (spec) => present(spec, vocab),
  };
}

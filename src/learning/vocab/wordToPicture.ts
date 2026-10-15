/**
 * "Word to picture": the order is a short word in words ("sun") and the child
 * taps the picture that matches it, among other words' pictures. A first miss
 * sounds the word out, lighting its letters one at a time.
 */
import { GAME_CONFIG, type VocabConfig } from '../../config/gameConfig';
import type { Rng } from '../../core/rng';
import type { ChallengePresentation } from '../types';
import type { VocabChallengeSpec, VocabSkill } from './skill';

const KEY_PREFIX = 'pic:';

function isPlayable(
  spec: VocabChallengeSpec,
  asked: readonly string[],
  all: readonly string[],
  choices: number,
): boolean {
  const { word, answer, options } = spec;
  return (
    spec.factKey === KEY_PREFIX + word &&
    answer === word &&
    asked.includes(word) &&
    options.length === choices &&
    new Set(options).size === options.length &&
    options.includes(answer) &&
    options.every((o) => all.includes(o))
  );
}

export function createWordToPicture(vocab: VocabConfig = GAME_CONFIG.vocab): VocabSkill {
  const pictureOf = (word: string) => vocab.words.find((w) => w.word === word)?.picture ?? word;
  const all = vocab.words.map((w) => w.word);
  const short = all.filter((w) => w.length <= vocab.pictureWordLength);

  function present(spec: VocabChallengeSpec): ChallengePresentation {
    const { word } = spec;
    return {
      expression: word,
      orderLine: word,
      ticketPicture: { kind: 'words', text: word },
      answerInput: { kind: 'choice', options: spec.options.map((o) => ({ id: o, picture: pictureOf(o) })) },
      correctAnswer: spec.answer,
      hint: { kind: 'word', word, lit: 0, sound: true, caption: `Sound it out: ${[...word].join(' - ')}` },
      explanation: {
        kind: 'word',
        word,
        picture: pictureOf(word),
        lit: word.length,
        caption: `${word} is this picture!`,
      },
    };
  }

  return {
    id: 'wordToPicture',
    label: 'Word to picture',
    facts: () => short.map((word) => ({ key: KEY_PREFIX + word, difficulty: word.length })),
    formatKey: (key) => key.slice(KEY_PREFIX.length),

    build(factKey, rng: Rng): VocabChallengeSpec {
      const word = factKey.slice(KEY_PREFIX.length);
      if (!short.includes(word)) throw new Error(`Unknown vocab fact "${factKey}"`);
      const others = rng.shuffle(all.filter((w) => w !== word)).slice(0, vocab.pictureChoices - 1);
      return {
        subjectId: 'vocab',
        skillId: 'wordToPicture',
        factKey,
        word,
        answer: word,
        options: rng.shuffle([word, ...others]),
      };
    },

    validate: (spec) => isPlayable(spec, short, all, vocab.pictureChoices),
    present,
  };
}

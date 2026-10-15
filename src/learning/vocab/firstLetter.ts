/**
 * "What letter does it start with?": a picture of an apple, the word with
 * its first letter missing (_pple), and four letters to tap. The wrong
 * letters are the first letters of other words, so every button is a letter
 * the child has seen on a picture today.
 */
import { GAME_CONFIG, type VocabConfig } from '../../config/gameConfig';
import type { Rng } from '../../core/rng';
import type { ChallengePresentation } from '../types';
import type { VocabChallengeSpec, VocabSkill } from './skill';

const KEY_PREFIX = 'first:';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

/** Wrong letters: other words' first letters first, then any letter, so there are always enough. */
function wrongLetters(right: string, words: readonly string[], count: number, rng: Rng): string[] {
  const seen = [...new Set(words.map((w) => w[0]!))].filter((l) => l !== right);
  const spare = [...ALPHABET].filter((l) => l !== right && !seen.includes(l));
  return [...rng.shuffle(seen), ...rng.shuffle(spare)].slice(0, count);
}

function isPlayable(spec: VocabChallengeSpec, words: readonly string[], choices: number): boolean {
  const { word, answer, options } = spec;
  return (
    spec.factKey === KEY_PREFIX + word &&
    words.includes(word) &&
    answer === word[0] &&
    options.length === choices &&
    new Set(options).size === options.length &&
    options.includes(answer) &&
    options.every((o) => /^[a-z]$/.test(o))
  );
}

function present(spec: VocabChallengeSpec, picture: string): ChallengePresentation {
  const blank = `_${spec.word.slice(1)}`;
  return {
    expression: blank,
    orderLine: 'What letter does it start with?',
    orderPicture: { kind: 'sprite', key: picture },
    ticketPicture: { kind: 'sprite', key: picture, word: blank },
    answerInput: { kind: 'choice', options: spec.options.map((o) => ({ id: o, label: o.toUpperCase() })) },
    correctAnswer: spec.answer,
    hint: {
      kind: 'word',
      word: blank,
      picture,
      lit: 0,
      caption: `Say it slowly: ${spec.word}. What sound do you hear first?`,
    },
    explanation: {
      kind: 'word',
      word: spec.word,
      picture,
      lit: 1,
      caption: `${spec.word} starts with ${spec.answer.toUpperCase()}!`,
    },
  };
}

export function createFirstLetter(vocab: VocabConfig = GAME_CONFIG.vocab): VocabSkill {
  const words = vocab.words.map((w) => w.word);
  const pictureOf = (word: string) => vocab.words.find((w) => w.word === word)?.picture ?? word;

  return {
    id: 'firstLetter',
    label: 'First letter',
    facts: () => words.map((word) => ({ key: KEY_PREFIX + word, difficulty: word.length })),
    formatKey: (key) => key.slice(KEY_PREFIX.length),

    build(factKey, rng): VocabChallengeSpec {
      const word = factKey.slice(KEY_PREFIX.length);
      if (!words.includes(word)) throw new Error(`Unknown vocab fact "${factKey}"`);
      const answer = word[0]!;
      const wrong = wrongLetters(answer, words, vocab.letterChoices - 1, rng);
      return {
        subjectId: 'vocab',
        skillId: 'firstLetter',
        factKey,
        word,
        answer,
        options: rng.shuffle([answer, ...wrong]),
      };
    },

    validate: (spec) => isPlayable(spec, words, vocab.letterChoices),
    present: (spec) => present(spec, pictureOf(spec.word)),
  };
}

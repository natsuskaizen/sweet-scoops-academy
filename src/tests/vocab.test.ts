import { describe, expect, it } from 'vitest';
import { GAME_CONFIG, type VocabConfig } from '../config/gameConfig';
import { createRng } from '../core/rng';
import { WORD_ART, WORD_ART_SIZE } from '../characters/wordArt';
import { createFirstLetter } from '../learning/vocab/firstLetter';
import { createVocabSkills } from '../learning/vocab/registry';
import type { VocabChallengeSpec } from '../learning/vocab/skill';
import { createVocabSubject } from '../learning/vocab/vocabSubject';

const skill = createFirstLetter();
const build = (word: string, seed = 1) => skill.build(`first:${word}`, createRng(seed));

describe('first letter skill', () => {
  it('asks for the first letter of every word with a picture, shorter words first', () => {
    const facts = skill.facts();
    expect(facts.map((f) => f.key)).toEqual(GAME_CONFIG.vocab.words.map((w) => `first:${w.word}`));
    expect(facts[0]!.difficulty).toBeLessThan(facts[facts.length - 1]!.difficulty);
    expect(skill.formatKey('first:apple')).toBe('apple');
  });

  it('offers the right letter among other words’ first letters, the same way every time for a seed', () => {
    for (const { word } of GAME_CONFIG.vocab.words) {
      const spec = build(word);
      expect(spec).toMatchObject({ subjectId: 'vocab', skillId: 'firstLetter', word, answer: word[0] });
      expect(spec.options).toHaveLength(GAME_CONFIG.vocab.letterChoices);
      expect(new Set(spec.options).size).toBe(spec.options.length);
      expect(spec.options).toContain(word[0]);
      expect(skill.validate(spec)).toBe(true);
    }
    expect(build('apple', 9)).toEqual(build('apple', 9));
  });

  it('falls back to any letter when the words have too few first letters', () => {
    const few: VocabConfig = { words: [{ word: 'ant', picture: 'star' }], letterChoices: 4 };
    const spec = createFirstLetter(few).build('first:ant', createRng(3));
    expect(spec.options).toHaveLength(4);
    expect(spec.options).toContain('a');
  });

  it('shows the picture and the word with a gap, and answers with letter buttons', () => {
    const shown = skill.present(build('apple'));
    expect(shown).toMatchObject({
      expression: '_pple',
      correctAnswer: 'a',
      orderPicture: { kind: 'sprite', key: 'apple' },
      ticketPicture: { kind: 'sprite', key: 'apple', word: '_pple' },
      hint: { kind: 'word', word: '_pple', lit: 0 },
      explanation: { kind: 'word', word: 'apple', lit: 1, caption: 'apple starts with A!' },
    });
    expect(shown.answerInput).toMatchObject({ kind: 'choice' });
    if (shown.answerInput.kind !== 'choice') throw new Error('expected choices');
    expect(shown.answerInput.options.map((o) => o.label)).toEqual(build('apple').options.map((o) => o.toUpperCase()));
  });

  it('rejects a question that is not one it could have built', () => {
    const good = build('hat');
    const bad: Partial<VocabChallengeSpec>[] = [
      { word: 'zzz' },
      { answer: 'x' },
      { options: ['h', 'h', 'a', 'b'] },
      { options: ['h', 'a', 'b'] },
      { options: ['H', 'a', 'b', 'c'] },
      { factKey: 'first:sun' },
    ];
    for (const change of bad) expect(skill.validate({ ...good, ...change })).toBe(false);
    expect(() => skill.build('first:zzz', createRng(1))).toThrow(/Unknown vocab fact/);
  });
});

describe('vocab subject', () => {
  const subject = createVocabSubject();
  const plan = (progress = subject.createProgress()) =>
    subject.planRound(progress, { roundNumber: 1, rng: createRng(5), count: 10, now: 0 });

  it('plans a round of valid first-letter questions', () => {
    const specs = plan();
    expect(specs).toHaveLength(10);
    for (const spec of specs) expect(subject.isValidSpec(spec)).toBe(true);
    expect(subject).toMatchObject({ id: 'vocab', badge: 'ABC' });
  });

  it('knows its own questions from other subjects’ and from damaged ones', () => {
    const spec = plan()[0]!;
    expect(subject.isValidSpec({ ...spec, subjectId: 'math' })).toBe(false);
    expect(subject.isValidSpec({ ...spec, skillId: 'nope' })).toBe(false);
    expect(subject.isValidSpec({ ...spec, options: [1, 2, 3, 4] })).toBe(false);
    expect(subject.isValidSpec(null)).toBe(false);
  });

  it('takes the tapped letter as the answer', () => {
    const spec = plan()[0]!;
    expect(subject.checkAnswer(spec, spec.answer)).toBe(true);
    expect(
      subject.checkAnswer(
        spec,
        spec.options.find((o) => o !== spec.answer)!,
      ),
    ).toBe(false);
    expect(subject.present(spec, { flavor: 'mint' }).correctAnswer).toBe(spec.answer);
  });

  it('keeps a record per word and reports it, with the words that need help', () => {
    const progress = subject.createProgress();
    const spec = plan(progress)[0]!;
    subject.recordOutcome(progress, spec, 'miss', { roundNumber: 1, now: 1 });
    expect(progress.firstLetter!.facts[spec.factKey]).toMatchObject({ missed: 1, presentations: 1 });
    const report = subject.progressReport(progress);
    expect(report[0]).toMatch(/^First letter: 0 mastered/);
    expect(report[report.length - 1]).toBe(`Words to practice: ${spec.word}`);
    expect(subject.progressReport(subject.createProgress()).at(-1)).toBe('Words to practice: none yet');
  });

  it('only builds skills it knows', () => {
    expect(() => createVocabSkills(['spelling'])).toThrow(/Unknown vocab skill/);
    expect(() => createVocabSkills([])).toThrow(/at least one/);
  });
});

describe('word pictures', () => {
  it('has a picture for every word, each a whole 14x14 grid of known colours', () => {
    for (const { picture } of GAME_CONFIG.vocab.words) {
      const rows = WORD_ART[picture];
      expect(rows, picture).toBeDefined();
      expect(rows).toHaveLength(WORD_ART_SIZE);
      for (const row of rows!) expect(row).toHaveLength(WORD_ART_SIZE);
      expect(rows!.join('')).toMatch(/^[.xrRgyYbBwknNcaAls]+$/);
    }
  });
});

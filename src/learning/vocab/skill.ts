/**
 * The contract every vocabulary skill implements, like MathOperation for math.
 * A skill owns its fact table, how its questions are built and checked, and
 * how they are presented; the vocab subject only wires skills together.
 *
 * Adding a skill:
 *   1. write `mySkill.ts` exporting a `create...(vocab)` that returns a VocabSkill
 *   2. add it to `createVocabSkills()` in registry.ts
 *   3. put its id in a game's `skills` in GAME_CONFIG.grades
 */
import type { Rng } from '../../core/rng';
import type { CatalogFact } from '../adaptiveEngine';
import type { ChallengePresentation, ChallengeSpec } from '../types';

export interface VocabChallengeSpec extends ChallengeSpec {
  subjectId: 'vocab';
  /** The skill id, e.g. "firstLetter". */
  skillId: string;
  /** The word as read: "apple". */
  word: string;
  /** What the buttons offer, in the order shown. Fixed when the round is planned, so a resumed order looks the same. */
  options: string[];
  /** The id of the right button. */
  answer: string;
  /** How many the order asks for ("2 pink"), for skills that read an order. */
  count?: number;
}

export interface VocabSkill {
  /** Skill id, also the key of this skill's progress in the save. */
  readonly id: string;
  /** Shown to grown-ups, e.g. "First letter". */
  readonly label: string;
  facts(): readonly CatalogFact[];
  /** Builds the question for one fact; `rng` picks the wrong answers and their order. */
  build(factKey: string, rng: Rng): VocabChallengeSpec;
  /** True when the spec is one this skill could have built, under today's word list. */
  validate(spec: VocabChallengeSpec): boolean;
  present(spec: VocabChallengeSpec): ChallengePresentation;
  /** A fact key shown to grown-ups: "apple". */
  formatKey(factKey: string): string;
}

/**
 * Vocabulary (reading) as a LearningSubject. Like math, each skill keeps its
 * own adaptive record, and everything about a question comes from the skill
 * (src/learning/vocab/); this file wires them into the subject contract.
 */
import { GAME_CONFIG, type AdaptiveConfig } from '../../config/gameConfig';
import { planRound, recordOutcome, summarizeSkill, type SkillPool } from '../adaptiveEngine';
import { skillLine, trickyFacts } from '../skillReport';
import type { LearningSubject, PlanContext, SkillProgress } from '../types';
import { createVocabSkills, type SkillRegistry } from './registry';
import type { VocabChallengeSpec } from './skill';

/** One adaptive record per skill id. Skills turned on later start empty. */
export type VocabProgress = Record<string, SkillProgress>;

export type VocabSubject = LearningSubject<VocabChallengeSpec, VocabProgress>;

export interface VocabSubjectOptions {
  adaptive?: AdaptiveConfig;
  /** The skills in play; the first skill when left out. */
  skills?: SkillRegistry;
  /** What the progress calendar files this subject's rounds under (see LearningSubject.gameType). */
  gameType?: string;
}

const skillProgress = (progress: VocabProgress, skillId: string): SkillProgress =>
  (progress[skillId] ??= { facts: {} });

export function createVocabSubject(options: VocabSubjectOptions = {}): VocabSubject {
  const adaptive = options.adaptive ?? GAME_CONFIG.adaptive;
  const skills = options.skills ?? createVocabSkills(['firstLetter']);

  const skill = (id: string) => {
    const found = skills.get(id);
    if (!found) throw new Error(`Unknown vocab skill "${id}"`);
    return found;
  };
  const pools = (progress: VocabProgress): SkillPool[] =>
    skills.enabled.map((s) => ({ skillId: s.id, progress: skillProgress(progress, s.id), catalog: s.facts() }));

  return {
    id: 'vocab',
    badge: 'ABC',
    gameType: options.gameType,

    createProgress: () => Object.fromEntries(skills.enabled.map((s) => [s.id, { facts: {} }])),

    planRound(progress: VocabProgress, ctx: PlanContext): VocabChallengeSpec[] {
      const plan = planRound(pools(progress), {
        roundNumber: ctx.roundNumber,
        rng: ctx.rng,
        count: ctx.count,
        config: adaptive,
      });
      return plan.map((item) => skill(item.skillId).build(item.factKey, ctx.rng));
    },

    isValidSpec: (spec: unknown): spec is VocabChallengeSpec =>
      isVocabSpec(spec) && !!skills.get(spec.skillId)?.validate(spec),

    present: (spec) => skill(spec.skillId).present(spec),

    checkAnswer: (spec, input) => input === spec.answer,

    recordOutcome(progress, spec, outcome, ctx) {
      recordOutcome(skillProgress(progress, spec.skillId), spec.factKey, outcome, ctx, adaptive);
    },

    progressReport(progress: VocabProgress): string[] {
      const lines = pools(progress).map((pool) => skillLine(skill(pool.skillId).label, summarizeSkill(pool)));
      const tricky = trickyFacts(progress, (id, key) => skills.get(id)?.formatKey(key) ?? key);
      return [...lines, `Words to practice: ${tricky.length ? tricky.join(', ') : 'none yet'}`];
    },
  };
}

function isVocabSpec(spec: unknown): spec is VocabChallengeSpec {
  const s = spec as Partial<VocabChallengeSpec> | null;
  return (
    typeof s === 'object' &&
    s !== null &&
    s.subjectId === 'vocab' &&
    typeof s.skillId === 'string' &&
    typeof s.factKey === 'string' &&
    typeof s.word === 'string' &&
    typeof s.answer === 'string' &&
    Array.isArray(s.options) &&
    s.options.every((o) => typeof o === 'string')
  );
}

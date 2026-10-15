/** The lines every subject's progress report is made of: a count per skill, and the facts that need help. */
import type { SkillSummary } from './adaptiveEngine';
import type { SkillProgress } from './types';

export const skillLine = (label: string, s: SkillSummary): string =>
  `${label}: ${s.mastered} mastered · ${s.practicing} practicing · ${s.learning} learning · ${s.unseen} not seen yet`;

/** Facts that needed help and are not yet mastered, most troublesome first, worded by `format(skillId, factKey)`. */
export function trickyFacts(
  progress: Record<string, SkillProgress>,
  format: (skillId: string, factKey: string) => string,
  limit = 6,
): string[] {
  const trouble = (r: { missed: number; retryCorrect: number }) => r.missed * 2 + r.retryCorrect;
  return Object.entries(progress)
    .flatMap(([skillId, skill]) => Object.values(skill.facts).map((r) => ({ skillId, r })))
    .filter(({ r }) => trouble(r) > 0 && r.state !== 'mastered')
    .sort((a, b) => trouble(b.r) - trouble(a.r))
    .slice(0, limit)
    .map(({ skillId, r }) => format(skillId, r.key));
}

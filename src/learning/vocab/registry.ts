/** The vocabulary skills the game knows about, built from GAME_CONFIG.vocab. */
import { GAME_CONFIG, type VocabConfig } from '../../config/gameConfig';
import { createFirstLetter } from './firstLetter';
import { createReadOrder } from './readOrder';
import { createWordToPicture } from './wordToPicture';
import type { VocabSkill } from './skill';

export interface SkillRegistry {
  all: readonly VocabSkill[];
  /** The skills a game's rounds are made of. */
  enabled: readonly VocabSkill[];
  get(id: string): VocabSkill | undefined;
}

export function createVocabSkills(
  enabledIds: readonly string[],
  vocab: VocabConfig = GAME_CONFIG.vocab,
): SkillRegistry {
  const all = [createFirstLetter(vocab), createReadOrder(vocab), createWordToPicture(vocab)];
  const byId = new Map(all.map((skill) => [skill.id, skill]));
  const enabled = enabledIds.map((id) => {
    const skill = byId.get(id);
    if (!skill) throw new Error(`Unknown vocab skill "${id}" in config`);
    return skill;
  });
  if (enabled.length === 0) throw new Error('Enable at least one vocab skill');
  return { all, enabled, get: (id) => byId.get(id) };
}

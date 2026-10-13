/**
 * The grown-ups area's reset actions, as plain changes to the save. The
 * scene only confirms, calls one of these, writes the save and restarts.
 */
import type { ChallengeSpec, LearningSubject } from '../learning/types';
import { createProfile } from './saveManager';
import { resetSubjectProgress, type Profile, type SaveFile } from './saveTypes';

type Subject = Pick<LearningSubject<ChallengeSpec, unknown>, 'id' | 'createProgress'>;

/** Clears the subject's practice progress and the round in play. Sprinkles, items and history stay. */
export function resetLearning(profile: Profile, subject: Subject): void {
  resetSubjectProgress(profile, subject);
  profile.learning.roundsStarted = 0;
  profile.currentRound = null;
}

/** Starts the active player over under the same name; any other players are left alone. */
export function resetProfile(save: SaveFile, now: number): Profile {
  const old = save.profiles[save.activeProfileId];
  const fresh = createProfile(old?.displayName ?? 'Player 1', now);
  delete save.profiles[save.activeProfileId];
  save.profiles[fresh.id] = fresh;
  save.activeProfileId = fresh.id;
  return fresh;
}

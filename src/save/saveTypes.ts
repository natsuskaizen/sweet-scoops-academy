/**
 * Persisted data shapes. Bump SAVE_SCHEMA_VERSION and add a migration in
 * saveManager.ts whenever these change incompatibly.
 */
import type { MathProgress } from '../learning/mathSubject';
import type { AttemptOutcome, ChallengeSpec, LearningSubject } from '../learning/types';
import type { EquipSlot, ShopSpot } from '../shop/catalog';
import type { RoundBonus } from '../shop/rewards';

export const SAVE_SCHEMA_VERSION = 2;

export interface OrderState {
  /** Checked by the owning subject's isValidSpec on load. */
  spec: ChallengeSpec;
  customerId: string;
  /** Wrong answers so far are attempts - (outcome ? 1 : 0). */
  attempts: number;
  outcome: AttemptOutcome | null;
  paid: boolean;
  sprinklesPaid: number;
}

export interface RoundState {
  id: string;
  roundNumber: number;
  seed: number;
  startedAt: number;
  /** Active play time so far; null for a round started before play time was recorded. */
  playMs: number | null;
  /** Last answer or step, so the next one knows how long the gap was. */
  lastActiveAt: number;
  orders: OrderState[];
  currentIndex: number;
  bonusPaid: boolean;
  bonus: RoundBonus | null;
}

export interface RoundSummary {
  roundNumber: number;
  /** Null for rounds saved before start times were recorded. */
  startedAt: number | null;
  finishedAt: number;
  /** Active play time (see GAME_CONFIG.round.playTimeIdleCapMs); null if not recorded. */
  playMs: number | null;
  ordersCompleted: number;
  firstTryCorrect: number;
  retryCorrect: number;
  missed: number;
  orderSprinkles: number;
  completionBonus: number;
  perfectBonus: number;
  total: number;
  perfect: boolean;
  /** Questions as shown on the ticket (e.g. "7 × 8"), answered on the second try. */
  retryFacts: string[];
  /** Questions whose answer was shown after two misses. */
  missFacts: string[];
}

export interface PlacedDecoration {
  itemId: string;
  spot: ShopSpot;
}

export interface ProfileSettings {
  showHints: boolean;
  reduceMotion: boolean;
}

export interface Profile {
  id: string;
  displayName: string;
  createdAt: number;
  sprinkles: number;
  lifetimeSprinkles: number;
  ownedItems: string[];
  equipped: Partial<Record<EquipSlot, string>>;
  decorations: PlacedDecoration[];
  learning: {
    /** Seed for this child's question sequence; each round derives its own. */
    seed: number;
    roundsStarted: number;
    /** Progress per subject, keyed by subject id. */
    math: MathProgress;
  };
  currentRound: RoundState | null;
  roundHistory: RoundSummary[];
  achievements: string[];
  settings: ProfileSettings;
}

export interface SaveFile {
  schemaVersion: number;
  savedAt: number;
  activeProfileId: string;
  profiles: Record<string, Profile>;
}

/**
 * A subject's progress in a profile, stored under the subject's id and
 * created on first use, so new subjects need no save migration.
 */
export function subjectProgress<P>(
  profile: Profile,
  subject: Pick<LearningSubject<ChallengeSpec, P>, 'id' | 'createProgress'>,
): P {
  const store = profile.learning as unknown as Record<string, unknown>;
  return (store[subject.id] ??= subject.createProgress()) as P;
}

export function resetSubjectProgress(
  profile: Profile,
  subject: Pick<LearningSubject<ChallengeSpec, unknown>, 'id' | 'createProgress'>,
): void {
  (profile.learning as unknown as Record<string, unknown>)[subject.id] = subject.createProgress();
}

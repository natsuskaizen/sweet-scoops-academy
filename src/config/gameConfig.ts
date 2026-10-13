/**
 * Every tunable in one place. Game modules read their defaults from here, and
 * the Phaser-free ones also accept an override so tests (or a future grown-ups
 * screen) can change behaviour without editing code.
 *
 * To turn on addition and subtraction, add them to `math.enabledOperations`.
 */
import type { AttemptOutcome } from '../learning/types';

export interface RangeRule {
  min: number;
  max: number;
}

export interface MathConfig {
  /** Operations that appear in rounds, split evenly. Order is the parent-screen order. */
  enabledOperations: readonly string[];
  multiplication: { factor: RangeRule };
  division: { dividend: RangeRule; quotient: RangeRule; divisor: RangeRule };
  addition: { addend: RangeRule; maxSum: number };
  subtraction: { minuend: RangeRule; subtrahend: RangeRule; minDifference: number };
  /** How hard each times-table factor feels to a young learner (lower is easier). */
  factorTiers: Readonly<Record<number, number>>;
}

export interface AdaptiveConfig {
  /** How many recent outcomes to remember per fact. */
  recentWindow: number;
  /** Consecutive first-try rounds needed before a fact is mastered (must be >= 2). */
  masterySessions: number;
  /** Rounds before a mastered fact is reviewed again, growing to the max. */
  masteredBaseInterval: number;
  masteredMaxInterval: number;
  /** Rounds before a practicing fact comes back. */
  practicingInterval: { afterStreak: number; struggled: number; clean: number };
  /** Stop introducing new facts in a skill while this many are still "learning". */
  maxLearningBeforeNew: number;
  /** Soft cap on new facts per round (ignored if nothing else is available). */
  maxNewPerRound: number;
  /** How many easiest unseen facts to choose between when introducing one. */
  newFactChoices: number;
  /** Target composition of a round. Flexible, not quotas. */
  composition: Record<'learning' | 'practicing' | 'mastered' | 'new', number>;
  /**
   * Skip-ahead for fluent learners: when recent first-try accuracy in a skill
   * is at least `accuracy` (over at least `minSamples` facts), new facts come
   * from `step` difficulty levels above the hardest fact already answered
   * first try, instead of from the easiest unseen facts.
   */
  stretch: { minSamples: number; accuracy: number; step: number; lookbackRounds: number };
}

export interface RewardConfig {
  perOrder: Record<AttemptOutcome, number>;
  completionBonus: number;
  perfectBonus: number;
}

export interface GameConfig {
  round: {
    ordersPerRound: number;
    /** Answers allowed per order before the answer is shown and explained. */
    attemptsPerOrder: number;
    /**
     * Play time counts at most this much for any gap between taps, so a round
     * left open overnight shows minutes of play, not hours.
     */
    playTimeIdleCapMs: number;
  };
  rewards: RewardConfig;
  adaptive: AdaptiveConfig;
  math: MathConfig;
  backup: {
    /** Larger files are refused before reading; a real backup is a few KB. */
    maxImportBytes: number;
  };
  parentArea: {
    /** Round cards per page in the grown-ups "Rounds" view (a 2x2 grid). */
    roundCardsPerPage: number;
    /** Questions named on a round card before "+N more". */
    cardPracticeFacts: number;
    /** Bars in the "Overview" chart, one per recent round. */
    chartRounds: number;
    /** The "Overview" tiles cover this many days back from now. */
    overviewDays: number;
    /** "Needs practice" looks at this many recent rounds... */
    practiceLookbackRounds: number;
    /** ...and lists at most this many questions. */
    practiceFacts: number;
  };
  timing: {
    /** How long to hold the ⚙ button to open the grown-ups area. */
    parentHoldMs: number;
    /** Pause between a customer's greeting and their order. */
    greetingMs: number;
  };
}

export const GAME_CONFIG: GameConfig = {
  round: { ordersPerRound: 10, attemptsPerOrder: 2, playTimeIdleCapMs: 120_000 },
  rewards: {
    perOrder: { first: 10, retry: 5, miss: 2 },
    completionBonus: 10,
    perfectBonus: 50,
  },
  adaptive: {
    recentWindow: 6,
    masterySessions: 3,
    masteredBaseInterval: 3,
    masteredMaxInterval: 8,
    practicingInterval: { afterStreak: 3, struggled: 1, clean: 2 },
    maxLearningBeforeNew: 8,
    maxNewPerRound: 6,
    newFactChoices: 3,
    composition: { learning: 4, practicing: 3, mastered: 2, new: 1 },
    stretch: { minSamples: 4, accuracy: 0.85, step: 4, lookbackRounds: 2 },
  },
  math: {
    enabledOperations: ['multiplication', 'division'],
    // Hard limits from the spec (section 5).
    multiplication: { factor: { min: 1, max: 11 } },
    division: {
      dividend: { min: 10, max: 99 },
      quotient: { min: 1, max: 10 },
      // The spec only requires a positive divisor; practice sticks to times-table divisors.
      divisor: { min: 1, max: 12 },
    },
    addition: { addend: { min: 1, max: 10 }, maxSum: 20 },
    subtraction: { minuend: { min: 2, max: 20 }, subtrahend: { min: 1, max: 10 }, minDifference: 0 },
    // ×1, ×2, ×10 are easiest, then ×5 ×11, then ×3 ×4, then ×9, then ×6 ×7 ×8 ×12.
    factorTiers: { 1: 0, 2: 1, 10: 1, 5: 2, 11: 2, 3: 3, 4: 3, 9: 4, 6: 5, 7: 5, 8: 5, 12: 5 },
  },
  backup: { maxImportBytes: 1_000_000 },
  parentArea: {
    roundCardsPerPage: 4,
    cardPracticeFacts: 3,
    chartRounds: 10,
    overviewDays: 7,
    practiceLookbackRounds: 5,
    practiceFacts: 8,
  },
  timing: { parentHoldMs: 1200, greetingMs: 900 },
};

/**
 * Every tunable in one place. Game modules read their defaults from here, and
 * the Phaser-free ones also accept an override so tests (or a future grown-ups
 * screen) can change behaviour without editing code.
 *
 * Which operations a player practises comes from their grade (`grades`);
 * `math.enabledOperations` is the default for code and tests that pass no grade.
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
  /** How many scoops a "how many?" cone can have. */
  counting: { count: RangeRule };
  /** How hard each times-table factor feels to a young learner (lower is easier). */
  factorTiers: Readonly<Record<number, number>>;
}

/** A word a young reader practises, with the picture that stands for it. */
export interface VocabWord {
  word: string;
  /** A key in src/characters/wordArt.ts. */
  picture: string;
}

export interface VocabConfig {
  /** Words with a picture; every vocab game is built from them. */
  words: readonly VocabWord[];
  /** Buttons on a first-letter question: the right letter and this many minus one wrong ones. */
  letterChoices: number;
}

/** One game a child can pick for a round, e.g. "Grouping". */
export interface GradeGame {
  id: string;
  /** Shown on the pick-a-game card. */
  label: string;
  /** A few characters that stand for the game on its card: "×", "123". */
  symbol: string;
  /** One short line under the label. */
  hint: string;
  /** The subject this game practises: 'math' or 'vocab'. */
  subject: string;
  /** The skills it puts in rounds, split evenly: math operations (as `math.enabledOperations`), or vocab skills. */
  skills: readonly string[];
}

export interface GradeLevel {
  id: string;
  label: string;
  /** This grade's number ranges, in place of the ones in `math`. */
  math: Partial<Omit<MathConfig, 'enabledOperations'>>;
  /** The games to pick from, in the order shown. A grade with one game skips the picking. */
  games: readonly GradeGame[];
  /** The game a player has on moving to this grade, until they pick (the first when left out). */
  startGame?: string;
  /** Players can't read yet: orders are drawn as pictures and number keys show dots. */
  preReaders?: boolean;
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

/** One music-box note: a step on the shop's scale, when it starts and how long it rings (seconds). */
export interface SoundNote {
  /** Steps up the pentatonic scale from `sound.scaleRootHz` (5 steps make an octave). */
  step: number;
  at: number;
  length: number;
  /** 0 to 1, before the master volume. */
  loudness: number;
}

/** A soft pitch slide with no scale note, like a scoop plopping onto a cone. */
export interface SoundGlide {
  at: number;
  fromHz: number;
  toHz: number;
  /** Time to slide from one pitch to the other. */
  slide: number;
  length: number;
  loudness: number;
}

export interface SoundCue {
  notes?: readonly SoundNote[];
  glides?: readonly SoundGlide[];
}

export type SoundCueId = 'keyTap' | 'keyBack' | 'submit' | 'doorBell' | 'scoopPlop' | 'orderServed' | 'sprinkles';

/** One sine partial of the music-box voice: its pitch as a multiple of the note's, and how it fades. */
export interface SoundPartial {
  ratio: number;
  gain: number;
  /** Fade time is `decay` plus `decayPerLength` times the note's length. */
  decay: number;
  decayPerLength: number;
}

export interface SoundConfig {
  /** Master volume, 0 to 1. Kept low so sounds stay well under a device's normal media volume. */
  volume: number;
  /** A gentle lowpass on everything, so nothing sounds sharp. */
  lowpassHz: number;
  /** A soft limiter after the lowpass, so sounds that overlap never get loud. */
  limiter: { thresholdDb: number; kneeDb: number; ratio: number };
  /** Step 0 of the scale (middle C). */
  scaleRootHz: number;
  /** Semitones of the one scale every note comes from (C major pentatonic), so overlapping sounds never clash. */
  scale: readonly number[];
  /** Every note fades in over this long, which keeps starts soft. */
  attack: number;
  /** The music-box voice Stan picked from the sampler. */
  voice: readonly SoundPartial[];
  /** Each play is nudged up or down by up to this many cents, so repeated taps don't sound mechanical. */
  jitterCents: number;
  cues: Readonly<Record<SoundCueId, SoundCue>>;
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
  vocab: VocabConfig;
  /** The grades a grown-up can choose for each player, in the order shown. */
  grades: {
    /** New players, and every player from before grades, start here. */
    defaultGrade: string;
    levels: readonly GradeLevel[];
  };
  backup: {
    /** Larger files are refused before reading; a real backup is a few KB (more with added characters). */
    maxImportBytes: number;
  };
  /** Characters a grown-up adds from their own pictures (see README, "Adding your own characters"). */
  addedCharacters: {
    maxCharacters: number;
    /** Picture files larger than this are refused before reading. */
    maxFileBytes: number;
    /** The picture is re-encoded on import; larger results are refused, which keeps saves and backups small. */
    maxStoredBytes: number;
    /** Allowed frame sizes are the built-in 16x20 grid times one of these. */
    frameMultiples: readonly number[];
    /** Frame counts a picture may have: standing, happy, thinking, walk A, walk B. */
    frameCounts: readonly number[];
    maxNameLength: number;
    maxLines: number;
    maxLineLength: number;
  };
  /** The children who play on this device, each with their own shop. */
  players: {
    maxPlayers: number;
    maxNameLength: number;
    maxShopNameLength: number;
    /** The name a new game's first player has until they type their own. */
    firstPlayerName: string;
    /** The shop a player has before choosing their own (and every save from before players chose). */
    defaultShop: { name: string; keeper: string };
    /** The friends a new player can choose to work behind their counter, in the order shown. */
    starterKeepers: readonly string[];
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
  /** The kids' progress calendar: a heart stamp on each day the goal is reached. */
  calendar: {
    /**
     * Different games (finished rounds of different kinds, e.g. grouping then sharing) in a day for a
     * heart, until a grown-up picks another goal. Never more than the games the player's grade has.
     */
    defaultDailyGoal: number;
    /** The goals a grown-up can choose from. */
    dailyGoal: { min: number; max: number };
    /** Days kept in the log (about 13 months), so the save stays small. */
    keepDays: number;
  };
  timing: {
    /** How long to hold the ⚙ button to open the grown-ups area. */
    parentHoldMs: number;
    /** Pause between a customer's greeting and their order. */
    greetingMs: number;
    /** Explanation boards: time between filling one cup and the next... */
    aidFillMs: number;
    /** ...and between dealing rounds when sharing scoops into cups. */
    aidDealMs: number;
    /** Perfect-round parade: time between customers setting off from the door... */
    paradeStepMs: number;
    /** ...and how long they cheer before the results card appears. */
    paradeCheerMs: number;
    /** After a first miss: pause on the hint before the keypad clears for another go. */
    retryPauseMs: number;
    /** How long the served treat takes to reach the customer. */
    handOffMs: number;
    /** How long the customer stays to thank and pay before leaving. */
    payMs: number;
    /** How long a notice (save problems) stays on screen before fading. */
    toastMs: number;
  };
  /** Character animation in the shop. */
  animation: {
    /** One walking step: a foot lifts and the body sways. */
    stepMs: number;
    /** Idle breathing: one breath in (or out). */
    breatheMs: number;
    /** How long a blink keeps the eyes closed... */
    blinkMs: number;
    /** ...and the gap between blinks, picked between these. */
    blinkGapMs: { min: number; max: number };
    /** Serving: the shopkeeper reaches into a tub... */
    scoopReachMs: number;
    /** ...then carries the scoop over to the cone. */
    scoopCarryMs: number;
  };
  /** Sound effects, made in the browser (no audio files). Sounds always go with something shown on screen. */
  sound: SoundConfig;
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
    counting: { count: { min: 1, max: 10 } },
    // ×1, ×2, ×10 are easiest, then ×5 ×11, then ×3 ×4, then ×9, then ×6 ×7 ×8 ×12.
    factorTiers: { 1: 0, 2: 1, 10: 1, 5: 2, 11: 2, 3: 3, 4: 3, 9: 4, 6: 5, 7: 5, 8: 5, 12: 5 },
  },
  vocab: {
    // Three-letter words are easiest. Every picture is drawn in src/characters/wordArt.ts.
    words: [
      { word: 'sun', picture: 'sun' },
      { word: 'hat', picture: 'hat' },
      { word: 'cup', picture: 'cup' },
      { word: 'cat', picture: 'cat' },
      { word: 'dog', picture: 'dog' },
      { word: 'bus', picture: 'bus' },
      { word: 'egg', picture: 'egg' },
      { word: 'ball', picture: 'ball' },
      { word: 'fish', picture: 'fish' },
      { word: 'moon', picture: 'moon' },
      { word: 'star', picture: 'star' },
      { word: 'apple', picture: 'apple' },
    ],
    letterChoices: 4,
  },
  grades: {
    defaultGrade: 'grade3',
    levels: [
      {
        id: 'kindergarten',
        label: 'Kindergarten',
        // Counting and adding within 5 first (Common Core K fluency); within 10 comes later.
        math: {
          addition: { addend: { min: 1, max: 4 }, maxSum: 5 },
          counting: { count: { min: 1, max: 5 } },
        },
        games: [
          {
            id: 'counting',
            label: 'How many?',
            symbol: '123',
            hint: 'Count the scoops',
            subject: 'math',
            skills: ['counting'],
          },
          {
            id: 'adding',
            label: 'Adding',
            symbol: '+',
            hint: 'Put scoops together',
            subject: 'math',
            skills: ['addition'],
          },
          {
            id: 'mixed',
            label: 'Mix it up',
            symbol: '1+',
            hint: 'A bit of both',
            subject: 'math',
            skills: ['counting', 'addition'],
          },
          {
            id: 'letters',
            label: 'First letter',
            symbol: 'Aa',
            hint: 'Which letter does it start with?',
            subject: 'vocab',
            skills: ['firstLetter'],
          },
        ],
        startGame: 'mixed',
        preReaders: true,
      },
      {
        id: 'grade3',
        label: '3rd grade',
        math: {},
        games: [
          {
            id: 'multiplication',
            label: 'Grouping',
            symbol: '×',
            hint: 'Groups of scoops',
            subject: 'math',
            skills: ['multiplication'],
          },
          {
            id: 'division',
            label: 'Sharing',
            symbol: '÷',
            hint: 'Share scoops fairly',
            subject: 'math',
            skills: ['division'],
          },
          {
            id: 'mixed',
            label: 'Mix it up',
            symbol: '×÷',
            hint: 'A bit of both',
            subject: 'math',
            skills: ['multiplication', 'division'],
          },
        ],
        startGame: 'mixed',
      },
    ],
  },
  backup: { maxImportBytes: 2_000_000 },
  addedCharacters: {
    maxCharacters: 12,
    maxFileBytes: 300_000,
    maxStoredBytes: 100_000,
    frameMultiples: [1, 2, 3, 4],
    frameCounts: [1, 2, 3, 5],
    maxNameLength: 12,
    maxLines: 3,
    maxLineLength: 24,
  },
  players: {
    maxPlayers: 6,
    maxNameLength: 12,
    maxShopNameLength: 28,
    firstPlayerName: 'Player 1',
    defaultShop: { name: 'Sweet Scoops', keeper: 'momo' },
    starterKeepers: ['momo', 'bonbon', 'kiki', 'mallow', 'pom', 'lulu'],
  },
  parentArea: {
    roundCardsPerPage: 4,
    cardPracticeFacts: 3,
    chartRounds: 10,
    overviewDays: 7,
    practiceLookbackRounds: 5,
    practiceFacts: 8,
  },
  calendar: { defaultDailyGoal: 3, dailyGoal: { min: 1, max: 5 }, keepDays: 400 },
  timing: {
    parentHoldMs: 1200,
    greetingMs: 900,
    aidFillMs: 450,
    aidDealMs: 650,
    paradeStepMs: 220,
    paradeCheerMs: 2600,
    retryPauseMs: 450,
    handOffMs: 450,
    payMs: 1300,
    toastMs: 4000,
  },
  animation: {
    stepMs: 160,
    breatheMs: 1100,
    blinkMs: 140,
    blinkGapMs: { min: 2400, max: 5200 },
    scoopReachMs: 150,
    scoopCarryMs: 230,
  },
  sound: {
    volume: 0.45,
    lowpassHz: 5200,
    limiter: { thresholdDb: -14, kneeDb: 12, ratio: 4 },
    scaleRootHz: 261.63,
    scale: [0, 2, 4, 7, 9],
    attack: 0.004,
    voice: [
      { ratio: 1, gain: 0.34, decay: 0.25, decayPerLength: 0.9 },
      { ratio: 2, gain: 0.06, decay: 0.08, decayPerLength: 0.35 },
      { ratio: 5.04, gain: 0.03, decay: 0.06, decayPerLength: 0 },
    ],
    jitterCents: 12,
    cues: {
      keyTap: { notes: [{ step: 9, at: 0, length: 0.25, loudness: 0.55 }] },
      keyBack: { notes: [{ step: 6, at: 0, length: 0.25, loudness: 0.45 }] },
      submit: {
        notes: [
          { step: 7, at: 0, length: 0.4, loudness: 0.6 },
          { step: 9, at: 0.06, length: 0.5, loudness: 0.6 },
        ],
      },
      doorBell: {
        notes: [
          { step: 12, at: 0, length: 1.4, loudness: 0.7 },
          { step: 9, at: 0.16, length: 1.6, loudness: 0.6 },
        ],
      },
      scoopPlop: { glides: [{ at: 0, fromHz: 260, toHz: 620, slide: 0.07, length: 0.16, loudness: 0.38 }] },
      orderServed: {
        notes: [
          { step: 7, at: 0, length: 0.6, loudness: 0.7 },
          { step: 9, at: 0.1, length: 0.6, loudness: 0.7 },
          { step: 12, at: 0.2, length: 1.2, loudness: 0.8 },
        ],
      },
      sprinkles: {
        notes: [
          { step: 12, at: 0, length: 0.4, loudness: 0.45 },
          { step: 14, at: 0.05, length: 0.4, loudness: 0.4 },
          { step: 13, at: 0.1, length: 0.4, loudness: 0.4 },
          { step: 15, at: 0.15, length: 0.6, loudness: 0.45 },
        ],
      },
    },
  },
};

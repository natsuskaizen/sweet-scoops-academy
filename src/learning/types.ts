/**
 * Subject-agnostic learning types.
 *
 * The shop (customers, orders, rewards, UI) only talks to a `LearningSubject`
 * through these types, so a future vocabulary or spelling subject can plug in
 * without touching shop code. Math is just the first implementation
 * (see mathSubject.ts).
 */
import type { Rng } from '../core/rng';

// ---------------------------------------------------------------------------
// Adaptive learning records (shared by every subject that tracks "facts")
// ---------------------------------------------------------------------------

export type LearningState = 'learning' | 'practicing' | 'mastered';

/** How a single presented challenge was resolved. */
export type AttemptOutcome =
  | 'first' // correct on the first attempt
  | 'retry' // correct on the second attempt, after a hint
  | 'miss'; // wrong twice; the answer was shown and explained

export interface FactRecord {
  /** Stable key, e.g. "mul:5x6" (commutative pair) or "div:30/5". */
  key: string;
  state: LearningState;
  presentations: number;
  firstTryCorrect: number;
  retryCorrect: number;
  missed: number;
  /** Most recent outcomes, oldest first, capped by config.recentWindow. */
  recent: AttemptOutcome[];
  /** Epoch ms of the last presentation. */
  lastPresentedAt: number;
  lastPresentedRound: number;
  /** Round number at which this fact is next due for practice. */
  nextDueRound: number;
  /** Consecutive rounds in which this fact was answered correctly first try. */
  successStreak: number;
  introducedRound: number;
}

/** All tracked facts for one skill (e.g. multiplication) for one child. */
export interface SkillProgress {
  facts: Record<string, FactRecord>;
}

// ---------------------------------------------------------------------------
// Generic challenge interface
// ---------------------------------------------------------------------------

/**
 * Serializable description of one challenge. Stored in the save file so an
 * interrupted round resumes with exactly the same questions.
 */
export interface ChallengeSpec {
  subjectId: string;
  /** Which independent skill record this belongs to (e.g. "multiplication"). */
  skillId: string;
  /** Key of the FactRecord this challenge practices. */
  factKey: string;
}

/** One tappable answer of a `choice` input. `id` is what `correctAnswer` and `checkAnswer` see. */
export interface ChoiceOption {
  id: string;
  /** Words or a letter on the button: "A", "pink". */
  label?: string;
  /** A little picture on the button: a key from src/characters/wordArt.ts. */
  picture?: string;
  /** A coloured disc on the button: a CSS colour. */
  swatch?: string;
}

/**
 * How the player answers. Either they type a number, or they tap one of a few
 * choices. `dots` puts dots under each number key, so a child who can count
 * but not yet read numbers can match a count to its key.
 */
export type AnswerInput =
  { kind: 'integer'; maxDigits: number; dots?: boolean } | { kind: 'choice'; options: readonly ChoiceOption[] };

/**
 * An order drawn as a picture, for players who can't read yet. Data only;
 * the shop draws it.
 */
export type OrderPicture =
  /** A cone stacked with `scoops` whole scoops: "how many?" */
  | { kind: 'cone'; scoops: number }
  /** Piles of scoops joined by plus signs: "put them together". */
  | { kind: 'piles'; parts: number[] }
  /** A little picture (a key from src/characters/wordArt.ts), with `word` beside it on the ticket. */
  | { kind: 'sprite'; key: string; word?: string };

/**
 * Data-only description of a visual hint or explanation. The shop renders
 * these; subjects never touch Phaser.
 */
export type VisualAid =
  /** `groups` cups each holding `perGroup` scoops. */
  | { kind: 'groups'; groups: number; perGroup: number; showTotal: boolean; caption: string }
  /** `total` scoops shared into `groups` cups; perGroup=null means "not shared yet" (hint). */
  | { kind: 'share'; total: number; groups: number; perGroup: number | null; caption: string }
  /** Separate piles of scoops (addition); showTotal adds a running total under each. */
  | { kind: 'combine'; parts: number[]; showTotal: boolean; caption: string }
  /** `total` scoops with `remove` of them taken away (subtraction); showResult crosses them out. */
  | { kind: 'takeAway'; total: number; remove: number; showResult: boolean; caption: string }
  /** `total` scoops in rows of 5 to count; showNumbers counts them out one by one (explanation). */
  | { kind: 'count'; total: number; showNumbers: boolean; caption: string }
  /** A word to read, with its picture; the first `lit` letters are lit up. */
  | { kind: 'word'; word: string; picture?: string; lit: number; caption: string }
  | { kind: 'text'; caption: string };

/** Customer-flavoured context the shop passes in so order text can be themed. */
export interface OrderContext {
  flavor: string;
}

export interface ChallengePresentation {
  /** Prominent, unambiguous prompt, e.g. "5 × 6". */
  expression: string;
  /** Short natural-language order line for the customer's speech bubble. */
  orderLine: string;
  /** Drawn in the speech bubble instead of `orderLine`, for players who can't read yet. */
  orderPicture?: OrderPicture;
  /** Drawn on the ticket instead of `expression` (which stays the grown-ups' record of the question). */
  ticketPicture?: OrderPicture;
  answerInput: AnswerInput;
  correctAnswer: string;
  hint: VisualAid;
  explanation: VisualAid;
}

export interface PlanContext {
  roundNumber: number;
  rng: Rng;
  /** Epoch ms, injected for testability. */
  now: number;
  count: number;
}

export interface OutcomeContext {
  roundNumber: number;
  now: number;
}

/**
 * A pluggable subject. `P` is the subject's own persisted progress shape.
 */
export interface LearningSubject<S extends ChallengeSpec, P> {
  readonly id: string;
  /** A few characters a young child can recognise, shown on the progress calendar (e.g. "123", "ABC"). */
  readonly badge: string;
  /**
   * Which game this is within the subject (grouping, sharing, ...). The
   * progress calendar asks for a heart's games to be different from each
   * other; a subject with no game types counts every round as the same game.
   */
  readonly gameType?: string;
  createProgress(): P;
  /** Choose `ctx.count` challenges for the next round, adapting to `progress`. */
  planRound(progress: P, ctx: PlanContext): S[];
  /** Runtime check used before displaying a challenge and when loading saves. */
  isValidSpec(spec: unknown): spec is S;
  present(spec: S, ctx: OrderContext): ChallengePresentation;
  checkAnswer(spec: S, input: string): boolean;
  /** Mutates `progress` to record how the challenge went. */
  recordOutcome(progress: P, spec: S, outcome: AttemptOutcome, ctx: OutcomeContext): void;
  /** Read-only lines about this child's progress for the grown-ups area. */
  progressReport(progress: P): string[];
}

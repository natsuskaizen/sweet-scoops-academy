/**
 * Round and order state machine. No Phaser here: the ShopScene asks this
 * class what to show and reports what the player did. Every state change that
 * matters (an answer, a payout, moving to the next customer) is persisted
 * before the method returns, so a reload resumes exactly where play stopped.
 *
 *   ensureRound() -> current() -> submit(answer)* -> finishOrder() -> ... x10
 *                                                  -> RoundSummary
 */
import { GAME_CONFIG } from '../config/gameConfig';
import { createRng, mixSeed } from '../core/rng';
import type { AttemptOutcome, ChallengePresentation, ChallengeSpec, LearningSubject } from '../learning/types';
import {
  subjectProgress,
  type OrderState,
  type Profile,
  type RoundState,
  type RoundSummary,
  type SaveFile,
} from '../save/saveTypes';
import { CUSTOMERS, customerById, lineup, type CustomerDef } from './customerManager';
import { recordRound } from './progressCalendar';
import { payOrder, payRoundBonus, type RoundBonus } from './rewards';

export type OrderPhase =
  | 'answering' // waiting for the first answer
  | 'retrying' // first answer was wrong; hint shown, one more try
  | 'resolved'; // paid out; ready to serve and move on

export interface ActiveOrder {
  index: number;
  total: number;
  order: OrderState;
  customer: CustomerDef;
  presentation: ChallengePresentation;
  phase: OrderPhase;
}

export type SubmitResult =
  | { kind: 'ignored' }
  | { kind: 'try-again'; presentation: ChallengePresentation }
  | { kind: 'resolved'; outcome: AttemptOutcome; sprinkles: number; presentation: ChallengePresentation };

/** One customer served this round, for the results card: a gold star for a first-try answer. */
export interface RoundSticker {
  customer: CustomerDef;
  firstTry: boolean;
}

export type FinishResult =
  | { kind: 'ignored' }
  | { kind: 'next-order' }
  | {
      kind: 'round-complete';
      summary: RoundSummary;
      stickers: RoundSticker[];
      /** This round reached today's goal on the progress calendar. */
      heartEarned: boolean;
    };

export interface Persister {
  write(save: SaveFile): { ok: true } | { ok: false; error: string };
}

export interface OrderManagerOptions {
  save: SaveFile;
  persister: Persister;
  /** Any subject: the manager never looks inside its specs or progress. */
  subject: LearningSubject<ChallengeSpec, unknown>;
  now?: () => number;
  ordersPerRound?: number;
  attemptsPerOrder?: number;
  playTimeIdleCapMs?: number;
  /** Who can visit: the built-in customers plus any a grown-up added. */
  roster?: readonly CustomerDef[];
  /** Called when a write fails, so the UI can warn a parent. */
  onSaveError?: (error: string) => void;
}

const MAX_HISTORY = 100;

export class OrderManager {
  private readonly now: () => number;
  private readonly ordersPerRound: number;
  private readonly attemptsPerOrder: number;
  private readonly idleCapMs: number;
  private readonly roster: readonly CustomerDef[];

  constructor(private readonly opts: OrderManagerOptions) {
    this.now = opts.now ?? (() => Date.now());
    this.ordersPerRound = opts.ordersPerRound ?? GAME_CONFIG.round.ordersPerRound;
    this.attemptsPerOrder = opts.attemptsPerOrder ?? GAME_CONFIG.round.attemptsPerOrder;
    this.idleCapMs = opts.playTimeIdleCapMs ?? GAME_CONFIG.round.playTimeIdleCapMs;
    this.roster = opts.roster ?? CUSTOMERS;
  }

  /** This subject's progress in the active profile. */
  private progress(): unknown {
    return subjectProgress(this.profile, this.opts.subject);
  }

  get save(): SaveFile {
    return this.opts.save;
  }

  get profile(): Profile {
    const profile = this.opts.save.profiles[this.opts.save.activeProfileId];
    if (!profile) throw new Error('Active profile missing');
    return profile;
  }

  /** Resumes the saved round, or plans and persists a new one. */
  ensureRound(): RoundState {
    const existing = this.profile.currentRound;
    if (existing) return existing;

    const profile = this.profile;
    const roundNumber = profile.learning.roundsStarted + 1;
    profile.learning.roundsStarted = roundNumber;
    profile.currentRound = this.planRound(roundNumber, mixSeed(profile.learning.seed, roundNumber));
    this.persist();
    return profile.currentRound;
  }

  private planRound(roundNumber: number, seed: number): RoundState {
    const rng = createRng(seed);
    const specs = this.opts.subject.planRound(this.progress(), {
      roundNumber,
      rng,
      now: this.now(),
      count: this.ordersPerRound,
    });
    const customers = lineup(rng, specs.length, this.roster);
    const startedAt = this.now();
    return {
      id: `r${roundNumber}-${seed.toString(36)}`,
      roundNumber,
      seed,
      startedAt,
      playMs: 0,
      lastActiveAt: startedAt,
      currentIndex: 0,
      bonusPaid: false,
      bonus: null,
      orders: specs.map((spec, i) => newOrder(spec, customers[i]!)),
    };
  }

  current(): ActiveOrder | null {
    const round = this.profile.currentRound;
    if (!round) return null;
    const order = round.orders[round.currentIndex];
    if (!order) return null;
    const customer = customerById(order.customerId, this.roster);
    return {
      index: round.currentIndex,
      total: round.orders.length,
      order,
      customer,
      presentation: this.opts.subject.present(order.spec, { flavor: customer.favoriteFlavor }),
      phase: order.outcome !== null ? 'resolved' : order.attempts === 0 ? 'answering' : 'retrying',
    };
  }

  /**
   * Checks an answer. Safe to call repeatedly: once an order is resolved,
   * further submits are ignored and nothing is paid again.
   */
  submit(input: string): SubmitResult {
    const active = this.current();
    if (!active || active.phase === 'resolved' || input.trim() === '') return { kind: 'ignored' };

    const { order, presentation } = active;
    this.trackPlayTime(this.profile.currentRound!);
    order.attempts += 1;
    const correct = this.opts.subject.checkAnswer(order.spec, input);

    if (!correct && order.attempts < this.attemptsPerOrder) {
      this.persist();
      return { kind: 'try-again', presentation };
    }

    const outcome: AttemptOutcome = correct ? (order.attempts === 1 ? 'first' : 'retry') : 'miss';
    order.outcome = outcome;
    this.opts.subject.recordOutcome(this.progress(), order.spec, outcome, {
      roundNumber: this.profile.currentRound!.roundNumber,
      now: this.now(),
    });
    const sprinkles = payOrder(this.profile, order);
    this.persist(); // outcome, learning record, payout and balance land in one write
    return { kind: 'resolved', outcome, sprinkles, presentation };
  }

  /** Moves past a resolved order. After the last one, pays bonuses once and closes the round. */
  finishOrder(): FinishResult {
    const round = this.profile.currentRound;
    const active = this.current();
    if (!round || !active || active.phase !== 'resolved') return { kind: 'ignored' };

    this.trackPlayTime(round);
    if (round.currentIndex < round.orders.length - 1) {
      round.currentIndex += 1;
      this.persist();
      return { kind: 'next-order' };
    }

    const bonus = payRoundBonus(this.profile, round) ?? round.bonus ?? { completion: 0, perfect: 0 };
    const summary = summarizeRound(round, bonus, this.now(), (o) => this.expression(o));
    const stickers = round.orders
      .filter((o) => o.outcome !== null)
      .map((o) => ({ customer: customerById(o.customerId, this.roster), firstTry: o.outcome === 'first' }));
    this.profile.roundHistory = [...this.profile.roundHistory, summary].slice(-MAX_HISTORY);
    const heartEarned = recordRound(this.profile, summary, this.opts.subject.id);
    this.profile.currentRound = null;
    this.persist();
    return { kind: 'round-complete', summary, stickers, heartEarned };
  }

  /** Adds the time since the last step, capped so a long pause counts as a short one. */
  private trackPlayTime(round: RoundState): void {
    const now = this.now();
    if (round.playMs !== null) round.playMs += Math.min(Math.max(0, now - round.lastActiveAt), this.idleCapMs);
    round.lastActiveAt = now;
  }

  /** The question as the ticket showed it, for the grown-ups report. */
  private expression(order: OrderState): string {
    const flavor = customerById(order.customerId, this.roster).favoriteFlavor;
    return this.opts.subject.present(order.spec, { flavor }).expression;
  }

  private persist(): void {
    const result = this.opts.persister.write(this.opts.save);
    if (!result.ok) this.opts.onSaveError?.(result.error);
  }
}

function newOrder(spec: ChallengeSpec, customerId: string): OrderState {
  return { spec, customerId, attempts: 0, outcome: null, paid: false, sprinklesPaid: 0 };
}

function summarizeRound(
  round: RoundState,
  bonus: RoundBonus,
  finishedAt: number,
  expression: (order: OrderState) => string,
): RoundSummary {
  const withOutcome = (outcome: AttemptOutcome | null) => round.orders.filter((o) => o.outcome === outcome);
  const count = (outcome: AttemptOutcome | null) => withOutcome(outcome).length;
  const orderSprinkles = round.orders.reduce((sum, o) => sum + o.sprinklesPaid, 0);
  return {
    roundNumber: round.roundNumber,
    startedAt: round.startedAt,
    finishedAt,
    playMs: round.playMs,
    ordersCompleted: round.orders.length - count(null),
    firstTryCorrect: count('first'),
    retryCorrect: count('retry'),
    missed: count('miss'),
    orderSprinkles,
    completionBonus: bonus.completion,
    perfectBonus: bonus.perfect,
    total: orderSprinkles + bonus.completion + bonus.perfect,
    perfect: bonus.perfect > 0,
    retryFacts: withOutcome('retry').map(expression),
    missFacts: withOutcome('miss').map(expression),
  };
}

/**
 * Round and order state machine. No Phaser here: the ShopScene asks this
 * class what to show and reports what the player did. Every state change that
 * matters (an answer, a payout, moving to the next customer) is persisted
 * before the method returns, so a reload resumes exactly where play stopped.
 *
 *   ensureRound() -> current() -> submit(answer)* -> finishOrder() -> ... x10
 *                                                  -> RoundSummary
 */
import { createRng, mixSeed } from '../core/rng';
import type { MathChallengeSpec } from '../learning/mathValidator';
import type { MathProgress } from '../learning/mathSubject';
import type { AttemptOutcome, ChallengePresentation, LearningSubject } from '../learning/types';
import type { OrderState, Profile, RoundState, RoundSummary, SaveFile } from '../save/saveTypes';
import { customerById, lineup, type CustomerDef } from './customerManager';
import { REWARDS, payOrder, payRoundBonus } from './rewards';

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

export type FinishResult =
  | { kind: 'ignored' }
  | { kind: 'next-order' }
  | { kind: 'round-complete'; summary: RoundSummary };

export interface Persister {
  write(save: SaveFile): { ok: true } | { ok: false; error: string };
}

export interface OrderManagerOptions {
  save: SaveFile;
  persister: Persister;
  subject: LearningSubject<MathChallengeSpec, MathProgress>;
  now?: () => number;
  ordersPerRound?: number;
  /** Called when a write fails, so the UI can warn a parent. */
  onSaveError?: (error: string) => void;
}

const MAX_HISTORY = 100;

export class OrderManager {
  private readonly now: () => number;
  private readonly ordersPerRound: number;

  constructor(private readonly opts: OrderManagerOptions) {
    this.now = opts.now ?? (() => Date.now());
    this.ordersPerRound = opts.ordersPerRound ?? REWARDS.ordersPerRound;
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
    const seed = mixSeed(profile.learning.seed, roundNumber);
    const rng = createRng(seed);
    const specs = this.opts.subject.planRound(profile.learning.math, {
      roundNumber,
      rng,
      now: this.now(),
      count: this.ordersPerRound,
    });
    const customers = lineup(rng, specs.length);

    profile.learning.roundsStarted = roundNumber;
    profile.currentRound = {
      id: `r${roundNumber}-${seed.toString(36)}`,
      roundNumber,
      seed,
      startedAt: this.now(),
      currentIndex: 0,
      bonusPaid: false,
      bonus: null,
      orders: specs.map((spec, i) => ({
        spec,
        customerId: customers[i]!,
        attempts: 0,
        outcome: null,
        paid: false,
        sprinklesPaid: 0,
      })),
    };
    this.persist();
    return profile.currentRound;
  }

  current(): ActiveOrder | null {
    const round = this.profile.currentRound;
    if (!round) return null;
    const order = round.orders[round.currentIndex];
    if (!order) return null;
    const customer = customerById(order.customerId);
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
    order.attempts += 1;
    const correct = this.opts.subject.checkAnswer(order.spec, input);

    if (!correct && order.attempts < 2) {
      this.persist();
      return { kind: 'try-again', presentation };
    }

    const outcome: AttemptOutcome = correct ? (order.attempts === 1 ? 'first' : 'retry') : 'miss';
    order.outcome = outcome;
    this.opts.subject.recordOutcome(this.profile.learning.math, order.spec, outcome, {
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

    if (round.currentIndex < round.orders.length - 1) {
      round.currentIndex += 1;
      this.persist();
      return { kind: 'next-order' };
    }

    const bonus = payRoundBonus(this.profile, round) ?? round.bonus ?? { completion: 0, perfect: 0 };
    const orders = round.orders;
    const orderSprinkles = orders.reduce((sum, o) => sum + o.sprinklesPaid, 0);
    const summary: RoundSummary = {
      roundNumber: round.roundNumber,
      finishedAt: this.now(),
      ordersCompleted: orders.filter((o) => o.outcome !== null).length,
      firstTryCorrect: orders.filter((o) => o.outcome === 'first').length,
      retryCorrect: orders.filter((o) => o.outcome === 'retry').length,
      missed: orders.filter((o) => o.outcome === 'miss').length,
      orderSprinkles,
      completionBonus: bonus.completion,
      perfectBonus: bonus.perfect,
      total: orderSprinkles + bonus.completion + bonus.perfect,
      perfect: bonus.perfect > 0,
    };
    this.profile.roundHistory = [...this.profile.roundHistory, summary].slice(-MAX_HISTORY);
    this.profile.currentRound = null;
    this.persist();
    return { kind: 'round-complete', summary };
  }

  private persist(): void {
    const result = this.opts.persister.write(this.opts.save);
    if (!result.ok) this.opts.onSaveError?.(result.error);
  }
}

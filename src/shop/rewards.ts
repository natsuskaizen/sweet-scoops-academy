/**
 * The single reward module. Every Sprinkle the game hands out is computed
 * and paid here, and every payout is guarded by a persisted `paid` flag so a
 * double tap, a reload or an interrupted animation can never pay twice.
 */
import { GAME_CONFIG, type RewardConfig } from '../config/gameConfig';
import type { AttemptOutcome } from '../learning/types';

/** Reward amounts (from GAME_CONFIG.rewards) plus the round size bonuses depend on. */
export const REWARDS: RewardConfig & { ordersPerRound: number } = {
  ...GAME_CONFIG.rewards,
  ordersPerRound: GAME_CONFIG.round.ordersPerRound,
};

export interface Wallet {
  sprinkles: number;
  lifetimeSprinkles: number;
}

export interface PayableOrder {
  outcome: AttemptOutcome | null;
  paid: boolean;
  sprinklesPaid: number;
}

export interface RoundBonus {
  completion: number;
  perfect: number;
}

export interface PayableRound {
  orders: PayableOrder[];
  bonusPaid: boolean;
  bonus: RoundBonus | null;
}

export function orderReward(outcome: AttemptOutcome): number {
  return REWARDS.perOrder[outcome];
}

export function computeRoundBonus(
  orders: readonly PayableOrder[],
  ordersPerRound = REWARDS.ordersPerRound,
): RoundBonus {
  const completed = orders.filter((o) => o.outcome !== null).length;
  const allDone = completed === ordersPerRound;
  const perfect = allDone && orders.every((o) => o.outcome === 'first');
  return {
    completion: allDone ? REWARDS.completionBonus : 0,
    perfect: perfect ? REWARDS.perfectBonus : 0,
  };
}

function credit(wallet: Wallet, amount: number): void {
  // Sprinkles only ever go up here: nothing is deducted for wrong answers.
  wallet.sprinkles += amount;
  wallet.lifetimeSprinkles += amount;
}

/** Pays a resolved order once. Returns the amount paid now (0 if already paid or unresolved). */
export function payOrder(wallet: Wallet, order: PayableOrder): number {
  if (order.paid || order.outcome === null) return 0;
  const amount = orderReward(order.outcome);
  order.paid = true;
  order.sprinklesPaid = amount;
  credit(wallet, amount);
  return amount;
}

/** Pays the end-of-round bonuses once. Returns null if already paid. */
export function payRoundBonus(wallet: Wallet, round: PayableRound): RoundBonus | null {
  if (round.bonusPaid) return null;
  const bonus = computeRoundBonus(round.orders);
  round.bonusPaid = true;
  round.bonus = bonus;
  credit(wallet, bonus.completion + bonus.perfect);
  return bonus;
}

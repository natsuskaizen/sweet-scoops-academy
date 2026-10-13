import { describe, expect, it } from 'vitest';
import { computeRoundBonus, orderReward, payOrder, payRoundBonus, type PayableOrder } from '../shop/rewards';
import type { AttemptOutcome } from '../learning/types';

const orders = (...outcomes: (AttemptOutcome | null)[]): PayableOrder[] =>
  outcomes.map((outcome) => ({ outcome, paid: false, sprinklesPaid: 0 }));

describe('rewards', () => {
  it('pays 10 / 5 / 2 per order', () => {
    expect(orderReward('first')).toBe(10);
    expect(orderReward('retry')).toBe(5);
    expect(orderReward('miss')).toBe(2);
  });

  it('a perfect round earns 160 Sprinkles in total', () => {
    const wallet = { sprinkles: 0, lifetimeSprinkles: 0 };
    const round = { orders: orders(...Array<AttemptOutcome>(10).fill('first')), bonusPaid: false, bonus: null };
    for (const o of round.orders) payOrder(wallet, o);
    expect(payRoundBonus(wallet, round)).toEqual({ completion: 10, perfect: 50 });
    expect(wallet.sprinkles).toBe(160);
  });

  it('gives the completion bonus but not the perfect bonus for a mixed round', () => {
    const bonus = computeRoundBonus(orders('first', 'retry', 'miss', ...Array<AttemptOutcome>(7).fill('first')));
    expect(bonus).toEqual({ completion: 10, perfect: 0 });
  });

  it('gives no bonus for an unfinished round', () => {
    expect(computeRoundBonus(orders('first', 'first', null))).toEqual({ completion: 0, perfect: 0 });
  });

  it('pays each order and each round bonus exactly once', () => {
    const wallet = { sprinkles: 0, lifetimeSprinkles: 0 };
    const [order] = orders('first');
    expect(payOrder(wallet, order!)).toBe(10);
    expect(payOrder(wallet, order!)).toBe(0);
    expect(payOrder(wallet, order!)).toBe(0);
    expect(wallet.sprinkles).toBe(10);

    const round = { orders: orders(...Array<AttemptOutcome>(10).fill('miss')), bonusPaid: false, bonus: null };
    expect(payRoundBonus(wallet, round)).not.toBeNull();
    expect(payRoundBonus(wallet, round)).toBeNull();
    expect(wallet.sprinkles).toBe(20);
  });

  it('does not pay unresolved orders', () => {
    const wallet = { sprinkles: 3, lifetimeSprinkles: 3 };
    expect(payOrder(wallet, orders(null)[0]!)).toBe(0);
    expect(wallet.sprinkles).toBe(3);
  });
});

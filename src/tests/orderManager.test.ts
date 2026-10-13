import { describe, expect, it } from 'vitest';
import { mathSubject } from '../learning/mathSubject';
import { MemoryStorage, SaveManager } from '../save/saveManager';
import { OrderManager } from '../shop/orderManager';

let clock = 1_700_000_000_000;
const now = () => (clock += 1000);

function boot(storage = new MemoryStorage()) {
  const saves = new SaveManager(storage, now);
  const { save } = saves.load();
  const manager = new OrderManager({ save, persister: saves, subject: mathSubject, now });
  return { storage, saves, manager };
}

const wrong = (answer: string) => String(Number(answer) + 1);

describe('OrderManager', () => {
  it('plays a full 10-order perfect round for 160 Sprinkles', () => {
    const { manager } = boot();
    manager.ensureRound();
    let summary;
    for (let i = 0; i < 10; i++) {
      const active = manager.current()!;
      expect(active.index).toBe(i);
      expect(manager.submit(active.presentation.correctAnswer)).toMatchObject({
        kind: 'resolved',
        outcome: 'first',
        sprinkles: 10,
      });
      const done = manager.finishOrder();
      if (done.kind === 'round-complete') summary = done.summary;
    }
    expect(summary).toMatchObject({
      ordersCompleted: 10,
      firstTryCorrect: 10,
      completionBonus: 10,
      perfectBonus: 50,
      total: 160,
      perfect: true,
    });
    expect(manager.profile.sprinkles).toBe(160);
    expect(manager.profile.currentRound).toBeNull();
    expect(manager.profile.roundHistory).toHaveLength(1);
  });

  it('allows one retry, then reveals the answer and still pays 2', () => {
    const { manager } = boot();
    manager.ensureRound();
    const { presentation } = manager.current()!;
    expect(manager.submit(wrong(presentation.correctAnswer))).toMatchObject({ kind: 'try-again' });
    expect(manager.current()!.phase).toBe('retrying');
    expect(manager.submit(wrong(presentation.correctAnswer))).toMatchObject({
      kind: 'resolved',
      outcome: 'miss',
      sprinkles: 2,
    });
    expect(manager.profile.sprinkles).toBe(2);
  });

  it('pays 5 for a correct retry', () => {
    const { manager } = boot();
    manager.ensureRound();
    const { presentation } = manager.current()!;
    manager.submit(wrong(presentation.correctAnswer));
    expect(manager.submit(presentation.correctAnswer)).toMatchObject({ outcome: 'retry', sprinkles: 5 });
  });

  it('ignores repeated submits after an order resolves', () => {
    const { manager } = boot();
    manager.ensureRound();
    const answer = manager.current()!.presentation.correctAnswer;
    manager.submit(answer);
    expect(manager.submit(answer)).toEqual({ kind: 'ignored' });
    expect(manager.submit(answer)).toEqual({ kind: 'ignored' });
    expect(manager.profile.sprinkles).toBe(10);
  });

  it('records outcomes in the right operation record', () => {
    const { manager } = boot();
    manager.ensureRound();
    const { order, presentation } = manager.current()!;
    manager.submit(presentation.correctAnswer);
    const skill = manager.profile.learning.math[order.spec.skillId];
    expect(skill!.facts[order.spec.factKey]).toMatchObject({ presentations: 1, firstTryCorrect: 1 });
  });

  it('resumes after a reload without paying twice or changing the questions', () => {
    const storage = new MemoryStorage();
    const first = boot(storage).manager;
    const round = first.ensureRound();
    const plan = round.orders.map((o) => o.spec);
    first.submit(first.current()!.presentation.correctAnswer); // resolved + paid, not yet finished

    const second = boot(storage).manager; // simulated page refresh
    expect(second.ensureRound().orders.map((o) => o.spec)).toEqual(plan);
    expect(second.current()!.phase).toBe('resolved');
    expect(second.submit('1')).toEqual({ kind: 'ignored' });
    expect(second.profile.sprinkles).toBe(10);
    expect(second.finishOrder()).toEqual({ kind: 'next-order' });

    // Wrong once, then reload: the retry state survives.
    second.submit(wrong(second.current()!.presentation.correctAnswer));
    const third = boot(storage).manager;
    expect(third.current()!.phase).toBe('retrying');
  });

  it('pays the round bonus once even if finishOrder is called again', () => {
    const { manager } = boot();
    manager.ensureRound();
    for (let i = 0; i < 10; i++) {
      manager.submit(manager.current()!.presentation.correctAnswer);
      manager.finishOrder();
    }
    expect(manager.finishOrder()).toEqual({ kind: 'ignored' });
    expect(manager.profile.sprinkles).toBe(160);
  });

  it('starts the next round with adapted questions', () => {
    const { manager } = boot();
    manager.ensureRound();
    for (let i = 0; i < 10; i++) {
      const { presentation } = manager.current()!;
      manager.submit(wrong(presentation.correctAnswer));
      manager.submit(wrong(presentation.correctAnswer));
      manager.finishOrder();
    }
    const missed = manager.profile.roundHistory[0]!;
    expect(missed.missed).toBe(10);
    const next = manager.ensureRound();
    expect(next.roundNumber).toBe(2);
    expect(manager.profile.sprinkles).toBe(30); // 10 x 2 + completion bonus
  });

  it('records play time, capping long pauses, and which questions needed help', () => {
    let t = 1_800_000_000_000;
    const saves = new SaveManager(new MemoryStorage(), () => t);
    const manager = new OrderManager({ save: saves.load().save, persister: saves, subject: mathSubject, now: () => t });
    const start = manager.ensureRound().startedAt;
    t += 10 * 60_000; // the tablet sat for ten minutes before the first answer: counts as 2
    const expressions: string[] = [];
    for (let i = 0; i < 10; i++) {
      const { presentation } = manager.current()!;
      expressions.push(presentation.expression);
      if (i < 2) manager.submit(wrong(presentation.correctAnswer));
      t += 5000;
      manager.submit(i === 1 ? wrong(presentation.correctAnswer) : presentation.correctAnswer);
      t += 3000; // serving animation
      manager.finishOrder();
      t += 2000; // next customer walks in
    }
    const summary = manager.profile.roundHistory[0]!;
    expect(summary.startedAt).toBe(start);
    expect(summary.playMs).toBe(120_000 + 10 * 10_000 - 2000);
    expect(summary.retryFacts).toEqual([expressions[0]]);
    expect(summary.missFacts).toEqual([expressions[1]]);
  });

  it('leaves play time unrecorded for a round started before timing existed', () => {
    const { manager } = boot();
    const round = manager.ensureRound();
    round.playMs = null;
    for (let i = 0; i < 10; i++) {
      manager.submit(manager.current()!.presentation.correctAnswer);
      manager.finishOrder();
    }
    expect(manager.profile.roundHistory[0]!.playMs).toBeNull();
  });
});

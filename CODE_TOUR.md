# Code tour

A short walk through the parts worth reading first, in the order data flows during one order. Everything up to step 5 is plain TypeScript with no Phaser import, which is why it is unit tested directly.

## 1. The rules: `src/learning/mathValidator.ts`

Every question is checked here before it can be shown, and saved questions are checked again on load.

```ts
export function validateDivision(dividend: unknown, divisor: unknown, answer?: unknown): ValidationResult {
  const { minDividend, maxDividend, minQuotient, maxQuotient } = MATH_RULES.division;
  if (!isInt(dividend) || !isInt(divisor)) return fail('dividend and divisor must be integers');
  if (divisor <= 0) return fail('divisor must be positive');
  if (dividend < minDividend || dividend > maxDividend) return fail(`dividend ${dividend} outside ...`);
  if (dividend % divisor !== 0) return fail(`${dividend} ÷ ${divisor} has a remainder`);
  const quotient = dividend / divisor;
  if (quotient < minQuotient || quotient > maxQuotient) return fail(`quotient ${quotient} outside ...`);
  ...
}

// 5 × 6 and 6 × 5 share one mastery record:
export function multiplicationKey(a: number, b: number): string {
  return `mul:${Math.min(a, b)}x${Math.max(a, b)}`;
}
```

## 2. Learning states: `src/learning/adaptiveEngine.ts`

`recordOutcome` updates one fact. The "once per round" guard is what makes mastery need several rounds:

```ts
const alreadySeenThisRound = rec.presentations > 0 && rec.lastPresentedRound === round;

case 'first':
  rec.firstTryCorrect += 1;
  if (!alreadySeenThisRound) rec.successStreak += 1;
  if (rec.state === 'learning') rec.state = 'practicing';
  if (rec.state === 'practicing' && rec.successStreak >= config.masterySessions) rec.state = 'mastered';
  break;
case 'miss':
  rec.missed += 1;                       // history is kept
  if (rec.state === 'mastered') rec.state = 'practicing';   // drop one level at most
  ...
rec.nextDueRound = round + nextInterval(rec, outcome, config); // a miss is due next round
```

`planRound` fills slots from the target mix, each with a fallback chain, in a strict pass (due dates and new-fact caps respected) and then a relaxed pass:

```ts
const FALLBACKS: Record<SlotKind, SlotKind[]> = {
  learning:   ['learning', 'practicing', 'new', 'mastered'],
  practicing: ['practicing', 'learning', 'mastered', 'new'],
  mastered:   ['mastered', 'practicing', 'learning', 'new'],
  new:        ['new', 'learning', 'practicing', 'mastered'],
};
```

The engine only sees string keys and difficulty numbers, so a vocabulary subject can reuse it unchanged.

## 3. The subject seam: `src/learning/types.ts` + `mathSubject.ts`

The shop talks to subjects only through this interface. Hints and explanations are data, rendered by the shop:

```ts
export interface LearningSubject<S extends ChallengeSpec, P> {
  readonly id: string;
  createProgress(): P;
  planRound(progress: P, ctx: PlanContext): S[];
  isValidSpec(spec: unknown): spec is S;
  present(spec: S, ctx: OrderContext): ChallengePresentation; // expression, order line, hint, explanation
  checkAnswer(spec: S, input: string): boolean;
  recordOutcome(progress: P, spec: S, outcome: AttemptOutcome, ctx: OutcomeContext): void;
}

export type VisualAid =
  | { kind: 'groups'; groups: number; perGroup: number; showTotal: boolean; caption: string }
  | { kind: 'share'; total: number; groups: number; perGroup: number | null; caption: string }
  | { kind: 'text'; caption: string };
```

## 4. One order: `src/shop/orderManager.ts`

The scene calls `submit()`; the outcome, the learning record, the payout and the balance all land in a single save write:

```ts
submit(input: string): SubmitResult {
  const active = this.current();
  if (!active || active.phase === 'resolved' || input.trim() === '') return { kind: 'ignored' };

  order.attempts += 1;
  const correct = this.opts.subject.checkAnswer(order.spec, input);
  if (!correct && order.attempts < 2) { this.persist(); return { kind: 'try-again', presentation }; }

  const outcome = correct ? (order.attempts === 1 ? 'first' : 'retry') : 'miss';
  order.outcome = outcome;
  this.opts.subject.recordOutcome(this.profile.learning.math, order.spec, outcome, ...);
  const sprinkles = payOrder(this.profile, order);   // guarded by order.paid
  this.persist();
  return { kind: 'resolved', outcome, sprinkles, presentation };
}
```

`src/shop/rewards.ts` is the only place Sprinkles are computed:

```ts
export function payOrder(wallet: Wallet, order: PayableOrder): number {
  if (order.paid || order.outcome === null) return 0;
  const amount = orderReward(order.outcome);   // 10 / 5 / 2
  order.paid = true;
  order.sprinklesPaid = amount;
  credit(wallet, amount);
  return amount;
}
```

## 5. Saving: `src/save/saveManager.ts`

```ts
write(save: SaveFile): WriteResult {
  const problems = validateSaveFile(save);
  if (problems.length > 0) return { ok: false, error: ... };   // never write bad data
  const previous = this.read(SAVE_KEYS.primary);
  if (previous !== null && parse(previous).ok) this.storage.setItem(SAVE_KEYS.backup, previous);
  this.storage.setItem(SAVE_KEYS.primary, JSON.stringify(save));
}
```

On load, a bad primary is copied to `sweet-scoops-academy.save.quarantine.<time>` first, then the backup is tried. Bump `SAVE_SCHEMA_VERSION` in `saveTypes.ts` and add a step in `migrate()` when the format changes.

## 6. The scene: `src/scenes/ShopScene.ts`

The scene animates whatever the manager decides. One customer per call, then it recurses:

```ts
private async runOrder(): Promise<void> {
  const active = this.manager.current();
  const customer = new CharacterView(this, LAYOUT.doorSpot.x, LAYOUT.customerSpot.y, { species, palette });
  await customer.walkTo(LAYOUT.customerSpot.x);
  this.bubble.say(presentation.orderLine, customer.x);
  this.ticket.showOrder(`${def.name}'s order`, presentation.expression);
  if (active.phase === 'resolved') return this.celebrateOrExplain(...); // reloaded mid-serve: animate only
  if (active.phase === 'retrying') this.showHint(presentation);
  this.keypad.setEnabled(true);
}
```

The keypad disables itself the moment ✓ is tapped and the scene re-enables it when it is ready, so repeat taps never reach the manager; the manager ignores them anyway.

## 7. Characters: `src/characters/`

Sprites are text grids on a shared 16×20 frame, so clothing layers line up on any species:

```ts
'chef-hat': grid({
  0: '.....oooooo.....',
  1: '....owwwwwwo....',
  ...
}),

new CharacterView(scene, x, y, { species: 'puppy', layers: { outfit: 'apron', hat: 'chef-hat' } });
view.setLayer('bow', 'bow-strawberry');   // how Milestone 3 equipment will plug in
```

## Tests

`src/tests/` has one suite per module. The most useful to read are `adaptiveEngine.test.ts` (mastery across rounds, misses coming back, mastered facts returning, seeded reproducibility) and `orderManager.test.ts` (full rounds, retry flow, double submits, reload mid-order).

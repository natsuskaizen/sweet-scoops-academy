# Code tour

A short walk through the parts worth reading first, in the order data flows during one order. Everything up to step 5 is plain TypeScript with no Phaser import, which is why it is unit tested directly.

## 0. Settings: `src/config/gameConfig.ts`

Every tunable lives in `GAME_CONFIG`. Modules read their defaults from it and accept overrides, so tests can try other settings:

```ts
export const GAME_CONFIG: GameConfig = {
  round: { ordersPerRound: 10, attemptsPerOrder: 2 },
  rewards: { perOrder: { first: 10, retry: 5, miss: 2 }, completionBonus: 10, perfectBonus: 50 },
  adaptive: { masterySessions: 3, composition: { learning: 4, practicing: 3, mastered: 2, new: 1 }, ... },
  math: { enabledOperations: ['multiplication', 'division'], division: { dividend: { min: 10, max: 99 }, ... } },
  ...
};
```

## 1. Operations: `src/learning/math/`

Each operation is one file implementing `MathOperation`. It owns its fact table, rules, wording and visuals, so adding addition touched nothing else:

```ts
export function createDivision(math: MathConfig): MathOperation {
  const { dividend: dividendRange, quotient: quotientRange, divisor: divisorRange } = math.division;
  return {
    id: 'division', label: 'Division', symbol: '÷', maxDigits: 2,
    facts,                                       // cached table built from the config ranges
    compute: (dividend, divisor) => dividend / divisor,
    keyFor: divisionKey,                         // "div:30/5"
    validate(dividend, divisor, answer) {
      if (!isInt(dividend) || !isInt(divisor)) return fail('dividend and divisor must be integers');
      if (divisor <= 0) return fail('divisor must be positive');
      return firstFailure(
        () => inRange('dividend', dividend, dividendRange),
        () => (dividend % divisor === 0 ? OK : fail(`${dividend} ÷ ${divisor} has a remainder`)),
        () => inRange('quotient', dividend / divisor, quotientRange),
        () => checkAnswer(dividend / divisor, answer),
      );
    },
    word(spec, flavor) { return { orderLine, hint: { kind: 'share', ... }, explanation: { ... } }; },
    ...
  };
}
```

`registry.ts` lists them; `mathValidator.ts` is the single entry point that finds a spec's operation and validates it. Every question is checked there before it is shown, and saved questions are checked again on load.

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

`planRound` fills slots from the target mix. `pickForSlot` tries each slot's fallback chain, primary skill first, in a strict pass (due dates and new-fact caps respected) and then a relaxed pass:

```ts
const FALLBACKS: Record<SlotKind, SlotKind[]> = {
  learning: ['learning', 'new', 'practicing', 'mastered'], // keeping up? introduce something new
  practicing: ['practicing', 'learning', 'new', 'mastered'],
  mastered: ['mastered', 'practicing', 'learning', 'new'],
  new: ['new', 'learning', 'practicing', 'mastered'],
};
```

New facts normally come from the easiest unseen ones, but `skillPace()` lets a fluent child skip ahead:

```ts
// in pickNewFact():
const pace = skillPace(pool, round, config); // recent first-try accuracy + hardest known fact
const target = pace.fluent ? pace.frontier + config.stretch.step : -Infinity;
const stretched = unseen.filter((f) => f.difficulty >= target);
```

The engine only sees string keys and difficulty numbers, so a vocabulary subject can reuse it unchanged.

## 3. The subject seam: `src/learning/types.ts` + `mathSubject.ts`

The shop talks to subjects only through this interface. `OrderManager`, the saves and the grown-ups screen never look inside a subject's questions or progress; a subject's progress is stored under its id (`subjectProgress(profile, subject)`). Hints and explanations are data, rendered by the shop:

```ts
export interface LearningSubject<S extends ChallengeSpec, P> {
  readonly id: string;
  createProgress(): P;
  planRound(progress: P, ctx: PlanContext): S[];
  isValidSpec(spec: unknown): spec is S;
  present(spec: S, ctx: OrderContext): ChallengePresentation; // expression, order line, hint, explanation
  checkAnswer(spec: S, input: string): boolean;
  recordOutcome(progress: P, spec: S, outcome: AttemptOutcome, ctx: OutcomeContext): void;
  progressReport(progress: P): string[]; // lines for the grown-ups area
}

export type VisualAid =
  | { kind: 'groups'; groups: number; perGroup: number; showTotal: boolean; caption: string }
  | { kind: 'share'; total: number; groups: number; perGroup: number | null; caption: string }
  | { kind: 'combine'; parts: number[]; showTotal: boolean; caption: string } // addition
  | { kind: 'takeAway'; total: number; remove: number; showResult: boolean; caption: string } // subtraction
  | { kind: 'text'; caption: string };
```

`mathSubject` is built from the enabled operations, so its `present()` is generic:

```ts
present(spec, ctx) {
  const op = operation(spec.skillId);
  return {
    expression: `${spec.left} ${op.symbol} ${spec.right}`,
    answerInput: { kind: 'integer', maxDigits: op.maxDigits },
    correctAnswer: String(spec.answer),
    ...op.word(spec, ctx.flavor),
  };
}
```

## 4. One order: `src/shop/orderManager.ts`

The scene calls `submit()`; the outcome, the learning record, the payout and the balance all land in a single save write:

```ts
submit(input: string): SubmitResult {
  const active = this.current();
  if (!active || active.phase === 'resolved' || input.trim() === '') return { kind: 'ignored' };

  order.attempts += 1;
  const correct = this.opts.subject.checkAnswer(order.spec, input);
  if (!correct && order.attempts < this.attemptsPerOrder) { this.persist(); return { kind: 'try-again', presentation }; }

  const outcome = correct ? (order.attempts === 1 ? 'first' : 'retry') : 'miss';
  order.outcome = outcome;
  this.opts.subject.recordOutcome(this.progress(), order.spec, outcome, ...);
  const sprinkles = payOrder(this.profile, order);   // guarded by order.paid
  this.persist();
  return { kind: 'resolved', outcome, sprinkles, presentation };
}
```

`src/shop/rewards.ts` is the only place Sprinkles are computed:

```ts
export function payOrder(wallet: Wallet, order: PayableOrder): number {
  if (order.paid || order.outcome === null) return 0;
  const amount = orderReward(order.outcome); // 10 / 5 / 2
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

The scene animates whatever the manager decides. One customer per call, each step its own small method:

```ts
private async runOrder(): Promise<void> {
  const active = this.manager.current();
  ...
  const customer = await this.customerArrives(active.customer);
  await this.placeOrder(active, customer);          // greeting, order line, ticket
  if (active.phase === 'resolved') return this.celebrateOrExplain(...); // reloaded mid-serve: animate only
  if (active.phase === 'retrying') this.showHint(active.presentation);
  this.readyForAnswer();
}

private async serve(presentation, sprinkles, flavor) {
  const treat = await this.scoopTreat(Number(presentation.correctAnswer), flavor);
  await this.tween({ targets: treat, x: customer.x + 52, y: customer.y - 62, ... });
  await this.thankAndPay(customer, Number(presentation.correctAnswer), sprinkles);
  await this.customerLeaves(customer, treat);
  this.nextOrder();
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

`src/tests/` has one suite per module. `operations.test.ts` checks every operation's fact table against its own rules and shows how turning on more operations behaves. The most useful to read are `adaptiveEngine.test.ts` (mastery across rounds, misses coming back, mastered facts returning, seeded reproducibility) and `orderManager.test.ts` (full rounds, retry flow, double submits, reload mid-order).

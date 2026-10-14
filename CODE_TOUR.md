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
  readonly badge: string; // "123": the subject's chip on the progress calendar
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

The shop draws these with pixel-art scoops and cups (`src/ui/VisualAidView.ts`). Hints appear at once; explanations play out in beats from `src/learning/aidBeats.ts`, which is Phaser-free and only reads the `VisualAid` data:

```ts
aidBeats({ kind: 'groups', groups: 3, perGroup: 4, showTotal: true, caption });
// -> fill cup 0 "4", fill cup 1 "8", fill cup 2 "12" (final)
aidBeats({ kind: 'share', total: 12, groups: 4, perGroup: 3, caption });
// -> deal round 1 (8 left), round 2 (4 left), round 3 (0 left, final)
```

So multiplication fills one cup at a time while the skip-count total grows under each cup, and division deals one scoop into every cup per round until the pile is gone. Scoops sit in rows of up to five, like a ten frame (`src/ui/aidLayout.ts`). The pace is `GAME_CONFIG.timing.aidFillMs` and `aidDealMs`.

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

Each `submit()` and `finishOrder()` also adds the time since the previous step to the round's play time, capped so a long pause counts as a short one. The finished round's summary keeps that time and the questions (as the ticket showed them) that needed help, for the grown-ups Progress screen. `src/shop/progressReport.ts` turns the history into tiles, cards, chart bars and practice chips (Phaser-free and unit tested), and `src/ui/ProgressScreen.ts` only draws them:

```ts
private trackPlayTime(round: RoundState): void {
  const now = this.now();
  if (round.playMs !== null) round.playMs += Math.min(Math.max(0, now - round.lastActiveAt), this.idleCapMs);
  round.lastActiveAt = now;
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

### The kids' progress calendar: `src/shop/progressCalendar.ts`

A finished round is one "game". `finishOrder()` also adds it to the day it finished on (`profile.dailyLog`, keyed by local date), with its play time and subject. Reaching the day's goal (`settings.dailyGoal`, 3 by default and changed from the grown-ups area within `GAME_CONFIG.calendar.dailyGoal`) stamps a heart on that day. The heart is stored, so raising the goal later never takes one away, and `finishOrder` reports `heartEarned` so the wall calendar can bounce its hearts:

```ts
export function addRound(log, round, subjectId, goal): boolean {
  const day = (log[dayKey(round.finishedAt)] ??= emptyDay());
  day.rounds += 1;
  day.playMs += round.playMs ?? 0;
  day.subjects[subjectId] = (day.subjects[subjectId] ?? 0) + 1;
  const earned = !day.heart && day.rounds >= goal;
  if (earned) day.heart = true;
  return earned;
}
```

The log keeps `GAME_CONFIG.calendar.keepDays` days, separate from the 100-round history, so old months stay on the calendar. `dayView` and `monthView` turn it into what is drawn (gentle words such as "One more game for a heart!" or "A rest day", never a cross). In the shop, `src/ui/WallCalendar.ts` hangs between the window and the display case with one heart per game today; tapping it opens `src/ui/CalendarScreen.ts` over the shop: the chosen day with a heart that fills a slice per game, and the month of heart stamps. Each subject played shows its `badge` as a chip, so math and later subjects share one calendar.

## 5. Saving: `src/save/saveManager.ts`

```ts
write(save: SaveFile): WriteResult {
  const problems = validateSaveFile(save);
  if (problems.length > 0) return { ok: false, error: ... };   // never write bad data
  const previous = this.read(SAVE_KEYS.primary);
  if (previous !== null && parseSave(previous).ok) this.storage.setItem(SAVE_KEYS.backup, previous);
  this.storage.setItem(SAVE_KEYS.primary, JSON.stringify(save));
}
```

On load, an unfinished round that no longer passes validation (its questions fall outside today's rules, for example) is dropped first (`dropUnplayableRounds`), so only a damaged save as a whole counts as bad. A bad primary is copied to `sweet-scoops-academy.save.quarantine.<time>`, then the backup is tried. Bump `SAVE_SCHEMA_VERSION` in `saveTypes.ts` and add a step to `MIGRATIONS` in `src/save/migrations.ts` when the format changes. Each step upgrades one version and only fills in what is missing; older data gets "unknown" rather than a guess:

Version 3 adds the progress calendar: `settings.dailyGoal` and a `dailyLog` rebuilt from the round history (`logFromHistory`).

```ts
// v1 -> v2: rounds gain timing and the questions that needed help.
for (const summary of history) {
  summary.startedAt ??= null; // shown as "time not recorded"
  summary.playMs ??= null;
  summary.retryFacts ??= [];
  summary.missFacts ??= [];
}
```

Each player has their own shop, so several children can share a device. The player actions in the same file never leave the save invalid: blank names are ignored, and the last player can't be removed:

```ts
addPlayer(save, { name: 'Ava', shop: { name: "Ava's Rainbow Scoops", keeper: 'bonbon' } }, Date.now()); // becomes the one playing
choosePlayer(save, id, Date.now()); // marks them as just played, so they come first in playersInOrder(save)
updatePlayer(profile, { shopName: 'Sugar Cloud', keeper: 'kiki' });
removePlayer(save, id); // false for the last player
```

Backup files (`src/save/backup.ts`) reuse the same path. An imported file goes through `parseSave` (parse, migrate, validate) like a storage load, and only a valid one reaches the confirmation step. `replaceWith` then quarantines the live save before writing:

```ts
export function readBackup(raw: string): Parsed {
  return parseSave(raw);
}

replaceWith(save: SaveFile): WriteResult {
  const problems = validateSaveFile(save);
  if (problems.length > 0) return { ok: false, error: `refusing to import invalid save: ${problems[0]}` };
  const current = this.read(SAVE_KEYS.primary);
  if (current !== null) this.quarantine(current);   // (wrapped in try/catch)
  return this.write(save);
}
```

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
  await tweenAsync(this, { targets: treat, x: customer.x + 52, y: customer.y - 62, duration: GAME_CONFIG.timing.handOffMs });
  await this.thankAndPay(customer, Number(presentation.correctAnswer), sprinkles);
  await this.customerLeaves(customer, treat);
  this.nextOrder();
}
```

The keypad disables itself the moment ✓ is tapped and the scene re-enables it when it is ready, so repeat taps never reach the manager; the manager ignores them anyway.

A round ends with a sticker card over the shop. `finishOrder()` hands the scene one sticker per customer served, so the card never has to read the round itself:

```ts
const finish = manager.finishOrder();
if (finish.kind === 'round-complete') {
  finish.stickers; // [{ customer, firstTry: true }, ...] gold star for first tries, a heart otherwise
}
// A perfect round first brings everyone back: they walk in and line up at paradeSpots(10).
const lineup = await this.parade.play(looks); // src/scenes/parade.ts, with its own Skip button
```

Animation steps are plain `await`s through `src/ui/tweenAsync.ts`. A tween's promise settles when it completes or is stopped early, so cutting an animation short (Skip, `arriveAt`) never leaves a caller waiting. Every pause in the order flow is a named number in `GAME_CONFIG.timing`.

The grown-ups area's content lives in `src/scenes/parentArea.ts`, so the scene only opens and closes it. Changes to the save go through Phaser-free helpers that are unit tested, then the shop rebuilds itself from the save:

```ts
// services.save is the live save; services.loadNotice is how it was found at startup, shown once
resetLearning(profile, services.subject); // src/save/profileActions.ts
resetProfile(services.save, Date.now()); // replaces only the active player, keeping their shop
const result = services.saves.write(services.save);
if (!result.ok) return gate.notice('Not saved', `The change could not be saved: ${result.error}`);
scene.scene.restart();
```

Players (`src/scenes/playerActions.ts`) opens a DOM dialog, `PlayersDialog`, so a grown-up renames with the device keyboard. The dialog only reports choices; each one is saved at once, and undone if the save fails:

```ts
rename: (id, name) => change(() => renamePlayer(services.save, id, name)), // null, or why not
remove: (id) => change(() => (removePlayer(services.save, id) ? null : "The last player can't be removed.")),
// On close: rebuild from the save, on the start screen if the player who was playing is gone.
```

`services.stage` says where the shop opens: `'setup'` when the load found no save, `'start'` whenever the game comes back (or a backup is loaded), and `'play'` once someone opens their shop. `ShopScene.create()` ends with `this.openAt(this.services.stage)`, and a rotation restarts into the same stage.

The start screen (`src/scenes/startScreen.ts`) shows the active player's own shop behind it with the door shut, and only reports choices; the scene does what they mean:

```ts
this.start = new StartScreen({
  scene: this,
  player, // the active player: "Hi, Ava!", her friend dressed as in her shop, Open the shop!
  others: playersInOrder(save).filter((p) => p.id !== player.id), // "Not Ava?" cards, most recent first
  canAddPlayer: canAddPlayer(save),
  onOpen: () => this.play(() => choosePlayer(save, player.id, Date.now())), // stage 'play', save, restart
  onSwitch: (id) => this.switchTo(id), // choosePlayer, save, restart on the start screen in front of their shop
  onNewPlayer: () => this.addNewPlayer(), // the setup below, with ✕ back to the start screen
  onGrownUps: () => this.openParentGate(),
});
```

Its pieces are placed by `startLayout()` in `src/ui/startLayout.ts` (unit tested). A brand new game, or New on the start screen, opens the new-player setup instead. It lives in the register panel, so the shop stays in view, and it only reports choices; the scene shows them and saves the result:

```ts
this.setup = new NewPlayerSetup({
  // src/scenes/newPlayerSetup.ts
  scene: this,
  onShopName: (name) => setShopSign(this.room.sign, name), // the sign follows every roll, tap and letter
  onKeeper: (id) => this.previewKeeper(id), // the friend steps behind the counter and says hi
  onDone: (player) => this.play(() => addPlayer(save, player, Date.now())), // or updatePlayer for a brand new game
  onCancel: () => this.scene.restart(), // only from the start screen: ✕ goes back to it
});
```

Typing goes through `typeKey` in `src/shop/playerNames.ts` (capitals start each word, spaces never double; `letterAs` makes the letter keys show the case they will type), ◀ goes back a step (`PREVIOUS_STEP`), and the keys (QWERTY rows, `letterKeyCells`) and cards are placed by `setupLayout()` in `src/ui/setupLayout.ts`, so both are unit tested.

Tapping ⚙ in the top bar opens My shop (`src/scenes/myShop.ts`, placed by `myShopLayout()`), the player's own settings; holding ⚙ still goes straight to the grown-ups area. Changing the shop name or shopkeeper reuses one step of the setup in edit mode, prefilled, with Done instead of Next:

```ts
this.setup = new NewPlayerSetup({
  scene: this,
  edit: { step, player }, // 'shop' or 'keeper', starting from the player's own choices
  onShopName: (name) => setShopSign(this.room.sign, name),
  onKeeper: (id) => this.previewKeeper(id),
  onDone: ({ shop }) => {
    updatePlayer(profile, { shopName: shop.name, keeper: shop.keeper });
    this.saveNow();
    this.scene.restart(); // rebuilt from the save, mid-order or not, as rotating does
  },
  onCancel: () => this.scene.restart(),
});
```

Calm mode is the player's `settings.reduceMotion`. `setCalm()` in `src/ui/motion.ts` is set from the active player whenever the shop is built, and `CharacterView` (breathing, `cheer`, `hop`, `puzzled`) and `confetti()` check `isCalm()` before they move.

## 7. Characters: `src/characters/`

The shop's cast (Momo behind the counter and 13 customers) lives in `friendArt.ts`. Each one is its standing frame as a 32×40 text grid, and every other frame is redrawn from it, so every character gets the same expressions and steps:

```ts
momo: {
  palette: { a: '#ffffff', b: '#ffc9a8', ... },   // 'o' is the shared outline, '.' is clear
  rows: ['...ooooooo...', ...],
},

friendFrames(FRIEND_ART.momo); // [stand, happy (^ ^ eyes), thinking (eyes up), walkA, walkB (one foot lifted), blink]
registerFriendTextures(scene); // BootScene: one 6-frame sprite sheet per character
new CharacterView(scene, x, y, friendLook('momo')).setExpression('happy');
```

A customer is one entry in `CUSTOMERS` (`src/shop/customerManager.ts`) naming its art, favourite flavour and lines. `CharacterView` does the moving, with timings from `GAME_CONFIG.animation`:

```ts
await customer.walkTo(x); // sways, and swaps feet at each end of the sway (pictures without walk frames just sway)
customer.idle(true); // slow breathing, and a blink now and then while the face is neutral
void customer.cheer(); // right answer: a jump and three hearts (reactions.ts)
customer.puzzled(); // first miss: thinking face, a head tilt and a "?" bubble
```

Serving is in `src/scenes/serveAnimation.ts`: the shopkeeper's paw holds an ice cream scooper (`src/characters/scooperArt.ts`), dips it into the flavour's tub (`tubSpot(flavor)` in `shopRoom.ts`), carries each scoop to the cone in its bowl and drops it into the treat, then the shopkeeper cheers. She serves with the wooden scooper until one is bought in her Closet (one look per item tier; Silver, Golden and Rainbow throw sparkles):

```ts
const scooper = equippedIn(profile, 'handheld')?.tier ?? 'wooden';
await scoopOntoCone(scene, { keeper: shopkeeper, scooper }, treat, flavor, count);
```

What the shopkeeper wears from the Closet is drawn in `wearArt.ts` on the friends' shared 32×40 frame (fitted to Momo), so each item is a layer the same size as their picture and fits any of the six shopkeepers. Some friends wear something of their own on their head (Momo's chef hat, Bonbon's flower, Kiki's star); a hat, or for some a bow, takes its place, so they are then drawn from a copy of their picture with it taken off:

```ts
WEAR_ART['glasses-round']; // { rows: [...], x: 0, y: 16 }: lenses around the eyes on rows 18-20
TOPPERS.bonbon; // { chars: 'cd', rows: 9, edge: 'ab', under: ['hat', 'bow'] }: her flower, replaced by a hat or bow
bareArt('bonbon'); // her picture without it, registered as friendSheets('bonbon').bare
dressFriend(view, 'bonbon', equippedItems(profile), friendSheets('bonbon')); // picks the sheet, then view.dress([...])
```

The older 16×20 species in `sprites.ts` share one grid so clothing layers line up on any of them:

```ts
new CharacterView(scene, x, y, { species: 'puppy', layers: { outfit: 'apron', hat: 'chef-hat' } });
view.setLayer('bow', 'bow-strawberry');
```

Grown-ups can add characters from their own pictures (`src/shop/addedCharacters.ts`). A picture is a row of frames on the same grid times 1-4, and it becomes a normal customer for the order flow:

```ts
sheetLayout(160, 40); // { ok: true, frameW: 32, frameH: 40, frames: 5 }
frameFor(3, 'walkA'); // 0: missing poses use the standing frame

// services.characters is a CharacterLibrary (src/save/characterLibrary.ts)
const roster = customerRoster(services.characters.list()); // built-ins + switched-on added customers
new OrderManager({ save, persister, subject, roster });

// BootScene registers each picture as a sprite sheet; expressions pick frames
const look = addedLook(scene, character) ?? friendLook('mallow'); // null if the picture didn't load
new CharacterView(scene, x, y, look).setExpression('happy'); // frame 1, or standing
```

## 8. The room: `src/scenes/shopRoom.ts`

The room is pixel art too. It is painted once onto a canvas the size of the whole screen under the status bar (one texel per art pixel) and shown at 4×, so its pixels match the characters'. While serving, the register covers the right side (landscape) or the bottom (portrait); Decorate slides it away and shows the whole room. Painting uses a tiny helper, `Pixels` in `roomPixels.ts`; the door, wall line and counter are placed from `LAYOUT`:

```ts
function paintPlainDoor(p: Pixels): void {
  const d = doorArt(); // LAYOUT.door in art pixels
  p.box(d.x - 2, d.y - 2, d.w + 4, d.wall - d.y + 2, C.wood); // frame, plum outline
  p.ring(cx, d.y + 13, 8, C.sky); // round window
}

// shopArt.ts: one texture per screen shape and per look (wall paint, door), painted when first needed
const key = roomTexture(scene, { wall: 'sky', door: itemById('door-arch.golden') });
```

Wall paint and doors bought in Decorate repaint the room rather than standing in it: `wallColors(tier)` gives the wallpaper's stripes, valance and panels in the tier's colours (Sparkly Rainbow in bands), and a bought door's grid from `doorArt.ts` is painted over the door frame. Every door keeps the OPEN sign and the customers' `LAYOUT.doorSpot` where they were.

The counter is a second canvas on a higher layer so it hides the shopkeeper's legs.

## 9. Buying, decorating and dressing up: `src/shop/catalog.ts`, `purchases.ts`, `src/scenes/decorateMode.ts`, `closetMode.ts`

The catalog lists designs; each comes in six tiers, and each tier is its own item to buy and own (`hat-beret.golden`). Plain colours cost the base price, then Silver ×2.5, Golden ×5 and Sparkly Rainbow ×10:

```ts
(wear('hat-beret', 'Beret', 80, 'hat'), // 80 / 80 / 80 / 200 / 400 / 800
  decoration('deco-cafe', 'Café Set', 100, 'floor-right'),
  itemById('hat-beret.golden')); // { name: 'Golden Beret', price: 400, tier: 'golden', ... }
```

`purchases.ts` holds the rules: buying spends once (through `spend` in `rewards.ts`, which never touches the lifetime total), owned items are kept for good, and a bought item is put to use at once, replacing what was in its slot or spot. The shop's one big button asks `offerFor` what it should do:

```ts
offerFor(profile, item); // { kind: 'buy', price } | { kind: 'short', short } | { kind: 'use' } | { kind: 'in-use' }
takeOffer(profile, item); // buys, puts in the shop, or takes away; the scene then saves
```

Decorate opens from the results card, or from the Sprinkle Shop menu (`ShopMenu`) that the Sprinkles balance in the top bar opens between rounds or while a customer waits; the keypad is off while any of them is open (`syncInput`). Each decoration has a spot (`LAYOUT.decorSpots`); its art is a text grid in `decorArt.ts` whose `L`/`l` pixels take the tier's colours (`tierColors.ts`), and Sparkly Rainbow pieces twinkle. Two spots are room surfaces (`isRoomSurface`): `'wall'` for wall paint and `'door'` for the doors. What is used there repaints the room (`PlacedDecorations.tryOn` previews it), and taking it away brings back the plain wall or door. Tapping a colour shows the piece in the room right away; `TierCard` shows the swatches and the button, placed by `tierCardRect` clear of what the piece covers (`pieceRect`). The tray shows a page of big bubbles between ◀ ▶ arrows (`decorTraySlots` in `theme.ts`).

```ts
(decoration('door-arch', 'Arched Door', 220, 'door', 'furniture'), // a new door design: add its grid to DOOR_ART
  itemInSpot(profile.decorations, 'wall')); // the wall paint in use, if any
```

The card's words are picked by each shop:

```ts
new TierCard(scene, rect, {
  labels: (design) => ({ use: 'Wear it', remove: 'Take it off' }),
  onPick: (tier) => this.pick(tier), // try it on
  onAction: () => this.act(), // takeOffer, then save
});
```

The Closet (named after the player's shopkeeper, "Kiki's Closet") opens the same two ways and covers the whole screen (`closetLayout()` in `theme.ts`): the shopkeeper on a stage, three tabs (Clothing: hats, T-shirt, dress, skirt, shoes; Accessories: glasses, sunglasses, hearing aids, bow; Ice Cream Tools: the scooper), a tile per design and the same `TierCard`. A dress is worn instead of a T-shirt and skirt (`SLOT_CLASHES` in `catalog.ts`), and `wornWith(profile, item)` gives what the shopkeeper would have on while trying something. Whatever colour is picked is shown on them at once; buying keeps it on, and when the Closet closes the shop rebuilds them in what they now have on.

## Tests

`src/tests/` has one suite per module. `operations.test.ts` checks every operation's fact table against its own rules and shows how turning on more operations behaves. The most useful to read are `adaptiveEngine.test.ts` (mastery across rounds, misses coming back, mastered facts returning, seeded reproducibility) and `orderManager.test.ts` (full rounds, retry flow, double submits, reload mid-order). The layout suites (`layout`, `setupLayout`, `startLayout`, `myShopLayout`) share `inside`, `overlaps` and `PANEL_SCREENS` from `src/tests/rects.ts`, so every screen shape is checked the same way.

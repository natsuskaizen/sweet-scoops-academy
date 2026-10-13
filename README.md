# Sweet Scoops Academy

A cozy ice cream shop game where kids practise multiplication and division by serving customers. Built with Phaser 3, TypeScript and Vite, hosted as a static site on GitHub Pages. The full design is in [GAME_SPEC.md](GAME_SPEC.md) and a guided walk through the code is in [CODE_TOUR.md](CODE_TOUR.md). This repository currently implements **Milestone 1**.

## Quick start

Requires Node 20.19+ or 22.12+.

```bash
npm install        # install dependencies
npm run dev        # dev server at http://localhost:5173 (add ?fast to speed up animations)
npm test           # run the automated tests (Vitest)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
```

To try it on an iPad on the same Wi-Fi: `npm run dev -- --host`, then open the printed network URL in Safari and turn the iPad sideways.

## Deploying to GitHub Pages

1. Push this project to a GitHub repository with `main` as the default branch.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. `.github/workflows/deploy.yml` runs the tests, builds, and publishes `dist/`.

The site appears at `https://<user>.github.io/<repo>/`. The build uses a relative base (`./`), so it works under any repository name with no configuration. To use an absolute base instead, build with `BASE_PATH=/<repo>/ npm run build`.

## How it is put together

The rule from the spec is that **the shop never goes away**: there is one gameplay scene, and the customer, ticket, keypad, hint board and results card are layered inside it. All game rules live in plain TypeScript modules with no Phaser imports, so they are unit tested directly.

```
src/
  main.ts                    Phaser config (1280x880, Scale.FIT, pixelArt)
  core/rng.ts                seeded RNG (mulberry32) used by all game logic
  learning/
    types.ts                 subject-agnostic LearningSubject / FactRecord / VisualAid types
    mathValidator.ts         the rules: factors 1-11, dividend 10-99, quotient 1-10, no remainders
    questionGenerator.ts     fact tables, difficulty, building + validating questions
    adaptiveEngine.ts        learning -> practicing -> mastered, round planning
    mathSubject.ts           math as a LearningSubject (order text, hints, explanations)
  shop/
    orderManager.ts          round/order state machine; persists every step
    rewards.ts               the only place Sprinkles are calculated and paid
    customerManager.ts       customer roster and lineup
    catalog.ts               item catalog (prices live only here)
  save/
    saveTypes.ts             persisted shapes + SAVE_SCHEMA_VERSION
    saveValidation.ts        structural validation of save files
    saveManager.ts           localStorage with backup slot and quarantine
  characters/
    sprites.ts               original placeholder pixel art as text grids
    characterManager.ts      layered character rendering (body + outfit/hat/bow/handheld)
  scenes/
    BootScene.ts             builds textures, loads the save
    ShopScene.ts             the persistent shop: animates what OrderManager decides
    ResultsOverlay.ts        end-of-round card drawn over the shop
    shopArt.ts               procedural room, props, decorations
  ui/                        NumberKeypad, OrderPanel (+ SpeechBubble), VisualAidView,
                             StatusBar, ParentGate, Button, theme
  tests/                     Vitest suites
```

### Adaptive learning in one paragraph

Each child has separate `multiplication` and `division` records. A fact starts in **learning** the first time it is shown. A first-try correct answer moves it to **practicing**; it becomes **mastered** only after first-try success in three separate rounds (a round is one "session", so the streak can grow at most once per round). Retry-assisted answers count as progress but lower the streak; a miss schedules the fact for next round and drops it one level at most, keeping its history. Each round is planned from a target mix (4 learning, 3 practicing, 2 mastered, 1 new), split evenly between the two operations, with fallbacks when a pool is empty, so it works for a brand-new child and for one who knows everything. New facts stop being introduced while too many are still in learning. All tunables are in `DEFAULT_ADAPTIVE_CONFIG`. Every round's seed is derived from the profile seed and round number, so the same state and seed always reproduce the same questions.

### Saving

Every meaningful change (a new round, each answer, each payout, moving to the next customer) is written immediately. Each write first copies the previous valid save into a backup slot. On load, invalid or newer-version data is copied to a `quarantine.<timestamp>` key before anything else happens, then the backup is used if it is valid. Saved rounds are re-validated question by question. Payouts are guarded by a persisted `paid` flag, so double taps and reloads cannot pay twice.

### Grown-ups area

Press and hold the ⚙ button in the top-right corner for about a second, then type the number shown in words. Inside: progress per operation, facts that need practice, and three actions (reset learning progress, reset the whole profile, restore the previous save), each with a confirmation step. This is a safeguard against accidental taps, not security.

## Milestone 1 status

All items in the spec's acceptance checklist are implemented. Verified automatically: 86 unit tests, the production build, a scripted Chromium playthrough of a full 10-order round with touch input (including a wrong answer, a retry, a revealed answer, triple-tapped submit, a reload mid-order, a corrupted save, and the parent reset), the build served from a `/<repo>/` sub-path, and the portrait rotate message.

## Known limitations

- **Not yet tested on a real iPad.** It was checked in desktop Chromium at iPad viewport sizes with touch emulation. Safari on a real device still needs a look.
- Art is original placeholder pixel art and flat procedural shapes. Animation is simple tweens (walk, hop, scoop stacking). Milestone 2 covers polish.
- There is one profile ("Player 1"). Multiple profiles, profile names, and JSON export/import are Milestone 4. The save format already supports several profiles.
- The item catalog exists with a few sample items and decorations render if owned, but there is no shop or customization screen yet (Milestone 3). The results card only offers "Keep scooping!".
- Division practice uses divisors 1-12 (`DIVISION_DIVISOR_RANGE`); the validator itself only requires a positive divisor, as the spec says.
- localStorage is per browser and per device. If the browser blocks storage (some private modes), the game still plays but warns that progress will not be kept.

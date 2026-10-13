# CLAUDE.md

Sweet Scoops Academy: a cozy ice cream shop game where kids aged 5 to 8 practise math by serving customers. Phaser 3, TypeScript, Vite, static site on GitHub Pages, no backend.

- Design: [GAME_SPEC.md](GAME_SPEC.md) (the source of truth for gameplay). Code walkthrough: [CODE_TOUR.md](CODE_TOUR.md). Setup and layout: [README.md](README.md).
- Current scope is Milestone 1 plus follow-ups. Don't build later milestones unless asked.

## Commands

```bash
npm run dev            # http://localhost:5173  (?fast speeds up animations, ?ops=addition,subtraction tries other operations)
npm run typecheck
npm test               # Vitest unit tests
npm run test:coverage  # what CI runs; floors live in vite.config.ts
npm run lint
npm run format         # format:check is what CI runs
npm run build && npm run e2e   # Playwright smoke test needs a fresh build
```

Before pushing, run everything CI runs: `typecheck`, `test:coverage`, `lint`, `format:check`, `build`, `e2e`.

## Code rules (enforced by ESLint, CI fails otherwise)

- Functions at most 45 lines, cyclomatic complexity at most 12, nesting depth at most 3, at most 5 parameters. Split into small named helpers instead of disabling a rule.
- No unused code, `import type` for type-only imports, `===` only, no `console.log` (`warn` and `error` are fine).
- Tests are exempt from the length and complexity limits.

## Testing

- Every meaningful logic change comes with a unit test in `src/tests/` (one suite per module). Skip tests for trivial or low-priority logic: no tests just for the sake of tests.
- Keep game-logic coverage at 80% or more on every measure. CI enforces the floors in `vite.config.ts` (statements 85, branches 80, functions 88, lines 90); don't lower them.
- Scenes and UI are covered by the Playwright smoke test (`e2e/smoke.spec.ts`), not unit tests.
- Don't repeat yourself: look for an existing helper (for example in `src/learning/math/operation.ts`) before writing a new one.

## Architecture rules

- **All tunables live in `src/config/gameConfig.ts`.** No magic numbers for round size, rewards, pacing, ranges or timings elsewhere. Phaser-free modules read defaults from `GAME_CONFIG` and accept an override so tests can try other settings.
- **Each math operation is one file** in `src/learning/math/` implementing `MathOperation`, listed in `registry.ts` and switched on in `math.enabledOperations`. Nothing outside the operation files names a specific operation: no `if (op === 'division')` in the shop, scene, saves or UI.
- **New subjects** implement `LearningSubject` (`src/learning/types.ts`) and plug in via `src/game/services.ts`. The order flow, rewards and saves never look inside a subject's questions or progress.
- **Game logic stays Phaser-free** (`config`, `core`, `learning`, `shop`, `save`) so it is unit tested directly. Scenes only animate what `OrderManager` decides.
- Randomness goes through the seeded RNG in `src/core/rng.ts`, so a given state and seed always reproduce the same round.
- Sprinkles are computed and paid only in `src/shop/rewards.ts`; item prices live only in `src/shop/catalog.ts`.
- Saves: every meaningful change is written immediately. When the save format changes, bump `SAVE_SCHEMA_VERSION` in `saveTypes.ts` and add a step in `migrate()`. Never write data that fails validation.

## Gameplay rules from the spec

- **The shop never goes away.** No separate quiz screen or scene. Ticket, keypad, hints and results are layered inside `ShopScene`.
- **Feedback is gentle, never punishing.** A first miss gets kind words, a retry and a visual hint. A second miss shows the answer with a visual explanation and still completes the order.
- Visual only: no speech or audio required. Touch first: large targets, custom keypad, repeat taps ignored.
- **Portrait and landscape both work.** Portrait (iPhone, iPad upright) puts the shop on the top half and the ticket and keypad on the bottom. Landscape puts the register on the right. All positions come from `layoutFor()` in `src/ui/theme.ts`; rotating restarts the scene from the save.
- Art is original placeholder pixel art (text-grid sprites in `src/characters/sprites.ts`). No external assets or runtime services, and avoid new dependencies.

## Deploy and workflow

- GitHub Pages deploys **only** through GitHub Actions (`.github/workflows/deploy.yml`) on push to `main`. Don't switch Pages to a branch source or commit `dist/`: that caused the blank-purple-screen bug. Keep the relative Vite `base: './'`.
- `ci.yml` runs on every PR: Typecheck, test, build; Lint and format; Browser smoke test. After deploy, "Check live site" verifies the published page.
- Stan is the only developer. Claude works on a branch and opens a PR; Stan reviews and merges. Never push to `main`.
- Commit messages and PR titles are plain sentences describing the change (for example "Play in portrait: shop on top, ticket and keypad below"). No prefixes or ticket numbers.
- Every PR that changes structure, commands, or code that README.md or CODE_TOUR.md shows must update those docs in the same PR.

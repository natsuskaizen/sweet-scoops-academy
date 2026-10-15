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
npm run lint       # ESLint, including function-size and complexity limits
npm run format     # Prettier (format:check is what CI runs)
npm run test:coverage  # unit tests with the coverage floor
npm run e2e        # browser smoke test against the build (run npm run build first)
```

## CI gates

Every pull request and every push to `main` runs `.github/workflows/ci.yml`:

| Check                      | What fails it                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Typecheck, test, build** | type errors, a failing unit test, game-logic coverage below the floors in `vite.config.ts`, a broken build                                                   |
| **Lint and format**        | ESLint errors (functions over 45 lines, complexity over 12, nesting deeper than 3, more than 5 parameters, unused code) or files not formatted with Prettier |
| **Browser smoke test**     | the built game failing to boot, or to serve one order, at iPhone portrait, iPad portrait and iPad landscape sizes, or any page error                         |

After each deploy, **Check live site** in `deploy.yml` fetches the published page and fails if it is the unbuilt source or any of its script files do not load. To block merging on a check, add its name to the branch ruleset under **Settings → Rules**.

To try it on an iPad on the same Wi-Fi: `npm run dev -- --host`, then open the printed network URL in Safari. It plays upright or sideways.

## Deploying to GitHub Pages

1. Push this project to a GitHub repository with `main` as the default branch.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. `.github/workflows/deploy.yml` runs the tests, builds, and publishes `dist/`.

The site appears at `https://<user>.github.io/<repo>/`. The build uses a relative base (`./`), so it works under any repository name with no configuration. To use an absolute base instead, build with `BASE_PATH=/<repo>/ npm run build`.

## Installing on an iPad or iPhone

Open the site in Safari, tap **Share → Add to Home Screen**. The game then opens full screen from its own icon and plays offline once it has been opened online.

Add it to the Home Screen rather than playing in a Safari tab: Safari can delete a website's saved data after about 7 days without a visit, but not a Home Screen app's. The Home Screen app keeps its own save, separate from Safari's, so to carry progress over, use **Save a backup file** in Safari's grown-ups area, then **Load a backup file** in the Home Screen app.

Offline play comes from a service worker (`src/pwa/sw.js`). The build fills in the list of files to cache and a version (`scripts/offline-plugin.mjs`), so each deploy installs a fresh worker and drops the previous cache. The page is always fetched from the network first when online, so a deploy is never hidden behind a cached copy. Icons are drawn from `public/favicon.svg` by `node scripts/make-icons.mjs`.

## How it is put together

The rule from the spec is that **the shop never goes away**: there is one gameplay scene, and the customer, ticket, keypad, hint board and results card are layered inside it. All game rules live in plain TypeScript modules with no Phaser imports, so they are unit tested directly.

```
src/
  main.ts                    Phaser config (Scale.FIT, pixelArt), picks the layout and switches it on rotation
  config/gameConfig.ts       every tunable: round size, rewards, adaptive pacing, number ranges, enabled operations
  core/rng.ts                seeded RNG (mulberry32) used by all game logic
  audio/soundCues.ts         each sound effect as music-box tones (pitch, start, fade), from GAME_CONFIG.sound
  learning/
    types.ts                 subject-agnostic LearningSubject / FactRecord / VisualAid types
    math/
      operation.ts           the MathOperation contract + small shared helpers
      multiplication.ts      one file per operation: facts, rules, wording, hints
      division.ts
      addition.ts            (kindergarten)
      counting.ts            how many scoops? (kindergarten)
      subtraction.ts         (built, off by default)
      registry.ts            the list of operations; which ones are enabled
    mathValidator.ts         entry point for validating a question (delegates to its operation)
    questionGenerator.ts     builds validated questions from fact keys
    adaptiveEngine.ts        learning -> practicing -> mastered, round planning
    aidBeats.ts              the steps an explanation plays out (fill a cup, deal a round)
    mathSubject.ts           math as a LearningSubject, built from the enabled operations
    skillReport.ts           the lines every subject's progress report is made of
    vocab/
      skill.ts               the VocabSkill contract (like MathOperation, for reading)
      firstLetter.ts         "what letter does it start with?" (kindergarten)
      registry.ts            the list of vocab skills
      vocabSubject.ts        vocabulary as a LearningSubject, built from a game's skills
    grades.ts                grade levels and games: which subject (math or vocab) each player plays
  shop/
    orderManager.ts          round/order state machine; persists every step
    rewards.ts               the only place Sprinkles are calculated and paid
    progressReport.ts        numbers and words for the grown-ups Progress screen
    progressCalendar.ts      the kids' progress calendar: games and time per day, heart stamps
    gamePicker.ts            what the pick-your-next-game screen shows (cards, heart slices)
    playerNames.ts           shop names to roll or tap, and the letter keys' typing rules
    customerManager.ts       the 13 built-in customers (names, flavours, lines) and lineup
    addedCharacters.ts       checks for grown-up-added characters; adds them to the roster
    catalog.ts               item catalog: designs in six tiers (prices live only here)
    purchases.ts             buying with Sprinkles, owning for good, using and putting away items
  save/
    saveTypes.ts             persisted shapes + SAVE_SCHEMA_VERSION
    saveValidation.ts        structural validation of save files
    migrations.ts            one upgrade step per save format version
    saveManager.ts           localStorage with backup slot and quarantine
    backup.ts                backup files: export, validated import, summary
    profileActions.ts        players (add, choose, remove, rename) and grown-ups resets
    characterLibrary.ts      added characters, kept in their own storage key
  pwa/
    sw.js                    service worker template (offline play, fresh page on each deploy)
    registerServiceWorker.ts registers it and checks for updates on launch and resume
  game/
    services.ts              wires the save system and subject for the scenes
    backupTransfer.ts        share sheet / download and file picker for backup files
  characters/
    friendArt.ts             the built-in cast (Momo and 13 customers): 32x40 text grids; faces, walking steps and a blink drawn per pose
    reactions.ts             hearts for a right answer, a "?" bubble for a first miss
    scooperArt.ts            Momo's scooper held in her paw: wooden, plus one per item tier from her Closet
    wearArt.ts               clothes and accessories on the friends' frame in tier colours; each friend without their own topper
    tierColors.ts            the colours of each item tier (Sparkly Rainbow in bands)
    sprites.ts               16x20 species and clothing layers (Milestone 3 equipment)
    characterManager.ts      layered species rendering (body + outfit/hat/bow/handheld), sprite sheets for the cast and added characters
  scenes/
    BootScene.ts             builds textures, loads the save
    ShopScene.ts             the persistent shop: runs the order flow, animating what OrderManager decides
    newPlayerSetup.ts        a new player's setup in the register: name, shop name, shopkeeper
    startScreen.ts           the start screen: hello to whoever played last, Open the shop!, the other players and New
    myShop.ts                My shop, the kids' settings from ⚙: shop name, shopkeeper, hints, calm mode, switch player
    parentArea.ts            what the grown-ups area shows and every action in it
    backupActions.ts         grown-ups area actions for saving and loading backup files
    characterActions.ts      grown-ups area action that opens the Characters dialog
    playerActions.ts         grown-ups area action that opens the Players dialog (rename, remove)
    gradeAction.ts           grown-ups area screen for a player's grade
    ResultsOverlay.ts        end-of-round sticker card (one sticker per customer, confetti)
    parade.ts                a perfect round's parade before the card, with Skip
    serveAnimation.ts        the shopkeeper's scooper carries each scoop from its tub to the cone
    shopArt.ts               prop textures, draws the room
    decorArt.ts              decoration pixel art in tier colours, and the decorations placed in the room
    doorArt.ts               the doors sold in Decorate (painted into the room) and the wall paint's icon
    decorateMode.ts          Decorate: the whole room, a paged tray of decorations, try a colour then buy
    closetMode.ts            the shopkeeper's Closet: Clothing, Accessories and Ice Cream Tools; try a colour on, then buy
    closetParts.ts           the Closet's backdrop, top bar, tabs and item tiles
    shopRoom.ts              the pixel-art room and counter (strawberry parlour), repainted for wall paint and doors
    roomPixels.ts            tiny pixel painter the room is drawn with
  ui/                        NumberKeypad, OrderPanel (+ SpeechBubble), VisualAidView,
                             StatusBar, ShopMenu, ParentGate, ProgressScreen, Button, TierCard, theme,
                             WallCalendar (on the shop wall) and CalendarScreen (the progress calendar),
                             CharacterDialog and PlayersDialog (DOM forms sharing domDialog.ts);
                             tweenAsync.ts turns tweens and timers into awaitable promises;
                             aidLayout.ts sizes the hint board's scoops and cups (unit tested);
                             setupLayout.ts places the new-player setup's keys and cards (unit tested);
                             GamePicker is the pick-your-next-game screen shown before every round;
                             ChoicePad is the answer buttons (letters, colours, pictures) in the keypad's place, placed by choiceLayout.ts;
                             startLayout.ts, myShopLayout.ts and pickerLayout.ts place the start screen, My shop and the picker (unit tested);
                             motion.ts holds calm mode for the character animations and confetti;
                             sound.ts plays the sound effects with Web Audio (no audio files), starting on the first tap;
                             registerCard.ts draws the register panel's card the setup, start screen and My shop share;
                             theme.ts also has DEPTH, the order the bar, cards and screens draw over the shop
  tests/                     Vitest suites (rects.ts: shared helpers for the layout suites)
e2e/                         Playwright: smoke test, new player, offline and backup, redeploy
scripts/                     offline-plugin.mjs (writes dist/sw.js), make-icons.mjs, check-live-site.mjs
public/                      favicon, manifest.webmanifest, Home Screen icons
```

### Changing settings

Everything you are likely to tweak is in [`src/config/gameConfig.ts`](src/config/gameConfig.ts): orders per round, attempts per order, Sprinkle amounts, adaptive pacing, number ranges per operation, the times-table difficulty tiers, and timings. The Phaser-free modules read their defaults from it and also accept an override, which is how the tests try other settings.

```ts
math: {
  enabledOperations: ['multiplication', 'division'],   // add 'addition', 'subtraction'
  multiplication: { factor: { min: 1, max: 11 } },
  addition: { addend: { min: 1, max: 10 }, maxSum: 20 },
  ...
}
```

Which operations a player practises comes from their grade, chosen in the grown-ups area, and the game the child picks before each round. Each grade in `grades.levels` has its own number ranges (on top of `math`) and its games (`games`), each naming its subject and skills, with a label, symbol and hint for its card on the pick-a-game screen:

```ts
grades: {
  defaultGrade: 'grade3',
  levels: [
    { id: 'kindergarten', label: 'Kindergarten', math: { addition: { addend: { min: 1, max: 4 }, maxSum: 5 }, ... },
      games: [{ id: 'counting', label: 'How many?', symbol: '123', hint: 'Count the scoops', subject: 'math', skills: ['counting'] },
             { id: 'letters', label: 'First letter', symbol: 'Aa', hint: '...', subject: 'vocab', skills: ['firstLetter'] }, ...],
      startMode: 'mixed', preReaders: true },
    { id: 'grade3', label: '3rd grade', math: {},
      games: [{ id: 'multiplication', ... }, { id: 'division', ... }, { id: 'mixed', ... }] },
  ],
}
```

Words for the reading games are `vocab.words` (a word and the key of its pixel picture in `src/characters/wordArt.ts`) and `vocab.letterChoices` (how many letter buttons a first-letter question has). To add a reading skill, write a `VocabSkill` file in `src/learning/vocab/`, list it in `registry.ts` and name it in a game's `skills`.

`math.enabledOperations` is the default for code and tests that don't pass a grade. To try other operations for every player without editing the config, run `npm run dev` and open `http://localhost:5173/?ops=addition,subtraction`.

### Adding a math operation or a subject

An operation is one file that implements `MathOperation` (`src/learning/math/operation.ts`): its fact table, validation, fact key, order wording, and the hint and explanation to draw. Register it in `registry.ts`, give it rules in `MathConfig`, and turn it on in `enabledOperations`. Rounds split evenly across enabled operations, each keeps its own progress record, and saves made before it existed simply start an empty record for it. Operations that are switched off stay known, so a round saved while one was on still loads.

A whole new subject (spelling, vocabulary) implements `LearningSubject` (`src/learning/types.ts`) and is plugged in in `src/game/services.ts`. The order flow, rewards and saves never look inside a subject's questions or progress.

### Adaptive learning in one paragraph

Each child has separate `multiplication` and `division` records. A fact starts in **learning** the first time it is shown. A first-try correct answer moves it to **practicing**; it becomes **mastered** only after first-try success in three separate rounds (a round is one "session", so the streak can grow at most once per round). Retry-assisted answers count as progress but lower the streak; a miss schedules the fact for next round and drops it one level at most, keeping its history. Each round is planned from a target mix (4 learning, 3 practicing, 2 mastered, 1 new), split evenly between the two operations, with fallbacks when a pool is empty, so it works for a brand-new child and for one who knows everything. When a child is keeping up, empty learning slots are filled with new facts rather than repeats, and while recent first-try accuracy in an operation stays at 85% or more, new facts skip ahead to a few difficulty levels above the hardest fact already answered first try. After misses it falls back to the easiest unseen facts, and new facts stop being introduced while too many are still in learning. All tunables are in `GAME_CONFIG.adaptive`. Every round's seed is derived from the profile seed and round number, so the same state and seed always reproduce the same questions.

### Saving

Every meaningful change (a new round, each answer, each payout, moving to the next customer) is written immediately. Each write first copies the previous valid save into a backup slot. On load, invalid or newer-version data is copied to a `quarantine.<timestamp>` key before anything else happens, then the backup is used if it is valid. Saved rounds are re-validated question by question; a round that no longer fits today's rules (say, after narrowing a factor range) is dropped so the rest of the save still loads. Payouts are guarded by a persisted `paid` flag, so double taps and reloads cannot pay twice. Older saves are upgraded on load by the steps in `src/save/migrations.ts` (version 2 added round timing, version 3 the progress calendar's daily log, version 4 each player's own shop name and shopkeeper), and the result is validated like any other save.

### Screen layouts

The shop room is always the same 800x880 drawing. Only the register (order ticket and keypad) moves:

- **Landscape** (iPad sideways, phones sideways): 1280x880 with the register on the right.
- **Portrait** (iPhone, iPad upright): 800 wide by 1360-1600 tall, depending on the screen's shape, with the shop on top and the register on the bottom half.

All positions come from `LAYOUT` in `src/ui/theme.ts`, built by `layoutFor(screenW, screenH)`. When the screen turns, `main.ts` resizes the game and restarts the shop scene, which rebuilds from the save exactly like a reload, so nothing is lost mid-order. This replaces the spec's "please rotate" screen.

### My shop (kids' settings)

Tap the ⚙ button in the top-right corner. The register panel shows the player's own settings, with no lock because they only change that player's things: change their own name, the shop's name or shopkeeper (the matching setup step; Done and ✕ both come back to My shop), Hints on or off, Calm mode (characters stand still instead of breathing and hopping, and no confetti falls), Switch player (back to the start screen), and a button to the grown-ups area.

### Grown-ups area

Press and hold the ⚙ button in the top-right corner for about a second (or tap Grown-ups in My shop or on the start screen), then type the number shown in words. Inside: progress per operation, facts that need practice, and these actions:

- **Progress**: a switch in the top-left corner (mirroring Close) flips between two views. **Rounds** shows totals (rounds played, time playing, % right first try) over a 2x2 grid of cards, newest first with Newer/Older pages. Each card has when the round was played, how long it took, the first-try count, one dot per order (green first try, blue 2nd try, pink answer shown) and up to three questions to practise. **Overview** shows the last 7 days (rounds, time playing, average round length), a bar for each of the last 10 rounds, and the questions that needed help most in the last 5 rounds. Time is active play: any gap between taps counts as 2 minutes at most (`GAME_CONFIG.round.playTimeIdleCapMs`), so a round left open overnight still shows minutes. Rounds finished before timing was added show a dash. Page sizes and look-backs are in `GAME_CONFIG.parentArea`. None of this appears outside the grown-ups area.
- **Save a backup file**: the whole save as JSON, through the share sheet on iPad and iPhone (Save to Files, AirDrop, Mail) or as a download elsewhere.
- **Load a backup file**: picks a file, checks it the same way a save is checked on load, shows whose progress it holds, and replaces the current progress only after a confirmation. The replaced progress is kept aside in storage, not deleted.
- **Players**: everyone who plays on this device, with their shop and totals. Rename a player, or remove one (tap Remove twice; the last player can't be removed). Removing the player who was playing goes back to the start screen. Children add new players from the start screen.
- **Characters**: add your own characters from a picture, switch them on or off, or remove them. See below.
- **Restore previous save**, **Reset learning progress**, **Reset whole profile**, each with a confirmation step.

This is a safeguard against accidental taps, not security.

### Adding your own characters

In the grown-ups area, **Characters** then **Add a character** picks a picture and asks for a name, a role and a favourite flavour. The picture stays in the browser on that device (never uploaded) and is included in backup files.

- **Picture**: a PNG with a transparent background, at most 300 KB. One row of equal frames, left to right: standing, happy, thinking, walk A, walk B. A sheet has 1, 2, 3 or 5 frames; missing poses use the standing frame, and without walk frames the character sways instead of stepping.
- **Frame size**: the built-in 16×20 grid times 1 to 4 (16×20, 32×40, 48×60 or 64×80), so shop accessories can scale onto it. Draw the character facing the player, centred, feet on the bottom edge. For example, 5 frames of 32×40 is a 160×40 PNG.
- **Role**: a customer joins the line of visitors from the next round; a shopkeeper replaces Momo (the newest switched-on one is used).
- **Head and neck**: tap the picture at the top of the head, then the neck. Optional; it records where hats and bows will sit (Milestone 3).
- **Lines**: up to 3 hello and 3 thank-you lines, 24 characters each; built-in ones are used if empty.

Up to 12 characters per device. The limits are in `GAME_CONFIG.addedCharacters`. A wrong-sized picture is refused with the size it should be.

## Milestone 1 status

All items in the spec's acceptance checklist are implemented. Verified automatically: 110 unit tests, the production build, a scripted Chromium playthrough of a full 10-order round with touch input (including a wrong answer, a retry, a revealed answer, triple-tapped submit, a reload mid-order, a corrupted save, and the parent reset), the build served from a `/<repo>/` sub-path, and portrait play on iPhone and iPad sizes including rotating mid-order.

## Known limitations

- **Not yet tested on a real iPad or iPhone.** It was checked in desktop Chromium at iPad and iPhone viewport sizes with touch emulation. Safari on a real device still needs a look.
- Art is original pixel art: the room is painted at 1/4 resolution and scaled up so it matches the characters; the built-in cast waddles on stepping feet, breathes and blinks while waiting, cheers or tilts their head at an answer, and Momo scoops from the tubs. Timings are in `GAME_CONFIG.animation`.
- Milestone 4 (in progress): the save holds several players, each with their own shop name, shopkeeper, Sprinkles, items and progress (`src/save/profileActions.ts`). A brand new game first asks the child's name, lets them roll, pick or type a shop name (the sign follows) and choose one of six friends for behind the counter. Coming back opens on a start screen in front of the shop of whoever played last (door shut), with one big "Open the shop!" button; under "Not Ava?" the other players switch in, and New sets up another child. Tapping ⚙ opens My shop, where a child changes their shop's name or shopkeeper, turns hints or calm mode on and off, or switches player. Grown-ups rename or remove players from Players in the grown-ups area.
- Decorate and the Closet (Milestone 3) open from the results card, or by tapping the Sprinkles balance in the top bar (between rounds or while a customer waits, not while serving). Decorate sells furniture and little decorations, wall paint and three doors; the Closet sells clothes, accessories and scoopers; everything comes in six tiers. The player's shopkeeper (any of the six) wears Closet items; a shopkeeper added from a picture serves with the chosen scooper but does not wear clothes or accessories.
- Division practice uses divisors 1-12 (`GAME_CONFIG.math.division.divisor`); the spec itself only requires a positive divisor.
- Addition and subtraction are built and tested but switched off, since Milestone 1 is multiplication and division. Their hints use simple piles of scoops; the difficulty curve for them is a first guess.
- localStorage is per browser and per device (and the Home Screen app has its own); backup files move progress between them. If the browser blocks storage (some private modes), the game still plays but warns that progress will not be kept.

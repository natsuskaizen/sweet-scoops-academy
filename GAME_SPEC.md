# Sweet Scoops Academy

Game Design and Implementation Specification

- **Project type:** HTML5 educational game
- **Target devices:** iPad and mobile browsers, with landscape orientation as the primary and required gameplay orientation
- **Hosting:** GitHub Pages
- **Framework:** Phaser 3, TypeScript, Vite
- **Audience:** Children aged 5 and 8
- **Initial learning content:** Third-grade multiplication and division
- **Visual style:** Cute, cozy pastel pixel art
- **Core concept:** Run an ice cream shop, serve customers, solve math problems, earn Sprinkles, and customize the shop and characters.

## 1. Project Vision

Sweet Scoops Academy is a cozy educational game where children run an ice cream shop staffed by cute original characters.

Customers enter the store and place orders. Each order contains a multiplication or division problem that the player must solve to prepare the correct ice cream. Correct answers earn Sprinkles, the game's non-monetary currency.

Players spend Sprinkles on clothing, accessories, and decorations for their characters and shop.

The game should feel like playing a cozy shop simulator that naturally incorporates math practice, not a quiz application.

### Core design principles

1. The shop is the primary game environment and remains visible during gameplay.
2. Customers physically enter the shop and interact with the shopkeeper.
3. Math questions are integrated into customer orders.
4. The game adapts to each child's knowledge without requiring an initial assessment.
5. Mistakes are learning opportunities, never punishments.
6. Players earn rewards for answering questions and completing rounds.
7. Characters, clothing, and decorations provide long-term motivation.
8. Progress is saved locally and can be exported and restored.
9. The architecture must support additional educational subjects in the future.
10. The game must work well with touch input on an iPad.

## 2. Technology Stack

Use the following technologies:

- **Phaser 3:** 2D game engine, scenes, sprites, animation, input, and game rendering.
- **TypeScript:** Strongly typed game logic and maintainable modular architecture.
- **Vite:** Development server and static production build.
- **GitHub Pages:** Static hosting.
- **Browser local storage:** Initial persistent save system.
- **JSON:** Portable save-file export and import format.
- **Automated tests:** Validate question generation, adaptive learning, rewards, and saving.

No backend, account system, or paid service is required for the initial version.

Prefer current stable, mutually compatible dependencies and document the installation and build commands.

## 3. Primary Gameplay: The Shop Must Always Remain Visible

This is a critical design requirement.

Do not create a separate quiz screen. Do not transition to a dedicated math scene when a question begins.

The shop remains visible while customers arrive, place orders, wait for answers, receive their ice cream, and leave.

The game should use one persistent shop scene with UI components layered into it.

### Landscape layout

The primary gameplay interface should contain:

- **Shop area:** The shop interior, entrance, counter, shelves, ice cream display, decorations, shopkeeper, and customer.
- **Order area:** Customer portrait or sprite, dialogue bubble, current order, math expression, and answer display.
- **Number keypad:** Large touch-friendly number buttons, backspace, and submit.
- **Status area:** Current order number, round progress, and Sprinkles balance.

The layout may reposition these elements responsively, but all remain part of the same shop environment.

The scene should never be obscured by a full-screen quiz interface.

### Customer order sequence

Each of the 10 orders follows this sequence:

1. A customer enters through the shop door.
2. The customer walks toward the counter.
3. A short visual greeting or speech bubble appears.
4. The customer describes the order.
5. A math expression appears on the order ticket or counter panel.
6. The player enters an answer using the on-screen number keypad.
7. The game checks the answer.
8. If incorrect, the customer waits patiently and the game offers one retry with a hint.
9. If the second answer is incorrect, the game shows the correct answer and a visual explanation.
10. The shopkeeper prepares the order.
11. The customer reacts positively, the reward is displayed, and the customer leaves.
12. The next customer enters.

Animations can be simplified during the initial prototype, but the gameplay state transitions must support this complete sequence.

### End of round

After the tenth order:

- Display a round-completion overlay while keeping the shop visible.
- Show completed orders, first-attempt accuracy, Sprinkles earned, and bonuses.
- Celebrate a perfect round.
- Allow the player to continue playing or return to the shop customization interface when implemented.

## 4. Art Direction and Characters

Use a cute, cozy, pastel pixel-art aesthetic suitable for children.

Suggested palette:

- Strawberry pink
- Cream white
- Mint green
- Sky blue
- Lavender
- Soft peach
- Warm brown accents

Use crisp pixel-art sprites, readable silhouettes, expressive character animations, and a consistent pixel scale.

Avoid overly complex backgrounds or tiny interface text.

### Original character direction

Create original characters with a cute collectible-character aesthetic.

Suggested initial cast:

- A white cloud puppy with long floppy ears and blue accents.
- A pink bunny who loves strawberry ice cream.
- A small white kitten who enjoys inventing new flavors.

These are original concepts and must not copy recognizable copyrighted character designs.

Do not use unlicensed Hello Kitty, Cinnamoroll, My Melody, or other Sanrio artwork. The art pipeline should allow authorized assets to be substituted later if appropriate.

### Layered character customization

Design the character rendering system so that clothing and accessories can eventually be layered over a base character.

Possible layers:

- Base body
- Outfit
- Hat or head accessory
- Bow or hair accessory
- Optional handheld item

Use placeholder sprites during the first milestone. Do not delay core gameplay to create a complete asset collection.

## 5. Math Question Generation

Multiplication and division must both be available from the beginning.

The two operations must maintain independent adaptive learning records for every child.

### Grade levels

Each child has a grade level, chosen by a grown-up in the parent area (new players start in 3rd grade). The grade decides what the shop's questions practise:

- **3rd grade**: three games: Grouping (multiplication only), Sharing (division only) and Mix it up (both).
- **Kindergarten**: three games: How many? (counting up to 5), Adding (within 5) and Mix it up (both). Players can't read yet, so orders are drawn as pictures (a cone of scoops, or piles of scoops with a plus between) and the number keys show dots, so a child can match a count to its key. Every scoop is drawn whole and clear of its neighbours so none can be mistaken for hidden. More kindergarten question types (take away, make 10, which is more) and kindergarten reading follow; see the Milestone 5 tracker.

Changing grade starts a fresh round. Each operation's learning record is kept, so a child who switches back carries on where they left off.

### Picking the next game

Children, not grown-ups, choose which game to play. Before every round, including the first after opening the shop, a "What shall we play?" screen covers the ticket and keypad with one big card per game of the child's grade (a symbol, a name and a few words, such as "÷ Sharing"). Tapping a card starts a round of that game. A grade with a single game would skip the screen, and a round already in progress is resumed without asking.

A heart needs different games, not the same one three times. The heart on the screen has one slice per game the heart needs (the daily goal, but never more than the grade offers); each different game played today fills a slice. Cards already played today show "✓ played" and can still be played, but add no slice; unplayed ones say "new!". "Mix it up" is its own game, so it fills its own slice. After the round that earns the heart, the screen says "You earned a heart!".

### Multiplication rules

- Both factors must be integers from 1 through 11, inclusive.
- Calculate the correct product programmatically.
- Do not generate factors outside this range.
- Avoid unnecessary duplicate questions within a round.
- Treat commutative facts consistently for mastery tracking. For example, 5 × 6 and 6 × 5 may share a mastery record while still allowing varied practice.

Examples:

- 5 × 6 = 30
- 11 × 5 = 55
- 3 × 9 = 27

Invalid examples:

- 12 × 5
- 23 × 12

### Division rules

- The dividend must be an integer from 10 through 99.
- The divisor must be a positive integer.
- The quotient must be a whole number from 1 through 10.
- Remainders are not allowed.
- The answer must be calculated programmatically.
- Do not generate questions with a three-digit dividend.

Examples:

- 10 ÷ 2 = 5
- 15 ÷ 5 = 3
- 30 ÷ 5 = 6
- 99 ÷ 9 = 11 is invalid because the quotient exceeds 10.

### Question validation

The generator must validate every question before displaying it.

Write automated tests for boundary conditions and invalid cases.

If the generator cannot produce a valid question, it must retry or report a controlled error rather than displaying an invalid problem.

### Future educational subjects

Do not hardcode math-specific assumptions into the customer or shop systems.

Create a reusable learning-challenge interface that can eventually support:

- Multiplication
- Division
- Vocabulary
- Spelling
- Science questions
- Other educational activities

The learning module should provide a prompt, answer input requirements, answer validation, and optional explanation.

The shop handles customer flow, rewards, and presentation independently of the subject being practiced.

## 6. Adaptive Learning System

The game must learn through play rather than starting with a formal assessment.

Each child has separate learning records for multiplication and division.

### Learning states

Every tracked fact has one of three states:

**Learning**

- Newly introduced or difficult facts.
- Presented regularly.
- May be accompanied by visual hints.

**Practicing**

- Facts answered correctly before but not yet consistently.
- Mixed with familiar questions and new challenges.

**Mastered**

- Facts answered correctly across multiple rounds.
- Presented less frequently but revisited periodically.

A single correct answer must never be enough to mark a fact mastered.

### Learning signals

Track at least:

- Number of presentations
- First-attempt correct count
- Retry-assisted correct count
- Recent outcomes
- Current learning state
- Last presentation time
- Next recommended practice time or round
- Consecutive successful sessions, where applicable

A wrong answer should increase the priority of future practice without resetting all accumulated progress.

Correct answers on retry count as learning progress but provide weaker evidence of mastery than first-attempt answers.

### Question selection

The adaptive engine should:

1. Begin with accessible facts while sampling both multiplication and division.
2. Introduce new facts gradually.
3. Prioritize facts that need practice.
4. Include familiar facts to build confidence.
5. Occasionally revisit mastered facts.
6. Avoid excessive repetition within a round.
7. Adapt separately for each operation.
8. Adapt separately for each child.

Suggested initial 10-question composition:

- 4 questions from facts currently being learned.
- 3 questions from facts being practiced.
- 2 questions from mastered facts.
- 1 new or slightly more challenging question.

These are flexible targets, not rigid quotas. The engine must handle children who have very little prior knowledge and children who already know most facts.

Use a simple, deterministic algorithm with configurable parameters. Do not introduce machine learning or an external AI dependency.

For testing, support a seeded random number generator so the same state and seed can reproduce the same question sequence.

### Progress presentation

Child-facing feedback should be positive and simple.

Show:

- Orders completed
- Sprinkles earned
- New items unlocked
- Encouraging visual celebrations
- A progress calendar, opened from a calendar on the shop wall: a heart stamp on each day the child plays the daily goal of different games (3 by default; a grown-up can change it in the parent area, and it never asks for more different games than the child's grade offers), with the time played that day. Every subject's games count toward the same heart, and a small badge shows which subjects were played. Days short of the goal show the games played, never a cross, and a heart once earned stays.

Do not display negative labels such as "bad at multiplication" or compare siblings.

Detailed fact-level performance belongs in the parent area.

## 7. Answer Input and Feedback

Use a custom on-screen number keypad.

Requirements:

- Digits 0–9
- Backspace
- Submit button
- Large touch targets
- Clear indication of the current entered answer
- Prevention of repeated submissions while an answer is being processed
- No requirement for a physical keyboard
- No multiple-choice interface in the initial version

### Incorrect-answer flow

First incorrect answer:

- Display gentle feedback.
- Offer one retry.
- Show a visual hint relevant to the problem.

Second incorrect answer:

- Display the correct answer.
- Explain it visually.
- Complete the order without penalizing the player.

For example, multiplication can be explained through equal groups of ice cream scoops. Division can be shown by distributing scoops equally among cones or customers.

The game is visual-only. Do not require speech or audio. Gentle sound effects (Milestone 6) are an optional extra: every sound accompanies something already shown on screen, and the game plays the same with sound off.

## 8. Customers and Storytelling

Customers should feel like the heart of the game.

Create a customer system that can eventually support multiple characters, expressions, order preferences, and animations.

Each customer may have:

- Name and character sprite
- Entrance and exit animation
- Dialogue or speech bubble
- Order description
- Math question
- Reaction to the completed order
- Optional favorite flavor or cosmetic preference

Keep dialogue short enough for young children.

Examples:

- "Can I get 5 cones with 6 scoops each?"
- "Please share 24 scoops equally between 4 friends."
- "I'd love 3 strawberry cones with 4 scoops on each!"

The math expression should be prominent and unambiguous. The natural-language order provides context, but the child should not need to infer a complicated word problem to understand the intended operation.

Initially, customers can use a small fixed set of original sprites and simple animations. Make it straightforward to add more customers later.

## 9. Sprinkles Reward System

Sprinkles are the game's non-monetary currency.

### Question rewards

- Correct on first attempt: 10 Sprinkles.
- Correct on second attempt: 5 Sprinkles.
- Incorrect after the retry and explanation: 2 Sprinkles.

### Round bonuses

- Complete all 10 orders: +10 Sprinkles.
- Answer all 10 questions correctly on the first attempt: +50 bonus Sprinkles.

A perfect round therefore earns 160 Sprinkles.

Rewards must be calculated by a single reward module.

Each order must be paid out exactly once, even if the submit button is tapped repeatedly or the scene is interrupted.

Persist the reward balance and completed-order status so reloads cannot accidentally duplicate payouts.

### Future purchases

The reward economy should support:

- Clothing
- Hats
- Bows
- Accessories
- Character outfits
- Ice cream shop decorations
- Furniture
- Wallpaper
- Signs
- Special collectible items

Purchased items should remain owned permanently.

Do not deduct currency for incorrect answers, and do not remove previously purchased items.

For the first milestone, implement the currency and results display. The complete inventory and shopping experience can follow in a later milestone.

## 10. Shop Customization

The game has one main decorating room.

The room should gradually become more personalized as the child unlocks decorations.

Examples:

- New counter
- Tables and chairs
- Plants
- Lamps
- Wall decorations
- Ice cream displays
- Wallpaper
- Floor patterns

Purchased decorations should appear in the actual shop scene.

For the first prototype, a small number of sample decoration placeholders is sufficient.

Future implementation should support a decoration catalog with:

- Unique item ID
- Display name
- Price
- Asset reference
- Category
- Ownership status
- Placement or equipment data

Do not hardcode item prices throughout the codebase.

## 11. Profiles and Saving

Each child should have an independent profile.

Each profile stores:

- Display name or nickname
- Sprinkles balance
- Owned items
- Equipped clothing and accessories
- Shop decorations
- Multiplication learning state
- Division learning state
- Round history
- Achievements
- Settings
- Save schema version

Use local storage for the initial implementation.

### Save requirements

- Autosave after meaningful state changes.
- Save progress when an order is completed.
- Save currency changes and purchases.
- Save learning progress and profile changes.
- Validate saved data before using it.
- Include a schema version for future migrations.
- Handle missing, malformed, or incompatible saves gracefully.
- Preserve a known-good recovery copy where feasible.

### Future backup features

Add parent-accessible controls for:

- Exporting a profile to a JSON file.
- Importing a previously exported save.
- Validating an imported file before replacing progress.
- Confirming destructive restore operations.
- Resetting an individual profile.

Local storage is not a cloud-sync solution. Exported backups are necessary to recover from browser-data deletion or device changes.

Comprehensive export/import and recovery tooling may be completed in a dedicated save-system milestone.

## 12. Parent Gate

Provide a parent-only area for settings and destructive actions.

Initially, protect:

- Profile resets
- Save restoration
- Profile deletion
- Learning progress resets
- Future settings that affect game progression

Use a simple adult confirmation mechanism suitable for a local family game.

This is an accidental-access safeguard, not strong authentication. Do not store real passwords or sensitive information in the game.

## 13. Device and Interface Requirements

Target landscape gameplay on iPad Safari.

Requirements:

- Landscape-first fixed game composition.
- Responsive scaling for supported landscape screen sizes.
- Large touch-friendly controls.
- No hover-dependent interactions.
- Readable text.
- Clear feedback and button states.
- No dependence on sound.
- Graceful handling of browser resizing and orientation changes.

If the game is opened in portrait mode, display a clear instruction to rotate the device rather than presenting a broken layout.

Do not assume the browser can forcibly lock orientation.

Test on actual iPad Safari as well as desktop browsers.

## 14. Project Structure

Use a modular structure similar to:

```
src/
  main.ts
  scenes/
    BootScene.ts
    ShopScene.ts
    ResultsOverlay.ts
  learning/
    types.ts
    questionGenerator.ts
    adaptiveEngine.ts
    mathValidator.ts
  shop/
    customerManager.ts
    orderManager.ts
    rewards.ts
  characters/
    characterManager.ts
  save/
    saveManager.ts
    saveTypes.ts
  ui/
    NumberKeypad.ts
    OrderPanel.ts
    ParentGate.ts
  tests/

public/assets/
  characters/
  shop/
  ui/
  fonts/
```

The exact filenames may be adjusted to fit good Phaser architecture, but keep responsibilities separate.

Important architectural rule: the shop remains the persistent gameplay scene. Customer, order, keypad, and rewards components update inside that scene. Do not create a separate quiz scene.

A brief results overlay is permitted, with the shop visible behind it.

## 15. Implementation Milestones

### Milestone 1 — Learning Engine and Playable Prototype

Deliver:

- Phaser, TypeScript, and Vite project setup.
- Landscape shop scene with placeholder art.
- Customer arrival and departure flow.
- Ten-question rounds.
- Multiplication and division generation.
- On-screen numeric keypad.
- One retry and visual explanation.
- Separate adaptive tracking for both operations.
- Sprinkles and round bonuses.
- Initial local save support.
- Parent gate for destructive actions.
- Automated tests.
- GitHub Pages build configuration.

The prototype must complete an entire 10-order round without leaving the shop view.

### Milestone 2 — Visual and Gameplay Polish

Deliver:

- Improved original pixel-art shop.
- Better customer and shopkeeper animations.
- Visual multiplication and division explanations.
- More customer variations.
- Improved feedback and results presentation.

### Milestone 3 — Rewards and Customization

Deliver:

- Item catalog.
- Shopping interface.
- Clothing and accessory equipment.
- Shop decorations placed in the room.
- Permanent ownership and currency transactions.

### Milestone 4 — Profiles and Backup System

Deliver:

- Multiple child profiles.
- Profile selection.
- Independent inventories and learning progress.
- JSON export and import.
- Save validation and recovery.
- Parent management interface.

### Milestone 5 — Content Expansion

Deliver:

- More original characters.
- More cosmetic items and decorations.
- Vocabulary learning module.
- Additional educational subjects through the generic challenge interface.

### Milestone 6 — Sound Effects

Deliver:

- Soft, pleasant sound effects made in the browser with Web Audio: no audio files, no new dependencies, nothing extra to cache offline.
- Sounds for the keypad, customers arriving, scooping, serving and Sprinkles.
- Gentle sounds for misses, hints and visual explanations. Never a buzzer or a "wrong" sound; a second miss ends with the same warm sound as a correct order.
- Celebration sounds for round results, calendar hearts and the sprinkle shop.
- A Sounds switch for each player, on by default; calm mode makes sounds quieter and skips flourishes.
- Sound starts on the first tap, follows the iPhone and iPad silent switch where Safari allows it, and pauses when the game is hidden.

Pleasant means: rounded tones from one major pentatonic scale, quick soft starts and fades, short sounds, and a quiet default volume. The style is a music box (soft tines with a gentle ring), picked by Stan from a listening sampler.

## 16. Milestone 1 Acceptance Checklist

The first milestone is complete only when all required items pass.

### Math correctness

- Multiplication factors are always integers from 1 through 11.
- Division dividends are always integers from 10 through 99.
- Division quotients are always integers from 1 through 10.
- Division questions never have remainders.
- Generated questions are validated before display.
- Automated tests cover boundaries and invalid cases.

### Adaptive learning

- Multiplication and division have independent progress records.
- New facts begin in the Learning state.
- First-attempt answers and retry-assisted answers are tracked separately.
- Mastery requires repeated success across multiple rounds.
- Missed facts receive additional practice.
- Previously mastered facts return periodically.
- Question sequences can be reproduced using a seeded random generator.

### Gameplay

- Customers enter, place orders, and leave.
- The shop remains visible throughout all orders.
- No separate quiz screen exists.
- The player can complete a 10-order round.
- The number keypad works with touch input.
- Incorrect first attempts permit one retry.
- Incorrect second attempts display the correct answer and explanation.
- Each order can pay out rewards only once.
- The results overlay displays round totals and bonuses.

### Saving and safety

- Progress survives a browser reload.
- Saved data is validated and versioned.
- Corrupt data does not silently overwrite recoverable data.
- Destructive actions require parent confirmation.
- Save state is not lost when moving between shop UI states.

### Deployment

- The production build succeeds.
- Automated tests pass.
- Assets load under the GitHub Pages project URL.
- The game works in iPad Safari landscape mode.
- Portrait mode displays an appropriate rotation message.
- Local development and deployment instructions are documented.

## 17. Instructions for the Coding Agent

Before writing code:

1. Inspect the existing repository and determine whether it already contains a project.
2. If the repository is empty, initialize the project with Phaser 3, TypeScript, and Vite.
3. Implement the learning engine and automated tests before building elaborate visuals.
4. Keep the shop scene persistent during gameplay.
5. Use original placeholder pixel-art assets or simple procedural graphics initially.
6. Avoid unnecessary dependencies and external runtime services.
7. Keep math generation, adaptive learning, rewards, and save logic testable independently of Phaser.
8. Do not implement future milestones prematurely if doing so delays the first playable prototype.
9. Run the tests and production build, and fix any failures before declaring the milestone complete.
10. Document how to run the game locally and deploy it to GitHub Pages.

**Definition of success:** A child can open Sweet Scoops Academy on an iPad in landscape orientation, watch customers enter the ice cream shop, solve 10 multiplication and division orders using the on-screen keypad, receive gentle feedback, earn Sprinkles, and retain learning progress after refreshing the browser—all without leaving the shop view.

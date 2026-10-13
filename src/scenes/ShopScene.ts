/**
 * The one persistent gameplay scene. Customers, the order ticket, the keypad,
 * hints and the results card are all components layered inside it; nothing
 * ever switches to a separate quiz screen.
 *
 * Game rules live in OrderManager (Phaser-free and unit tested). This scene
 * only animates what the manager says and forwards what the player taps.
 */
import Phaser from 'phaser';
import {
  addedLook,
  CharacterView,
  friendLook,
  registerAddedTextures,
  type AnyLook,
} from '../characters/characterManager';
import { SERVICES_KEY, type GameServices } from '../game/services';
import { GAME_CONFIG } from '../config/gameConfig';
import { createProfile } from '../save/saveManager';
import { resetSubjectProgress, subjectProgress } from '../save/saveTypes';
import type { RoundSummary } from '../save/saveTypes';
import { chosenShopkeeper, customerRoster } from '../shop/addedCharacters';
import { lineFor, type CustomerDef } from '../shop/customerManager';
import { OrderManager, type ActiveOrder, type RoundSticker } from '../shop/orderManager';
import type { AttemptOutcome, ChallengePresentation } from '../learning/types';
import { Button } from '../ui/Button';
import { NumberKeypad } from '../ui/NumberKeypad';
import { OrderPanel, SpeechBubble } from '../ui/OrderPanel';
import { ParentGate, type ParentAction } from '../ui/ParentGate';
import { showProgress } from '../ui/ProgressScreen';
import { StatusBar } from '../ui/StatusBar';
import { COLORS, CSS, LAYOUT, paradeSpots, text } from '../ui/theme';
import { VisualAidView } from '../ui/VisualAidView';
import { backupActions } from './backupActions';
import { characterAction } from './characterActions';
import { confetti, ResultsOverlay } from './ResultsOverlay';
import { drawDecorations, drawShopRoom } from './shopArt';

/** Test hooks (`window.__ssa`, `?fast`) exist in dev, and in a build only when opened with `?e2e`. */
const testHooksEnabled = (): boolean => import.meta.env.DEV || new URLSearchParams(window.location.search).has('e2e');

const PRAISE = ["Yum! That's right!", 'Sweet! You got it!', 'Scoop-tastic!', 'Perfect order!'];
const RETRY_PRAISE = ['You got it! Great thinking!', 'Yes! Nice try-again!'];

export class ShopScene extends Phaser.Scene {
  private services!: GameServices;
  private manager!: OrderManager;
  private status!: StatusBar;
  private ticket!: OrderPanel;
  private bubble!: SpeechBubble;
  private aid!: VisualAidView;
  private keypad!: NumberKeypad;
  private shopkeeper!: CharacterView;
  private customer: CharacterView | null = null;
  private treat: Phaser.GameObjects.Container | null = null;
  private gotIt: Button | null = null;
  private busy = false;
  /** The open grown-ups area, if any (the e2e test drives it through `__ssa`). */
  private gate: ParentGate | null = null;

  constructor() {
    super('Shop');
  }

  create(): void {
    this.services = this.registry.get(SERVICES_KEY) as GameServices;
    this.customer = null;
    this.treat = null;
    this.gotIt = null;
    this.busy = false;
    this.gate = null;

    if (testHooksEnabled() && new URLSearchParams(window.location.search).has('fast')) {
      this.tweens.timeScale = 6;
      this.time.timeScale = 6;
    }

    this.manager = new OrderManager({
      save: this.services.load.save,
      persister: this.services.saves,
      subject: this.services.subject,
      onSaveError: () => this.toast('Progress could not be saved just now.'),
      roster: customerRoster(this.services.characters.list()),
    });

    drawShopRoom(this);
    drawDecorations(this, this.manager.profile.decorations);
    this.drawRegisterPanel();

    this.shopkeeper = new CharacterView(this, LAYOUT.shopkeeper.x, 530, this.shopkeeperLook()).setDepth(20).idle(true);

    this.status = new StatusBar(this, () => this.openParentGate());
    this.status.setSprinkles(this.manager.profile.sprinkles);
    this.ticket = new OrderPanel(this, LAYOUT.ticket.x, LAYOUT.ticket.y, LAYOUT.ticket.w, LAYOUT.ticket.h).setDepth(70);
    this.bubble = new SpeechBubble(this, LAYOUT.bubble.x, 455, LAYOUT.bubble.w, LAYOUT.bubble.h).setDepth(60);
    this.aid = new VisualAidView(this, LAYOUT.board.x, LAYOUT.board.y, LAYOUT.board.w, LAYOUT.board.h).setDepth(55);
    this.keypad = new NumberKeypad(this, {
      ...LAYOUT.keypad,
      maxDigits: 3,
      onChange: (v) => this.ticket.setAnswer(v),
      onSubmit: (v) => void this.handleSubmit(v),
    });
    this.keypad.setDepth(70);

    this.showLoadNotices();
    if (testHooksEnabled())
      (window as unknown as Record<string, unknown>).__ssa = { scene: this, manager: () => this.manager };

    this.manager.ensureRound();
    void this.runOrder();
  }

  update(): void {
    // The served treat travels with its customer.
    if (this.treat && this.customer && this.treat.getData('follow')) {
      this.treat.x = this.customer.x + 52;
      this.treat.y = this.customer.y - 62;
    }
  }

  // -------------------------------------------------------------------------
  // Order flow
  // -------------------------------------------------------------------------

  private async runOrder(): Promise<void> {
    const active = this.manager.current();
    if (!active) {
      this.manager.ensureRound();
      return this.runOrder();
    }
    this.busy = true;
    this.updateStatus(active);
    this.ticket.clearOrder();
    const customer = await this.customerArrives(active.customer);
    await this.placeOrder(active, customer);

    if (active.phase === 'resolved') {
      // Reloaded after paying but before serving: finish the animation only.
      await this.celebrateOrExplain(active.order.outcome!, active.order.sprinklesPaid, active.presentation, '');
      return;
    }
    if (active.phase === 'retrying') this.showHint(active.presentation);
    this.readyForAnswer();
  }

  private async customerArrives(def: CustomerDef): Promise<CharacterView> {
    const customer = new CharacterView(this, LAYOUT.doorSpot.x, LAYOUT.customerSpot.y, this.customerLook(def))
      .setDepth(40)
      .setAlpha(0);
    this.customer = customer;
    this.tweens.add({ targets: customer, alpha: 1, duration: 250 });
    await customer.walkTo(LAYOUT.customerSpot.x);
    customer.idle(true);
    return customer;
  }

  /** The newest added shopkeeper, else Momo. */
  private shopkeeperLook(): AnyLook {
    const added = chosenShopkeeper(this.services.characters.list());
    return (added && addedLook(this, added)) || friendLook('momo');
  }

  private customerLook(def: CustomerDef): AnyLook {
    const added = def.addedId ? this.services.characters.list().find((c) => c.id === def.addedId) : undefined;
    return (added && addedLook(this, added)) || friendLook(def.art ?? 'mallow');
  }

  private async placeOrder(active: ActiveOrder, customer: CharacterView): Promise<void> {
    const { customer: def, presentation } = active;
    this.bubble.say(lineFor(def.greetings, active.index), customer.x);
    await this.wait(GAME_CONFIG.timing.greetingMs);
    this.bubble.say(presentation.orderLine, customer.x);
    this.ticket.showOrder(`${def.name}'s order`, presentation.expression);
    this.keypad.setMaxDigits(presentation.answerInput.maxDigits);
    this.keypad.clear();
  }

  /** Hands control back to the player (unless the grown-ups area is open). */
  private readyForAnswer(): void {
    this.busy = false;
    if (!this.gate) this.keypad.setEnabled(true);
  }

  private async handleSubmit(value: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const result = this.manager.submit(value);

    if (result.kind === 'ignored') {
      this.busy = false;
      this.keypad.setEnabled(true);
      return;
    }

    if (result.kind === 'try-again') {
      this.ticket.wiggle();
      this.customer?.setExpression('thinking');
      this.showHint(result.presentation);
      await this.wait(450);
      this.keypad.clear();
      this.readyForAnswer();
      return;
    }

    await this.celebrateOrExplain(result.outcome, result.sprinkles, result.presentation, value);
  }

  private showHint(presentation: ChallengePresentation): void {
    this.ticket.setFeedback('So close! Look at the scoops and try once more.', 'gentle');
    if (this.manager.profile.settings.showHints) {
      this.aid.show(presentation.hint, this.manager.current()?.customer.favoriteFlavor);
    }
  }

  private async celebrateOrExplain(
    outcome: AttemptOutcome,
    sprinkles: number,
    presentation: ChallengePresentation,
    typed: string,
  ): Promise<void> {
    const active = this.manager.current();
    const flavor = active?.customer.favoriteFlavor ?? 'vanilla';
    if (active) this.updateStatus(active);

    if (outcome === 'miss') {
      // Show the answer and why, then let the child continue when ready.
      this.ticket.setAnswer(presentation.correctAnswer, CSS.strawberry);
      this.ticket.setFeedback(`It's ${presentation.correctAnswer}! Let's see why.`, 'explain');
      this.aid.show(presentation.explanation, flavor);
      await this.waitForGotIt();
      this.aid.hide();
    } else {
      const lines = outcome === 'first' ? PRAISE : RETRY_PRAISE;
      this.ticket.setAnswer(typed || presentation.correctAnswer, CSS.mint);
      this.ticket.setFeedback(lineFor(lines, Number(presentation.correctAnswer)), 'happy');
      this.aid.hide();
    }
    await this.serve(presentation, sprinkles, flavor);
  }

  private waitForGotIt(): Promise<void> {
    this.keypad.setVisible(false);
    return new Promise((resolve) => {
      const { x, y, cellW, cellH, gap } = LAYOUT.keypad;
      this.gotIt = new Button(this, x + (3 * cellW + 2 * gap) / 2, y + 2 * cellH, {
        width: 360,
        height: 130,
        label: 'Got it!',
        fontSize: 48,
        fill: COLORS.mint,
        shade: COLORS.mintDark,
        onTap: () => {
          this.gotIt?.destroy();
          this.gotIt = null;
          this.keypad.setVisible(true);
          resolve();
        },
      }).setDepth(80);
    });
  }

  private async serve(presentation: ChallengePresentation, sprinkles: number, flavor: string): Promise<void> {
    const customer = this.customer!;
    customer.setExpression('happy');
    const treat = await this.scoopTreat(Number(presentation.correctAnswer), flavor);
    await this.tween({ targets: treat, x: customer.x + 52, y: customer.y - 62, duration: 450, ease: 'Quad.easeInOut' });
    treat.setData('follow', true);
    await this.thankAndPay(customer, Number(presentation.correctAnswer), sprinkles);
    await this.customerLeaves(customer, treat);
    this.nextOrder();
  }

  /** Shopkeeper stacks up to four scoops on a cone on the counter. */
  private async scoopTreat(answer: number, flavor: string): Promise<Phaser.GameObjects.Container> {
    const treat = this.add.container(LAYOUT.counter.x + 80, LAYOUT.counter.y - 40).setDepth(45);
    this.treat = treat;
    treat.add(this.add.image(0, 0, 'cone').setScale(6).setOrigin(0.5, 0));
    void this.shopkeeper.hop();
    const scoops = Phaser.Math.Clamp(answer || 1, 1, 4);
    for (let i = 0; i < scoops; i++) {
      const s = this.add
        .image(0, -i * 22 + 4, `scoop-${flavor}`)
        .setScale(0)
        .setOrigin(0.5, 1);
      treat.add(s);
      this.tweens.add({ targets: s, scale: 6, duration: 160, ease: 'Back.easeOut' });
      await this.wait(170);
    }
    return treat;
  }

  private async thankAndPay(customer: CharacterView, answer: number, sprinkles: number): Promise<void> {
    const def = this.manager.current()?.customer;
    this.bubble.say(lineFor(def?.thanks ?? ['Thank you!'], answer), customer.x);
    void customer.hop();
    this.sprinklePopup(customer.x, customer.y - 170, sprinkles);
    this.status.setSprinkles(this.manager.profile.sprinkles, true);
    await this.wait(1300);
  }

  private async customerLeaves(customer: CharacterView, treat: Phaser.GameObjects.Container): Promise<void> {
    this.bubble.hide();
    this.ticket.clearOrder();
    customer.idle(false);
    await customer.walkTo(LAYOUT.doorSpot.x);
    await this.tween({ targets: [customer, treat], alpha: 0, duration: 200 });
    customer.destroy();
    treat.destroy();
    this.customer = null;
    this.treat = null;
  }

  private nextOrder(): void {
    const outcomes = this.roundOutcomes(); // the round is cleared once it finishes
    const finish = this.manager.finishOrder();
    if (finish.kind === 'round-complete') void this.showResults(finish.summary, finish.stickers, outcomes);
    else void this.runOrder();
  }

  private async showResults(
    summary: RoundSummary,
    served: RoundSticker[],
    outcomes: (AttemptOutcome | null)[],
  ): Promise<void> {
    this.status.setProgress(outcomes.length - 1, outcomes);
    this.status.setSprinkles(this.manager.profile.sprinkles, true);
    this.shopkeeper.setExpression('happy');
    const stickers = served.map((s) => ({ look: this.customerLook(s.customer), firstTry: s.firstTry }));
    // A perfect round brings every customer back for a parade before the card.
    const parade = summary.perfect ? await this.parade(stickers.map((s) => s.look)) : [];
    let closed = false;
    const overlay = new ResultsOverlay(this, summary, stickers, () => {
      if (closed) return;
      closed = true;
      overlay.destroy();
      parade.forEach((c) => c.destroy());
      this.shopkeeper.setExpression('neutral');
      this.manager.ensureRound();
      void this.runOrder();
    });
  }

  /** Customers walk in from the door one after another, line up on the floor and cheer. */
  private async parade(looks: AnyLook[]): Promise<CharacterView[]> {
    const spots = paradeSpots(looks.length);
    const { paradeStepMs, paradeCheerMs } = GAME_CONFIG.timing;
    const views = looks.map((look, i) => {
      const spot = spots[i]!;
      const view = new CharacterView(this, LAYOUT.doorSpot.x, spot.y, look).setDepth(spot.y / 10).setAlpha(0);
      return view.setScale(view.scaleX * spot.scale);
    });
    await Promise.all(
      views.map(async (view, i) => {
        await this.wait(i * paradeStepMs);
        this.tweens.add({ targets: view, alpha: 1, duration: 200 });
        await view.walkTo(spots[i]!.x, 2);
        view.setExpression('happy');
        await view.hop();
      }),
    );
    confetti(this, true);
    views.forEach((v) => void v.hop());
    await this.wait(paradeCheerMs);
    return views;
  }

  // -------------------------------------------------------------------------
  // Parent area
  // -------------------------------------------------------------------------

  private openParentGate(): void {
    if (this.gate) return;
    const keypadWasEnabled = this.keypad.isEnabled;
    this.keypad.setEnabled(false);
    this.gate = new ParentGate(this, {
      info: () => this.parentInfo(),
      actions: () => this.parentActions(),
      onClose: () => {
        this.gate = null;
        if (keypadWasEnabled && !this.busy) this.keypad.setEnabled(true);
      },
    });
  }

  private parentInfo(): string[] {
    const p = this.manager.profile;
    const subject = this.services.subject;
    const last = p.roundHistory[p.roundHistory.length - 1];
    const lastRound = last ? `   ·   Last round: ${last.firstTryCorrect}/${last.ordersCompleted} first try` : '';
    return [
      `Player: ${p.displayName}   ·   Sprinkles: ${p.sprinkles} (earned in total: ${p.lifetimeSprinkles})`,
      `Rounds finished: ${p.roundHistory.length}${lastRound}`,
      ...subject.progressReport(subjectProgress(p, subject)),
      this.services.persistent
        ? 'Progress is saved in this browser on this device.'
        : 'This browser is not allowing saves; progress will be lost on reload.',
    ];
  }

  private parentActions(): ParentAction[] {
    const saves = this.services.saves;
    return [
      {
        label: 'Progress',
        enabled: true,
        run: (gate) => showProgress(gate, this, this.manager.profile.roundHistory),
      },
      characterAction(this, this.services),
      ...backupActions(this.services, () => void this.restartWithCharacters()),
      {
        label: 'Restore previous save',
        confirm: 'Goes back to the backup copy from the previous save. The current copy is kept aside, not deleted.',
        enabled: saves.hasBackup(),
        run: () => {
          const restored = saves.restoreBackup();
          if (restored) this.services.load = { save: restored, status: 'loaded', problems: [] };
          this.scene.restart();
        },
      },
      ...this.resetActions(),
    ];
  }

  private resetActions(): ParentAction[] {
    return [
      {
        label: 'Reset learning progress',
        confirm: 'Clears all practice progress. Sprinkles and items are kept.',
        enabled: true,
        run: () => {
          const p = this.manager.profile;
          resetSubjectProgress(p, this.services.subject);
          p.learning.roundsStarted = 0;
          p.currentRound = null;
          this.saveAndRestart();
        },
      },
      {
        label: 'Reset whole profile',
        confirm: 'Starts this player over: Sprinkles, items, history and learning progress are all cleared.',
        enabled: true,
        run: () => {
          const fresh = createProfile(this.manager.profile.displayName, Date.now());
          const save = this.services.load.save;
          save.profiles = { [fresh.id]: fresh };
          save.activeProfileId = fresh.id;
          this.saveAndRestart();
        },
      },
    ];
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** After a backup brings characters, decode their pictures before rebuilding the shop. */
  private async restartWithCharacters(): Promise<void> {
    await registerAddedTextures(this, this.services.characters.list());
    this.scene.restart();
  }

  private saveAndRestart(): void {
    this.services.saves.write(this.services.load.save);
    this.scene.restart();
  }

  private updateStatus(active: ActiveOrder): void {
    this.status.setProgress(active.index, this.roundOutcomes());
  }

  private roundOutcomes(): (AttemptOutcome | null)[] {
    return this.manager.profile.currentRound?.orders.map((o) => o.outcome) ?? [];
  }

  private drawRegisterPanel(): void {
    const { x, y, w, h } = LAYOUT.panel;
    const area = LAYOUT.registerArea;
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(COLORS.brown, 1).fillRect(area.x, area.y, area.w, area.h);
    if (LAYOUT.orientation === 'portrait') g.fillStyle(COLORS.brownDark, 1).fillRect(area.x, area.y, area.w, 8);
    g.fillStyle(0xffe9d6, 1).fillRoundedRect(x, y, w, h - 10, 26);
    g.lineStyle(5, COLORS.brownDark, 1).strokeRoundedRect(x, y, w, h - 10, 26);
  }

  private showLoadNotices(): void {
    const load = this.services.load;
    if (load.status === 'restored-from-backup') this.toast('Saved game restored from the backup copy.');
    else if (load.status === 'reset-after-corrupt')
      this.toast('Saved game could not be read, so a new one was started.');
    else if (!this.services.persistent) this.toast('This browser is not saving progress.');
    // Only show once per page load.
    this.services.load = { ...load, status: 'loaded', problems: [] };
  }

  private toast(message: string): void {
    const t = this.add
      .text(400, 840, message, text(22, CSS.white, { backgroundColor: '#7a6a88', padding: { x: 16, y: 8 } }))
      .setOrigin(0.5)
      .setDepth(900);
    this.tweens.add({ targets: t, alpha: 0, delay: 4000, duration: 600, onComplete: () => t.destroy() });
  }

  private sprinklePopup(x: number, y: number, amount: number): void {
    const c = this.add.container(x, y).setDepth(90);
    c.add(this.add.image(-40, 0, 'sprinkle-icon').setScale(5));
    c.add(
      this.add
        .text(-8, 0, `+${amount}`, text(44, CSS.strawberry, { stroke: '#ffffff', strokeThickness: 8 }))
        .setOrigin(0, 0.5),
    );
    this.tweens.add({
      targets: c,
      y: y - 70,
      alpha: { from: 1, to: 0 },
      delay: 500,
      duration: 1000,
      onComplete: () => c.destroy(),
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }
}

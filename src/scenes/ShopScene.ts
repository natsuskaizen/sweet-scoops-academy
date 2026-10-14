/**
 * The one persistent gameplay scene. Customers, the order ticket, the keypad,
 * hints and the results card are all components layered inside it; nothing
 * ever switches to a separate quiz screen.
 *
 * Game rules live in OrderManager (Phaser-free and unit tested). This scene
 * only animates what the manager says and forwards what the player taps.
 */
import Phaser from 'phaser';
import { addedLook, CharacterView, friendLook, MOMO_SHEETS, type AnyLook } from '../characters/characterManager';
import { isFriendId } from '../characters/friendArt';
import type { ScooperId } from '../characters/scooperArt';
import { dressMomo } from '../characters/wearArt';
import { SERVICES_KEY, type GameServices } from '../game/services';
import { GAME_CONFIG } from '../config/gameConfig';
import type { RoundSummary } from '../save/saveTypes';
import { chosenShopkeeper, customerRoster } from '../shop/addedCharacters';
import { equippedIn, equippedItems } from '../shop/purchases';
import { lineFor, type CustomerDef } from '../shop/customerManager';
import { OrderManager, type ActiveOrder, type RoundSticker } from '../shop/orderManager';
import type { AttemptOutcome, ChallengePresentation } from '../learning/types';
import { Button } from '../ui/Button';
import { CalendarScreen } from '../ui/CalendarScreen';
import { NumberKeypad } from '../ui/NumberKeypad';
import { OrderPanel, SpeechBubble } from '../ui/OrderPanel';
import { ParentGate, type ParentGateOptions } from '../ui/ParentGate';
import { ShopMenu } from '../ui/ShopMenu';
import { StatusBar } from '../ui/StatusBar';
import { COLORS, CSS, LAYOUT, text } from '../ui/theme';
import { delay, tweenAsync } from '../ui/tweenAsync';
import { VisualAidView } from '../ui/VisualAidView';
import { WallCalendar } from '../ui/WallCalendar';
import { Parade } from './parade';
import { parentArea } from './parentArea';
import { ResultsOverlay } from './ResultsOverlay';
import { scoopOntoCone } from './serveAnimation';
import { ClosetMode } from './closetMode';
import { PlacedDecorations } from './decorArt';
import { DecorateMode } from './decorateMode';
import { drawShopRoom } from './shopArt';

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
  /** A perfect round's parade (the e2e test taps its Skip through `__ssa`). */
  private parade!: Parade;
  /** What the grown-ups area shows (the e2e tests run its actions through `__ssa`). */
  private parentArea!: Pick<ParentGateOptions, 'info' | 'actions'>;
  private results: ResultsOverlay | null = null;
  private placed!: PlacedDecorations;
  private registerPanel!: Phaser.GameObjects.Graphics;
  /** Decorate, while it is open (the e2e test drives it through `__ssa`). */
  private decorate: DecorateMode | null = null;
  /** Momo's Closet, while it is open (the e2e test drives it through `__ssa`). */
  private closet: ClosetMode | null = null;
  /** The Sprinkle Shop's menu, while it is open. */
  private shopMenu: ShopMenu | null = null;
  /** The calendar on the shop wall, and the progress calendar it opens (the e2e test drives both through `__ssa`). */
  private wallCalendar!: WallCalendar;
  private calendar: CalendarScreen | null = null;
  /** The results card and any parade, hidden while Decorate is open over them. */
  private resultsCover: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Shop');
  }

  create(): void {
    this.services = this.registry.get(SERVICES_KEY) as GameServices;
    this.resetRunState();

    if (testHooksEnabled() && new URLSearchParams(window.location.search).has('fast')) {
      this.tweens.timeScale = 6;
      this.time.timeScale = 6;
    }

    this.manager = new OrderManager({
      save: this.services.save,
      persister: this.services.saves,
      subject: this.services.subject,
      onSaveError: () => this.toast('Progress could not be saved just now.'),
      roster: customerRoster(this.services.characters.list()),
    });

    this.parentArea = parentArea({ scene: this, services: this.services, profile: () => this.manager.profile });

    this.placed = new PlacedDecorations(this, drawShopRoom(this, this.manager.profile.shop.name));
    this.placed.draw(this.manager.profile.decorations);
    this.wallCalendar = new WallCalendar(this, () => this.openCalendar());
    this.wallCalendar.refresh(this.manager.profile, Date.now());
    this.registerPanel = this.drawRegisterPanel();

    this.shopkeeper = this.makeShopkeeper();

    this.status = new StatusBar(
      this,
      () => this.openParentGate(),
      () => this.openShopMenu(),
    );
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

  /** The newest added shopkeeper, else the player's own, with Momo in what she has on from her Closet. */
  private makeShopkeeper(): CharacterView {
    const added = chosenShopkeeper(this.services.characters.list());
    const { keeper: id } = this.manager.profile.shop;
    const keeper = isFriendId(id) ? id : 'momo';
    const look = (added && addedLook(this, added)) || friendLook(keeper);
    const view = new CharacterView(this, LAYOUT.shopkeeper.x, 530, look).setDepth(20);
    if (!added && keeper === 'momo') dressMomo(view, equippedItems(this.manager.profile), MOMO_SHEETS);
    return view.idle(true);
  }

  private customerLook(def: CustomerDef): AnyLook {
    const added = def.addedId ? this.services.characters.list().find((c) => c.id === def.addedId) : undefined;
    return (added && addedLook(this, added)) || friendLook(def.art ?? 'mallow');
  }

  private async placeOrder(active: ActiveOrder, customer: CharacterView): Promise<void> {
    const { customer: def, presentation } = active;
    this.bubble.say(lineFor(def.greetings, active.index), customer.x);
    await delay(this, GAME_CONFIG.timing.greetingMs);
    this.bubble.say(presentation.orderLine, customer.x);
    this.ticket.showOrder(`${def.name}'s order`, presentation.expression);
    this.keypad.setMaxDigits(presentation.answerInput.maxDigits);
    this.keypad.clear();
  }

  /**
   * A restart (rotation, restoring a save) reuses this object, so every
   * per-run field goes back to its starting value here.
   */
  private resetRunState(): void {
    this.customer = null;
    this.treat = null;
    this.gotIt = null;
    this.busy = false;
    this.gate = null;
    this.parade = new Parade(this);
    this.results = null;
    this.resultsCover = [];
    this.shopMenu = null;
    this.calendar = null;
    this.decorate = null;
    this.closet = null;
  }

  /** Hands control back to the player. */
  private readyForAnswer(): void {
    this.busy = false;
    this.syncInput();
  }

  /** The keypad takes answers only while the shop waits for one and the grown-ups area is closed. */
  private syncInput(): void {
    const away = this.gate || this.decorate || this.closet || this.shopMenu || this.calendar;
    this.keypad.setEnabled(!this.busy && !away);
  }

  private async handleSubmit(value: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const result = this.manager.submit(value);

    if (result.kind === 'ignored') {
      this.readyForAnswer();
      return;
    }

    if (result.kind === 'try-again') {
      this.ticket.wiggle();
      this.customer?.puzzled();
      this.showHint(result.presentation);
      await delay(this, GAME_CONFIG.timing.retryPauseMs);
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
      this.customer?.setExpression('happy');
      void this.customer?.cheer();
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
    await tweenAsync(this, {
      targets: treat,
      x: customer.x + 52,
      y: customer.y - 62,
      duration: GAME_CONFIG.timing.handOffMs,
      ease: 'Quad.easeInOut',
    });
    treat.setData('follow', true);
    await this.thankAndPay(customer, Number(presentation.correctAnswer), sprinkles);
    await this.customerLeaves(customer, treat);
    this.nextOrder();
  }

  /** Shopkeeper scoops up to four scoops from the tubs onto a cone on the counter. */
  private async scoopTreat(answer: number, flavor: string): Promise<Phaser.GameObjects.Container> {
    const treat = this.add.container(LAYOUT.counter.x + 80, LAYOUT.counter.y - 40).setDepth(45);
    this.treat = treat;
    treat.add(this.add.image(0, 0, 'cone').setScale(6).setOrigin(0.5, 0));
    const scooper: ScooperId = equippedIn(this.manager.profile, 'handheld')?.tier ?? 'wooden';
    const server = { keeper: this.shopkeeper, scooper };
    await scoopOntoCone(this, server, treat, flavor, Phaser.Math.Clamp(answer || 1, 1, 4));
    return treat;
  }

  private async thankAndPay(customer: CharacterView, answer: number, sprinkles: number): Promise<void> {
    const def = this.manager.current()?.customer;
    this.bubble.say(lineFor(def?.thanks ?? ['Thank you!'], answer), customer.x);
    void customer.hop();
    this.sprinklePopup(customer.x, customer.y - 170, sprinkles);
    this.status.setSprinkles(this.manager.profile.sprinkles, true);
    await delay(this, GAME_CONFIG.timing.payMs);
  }

  private async customerLeaves(customer: CharacterView, treat: Phaser.GameObjects.Container): Promise<void> {
    this.bubble.hide();
    this.ticket.clearOrder();
    customer.idle(false);
    await customer.walkTo(LAYOUT.doorSpot.x);
    await tweenAsync(this, { targets: [customer, treat], alpha: 0, duration: 200 });
    customer.destroy();
    treat.destroy();
    this.customer = null;
    this.treat = null;
  }

  private nextOrder(): void {
    const outcomes = this.roundOutcomes(); // the round is cleared once it finishes
    const finish = this.manager.finishOrder();
    if (finish.kind !== 'round-complete') return void this.runOrder();
    this.wallCalendar.refresh(this.manager.profile, Date.now(), finish.heartEarned);
    void this.showResults(finish.summary, finish.stickers, outcomes);
  }

  private async showResults(
    summary: RoundSummary,
    served: RoundSticker[],
    outcomes: (AttemptOutcome | null)[],
  ): Promise<void> {
    if (this.results) return; // one card at a time
    this.status.setProgress(outcomes.length - 1, outcomes);
    this.status.setSprinkles(this.manager.profile.sprinkles, true);
    this.shopkeeper.setExpression('happy');
    const stickers = served.map((s) => ({ look: this.customerLook(s.customer), firstTry: s.firstTry }));
    // A perfect round brings every customer back for a parade before the card.
    const parade = summary.perfect ? await this.parade.play(stickers.map((s) => s.look)) : [];
    let closed = false;
    const overlay = new ResultsOverlay(this, summary, stickers, {
      onDecorate: () => this.openDecorate(this.resultsCover),
      onCloset: () => this.openCloset(),
      onContinue: () => {
        if (closed) return;
        closed = true;
        overlay.destroy();
        this.results = null;
        this.resultsCover = [];
        parade.forEach((c) => c.destroy());
        this.shopkeeper.setExpression('neutral');
        this.manager.ensureRound();
        void this.runOrder();
      },
    });
    this.results = overlay;
    this.resultsCover = [overlay, ...parade];
  }

  // -------------------------------------------------------------------------
  // Sprinkle Shop: Decorate and Momo's Closet
  // -------------------------------------------------------------------------

  /**
   * The Sprinkles balance opens the shop between rounds and while a customer
   * waits for an answer, never in the middle of serving.
   */
  private openShopMenu(): void {
    if (this.shopMenu || this.gate || this.decorate || this.closet) return;
    if (this.busy && !this.results) return;
    this.shopMenu = new ShopMenu(this, {
      onDecorate: () => this.openDecorate(this.resultsCover),
      onCloset: () => this.openCloset(),
      onClose: () => {
        this.shopMenu = null;
        this.syncInput();
      },
    });
    this.syncInput();
  }

  // -------------------------------------------------------------------------
  // Progress calendar
  // -------------------------------------------------------------------------

  /** The wall calendar opens the progress calendar whenever the Sprinkle Shop could open. */
  private openCalendar(): void {
    if (this.calendar || this.shopMenu || this.gate || this.decorate || this.closet) return;
    if (this.busy && !this.results) return;
    this.calendar = new CalendarScreen(this, {
      profile: () => this.manager.profile,
      subjects: [this.services.subject],
      now: () => Date.now(),
      onClose: () => {
        this.calendar = null;
        this.wallCalendar.refresh(this.manager.profile, Date.now());
        this.syncInput();
      },
    });
    this.syncInput();
  }

  /**
   * Opens Decorate: the register and `cover` (the results card, if open) hide until
   * it closes. Each comes back as it was, so what was already hidden (the
   * hint board, the speech bubble) stays hidden.
   */
  private openDecorate(cover: Phaser.GameObjects.GameObject[]): void {
    if (this.decorate) return;
    const parts = [
      this.registerPanel,
      this.ticket,
      this.aid,
      this.bubble,
      this.customer,
      this.treat,
      ...cover,
      this.keypad,
    ];
    const hidden = parts.filter((o) => o !== null) as unknown as {
      visible: boolean;
      setVisible: (v: boolean) => void;
    }[];
    const wasVisible = hidden.map((o) => o.visible);
    hidden.forEach((o) => o.setVisible(false));
    this.decorate = new DecorateMode({
      scene: this,
      profile: () => this.manager.profile,
      placed: this.placed,
      save: () => this.saveNow(),
      onClose: () => {
        this.decorate = null;
        hidden.forEach((o, i) => o.setVisible(wasVisible[i]!));
        this.status.setSprinkles(this.manager.profile.sprinkles);
        this.syncInput();
      },
    });
    this.syncInput();
  }

  /** Opens Momo's Closet over everything; Momo comes back to the counter in what she chose. */
  private openCloset(): void {
    if (this.closet || this.decorate) return;
    this.closet = new ClosetMode({
      scene: this,
      profile: () => this.manager.profile,
      save: () => this.saveNow(),
      onClose: () => {
        this.closet = null;
        this.shopkeeper.destroy();
        this.shopkeeper = this.makeShopkeeper().setExpression(this.results ? 'happy' : 'neutral');
        this.status.setSprinkles(this.manager.profile.sprinkles);
        this.syncInput();
      },
    });
    this.syncInput();
  }

  private saveNow(): boolean {
    const result = this.services.saves.write(this.services.save);
    if (!result.ok) this.toast('That could not be saved just now.');
    return result.ok;
  }

  // -------------------------------------------------------------------------
  // Parent area
  // -------------------------------------------------------------------------

  private openParentGate(): void {
    if (this.gate) return;
    this.gate = new ParentGate(this, {
      ...this.parentArea,
      onClose: () => {
        this.gate = null;
        // The daily goal may have changed.
        this.wallCalendar.refresh(this.manager.profile, Date.now());
        this.syncInput();
      },
    });
    this.syncInput();
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private updateStatus(active: ActiveOrder): void {
    this.status.setProgress(active.index, this.roundOutcomes());
  }

  private roundOutcomes(): (AttemptOutcome | null)[] {
    return this.manager.profile.currentRound?.orders.map((o) => o.outcome) ?? [];
  }

  private drawRegisterPanel(): Phaser.GameObjects.Graphics {
    const { x, y, w, h } = LAYOUT.panel;
    const area = LAYOUT.registerArea;
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(COLORS.brown, 1).fillRect(area.x, area.y, area.w, area.h);
    if (LAYOUT.orientation === 'portrait') g.fillStyle(COLORS.brownDark, 1).fillRect(area.x, area.y, area.w, 8);
    g.fillStyle(0xffe9d6, 1).fillRoundedRect(x, y, w, h - 10, 26);
    g.lineStyle(5, COLORS.brownDark, 1).strokeRoundedRect(x, y, w, h - 10, 26);
    return g;
  }

  private showLoadNotices(): void {
    const notice = this.services.loadNotice;
    if (notice === 'restored-from-backup') this.toast('Saved game restored from the backup copy.');
    else if (notice === 'reset-after-corrupt') this.toast('Saved game could not be read, so a new one was started.');
    else if (!this.services.persistent) this.toast('This browser is not saving progress.');
    // Only show once per page load.
    this.services.loadNotice = null;
  }

  private toast(message: string): void {
    const t = this.add
      .text(400, 840, message, text(22, CSS.white, { backgroundColor: '#7a6a88', padding: { x: 16, y: 8 } }))
      .setOrigin(0.5)
      .setDepth(900);
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: GAME_CONFIG.timing.toastMs,
      duration: 600,
      onComplete: () => t.destroy(),
    });
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
}

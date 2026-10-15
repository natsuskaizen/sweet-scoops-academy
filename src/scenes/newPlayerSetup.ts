/**
 * Setting up a new player, inside the register panel while the shop stays
 * in view: their name, their shop's name (the sign changes as they go) and
 * who works behind their counter (they step in straight away). Each step
 * replaces the last; the scene saves the result and opens the shop.
 */
import type Phaser from 'phaser';
import { friendLook } from '../characters/characterManager';
import { friendName, isFriendId, keeperOrMomo, type FriendId } from '../characters/friendArt';
import { GAME_CONFIG } from '../config/gameConfig';
import { createRng, randomSeed, type Rng } from '../core/rng';
import type { NewPlayer } from '../save/profileActions';
import { letterAs, ownedShopName, rollShopName, SHOP_NAME_IDEAS, typeKey, type LetterKey } from '../shop/playerNames';
import { Button } from '../ui/Button';
import { gridCells, letterKeyCells, setupLayout, type SetupLayout } from '../ui/setupLayout';
import { registerCover } from '../ui/registerCard';
import { COLORS, CSS, DEPTH, LAYOUT, text, type Rect } from '../ui/theme';

export interface SetupHost {
  scene: Phaser.Scene;
  /** The sign changes as a shop name is rolled, picked or typed. */
  onShopName: (name: string) => void;
  /** The chosen friend steps behind the counter. */
  onKeeper: (id: FriendId) => void;
  onDone: (player: NewPlayer) => void;
  /** When adding a player from the start screen, or changing one thing from My shop, ✕ goes back. */
  onCancel?: () => void;
  /** Changing one thing for a player who has a shop: starts on that step with their choices, and Done finishes. */
  edit?: { step: EditStep; player: NewPlayer };
}

export type EditStep = 'name' | 'shop' | 'keeper';

type Step = 'name' | 'shop' | 'typeShop' | 'keeper' | 'ready';
const NEXT_STEP: Record<EditStep, Step> = { name: 'shop', shop: 'keeper', keeper: 'ready' };
/** Where ◀ goes from each step; the first step has none. */
const PREVIOUS_STEP: Partial<Record<Step, Step>> = { shop: 'name', typeShop: 'shop', keeper: 'shop', ready: 'keeper' };
const STEP_DOT: Record<Step, number> = { name: 0, shop: 1, typeShop: 1, keeper: 2, ready: 3 };

/** What the keys that aren't letters show. */
const KEY_LABELS: Record<string, string> = { done: '✓', back: '⌫', ' ': 'space' };

const button = (scene: Phaser.Scene, r: Rect, label: string, fontSize: number, onTap: () => void) =>
  Button.inRect(scene, r, { label, fontSize, onTap });

/** ◀ and ✕ in the panel's top corners. */
const CORNER = { w: 60, h: 56, inset: 12, top: 10 };

/** The two things typed on the letter keys, and what each one is called in the setup. */
type Typed = 'name' | 'shop';

export class NewPlayerSetup {
  private readonly root: Phaser.GameObjects.Container;
  private readonly page: Phaser.GameObjects.Container;
  private readonly layout: SetupLayout;
  private readonly rng: Rng = createRng(randomSeed());
  private readonly players = GAME_CONFIG.players;
  private step: Step = 'name';
  private name = '';
  private shopName = '';
  private keeper: FriendId;
  private nameText: Phaser.GameObjects.Text | null = null;
  /** The shop name before "Type my own" cleared it, for ◀. */
  private shopNameBeforeTyping = '';
  private done = false;

  constructor(private readonly host: SetupHost) {
    const { scene } = host;
    this.layout = setupLayout(LAYOUT.panel, LAYOUT.orientation === 'portrait');
    const { edit } = host;
    this.keeper = keeperOrMomo(edit?.player.shop.keeper ?? this.players.defaultShop.keeper);
    this.name = edit?.player.name ?? '';
    this.shopName = edit?.player.shop.name ?? '';
    this.page = scene.add.container(0, 0);
    const depth = edit ? DEPTH.changeShop : DEPTH.setup;
    this.root = scene.add.container(0, 0, [...registerCover(scene), this.page]).setDepth(depth);
    this.show(edit?.step ?? 'name');
  }

  /** The step showing now (the e2e test reads it). */
  get current(): Step {
    return this.step;
  }

  /** Finishes with these choices, as "Open the shop!" does (the e2e test calls it to skip the steps). */
  complete(player: NewPlayer): void {
    if (this.done) return;
    this.destroy();
    this.host.onDone(player);
  }

  private cancel(onCancel: () => void): void {
    if (this.done) return;
    this.destroy();
    onCancel();
  }

  destroy(): void {
    this.done = true;
    this.root.destroy();
  }

  private show(step: Step): void {
    this.step = step;
    this.page.removeAll(true);
    this.nameText = null;
    this.addHeader(step);
    const build: Record<Step, () => void> = {
      name: () => this.buildTyping('name'),
      typeShop: () => this.buildTyping('shop'),
      shop: () => this.buildShopName(),
      keeper: () => this.buildKeepers(),
      ready: () => this.buildReady(),
    };
    build[step]();
  }

  private addHeader(step: Step): void {
    const { scene } = this.host;
    const cx = LAYOUT.panel.x + LAYOUT.panel.w / 2;
    const dots = scene.add.graphics();
    for (let i = 0; i < (this.host.edit ? 0 : 4); i++) {
      dots.fillStyle(i <= STEP_DOT[step] ? COLORS.lavenderDark : COLORS.off, 1);
      dots.fillCircle(cx + (i - 1.5) * 30, this.layout.dotsY, 9);
    }
    const titles: Record<Step, string> = {
      name: "What's your name?",
      shop: 'Name your shop!',
      typeShop: 'Type your shop name',
      keeper: 'Who works in your shop?',
      ready: 'Your shop is ready!',
    };
    const { onCancel } = this.host;
    if (onCancel) this.addCorner('right', '✕', () => this.cancel(onCancel));
    const previous = this.previousStep(step);
    if (previous) this.addCorner('left', '◀', () => this.goBack(previous));
    const title = scene.add.text(cx, this.layout.titleY, titles[step], text(this.layout.titleFont)).setOrigin(0.5);
    title.setScale(Math.min(1, (LAYOUT.panel.w - 30) / title.width));
    this.page.add([dots, title]);
  }

  private addCorner(side: 'left' | 'right', label: string, onTap: () => void): void {
    const { x, y, w } = LAYOUT.panel;
    const left = side === 'left' ? x + CORNER.inset : x + w - CORNER.inset - CORNER.w;
    const r = { x: left, y: y + CORNER.top, w: CORNER.w, h: CORNER.h };
    this.page.add(button(this.host.scene, r, label, 26, onTap));
  }

  /** The step ◀ goes back to: none from the first step, or from the one step being changed. */
  private previousStep(step: Step): Step | undefined {
    const { edit } = this.host;
    if (edit && step === edit.step) return undefined;
    return PREVIOUS_STEP[step];
  }

  private goBack(step: Step): void {
    if (this.step === 'typeShop') {
      this.pickShopName(this.shopNameBeforeTyping);
    }
    this.show(step);
  }

  private addNameBox(value: string, fontSize: number): void {
    const { scene } = this.host;
    const { x, y, w, h } = this.layout.nameBox;
    const box = scene.add.graphics();
    box.fillStyle(COLORS.white, 1).fillRoundedRect(x, y, w, h, 16);
    box.lineStyle(4, COLORS.skyDark, 1).strokeRoundedRect(x, y, w, h, 16);
    this.nameText = scene.add.text(x + w / 2, y + h / 2, '', text(fontSize)).setOrigin(0.5);
    this.page.add([box, this.nameText]);
    this.showInBox(value);
  }

  /** Shows `value` in the name box, shrunk to fit. */
  private showInBox(value: string): void {
    const t = this.nameText;
    if (!t) return;
    t.setText(value).setScale(1);
    t.setScale(Math.min(1, (this.layout.nameBox.w - 30) / Math.max(1, t.width)));
  }

  /** What the letter keys type into, and how long it may be. */
  private typed(what: Typed) {
    const isName = what === 'name';
    return {
      max: isName ? this.players.maxNameLength : this.players.maxShopNameLength,
      fontSize: isName ? 44 : 34,
      read: () => (isName ? this.name : this.shopName),
      write: (value: string) => {
        if (!isName) return this.pickShopName(value);
        this.name = value;
        this.showInBox(value);
      },
    };
  }

  /** The letter keys, typing the player's name or their own shop name. */
  private buildTyping(what: Typed): void {
    const { max, fontSize, read, write } = this.typed(what);
    if (what === 'shop') {
      this.shopNameBeforeTyping = this.shopName;
      this.shopName = '';
    }
    this.addNameBox(read(), fontSize);
    const short = this.layout.keys.h < 300;
    const letters: { key: string; button: Button }[] = [];
    // Letter keys show the case they type next: capitals to start a word, small after.
    const relabel = () => letters.forEach(({ key, button }) => button.setLabel(letterAs(read(), key)));
    for (const { key, rect } of letterKeyCells(this.layout.keys, 6)) {
      const label = KEY_LABELS[key] ?? key;
      const keySize = key === ' ' ? 24 : short ? 26 : 30;
      const b = button(this.host.scene, rect, label, keySize, () => {
        if (key === 'done') return this.finishTyping(what);
        write(typeKey(read(), key as LetterKey, max));
        relabel();
      });
      if (key === 'done') b.setFill(COLORS.mint, COLORS.mintDark);
      else if (!KEY_LABELS[key]) letters.push({ key, button: b });
      this.page.add(b);
    }
    relabel();
  }

  private finishTyping(what: Typed): void {
    if (!this.typed(what).read().trim()) return;
    if (what === 'shop') return this.after('shop');
    if (!this.shopName) this.pickShopName(this.rolled());
    this.after('name');
  }

  /** On to the next step, or finished when only this one thing was being changed. */
  private after(step: EditStep): void {
    if (!this.host.edit) return this.show(NEXT_STEP[step]);
    this.complete({ name: this.name, shop: { name: this.shopName, keeper: this.keeper } });
  }

  private rolled(): string {
    return rollShopName(this.rng, this.name, this.players.maxShopNameLength);
  }

  /** The sign shows the shop's name, or the default one while the name is blank. */
  private pickShopName(name: string): void {
    this.shopName = name;
    this.host.onShopName(name || this.players.defaultShop.name);
    this.showInBox(name);
  }

  /** Roll a name, tap an idea, or type one; the sign follows. */
  private buildShopName(): void {
    const { scene } = this.host;
    this.addNameBox(this.shopName, 34);
    const { body } = this.layout;
    const cols = LAYOUT.orientation === 'portrait' ? 3 : 2;
    const rows = 1 + Math.ceil(SHOP_NAME_IDEAS.length / cols);
    const rowH = Math.min(74, (body.h - 18 - 12 * (rows - 2)) / rows);
    const [roll, own] = gridCells({ ...body, h: rowH }, 2, 2, 14);
    const rollButton = button(scene, roll!, 'Roll a new name', 22, () => this.pickShopName(this.rolled()));
    rollButton.setFill(COLORS.strawberry, COLORS.strawberryDark);
    this.page.add([rollButton, button(scene, own!, 'Type my own', 24, () => this.show('typeShop'))]);
    const ideas = { ...body, y: body.y + rowH + 18, h: (rowH + 12) * (rows - 1) - 12 };
    gridCells(ideas, SHOP_NAME_IDEAS.length, cols, 12).forEach((cell, i) => {
      const idea = SHOP_NAME_IDEAS[i]!;
      const owned = () => ownedShopName(this.name, idea, this.players.maxShopNameLength);
      this.page.add(button(scene, cell, idea, 21, () => this.pickShopName(owned())));
    });
    this.addNext(() => this.after('shop'));
  }

  private addNext(onTap: () => void, label = this.host.edit ? 'Done ✓' : 'Next ▶'): void {
    const next = button(this.host.scene, this.layout.next, label, 30, onTap);
    this.page.add(next.setFill(COLORS.mint, COLORS.mintDark));
  }

  /** The friends to choose from; tapping one puts them behind the counter. */
  private buildKeepers(): void {
    const { scene } = this.host;
    const ids = this.players.starterKeepers.filter(isFriendId);
    const cells = gridCells(this.layout.body, ids.length, this.layout.keeperCols, 12);
    const cards = ids.map((id, i) => {
      const cell = cells[i]!;
      const card = button(scene, cell, '', 20, () => this.chooseKeeper(id, cards, ids));
      const s = this.layout.keeperScale;
      const label = scene.add.text(0, cell.h / 2 - 24, friendName(id), text(s > 2.5 ? 22 : 18)).setOrigin(0.5);
      card.add([scene.add.sprite(0, -14, friendLook(id).sheet.key, 0).setScale(s), label]);
      return card;
    });
    this.page.add(cards);
    this.chooseKeeper(this.keeper, cards, ids);
    this.addNext(() => this.after('keeper'));
  }

  private chooseKeeper(id: FriendId, cards: Button[], ids: FriendId[]): void {
    this.keeper = id;
    cards.forEach((card, i) => card.setFill(ids[i] === id ? COLORS.lemon : COLORS.cream, COLORS.creamDark));
    this.host.onKeeper(id);
  }

  private buildReady(): void {
    const { scene } = this.host;
    const { body } = this.layout;
    const cx = body.x + body.w / 2;
    const small = body.h < 260;
    const friend = scene.add.sprite(cx, body.y + body.h * 0.42, friendLook(this.keeper).sheet.key, 0);
    friend.setScale(small ? 3 : 5);
    const shop = scene.add.text(cx, body.y + body.h - 20, this.shopName, text(small ? 26 : 30, CSS.ink));
    shop.setOrigin(0.5).setScale(Math.min(1, body.w / Math.max(1, shop.width)));
    this.page.add([friend, shop]);
    const player = { name: this.name, shop: { name: this.shopName, keeper: this.keeper } };
    this.addNext(() => this.complete(player), 'Open the shop!');
  }
}

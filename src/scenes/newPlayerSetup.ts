/**
 * Setting up a new player, inside the register panel while the shop stays
 * in view: their name, their shop's name (the sign changes as they go) and
 * who works behind their counter (they step in straight away). Each step
 * replaces the last; the scene saves the result and opens the shop.
 */
import type Phaser from 'phaser';
import { friendLook } from '../characters/characterManager';
import { friendName, isFriendId, type FriendId } from '../characters/friendArt';
import { GAME_CONFIG } from '../config/gameConfig';
import { createRng, randomSeed, type Rng } from '../core/rng';
import type { NewPlayer } from '../save/profileActions';
import { ownedShopName, rollShopName, SHOP_NAME_IDEAS, typeKey, type LetterKey } from '../shop/playerNames';
import { Button } from '../ui/Button';
import { gridCells, letterKeyCells, setupLayout, type SetupLayout } from '../ui/setupLayout';
import { COLORS, CSS, LAYOUT, text, type Rect } from '../ui/theme';

export interface SetupHost {
  scene: Phaser.Scene;
  /** The sign changes as a shop name is rolled, picked or typed. */
  onShopName: (name: string) => void;
  /** The chosen friend steps behind the counter. */
  onKeeper: (id: FriendId) => void;
  onDone: (player: NewPlayer) => void;
  /** When adding a player from the start screen, ✕ goes back to it. */
  onCancel?: () => void;
}

type Step = 'name' | 'shop' | 'typeShop' | 'keeper' | 'ready';
const STEP_DOT: Record<Step, number> = { name: 0, shop: 1, typeShop: 1, keeper: 2, ready: 3 };

const button = (scene: Phaser.Scene, r: Rect, label: string, fontSize: number, onTap: () => void) =>
  new Button(scene, r.x + r.w / 2, r.y + r.h / 2, { width: r.w, height: r.h, label, fontSize, onTap });

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
  private done = false;

  constructor(private readonly host: SetupHost) {
    const { scene } = host;
    this.layout = setupLayout(LAYOUT.panel, LAYOUT.orientation === 'portrait');
    const keeper = this.players.defaultShop.keeper;
    this.keeper = isFriendId(keeper) ? keeper : 'momo';
    const { x, y, w, h } = LAYOUT.panel;
    const g = scene.add.graphics();
    g.fillStyle(0xffe9d6, 1).fillRoundedRect(x, y, w, h - 10, 26);
    g.lineStyle(5, COLORS.brownDark, 1).strokeRoundedRect(x, y, w, h - 10, 26);
    // Taps on the panel never reach the ticket or keypad underneath.
    const blocker = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    this.page = scene.add.container(0, 0);
    this.root = scene.add.container(0, 0, [g, blocker, this.page]).setDepth(80);
    this.show('name');
  }

  /** The step showing now (the e2e test reads it). */
  get current(): Step {
    return this.step;
  }

  /** Finishes with these choices, as "Open the shop!" does (the e2e test calls it to skip the steps). */
  complete(player: NewPlayer): void {
    if (this.done) return;
    this.done = true;
    this.root.destroy();
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
    for (let i = 0; i < 4; i++) {
      dots.fillStyle(i <= STEP_DOT[step] ? COLORS.lavenderDark : 0xe2d3c4, 1);
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
    if (onCancel) {
      const close = { x: LAYOUT.panel.x + 12, y: LAYOUT.panel.y + 10, w: 60, h: 56 };
      this.page.add(button(scene, close, '✕', 26, () => this.cancel(onCancel)));
    }
    const title = scene.add.text(cx, this.layout.titleY, titles[step], text(this.layout.titleFont)).setOrigin(0.5);
    title.setScale(Math.min(1, (LAYOUT.panel.w - 30) / title.width));
    this.page.add([dots, title]);
  }

  private addNameBox(value: string, fontSize: number): void {
    const { scene } = this.host;
    const { x, y, w, h } = this.layout.nameBox;
    const box = scene.add.graphics();
    box.fillStyle(COLORS.white, 1).fillRoundedRect(x, y, w, h, 16);
    box.lineStyle(4, COLORS.skyDark, 1).strokeRoundedRect(x, y, w, h, 16);
    this.nameText = scene.add.text(x + w / 2, y + h / 2, value, text(fontSize)).setOrigin(0.5);
    this.page.add([box, this.nameText]);
    this.fitName();
  }

  private fitName(): void {
    const t = this.nameText;
    if (!t) return;
    t.setScale(1);
    t.setScale(Math.min(1, (this.layout.nameBox.w - 30) / Math.max(1, t.width)));
  }

  /** The letter keys, typing the player's name or their own shop name. */
  private buildTyping(what: 'name' | 'shop'): void {
    const max = what === 'name' ? this.players.maxNameLength : this.players.maxShopNameLength;
    const read = () => (what === 'name' ? this.name : this.shopName);
    const write = (value: string) => {
      if (what === 'name') this.name = value;
      else {
        this.shopName = value;
        this.host.onShopName(value || this.players.defaultShop.name);
      }
      this.nameText?.setText(value);
      this.fitName();
    };
    if (what === 'shop') this.shopName = '';
    this.addNameBox(read(), what === 'name' ? 44 : 34);
    const short = this.layout.keys.h < 300;
    for (const { key, rect } of letterKeyCells(this.layout.keys, 8)) {
      const label = key === 'done' ? '✓' : key === 'back' ? '⌫' : key === ' ' ? 'space' : key;
      const fontSize = key === ' ' ? 24 : short ? 26 : 30;
      const b = button(this.host.scene, rect, label, fontSize, () =>
        key === 'done' ? this.finishTyping(what) : write(typeKey(read(), key as LetterKey, max)),
      );
      if (key === 'done') b.setFill(COLORS.mint, COLORS.mintDark);
      this.page.add(b);
    }
  }

  private finishTyping(what: 'name' | 'shop'): void {
    if (what === 'name' && !this.name.trim()) return;
    if (what === 'shop' && !this.shopName.trim()) return;
    if (what === 'name' && !this.shopName) this.pickShopName(this.rolled());
    this.show(what === 'name' ? 'shop' : 'keeper');
  }

  private rolled(): string {
    return rollShopName(this.rng, this.name, this.players.maxShopNameLength);
  }

  private pickShopName(name: string): void {
    this.shopName = name;
    this.host.onShopName(name);
    this.nameText?.setText(name);
    this.fitName();
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
    this.addNext(() => this.show('keeper'));
  }

  private addNext(onTap: () => void, label = 'Next ▶'): void {
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
    this.addNext(() => this.show('ready'));
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

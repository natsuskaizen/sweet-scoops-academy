/**
 * The start screen: the shop of whoever played last, door shut, and in the
 * register panel "Hi, Ava!", their friend and one big Open button. The other
 * players and New sit underneath ("Not Ava?"), with the grown-ups area. The
 * scene does what each choice means.
 */
import type Phaser from 'phaser';
import { CharacterView, friendLook, friendSheets } from '../characters/characterManager';
import { keeperOrMomo } from '../characters/friendArt';
import { dressFriend } from '../characters/wearArt';
import type { Profile } from '../save/saveTypes';
import { equippedItems } from '../shop/purchases';
import { Button } from '../ui/Button';
import { gridCells } from '../ui/setupLayout';
import { startLayout, type StartLayout } from '../ui/startLayout';
import { registerCover } from '../ui/registerCard';
import { COLORS, CSS, DEPTH, LAYOUT, text, type Rect } from '../ui/theme';

export interface StartHost {
  scene: Phaser.Scene;
  /** Whoever played last: the shop behind is theirs. */
  player: Profile;
  /** Everyone else, most recent first. */
  others: readonly Profile[];
  canAddPlayer: boolean;
  onOpen: () => void;
  /** Shows the start screen for another player instead. */
  onSwitch: (id: string) => void;
  onNewPlayer: () => void;
  onGrownUps: () => void;
}

/** Cards per row for the other players, and the tallest a card gets. */
const OTHER_COLS = 3;
const CARD_H = 72;
const FACE_H = 56;

export class StartScreen {
  private readonly root: Phaser.GameObjects.Container;
  private readonly layout: StartLayout;
  private done = false;
  /** Where the buttons are, by label or player id (the e2e test taps them). */
  readonly spots: Record<string, { x: number; y: number }> = {};

  constructor(private readonly host: StartHost) {
    this.layout = startLayout(LAYOUT.panel, LAYOUT.orientation === 'portrait');
    this.root = host.scene.add.container(0, 0).setDepth(DEPTH.startScreen);
    this.drawTopBar();
    this.root.add(registerCover(host.scene));
    this.drawWelcome();
    this.drawOthers();
  }

  destroy(): void {
    this.done = true;
    this.root.destroy();
  }

  /** Runs a choice once: another tap while the shop restarts does nothing. */
  private once(go: () => void): () => void {
    return () => {
      if (this.done) return;
      this.done = true;
      go();
    };
  }

  private button(id: string, r: Rect, label: string, fontSize: number, onTap: () => void): Button {
    const b = Button.inRect(this.host.scene, r, { label, fontSize, onTap });
    this.spots[id] = { x: b.x, y: b.y };
    this.root.add(b);
    return b;
  }

  private drawTopBar(): void {
    const { scene } = this.host;
    const { w, h } = LAYOUT.statusBar;
    const bar = scene.add.graphics();
    bar.fillStyle(COLORS.lavender, 1).fillRect(0, 0, w, h);
    bar.fillStyle(COLORS.lavenderDark, 1).fillRect(0, h - 6, w, 6);
    const title = scene.add.text(w / 2, h / 2 - 3, 'Sweet Scoops Academy', text(30)).setOrigin(0.5);
    // Taps on the bar don't reach the shop's own top bar underneath.
    this.root.add([bar, scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive(), title]);
  }

  /** "Hi, Ava!", her friend dressed as in her shop, Open the shop! and her Sprinkles. */
  private drawWelcome(): void {
    const { scene, player } = this.host;
    const { textX, welcomeY, helloY, helloFont, friend: spot, open, sprinklesY } = this.layout;
    const welcome = scene.add.text(textX, welcomeY, 'Welcome back!', text(24, CSS.inkSoft)).setOrigin(0.5);
    const hello = scene.add.text(textX, helloY, `Hi, ${player.displayName}!`, text(helloFont)).setOrigin(0.5);
    hello.setScale(Math.min(1, (open.w + 20) / hello.width));
    const keeper = keeperOrMomo(player.shop.keeper);
    const friend = new CharacterView(scene, spot.x, spot.y, friendLook(keeper));
    dressFriend(friend, keeper, equippedItems(player), friendSheets(keeper));
    friend.setScale(friend.scaleX * spot.scale).idle(true);
    const sprinkles = scene.add.text(textX, sprinklesY, `✦ ${player.sprinkles} Sprinkles`, text(26, CSS.strawberry));
    this.root.add([welcome, hello, friend, sprinkles.setOrigin(0.5)]);
    const go = this.once(() => {
      friend.setExpression('happy');
      this.host.onOpen();
    });
    this.button('open', open, 'Open the shop!', 38, go).setFill(COLORS.mint, COLORS.mintDark);
  }

  /** "Not Ava?": a card for each other player and one for New, then the grown-ups area. */
  private drawOthers(): void {
    const { scene, player, others, canAddPlayer } = this.host;
    const { othersLabel, others: area, grownUps } = this.layout;
    const count = others.length + (canAddPlayer ? 1 : 0);
    if (count > 0) {
      const label = others.length > 0 ? `Not ${player.displayName}?` : 'Someone new?';
      this.root.add(scene.add.text(othersLabel.x, othersLabel.y, label, text(22, CSS.inkSoft)).setOrigin(0.5));
      const rows = Math.ceil(count / OTHER_COLS);
      const grid = { ...area, h: Math.min(area.h, rows * CARD_H + (rows - 1) * 12) };
      const cells = gridCells(grid, count, Math.min(count, OTHER_COLS), 12);
      others.forEach((p, i) => this.playerCard(cells[i]!, p));
      if (canAddPlayer) this.button('new', cells[others.length]!, '+ New', 24, this.once(this.host.onNewPlayer));
    }
    this.button('grownUps', grownUps, '⚙ Grown-ups', 22, () => this.host.onGrownUps());
  }

  /** Another player: their friend's picture and their name; tapping switches to them. */
  private playerCard(cell: Rect, profile: Profile): void {
    const { scene } = this.host;
    const card = this.button(
      profile.id,
      cell,
      '',
      20,
      this.once(() => this.host.onSwitch(profile.id)),
    );
    const keeper = keeperOrMomo(profile.shop.keeper);
    const face = scene.add.sprite(-cell.w / 2 + 34, 0, friendLook(keeper).sheet.key, 0);
    face.setScale(Math.min(FACE_H, cell.h - 10) / face.height);
    const name = scene.add.text(-cell.w / 2 + 64, 0, profile.displayName, text(22)).setOrigin(0, 0.5);
    name.setScale(Math.min(1, (cell.w - 76) / name.width));
    card.add([face, name]);
  }
}

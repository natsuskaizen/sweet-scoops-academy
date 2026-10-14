/**
 * My shop: the player's own settings, opened by tapping ⚙ in the top bar.
 * No lock, as it only changes this player's things: their shop's name and
 * shopkeeper, hints and calm mode, or handing over to another player. The
 * grown-ups area stays behind its gate. The panel only reports choices; the
 * scene saves them.
 */
import type Phaser from 'phaser';
import { friendLook } from '../characters/characterManager';
import { keeperOrMomo } from '../characters/friendArt';
import type { Profile, ProfileSettings } from '../save/saveTypes';
import { Button } from '../ui/Button';
import { myShopLayout, type MyShopLayout } from '../ui/myShopLayout';
import { registerCover } from '../ui/registerCard';
import { COLORS, CSS, DEPTH, LAYOUT, text, type Rect } from '../ui/theme';
import type { EditStep } from './newPlayerSetup';

/** The settings a child can switch on and off here. */
export type KidToggle = keyof Pick<ProfileSettings, 'showHints' | 'reduceMotion'>;

export interface MyShopHost {
  scene: Phaser.Scene;
  profile: Profile;
  /** Change the shop's name or who works there (the new-player step for it). */
  onChange: (step: EditStep) => void;
  /** Flip a setting and save it; the panel then shows its new state. */
  onToggle: (setting: KidToggle) => void;
  onSwitchPlayer: () => void;
  onGrownUps: () => void;
  onClose: () => void;
}

interface ToggleRow {
  label: string;
  note: string;
  setting: KidToggle;
}

const TOGGLES: ToggleRow[] = [
  { label: 'Hints', note: 'Pictures help after a miss', setting: 'showHints' },
  { label: 'Calm mode', note: 'Less bouncing and confetti', setting: 'reduceMotion' },
];

const SWITCH_W = 96;
const SWITCH_H = 48;

export class MyShopPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly layout: MyShopLayout;
  private readonly switches = new Map<KidToggle, Phaser.GameObjects.Graphics>();
  private closed = false;
  /** Where each row and button is (the e2e test taps them). */
  readonly spots: Record<string, { x: number; y: number }> = {};

  constructor(private readonly host: MyShopHost) {
    const { scene } = host;
    this.layout = myShopLayout(LAYOUT.panel, LAYOUT.orientation === 'portrait');
    const { x, w } = LAYOUT.panel;
    const title = scene.add.text(x + w / 2, this.layout.titleY, 'My shop', text(38)).setOrigin(0.5);
    this.root = scene.add.container(0, 0, [...registerCover(scene), title]).setDepth(DEPTH.myShop);
    this.addChangeRows();
    TOGGLES.forEach((row, i) => this.addToggle(this.layout.rows[i + 2]!, row));
    this.addButtons();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.root.destroy();
    this.host.onClose();
  }

  /** Leaves My shop, then does what was tapped. */
  private leave(go: () => void): () => void {
    return () => {
      if (this.closed) return;
      this.close();
      go();
    };
  }

  /** A button the e2e test can find by `id`; rows have no label of their own. */
  private button(id: string, r: Rect, onTap: () => void, label = '', fontSize?: number): Button {
    const b = Button.inRect(this.host.scene, r, { label, fontSize, onTap });
    this.spots[id] = { x: b.x, y: b.y };
    this.root.add(b);
    return b;
  }

  /** A row's name, with a smaller line under it when the row is tall enough. */
  private label(row: Button, r: Rect, label: string, note: string, left = 20): void {
    const { scene } = this.host;
    const roomy = r.h >= 72 && note !== '';
    const name = scene.add.text(-r.w / 2 + left, roomy ? -10 : 2, label, text(26)).setOrigin(0, 0.5);
    row.add(name);
    if (!roomy) return;
    const small = scene.add.text(-r.w / 2 + left, 18, note, text(17, CSS.inkSoft)).setOrigin(0, 0.5);
    row.add(small.setScale(Math.min(1, (r.w - left - SWITCH_W - 50) / small.width)));
  }

  /** Shop name and Shopkeeper: the row opens that step of the setup. */
  private addChangeRows(): void {
    const { scene, profile } = this.host;
    const [nameRow, keeperRow] = this.layout.rows as [Rect, Rect];
    const shop = this.button(
      'shopName',
      nameRow,
      this.leave(() => this.host.onChange('shop')),
    );
    this.label(shop, nameRow, 'Shop name', profile.shop.name);
    shop.add(this.changePill(nameRow));
    const keeper = this.button(
      'keeper',
      keeperRow,
      this.leave(() => this.host.onChange('keeper')),
    );
    const face = scene.add.sprite(-keeperRow.w / 2 + 44, 0, friendLook(keeperOrMomo(profile.shop.keeper)).sheet.key, 0);
    face.setScale((keeperRow.h - 18) / face.height);
    keeper.add(face);
    this.label(keeper, keeperRow, 'Shopkeeper', '', 84);
    keeper.add(this.changePill(keeperRow));
  }

  /** The "Change" pill at the right of a row (the whole row is the button). */
  private changePill(r: Rect): Phaser.GameObjects.GameObject[] {
    const { scene } = this.host;
    const cx = r.w / 2 - 20 - 66;
    const pill = scene.add.graphics();
    pill.fillStyle(COLORS.white, 1).fillRoundedRect(cx - 66, -22, 132, 44, 22);
    pill.lineStyle(3, COLORS.ink, 0.85).strokeRoundedRect(cx - 66, -22, 132, 44, 22);
    return [pill, scene.add.text(cx, 0, 'Change', text(22)).setOrigin(0.5)];
  }

  private addToggle(r: Rect, { label, note, setting }: ToggleRow): void {
    const row = this.button(setting, r, () => {
      this.host.onToggle(setting);
      this.drawSwitch(setting);
    });
    this.label(row, r, label, note);
    const knob = this.host.scene.add.graphics();
    knob.setPosition(r.w / 2 - 20 - SWITCH_W / 2, 0);
    this.switches.set(setting, knob);
    row.add(knob);
    this.drawSwitch(setting);
  }

  /** An on/off switch: mint with the knob on the right when on. */
  private drawSwitch(setting: KidToggle): void {
    const g = this.switches.get(setting)!;
    const on = this.host.profile.settings[setting];
    g.clear();
    g.fillStyle(on ? COLORS.mint : COLORS.off, 1).fillRoundedRect(-SWITCH_W / 2, -SWITCH_H / 2, SWITCH_W, SWITCH_H, 24);
    g.lineStyle(3, COLORS.ink, 0.85).strokeRoundedRect(-SWITCH_W / 2, -SWITCH_H / 2, SWITCH_W, SWITCH_H, 24);
    g.fillStyle(COLORS.white, 1).fillCircle(on ? SWITCH_W / 2 - 24 : -SWITCH_W / 2 + 24, 0, 17);
    g.lineStyle(3, COLORS.ink, 0.85).strokeCircle(on ? SWITCH_W / 2 - 24 : -SWITCH_W / 2 + 24, 0, 17);
  }

  private addButtons(): void {
    const { switchPlayer, back, grownUps } = this.layout;
    const portrait = LAYOUT.orientation === 'portrait';
    this.button('switch', switchPlayer, this.leave(this.host.onSwitchPlayer), 'Switch player', 28);
    const backLabel = portrait ? 'Back to shop' : 'Back to the shop';
    this.button('back', back, () => this.close(), backLabel, 30).setFill(COLORS.mint, COLORS.mintDark);
    this.button('grownUps', grownUps, this.leave(this.host.onGrownUps), '⚙ Grown-ups', 20);
  }
}

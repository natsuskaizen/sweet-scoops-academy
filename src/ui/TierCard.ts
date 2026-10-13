import Phaser from 'phaser';
import { tierSwatch, TIER_COLORS } from '../characters/tierColors';
import type { Profile } from '../save/saveTypes';
import { itemById, itemId, TIERS, type CatalogDesign, type CatalogItem, type TierId } from '../shop/catalog';
import { offerFor, owns, type Offer } from '../shop/purchases';
import { Button } from './Button';
import { COLORS, CSS, text, type Point, type Rect } from './theme';

export interface TierCardOptions {
  /** The big button's words when the item is owned but not in use, and when it is. */
  useLabel: string;
  removeLabel: string;
  onPick: (tier: TierId) => void;
  onAction: () => void;
}

const SWATCH_R = 30;
const SWATCH_STEP = 84;

/**
 * The shop's colour card: the design's name, its six tiers as swatches with
 * prices (or a tick when owned), and one big button that buys, uses or
 * puts away the chosen tier. Too dear shows how many Sprinkles are still
 * needed instead of a "no".
 */
export class TierCard extends Phaser.GameObjects.Container {
  private action: Button | null = null;

  constructor(
    scene: Phaser.Scene,
    private rect: Rect,
    private readonly opts: TierCardOptions,
  ) {
    super(scene, rect.x, rect.y);
    scene.add.existing(this);
  }

  placeAt(rect: Rect): void {
    this.rect = rect;
    this.setPosition(rect.x, rect.y);
  }

  show(design: CatalogDesign, selected: TierId, profile: Profile): void {
    this.removeAll(true);
    const item = itemById(itemId(design.id, selected))!;
    const { w, h } = this.rect;
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.lavender, 1).fillRoundedRect(0, 6, w, h, 26);
    g.fillStyle(COLORS.cream, 1).fillRoundedRect(0, 0, w, h, 26);
    g.lineStyle(4, COLORS.lavenderDark, 1).strokeRoundedRect(0, 0, w, h, 26);
    this.add(g);
    this.add(this.scene.add.text(24, 16, item.name, text(28)).setOrigin(0, 0));
    this.add(this.scene.add.text(w - 24, 22, 'Tap a colour to try it', text(17, CSS.inkSoft)).setOrigin(1, 0));
    const startX = (w - SWATCH_STEP * (TIERS.length - 1)) / 2;
    TIERS.forEach((tier, i) =>
      this.swatch({ x: startX + i * SWATCH_STEP, y: 104 }, design, tier, tier === selected, profile),
    );
    this.action = this.button(item, offerFor(profile, item));
    this.add(this.action);
  }

  private swatch(at: Point, design: CatalogDesign, tier: TierId, on: boolean, profile: Profile): void {
    const { x, y } = at;
    const item = itemById(itemId(design.id, tier))!;
    const g = this.scene.add.graphics();
    if (on) g.lineStyle(6, COLORS.lavenderDark, 1).strokeCircle(x, y, SWATCH_R + 8);
    fillSwatch(g, x, y, tier);
    g.lineStyle(4, COLORS.ink, 1).strokeCircle(x, y, SWATCH_R);
    const caption = owns(profile, item) ? '✓' : `✦${item.price}`;
    const color = owns(profile, item) ? CSS.mint : CSS.strawberry;
    const label = this.scene.add.text(x, y + SWATCH_R + 18, caption, text(18, color)).setOrigin(0.5);
    const hit = this.scene.add.zone(x, y, SWATCH_STEP, SWATCH_STEP).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.opts.onPick(tier));
    this.add([g, label, hit]);
  }

  private button(item: CatalogItem, offer: Offer): Button {
    const { w, h } = this.rect;
    const look = BUTTON_LOOK[offer.kind];
    const button = new Button(this.scene, w / 2, h - 52, {
      width: w - 40,
      height: 76,
      label: this.labelFor(item, offer),
      fontSize: 28,
      fill: look.fill,
      shade: look.shade,
      onTap: () => this.opts.onAction(),
    });
    if (offer.kind === 'short') button.setEnabled(false);
    return button;
  }

  private labelFor(item: CatalogItem, offer: Offer): string {
    if (offer.kind === 'buy') return `Buy for ✦ ${item.price}`;
    if (offer.kind === 'short') return `✦ ${offer.short} more to go!`;
    return offer.kind === 'use' ? this.opts.useLabel : this.opts.removeLabel;
  }
}

const BUTTON_LOOK: Record<Offer['kind'], { fill: number; shade: number }> = {
  buy: { fill: COLORS.mint, shade: COLORS.mintDark },
  short: { fill: COLORS.creamDark, shade: 0xd9c3ae },
  use: { fill: COLORS.sky, shade: COLORS.skyDark },
  'in-use': { fill: COLORS.cream, shade: COLORS.creamDark },
};

/** A plain disc for most tiers; Sparkly Rainbow is a pie of its colours. */
export function fillSwatch(g: Phaser.GameObjects.Graphics, x: number, y: number, tier: TierId, r = SWATCH_R): void {
  const colors = TIER_COLORS[tier].main;
  if (colors.length === 1) {
    g.fillStyle(Phaser.Display.Color.HexStringToColor(tierSwatch(tier)).color, 1).fillCircle(x, y, r);
    return;
  }
  const step = (Math.PI * 2) / colors.length;
  colors.forEach((c, i) => {
    g.fillStyle(Phaser.Display.Color.HexStringToColor(c).color, 1);
    g.slice(x, y, r, i * step, (i + 1) * step).fillPath();
  });
}

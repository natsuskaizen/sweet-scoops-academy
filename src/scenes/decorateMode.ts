/**
 * Decorate: the register slides away so the room fills the screen, a tray
 * of decorations runs along the bottom, and the colour card picks a tier.
 * Whatever is picked stands in its spot right away as a preview; buying
 * (or using an owned one) keeps it there. Rules live in shop/purchases.ts;
 * this only shows them.
 */
import type Phaser from 'phaser';
import type { Profile } from '../save/saveTypes';
import { designsIn, itemById, itemId, TIERS, type CatalogDesign, type TierId } from '../shop/catalog';
import { ownedTiers, takeOffer } from '../shop/purchases';
import { Button } from '../ui/Button';
import { TierCard } from '../ui/TierCard';
import { COLORS, CSS, decorTrayRect, LAYOUT, text, tierCardRect } from '../ui/theme';
import { decorationTexture, drawDecoration, type PlacedDecorations } from './decorArt';

export interface DecorateHost {
  scene: Phaser.Scene;
  profile: () => Profile;
  placed: PlacedDecorations;
  /** Writes the save; false if it could not be saved. */
  save: () => boolean;
  onClose: () => void;
}

const BAR_H = 72;

export class DecorateMode {
  private readonly root: Phaser.GameObjects.Container;
  private readonly card: TierCard;
  private readonly balance: Phaser.GameObjects.Text;
  private tray: Phaser.GameObjects.Container;
  private preview: Phaser.GameObjects.Container | null = null;
  private design: CatalogDesign;
  private tier: TierId = 'pink';

  constructor(private readonly host: DecorateHost) {
    const { scene } = host;
    this.root = scene.add.container(0, 0).setDepth(450);
    this.balance = this.drawTopBar();
    this.design = designsIn('decorate')[0]!;
    this.tray = scene.add.container(0, 0);
    this.root.add(this.tray);
    this.card = new TierCard(scene, tierCardRect(LAYOUT, this.spot()), {
      useLabel: 'Put it in the shop',
      removeLabel: 'Take it away',
      onPick: (tier) => this.pick(tier),
      onAction: () => this.act(),
    });
    this.root.add(this.card);
    this.select(this.design);
  }

  /** Shows a design, in the tier standing in the room if there is one, else the first owned, else pink. */
  select(design: CatalogDesign): void {
    this.design = design;
    const placed = this.host.profile().decorations.find((d) => d.itemId.startsWith(`${design.id}.`));
    const standing = placed ? itemById(placed.itemId)?.tier : undefined;
    this.pick(standing ?? ownedTiers(this.host.profile(), design)[0] ?? TIERS[0]);
  }

  pick(tier: TierId): void {
    this.tier = tier;
    this.card.placeAt(tierCardRect(LAYOUT, this.spot()));
    this.card.show(this.design, tier, this.host.profile());
    this.drawTray();
    this.showPreview();
  }

  /** The big button: buy, put in the shop, or take away. */
  act(): void {
    const item = itemById(itemId(this.design.id, this.tier))!;
    const profile = this.host.profile();
    if (takeOffer(profile, item) === 'none') return;
    if (!this.host.save()) return;
    this.balance.setText(`✦ ${profile.sprinkles}`);
    this.host.placed.draw(profile.decorations);
    this.pick(this.tier);
  }

  close(): void {
    this.clearPreview();
    this.host.placed.draw(this.host.profile().decorations);
    this.root.destroy();
    this.host.onClose();
  }

  private spot() {
    return LAYOUT.decorSpots[this.spotId()];
  }

  private spotId() {
    const { placement } = this.design;
    return placement.kind === 'shop' ? placement.spot : 'floor-left';
  }

  private drawTopBar(): Phaser.GameObjects.Text {
    const { scene } = this.host;
    const g = scene.add.graphics();
    g.fillStyle(COLORS.lavender, 1).fillRect(0, 0, LAYOUT.width, BAR_H);
    g.fillStyle(COLORS.lavenderDark, 1).fillRect(0, BAR_H - 6, LAYOUT.width, 6);
    const back = new Button(scene, 90, BAR_H / 2 - 2, {
      width: 150,
      height: 56,
      label: '◀ Back',
      fontSize: 24,
      onTap: () => this.close(),
    });
    const title = scene.add.text(LAYOUT.width / 2, BAR_H / 2 - 3, 'Decorate', text(32)).setOrigin(0.5);
    const balance = scene.add
      .text(LAYOUT.width - 24, BAR_H / 2 - 3, `✦ ${this.host.profile().sprinkles}`, text(30, CSS.strawberry))
      .setOrigin(1, 0.5);
    this.root.add([g, back, title, balance]);
    return balance;
  }

  private drawTray(): void {
    this.tray.removeAll(true);
    const rect = decorTrayRect(LAYOUT);
    const g = this.host.scene.add.graphics();
    g.fillStyle(COLORS.cream, 0.94).fillRect(rect.x, rect.y, rect.w, rect.h);
    g.fillStyle(COLORS.lavenderDark, 1).fillRect(rect.x, rect.y, rect.w, 6);
    this.tray.add(g);
    designsIn('decorate').forEach((design, i) => this.bubble(design, i));
  }

  private bubble(design: CatalogDesign, i: number): void {
    const { scene } = this.host;
    const { x, y, d } = bubbleSpot(i);
    const on = design.id === this.design.id;
    const g = scene.add.graphics();
    g.fillStyle(0xb0805e, 1).fillCircle(x, y + 5, d / 2);
    g.fillStyle(on ? 0xf7f2ff : COLORS.white, 1).fillCircle(x, y, d / 2);
    g.lineStyle(on ? 7 : 4, on ? COLORS.lavenderDark : 0xe6d6c4, 1).strokeCircle(x, y, d / 2);
    const tier = on ? this.tier : (ownedTiers(this.host.profile(), design)[0] ?? 'pink');
    const key = decorationTexture(scene, itemById(itemId(design.id, tier))!);
    const parts: Phaser.GameObjects.GameObject[] = [g];
    if (key) {
      const icon = scene.add.image(x, y, key);
      parts.push(icon.setScale(Math.min(6, (d * 0.62) / Math.max(icon.width, icon.height))));
    }
    if (ownedTiers(this.host.profile(), design).length > 0) {
      parts.push(scene.add.text(x + d / 2 - 8, y - d / 2 + 4, '✓', text(26, CSS.mint)).setOrigin(0.5));
    }
    const hit = scene.add.zone(x, y, d, d).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.select(design));
    this.tray.add([...parts, hit]);
  }

  private showPreview(): void {
    this.clearPreview();
    const { scene } = this.host;
    const item = itemById(itemId(this.design.id, this.tier))!;
    const at = this.spot();
    this.host.placed.setSpotVisible(this.spotId(), false);
    const piece = drawDecoration(scene, item, at);
    const bounds = piece.getBounds();
    const outline = scene.add.graphics().setDepth(piece.depth + 0.1);
    outline.lineStyle(4, COLORS.lavenderDark, 1);
    outline.strokeRoundedRect(bounds.x - 12, bounds.y - 12, bounds.width + 24, bounds.height + 24, 14);
    scene.tweens.add({ targets: outline, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    this.preview = scene.add.container(0, 0, [piece, outline]).setDepth(piece.depth);
  }

  private clearPreview(): void {
    this.preview?.destroy();
    this.preview = null;
    for (const spot of Object.keys(LAYOUT.decorSpots)) {
      this.host.placed.setSpotVisible(spot as keyof typeof LAYOUT.decorSpots, true);
    }
  }
}

/** Where the i-th tray bubble sits: one row in landscape, rows of three in portrait. */
function bubbleSpot(i: number): { x: number; y: number; d: number } {
  const rect = decorTrayRect(LAYOUT);
  if (LAYOUT.orientation === 'landscape') return { x: 105 + i * 165, y: rect.y + 88, d: 130 };
  const step = 220;
  const x0 = (LAYOUT.width - 2 * step) / 2;
  return { x: x0 + (i % 3) * step, y: rect.y + 78 + Math.floor(i / 3) * 140, d: 116 };
}

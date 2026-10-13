/**
 * Decorate: the register slides away so the room fills the screen, a tray
 * of decorations runs along the bottom (a page at a time, with big arrows),
 * and the colour card picks a tier. Whatever is picked shows in the room
 * right away as a preview (wall paint and doors repaint the room); buying
 * (or using an owned one) keeps it there. Rules live in shop/purchases.ts;
 * this only shows them.
 */
import type Phaser from 'phaser';
import type { Profile } from '../save/saveTypes';
import {
  designsIn,
  isRoomSurface,
  itemById,
  itemId,
  TIERS,
  type CatalogDesign,
  type CatalogItem,
  type TierId,
} from '../shop/catalog';
import { ownedTiers, takeOffer } from '../shop/purchases';
import { Button } from '../ui/Button';
import { TierCard } from '../ui/TierCard';
import { COLORS, CSS, decorTrayRect, decorTraySlots, LAYOUT, text, tierCardRect, type Rect } from '../ui/theme';
import { decorationTexture, drawDecoration, pieceRect, type PlacedDecorations } from './decorArt';

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
  private preview: Phaser.GameObjects.Container | Phaser.GameObjects.Graphics | null = null;
  private design: CatalogDesign;
  private tier: TierId = 'pink';
  private page = 0;
  private readonly designs = designsIn('decorate');

  constructor(private readonly host: DecorateHost) {
    const { scene } = host;
    this.root = scene.add.container(0, 0).setDepth(450);
    this.balance = this.drawTopBar();
    this.design = this.designs[0]!;
    this.tray = scene.add.container(0, 0);
    this.root.add(this.tray);
    this.card = new TierCard(scene, tierCardRect(LAYOUT, pieceRect(this.design)), {
      labels: () => ({ use: 'Put it in the shop', remove: 'Take it away' }),
      onPick: (tier) => this.pick(tier),
      onAction: () => this.act(),
    });
    this.root.add(this.card);
    this.select(this.design);
  }

  /** Shows a design, in the tier standing in the room if there is one, else the first owned, else pink. */
  select(design: CatalogDesign): void {
    this.design = design;
    this.page = Math.max(0, Math.floor(this.designs.indexOf(design) / decorTraySlots(LAYOUT).perPage));
    const placed = this.host.profile().decorations.find((d) => d.itemId.startsWith(`${design.id}.`));
    const standing = placed ? itemById(placed.itemId)?.tier : undefined;
    this.pick(standing ?? ownedTiers(this.host.profile(), design)[0] ?? TIERS[0]);
  }

  /** Selects a design by its id (the e2e tests drive Decorate this way). */
  selectById(id: string): void {
    const design = this.designs.find((d) => d.id === id);
    if (design) this.select(design);
  }

  /** Shows another page of the tray. */
  turnPage(step: number): void {
    const pages = Math.ceil(this.designs.length / decorTraySlots(LAYOUT).perPage);
    const page = Math.min(pages - 1, Math.max(0, this.page + step));
    if (page === this.page) return;
    this.page = page;
    this.drawTray();
  }

  pick(tier: TierId): void {
    this.tier = tier;
    this.card.placeAt(tierCardRect(LAYOUT, pieceRect(this.design)));
    this.card.show(this.design, tier, this.host.profile());
    this.drawTray();
    this.showPreview();
  }

  /** The big button: buy, put in the shop, or take away. */
  act(): void {
    const profile = this.host.profile();
    if (takeOffer(profile, this.item()) === 'none') return;
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

  private item(): CatalogItem {
    return itemById(itemId(this.design.id, this.tier))!;
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
    const { perPage } = decorTraySlots(LAYOUT);
    const first = this.page * perPage;
    this.designs.slice(first, first + perPage).forEach((design, i) => this.bubble(design, i));
    this.drawPager();
  }

  /** The ◀ ▶ arrows and a dot per page (only when there is more than one page). */
  private drawPager(): void {
    const { scene } = this.host;
    const { perPage, prev, next, dotsY } = decorTraySlots(LAYOUT);
    const pages = Math.ceil(this.designs.length / perPage);
    if (pages < 2) return;
    const arrow = (r: Rect, label: string, step: number) => {
      const b = new Button(scene, r.x + r.w / 2, r.y + r.h / 2, {
        width: r.w,
        height: r.h,
        label,
        fontSize: 40,
        fill: COLORS.lavender,
        shade: COLORS.lavenderDark,
        onTap: () => this.turnPage(step),
      });
      const end = step < 0 ? this.page === 0 : this.page === pages - 1;
      return b.setEnabled(!end);
    };
    const dots = scene.add.graphics();
    for (let i = 0; i < pages; i++) {
      dots.fillStyle(i === this.page ? COLORS.lavenderDark : COLORS.creamDark, 1);
      dots.fillCircle(LAYOUT.width / 2 + (i - (pages - 1) / 2) * 28, dotsY, 8);
    }
    this.tray.add([arrow(prev, '◀', -1), arrow(next, '▶', 1), dots]);
  }

  private bubble(design: CatalogDesign, i: number): void {
    const { scene } = this.host;
    const { slots, d } = decorTraySlots(LAYOUT);
    const { x, y } = slots[i]!;
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

  /** Shows the picked item in the room, outlined: standing on its spot, or painted into the room. */
  private showPreview(): void {
    this.clearPreview();
    const item = this.item();
    const spot = this.spotId();
    if (isRoomSurface(spot)) {
      this.host.placed.tryOn(item);
      // The whole wall changes colour, so only a door needs pointing out.
      if (spot === 'door') this.preview = this.outline(pieceRect(this.design), 3);
      return;
    }
    this.host.placed.setSpotVisible(spot, false);
    const piece = drawDecoration(this.host.scene, item, LAYOUT.decorSpots[spot]);
    const b = piece.getBounds();
    const outline = this.outline({ x: b.x, y: b.y, w: b.width, h: b.height }, piece.depth + 0.1);
    this.preview = this.host.scene.add.container(0, 0, [piece, outline]).setDepth(piece.depth);
  }

  private outline(r: Rect, depth: number): Phaser.GameObjects.Graphics {
    const { scene } = this.host;
    const outline = scene.add.graphics().setDepth(depth);
    outline.lineStyle(4, COLORS.lavenderDark, 1);
    outline.strokeRoundedRect(r.x - 12, r.y - 12, r.w + 24, r.h + 24, 14);
    scene.tweens.add({ targets: outline, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    return outline;
  }

  private clearPreview(): void {
    this.preview?.destroy();
    this.preview = null;
    this.host.placed.tryOn(null);
    for (const spot of Object.keys(LAYOUT.decorSpots)) {
      this.host.placed.setSpotVisible(spot as keyof typeof LAYOUT.decorSpots, true);
    }
  }
}

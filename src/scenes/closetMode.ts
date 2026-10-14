/**
 * The Closet: a dressing room drawn over the shop, with the player's
 * shopkeeper on a little stage and a panel of hats, bows, glasses, hearing
 * aids and scoopers. Any colour tried is shown on them straight away; buying
 * (or wearing an owned one) keeps it on, in the shop too. Rules live in shop/purchases.ts; this
 * only shows them.
 */
import type Phaser from 'phaser';
import { CharacterView, friendLook, friendSheets } from '../characters/characterManager';
import { friendName, keeperOrMomo, type FriendId } from '../characters/friendArt';
import { dressFriend } from '../characters/wearArt';
import type { Profile } from '../save/saveTypes';
import {
  designsIn,
  itemById,
  itemId,
  TIER_INFO,
  TIERS,
  type CatalogDesign,
  type CatalogItem,
  type EquipSlot,
  type TierId,
} from '../shop/catalog';
import { equippedIn, equippedItems, isInUse, owns, ownedTiers, takeOffer, wornWith } from '../shop/purchases';
import { TierCard } from '../ui/TierCard';
import { closetLayout, CSS, DEPTH, LAYOUT, text, type ClosetLayout } from '../ui/theme';
import { drawBackdrop, drawTabs, drawTile, drawTopBar, heldScooper, tileRect, type ClosetTab } from './closetParts';
import { twinkle } from './decorArt';

export interface ClosetHost {
  scene: Phaser.Scene;
  profile: () => Profile;
  /** Writes the save; false if it could not be saved. */
  save: () => boolean;
  onClose: () => void;
}

const TABS: readonly ClosetTab[] = [
  { id: 'clothing', label: 'Clothing', slots: ['hat', 'top', 'outfit', 'bottom', 'shoes'] },
  { id: 'accessories', label: 'Accessories', slots: ['glasses', 'hearing', 'bow'] },
  { id: 'tools', label: 'Ice Cream Tools', slots: ['handheld'] },
];

const slotOf = (design: Pick<CatalogDesign, 'placement'>): EquipSlot | null =>
  design.placement.kind === 'equip' ? design.placement.slot : null;

/** A tab's designs, slot by slot in the tab's order, cheapest first within a slot. */
const designsFor = (tab: ClosetTab): CatalogDesign[] =>
  tab.slots.flatMap((slot) => designsIn('closet').filter((d) => slotOf(d) === slot));

export class ClosetMode {
  private readonly root: Phaser.GameObjects.Container;
  private readonly layout: ClosetLayout;
  private readonly balance: Phaser.GameObjects.Text;
  /** The shopkeeper trying things on. */
  private readonly wearer: CharacterView;
  private readonly keeper: FriendId;
  /** The shopkeeper's fur colour, for paws holding scoopers. */
  private readonly paw: string;
  private readonly card: TierCard;
  /** Things redrawn on every change: tabs, tiles, captions, the scooper and sparkles. */
  private readonly changing: Phaser.GameObjects.Container;
  private tab: ClosetTab = TABS[0]!;
  private design: CatalogDesign;
  private tier: TierId = 'pink';
  /** Whether the shopkeeper is trying on the chosen colour (off once it is taken off). */
  private trying = true;

  constructor(private readonly host: ClosetHost) {
    const { scene } = host;
    this.layout = closetLayout(LAYOUT);
    this.root = scene.add.container(0, 0).setDepth(DEPTH.closet);
    this.root.add(drawBackdrop(scene, this.layout));
    this.keeper = keeperOrMomo(host.profile().shop.keeper);
    this.balance = drawTopBar(scene, this.root, `${friendName(this.keeper)}'s Closet`, () => this.close());
    const { momo } = this.layout;
    this.wearer = new CharacterView(scene, momo.x, momo.y, friendLook(this.keeper));
    this.wearer.setScale(momo.scale).idle(true);
    this.paw = `#${this.wearer.bodyColor().toString(16).padStart(6, '0')}`;
    this.changing = scene.add.container(0, 0);
    this.card = new TierCard(scene, this.layout.card, {
      labels: (design) =>
        slotOf(design) === 'handheld'
          ? { use: 'Scoop with it', remove: 'Put it away' }
          : { use: 'Wear it', remove: 'Take it off' },
      onPick: (tier) => this.pick(tier),
      onAction: () => this.act(),
    });
    this.root.add([this.wearer, this.changing, this.card]);
    this.design = designsFor(this.tab)[0]!;
    this.showTab(this.tab.id);
  }

  showTab(id: string): void {
    this.tab = TABS.find((t) => t.id === id) ?? TABS[0]!;
    this.select(designsFor(this.tab)[0]!);
  }

  /** Shows a design, in the colour Momo has on if she wears it, else the first owned, else pink. */
  select(design: CatalogDesign): void {
    this.design = design;
    const worn = equippedIn(this.host.profile(), slotOf(design)!);
    const tier = worn?.designId === design.id ? worn.tier : ownedTiers(this.host.profile(), design)[0];
    this.pick(tier ?? TIERS[0]);
  }

  pick(tier: TierId): void {
    this.tier = tier;
    this.trying = true;
    this.refresh();
  }

  /** The big button: buy, wear (or scoop with), or take off. */
  act(): void {
    const result = takeOffer(this.host.profile(), this.item());
    if (result === 'none' || !this.host.save()) return;
    this.trying = result !== 'removed';
    this.refresh();
  }

  close(): void {
    this.root.destroy();
    this.host.onClose();
  }

  private item(): CatalogItem {
    return itemById(itemId(this.design.id, this.tier))!;
  }

  private refresh(): void {
    const profile = this.host.profile();
    this.balance.setText(`✦ ${profile.sprinkles}`);
    this.card.show(this.design, this.tier, profile);
    this.changing.removeAll(true);
    const { scene } = this.host;
    this.changing.add(drawTabs(scene, this.layout.tabs, TABS, { id: this.tab.id, onTap: (t) => this.showTab(t.id) }));
    designsFor(this.tab).forEach((design, i) => this.tile(design, i));
    this.dressUp();
    this.caption();
  }

  private tile(design: CatalogDesign, i: number): void {
    const on = design.id === this.design.id;
    const owned = ownedTiers(this.host.profile(), design);
    const tier = on ? this.tier : (owned[0] ?? 'pink');
    const info = {
      item: itemById(itemId(design.id, tier))!,
      name: design.name,
      basePrice: design.basePrice,
      ownedCount: owned.length,
      on,
      onTap: () => this.select(design),
      paw: this.paw,
    };
    this.changing.add(drawTile(this.host.scene, tileRect(this.layout.grid, i), info));
  }

  /** The shopkeeper in what they have on, with the colour being tried in place of their own for that slot. */
  private dressUp(): void {
    const profile = this.host.profile();
    const items = this.trying ? wornWith(profile, this.item()) : equippedItems(profile);
    dressFriend(this.wearer, this.keeper, items, friendSheets(this.keeper));
    const { momo } = this.layout;
    const scooper = items.find((i) => slotOf(i) === 'handheld');
    const held = heldScooper(this.host.scene, scooper, this.paw, momo.scale);
    this.changing.add(held.setPosition(momo.x - 8 * momo.scale, momo.y - 10 * momo.scale));
    if (items.some((i) => i.tier === 'rainbow')) {
      const box = this.host.scene.add.container(momo.x, momo.y);
      twinkle(this.host.scene, box, momo.scale * 36, momo.scale * 40);
      this.changing.add(box);
    }
  }

  private caption(): void {
    const { scene } = this.host;
    const { stage, captionY } = this.layout;
    const x = stage.x + stage.w / 2;
    const name = `${this.design.name} · ${TIER_INFO[this.tier].name}`;
    this.changing.add(scene.add.text(x, captionY, name, text(30)).setOrigin(0.5, 0));
    this.changing.add(scene.add.text(x, captionY + 42, this.note(), text(20, CSS.inkSoft)).setOrigin(0.5, 0));
  }

  private note(): string {
    const profile = this.host.profile();
    const item = this.item();
    if (!this.trying) return "Taken off. It's still yours.";
    if (isInUse(profile, item))
      return `${friendName(this.keeper)} ${slotOf(item) === 'handheld' ? 'scoops with this one' : 'is wearing it'}!`;
    if (owns(profile, item)) return "It's yours! Tap the button to use it.";
    return 'Trying it on. Tap Buy to keep it.';
  }
}

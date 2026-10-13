/**
 * The pieces Momo's Closet is drawn from: the dressing-room backdrop, the
 * top bar, the tabs and the item tiles. closetMode.ts puts them together.
 */
import type Phaser from 'phaser';
import { scooperTexture } from '../characters/scooperArt';
import { wearIconTexture } from '../characters/wearArt';
import type { CatalogItem, EquipSlot } from '../shop/catalog';
import { Button } from '../ui/Button';
import { COLORS, CSS, LAYOUT, text, type ClosetLayout, type Rect } from '../ui/theme';

/** Momo's fur, for the paw holding a scooper icon. */
const MOMO_PAW = '#ffc9a8';
const STRIPE_W = 40;

/** Striped wallpaper behind Momo, a scalloped trim, the floor and a round rug. */
export function drawBackdrop(scene: Phaser.Scene, closet: ClosetLayout): Phaser.GameObjects.GameObject[] {
  const { stage, momo } = closet;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.creamDark, 1).fillRect(0, 0, LAYOUT.width, LAYOUT.height);
  const wallH = momo.y - 40 - stage.y;
  g.fillStyle(0xefe6ff, 1).fillRect(stage.x, stage.y, stage.w, wallH);
  g.fillStyle(0xe4d8fa, 1);
  for (let x = stage.x + STRIPE_W / 2; x < stage.x + stage.w; x += STRIPE_W)
    g.fillRect(x, stage.y, STRIPE_W / 2, wallH);
  g.fillStyle(COLORS.strawberry, 1).fillRect(stage.x, stage.y, stage.w, 14);
  for (let x = stage.x + 20; x < stage.x + stage.w; x += STRIPE_W) g.fillCircle(x, stage.y + 14, 20);
  g.fillStyle(0xffd1df, 1).fillEllipse(momo.x, momo.y, momo.scale * 46, momo.scale * 11);
  g.lineStyle(5, COLORS.strawberry, 1).strokeEllipse(momo.x, momo.y, momo.scale * 46, momo.scale * 11);
  const { panel } = closet;
  g.fillStyle(COLORS.lavender, 1).fillRoundedRect(panel.x, panel.y + 6, panel.w, panel.h, 26);
  g.fillStyle(COLORS.cream, 1).fillRoundedRect(panel.x, panel.y, panel.w, panel.h, 26);
  g.lineStyle(5, COLORS.lavenderDark, 1).strokeRoundedRect(panel.x, panel.y, panel.w, panel.h, 26);
  // Taps on the Closet never reach the shop underneath.
  const blocker = scene.add.zone(0, 0, LAYOUT.width, LAYOUT.height).setOrigin(0).setInteractive();
  return [blocker, g];
}

/** The lavender bar along the top: Back, the title and the Sprinkles balance (returned so it can change). */
export function drawTopBar(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  onBack: () => void,
): Phaser.GameObjects.Text {
  const barH = 72;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.lavender, 1).fillRect(0, 0, LAYOUT.width, barH);
  g.fillStyle(COLORS.lavenderDark, 1).fillRect(0, barH - 6, LAYOUT.width, 6);
  const back = new Button(scene, 90, barH / 2 - 2, {
    width: 150,
    height: 56,
    label: '◀ Back',
    fontSize: 24,
    onTap: onBack,
  });
  const title = scene.add.text(LAYOUT.width / 2, barH / 2 - 3, "Momo's Closet", text(32)).setOrigin(0.5);
  const balance = scene.add.text(LAYOUT.width - 24, barH / 2 - 3, '', text(30, CSS.strawberry)).setOrigin(1, 0.5);
  root.add([g, back, title, balance]);
  return balance;
}

export interface ClosetTab {
  id: string;
  label: string;
  /** The slots whose designs the tab shows, in this order. */
  slots: readonly EquipSlot[];
}

/** One row of tabs; the chosen one is white with a lavender edge. */
export function drawTabs(
  scene: Phaser.Scene,
  rect: Rect,
  tabs: readonly ClosetTab[],
  chosen: { id: string; onTap: (tab: ClosetTab) => void },
): Phaser.GameObjects.GameObject[] {
  const gap = 10;
  const w = (rect.w - gap * (tabs.length - 1)) / tabs.length;
  return tabs.flatMap((tab, i) => {
    const x = rect.x + i * (w + gap);
    const on = tab.id === chosen.id;
    const g = scene.add.graphics();
    g.fillStyle(on ? COLORS.white : COLORS.creamDark, 1).fillRoundedRect(x, rect.y, w, rect.h, 16);
    g.lineStyle(4, on ? COLORS.lavenderDark : 0xe6d6c4, 1).strokeRoundedRect(x, rect.y, w, rect.h, 16);
    const style = text(22, on ? CSS.ink : CSS.inkSoft, { align: 'center', wordWrap: { width: w - 12 } });
    const label = scene.add.text(x + w / 2, rect.y + rect.h / 2, tab.label, style).setOrigin(0.5);
    const hit = scene.add.zone(x, rect.y, w, rect.h).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => chosen.onTap(tab));
    return [g, label, hit];
  });
}

export interface TileInfo {
  /** The tier shown on the tile. */
  item: CatalogItem;
  name: string;
  basePrice: number;
  ownedCount: number;
  on: boolean;
  onTap: () => void;
}

const TILE_GAP = 14;
const TILE_COLS = 4;

/** Where tile `i` of the grid goes. */
export function tileRect(grid: Rect, i: number): Rect {
  const w = (grid.w - TILE_GAP * (TILE_COLS - 1)) / TILE_COLS;
  const rows = 2;
  const h = (grid.h - TILE_GAP * (rows - 1)) / rows;
  return { x: grid.x + (i % TILE_COLS) * (w + TILE_GAP), y: grid.y + Math.floor(i / TILE_COLS) * (h + TILE_GAP), w, h };
}

/** A design's tile: its picture, its name, and "from ✦ N" or how many colours are owned. */
export function drawTile(scene: Phaser.Scene, rect: Rect, tile: TileInfo): Phaser.GameObjects.GameObject[] {
  const { x, y, w, h } = rect;
  const g = scene.add.graphics();
  g.fillStyle(0xe6d6c4, 1).fillRoundedRect(x, y + 5, w, h, 18);
  g.fillStyle(tile.on ? 0xf7f2ff : COLORS.white, 1).fillRoundedRect(x, y, w, h, 18);
  g.lineStyle(tile.on ? 6 : 3, tile.on ? COLORS.lavenderDark : 0xe6d6c4, 1).strokeRoundedRect(x, y, w, h, 18);
  const parts: Phaser.GameObjects.GameObject[] = [g];
  const key = iconTexture(scene, tile.item);
  if (key) {
    const icon = scene.add.image(x + w / 2, y + h * 0.33, key);
    parts.push(icon.setScale(Math.max(2, Math.floor(Math.min((w * 0.7) / icon.width, (h * 0.4) / icon.height)))));
  }
  parts.push(scene.add.text(x + w / 2, y + h * 0.66, tile.name, text(w < 150 ? 16 : 18)).setOrigin(0.5));
  const owned = tile.ownedCount > 0;
  const badge = owned
    ? `✓ ${tile.ownedCount} ${tile.ownedCount === 1 ? 'colour' : 'colours'}`
    : `from ✦${tile.basePrice}`;
  parts.push(
    scene.add.text(x + w / 2, y + h * 0.85, badge, text(16, owned ? CSS.mint : CSS.strawberry)).setOrigin(0.5),
  );
  const hit = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  hit.on('pointerup', tile.onTap);
  return [...parts, hit];
}

function iconTexture(scene: Phaser.Scene, item: CatalogItem): string | null {
  const slot = item.placement.kind === 'equip' ? item.placement.slot : null;
  return slot === 'handheld' ? scooperTexture(scene, item.tier, MOMO_PAW) : wearIconTexture(scene, item);
}

/** Momo's scooper held at her side, drawn at `scale`. */
export function heldScooper(
  scene: Phaser.Scene,
  item: CatalogItem | undefined,
  scale: number,
): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, scooperTexture(scene, item?.tier ?? 'wooden', MOMO_PAW))
    .setOrigin(0.85, 0.15)
    .setScale(scale);
}

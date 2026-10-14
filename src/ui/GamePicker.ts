/**
 * The "pick your next game" screen, over the ticket and keypad before every
 * round: big cards for the games this grade offers, and a heart that fills a
 * slice for each different game played today. Tapping a card plays it.
 */
import type Phaser from 'phaser';
import type { PickCard, PickerView } from '../shop/gamePicker';
import { Button } from './Button';
import { pickerLayout, type PickerLayout } from './pickerLayout';
import { registerCover } from './registerCard';
import { COLORS, CSS, DEPTH, LAYOUT, text, type Rect } from './theme';

export interface GamePickerHost {
  scene: Phaser.Scene;
  view: PickerView;
  /** Pops the hearts after the round that earned one. */
  celebrate: boolean;
  onPick: (id: string) => void;
}

/** Each card keeps its own colour, so a child learns "the green one". */
const LOOKS = [
  { fill: COLORS.mint, shade: COLORS.mintDark },
  { fill: COLORS.sky, shade: COLORS.skyDark },
  { fill: COLORS.lemon, shade: COLORS.creamDark },
];
const PLAYED = { fill: COLORS.cream, shade: COLORS.creamDark };
const HEART_ART_W = 11;

export class GamePicker {
  private readonly root: Phaser.GameObjects.Container;
  private readonly layout: PickerLayout;
  private done = false;
  /** Where each card is, by game id (the e2e test taps them). */
  readonly spots: Record<string, { x: number; y: number }> = {};

  constructor(private readonly host: GamePickerHost) {
    const { scene, view } = host;
    this.layout = pickerLayout(LAYOUT.panel, LAYOUT.orientation === 'portrait', view.cards.length);
    this.root = scene.add.container(0, 0).setDepth(DEPTH.setup + 5);
    this.root.add(registerCover(scene));
    const { title, foot } = this.layout;
    this.root.add(scene.add.text(title.x, title.y, view.title, text(title.font)).setOrigin(0.5));
    this.drawHearts();
    view.cards.forEach((card, i) => this.drawCard(card, this.layout.cards[i]!, i));
    const note = text(24, CSS.inkSoft, { align: 'center', wordWrap: { width: foot.w } });
    this.root.add(scene.add.text(foot.x + foot.w / 2, foot.y + foot.h / 2, view.foot, note).setOrigin(0.5));
  }

  destroy(): void {
    this.done = true;
    this.root.destroy();
  }

  /** One heart slice per different game the heart needs, filled for each one played today. */
  private drawHearts(): void {
    const { scene, view, celebrate } = this.host;
    const { hearts } = this.layout;
    const step = HEART_ART_W * hearts.scale + hearts.gap;
    const left = hearts.x - ((view.goal - 1) * step) / 2;
    const images = Array.from({ length: view.goal }, (_, i) =>
      scene.add.image(left + i * step, hearts.y, i < view.filled ? 'heart' : 'heart-empty').setScale(hearts.scale),
    );
    this.root.add(images);
    if (celebrate)
      scene.tweens.add({ targets: images, scale: hearts.scale * 1.4, duration: 220, yoyo: true, repeat: 1 });
  }

  /** A card: its symbol, name and hint, with "new!" or "✓ played" in the corner. */
  private drawCard(card: PickCard, r: Rect, index: number): void {
    const { scene, view } = this.host;
    const look = card.played ? PLAYED : LOOKS[index % LOOKS.length]!;
    const button = Button.inRect(scene, r, {
      label: '',
      ...look,
      onTap: () => {
        if (this.done) return;
        this.done = true;
        this.host.onPick(card.id);
      },
    });
    this.spots[card.id] = { x: button.x, y: button.y };
    const left = -r.w / 2;
    const portrait = LAYOUT.orientation === 'portrait';
    const ink = card.played ? CSS.inkSoft : CSS.ink;
    const parts = portrait ? portraitParts(card, r, ink) : landscapeParts(card, ink, left);
    const badge = card.played ? '✓ played' : view.filled < view.goal ? 'new!' : '';
    const tag = scene.add.text(r.w / 2 - 14, -r.h / 2 + 22, badge, text(20, card.played ? CSS.mint : CSS.strawberry));
    button.add([
      ...parts.map((p) => scene.add.text(p.x, p.y, p.label, p.style).setOrigin(p.ox, 0.5)),
      tag.setOrigin(1, 0.5),
    ]);
    this.root.add(button);
  }
}

interface Part {
  x: number;
  y: number;
  ox: number;
  label: string;
  style: Phaser.Types.GameObjects.Text.TextStyle;
}

/** Landscape: a wide card with the symbol on the left and the words beside it. */
function landscapeParts(card: PickCard, ink: string, left: number): Part[] {
  return [
    { x: left + 80, y: 0, ox: 0.5, label: card.symbol, style: text(54, ink) },
    { x: left + 150, y: -16, ox: 0, label: card.label, style: text(34, ink) },
    { x: left + 150, y: 24, ox: 0, label: card.hint, style: text(20, CSS.inkSoft) },
  ];
}

/** Portrait: a tall card with the symbol above the words. */
function portraitParts(card: PickCard, r: Rect, ink: string): Part[] {
  const wrap = { align: 'center', wordWrap: { width: r.w - 20 } };
  return [
    { x: 0, y: -r.h * 0.18, ox: 0.5, label: card.symbol, style: text(54, ink) },
    { x: 0, y: r.h * 0.12, ox: 0.5, label: card.label, style: text(28, ink, wrap) },
    { x: 0, y: r.h * 0.3, ox: 0.5, label: card.hint, style: text(18, CSS.inkSoft, wrap) },
  ];
}

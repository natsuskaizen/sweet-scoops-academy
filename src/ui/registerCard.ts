/**
 * The cream card in the register panel. The ticket and keypad sit on it,
 * and the start screen, a new player's setup and My shop each draw their own
 * over them.
 */
import type Phaser from 'phaser';
import { COLORS, LAYOUT } from './theme';

/** Draws the card onto `g`. */
export function drawPanelCard(g: Phaser.GameObjects.Graphics): Phaser.GameObjects.Graphics {
  const { x, y, w, h } = LAYOUT.panel;
  g.fillStyle(COLORS.panel, 1).fillRoundedRect(x, y, w, h - 10, 26);
  g.lineStyle(5, COLORS.brownDark, 1).strokeRoundedRect(x, y, w, h - 10, 26);
  return g;
}

/** A card covering the panel, and a zone that keeps its taps from reaching the ticket and keypad underneath. */
export function registerCover(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const { x, y, w, h } = LAYOUT.panel;
  return [drawPanelCard(scene.add.graphics()), scene.add.zone(x, y, w, h).setOrigin(0).setInteractive()];
}

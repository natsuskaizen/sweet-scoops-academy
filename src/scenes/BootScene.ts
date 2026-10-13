import Phaser from 'phaser';
import { createServices, SERVICES_KEY } from '../game/services';
import { createPropTextures } from './shopArt';

/** Builds placeholder textures, loads the save, then opens the shop. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    createPropTextures(this);
    if (!this.registry.has(SERVICES_KEY)) this.registry.set(SERVICES_KEY, createServices());
    this.scene.start('Shop');
  }
}

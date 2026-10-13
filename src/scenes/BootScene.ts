import Phaser from 'phaser';
import { registerAddedTextures } from '../characters/characterManager';
import { createServices, SERVICES_KEY, type GameServices } from '../game/services';
import { createPropTextures } from './shopArt';

/** Builds textures (including added characters' pictures), loads the save, then opens the shop. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    createPropTextures(this);
    if (!this.registry.has(SERVICES_KEY)) this.registry.set(SERVICES_KEY, createServices());
    const services = this.registry.get(SERVICES_KEY) as GameServices;
    void registerAddedTextures(this, services.characters.list()).then(() => this.scene.start('Shop'));
  }
}

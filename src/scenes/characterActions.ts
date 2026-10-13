/**
 * Grown-ups area action for characters added from pictures. Changes take
 * effect by rebuilding the shop from the save, like loading a backup: the
 * shopkeeper is swapped at once and new customers join from the next round.
 */
import type Phaser from 'phaser';
import { registerAddedTextures } from '../characters/characterManager';
import type { GameServices } from '../game/services';
import { CharacterDialog } from '../ui/CharacterDialog';
import type { ParentAction } from '../ui/ParentGate';

export function characterAction(scene: Phaser.Scene, services: GameServices): ParentAction {
  return {
    label: 'Characters',
    enabled: true,
    run: (gate) => {
      new CharacterDialog(services.characters, (changed) => {
        if (!changed) return;
        gate.close();
        void restartWithCharacters(scene, services);
      });
    },
  };
}

/** Decodes added characters' pictures, then rebuilds the shop from the save. */
export async function restartWithCharacters(scene: Phaser.Scene, services: GameServices): Promise<void> {
  await registerAddedTextures(scene, services.characters.list());
  scene.scene.restart();
}

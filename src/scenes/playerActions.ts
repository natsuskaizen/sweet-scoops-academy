/**
 * Grown-ups area action for managing players: rename or remove anyone who
 * plays on this device. Each change is saved at once; when the dialog closes
 * the shop rebuilds from the save, on the start screen if the player who was
 * playing was removed.
 */
import type Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig';
import type { GameServices } from '../game/services';
import { playersInOrder, playerStats, removePlayer, renamePlayer } from '../save/profileActions';
import type { SaveFile } from '../save/saveTypes';
import type { ParentAction } from '../ui/ParentGate';
import { PlayersDialog, type PlayerRow } from '../ui/PlayersDialog';

export function playerRows(save: SaveFile): PlayerRow[] {
  return playersInOrder(save).map((p) => ({
    id: p.id,
    name: p.displayName,
    detail: `${p.shop.name} · ${playerStats(p)}`,
    playing: p.id === save.activeProfileId,
  }));
}

export function playersAction(scene: Phaser.Scene, services: GameServices): ParentAction {
  return {
    label: 'Players',
    enabled: true,
    run: (gate) => {
      let touched = false;
      const playingBefore = services.save.activeProfileId;
      const change = (apply: () => string | null): string | null => {
        touched = true;
        return saveOrUndo(services, apply);
      };
      new PlayersDialog({
        rows: () => playerRows(services.save),
        maxNameLength: GAME_CONFIG.players.maxNameLength,
        rename: (id, name) => change(() => renamePlayer(services.save, id, name)),
        remove: (id) => change(() => (removePlayer(services.save, id) ? null : "The last player can't be removed.")),
        onClose: () => {
          if (!touched) return;
          gate.close();
          // The one playing may be gone, so a child picks who plays next.
          if (!services.save.profiles[playingBefore]) services.stage = 'start';
          scene.scene.restart();
        },
      });
    },
  };
}

/** Applies a change and saves it; if the save fails, the change is undone so nothing unsaved shows. */
function saveOrUndo(services: GameServices, apply: () => string | null): string | null {
  const before = structuredClone(services.save);
  const problem = apply();
  if (problem) return problem;
  const result = services.saves.write(services.save);
  if (result.ok) return null;
  services.save.profiles = before.profiles;
  services.save.activeProfileId = before.activeProfileId;
  return `Not saved: ${result.error}`;
}

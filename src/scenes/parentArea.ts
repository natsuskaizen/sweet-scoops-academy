/**
 * What the grown-ups area shows and offers: the info lines and every action.
 * Changes to the save go through the Phaser-free helpers in src/save, then
 * the shop rebuilds itself from the save.
 */
import type Phaser from 'phaser';
import type { GameServices } from '../game/services';
import { resetLearning, resetProfile } from '../save/profileActions';
import { nextGoal } from '../shop/progressCalendar';
import { subjectProgress, type Profile } from '../save/saveTypes';
import type { ParentAction, ParentGate, ParentGateOptions } from '../ui/ParentGate';
import { showProgress } from '../ui/ProgressScreen';
import { backupActions } from './backupActions';
import { characterAction, restartWithCharacters } from './characterActions';

export interface ParentAreaHost {
  scene: Phaser.Scene;
  services: GameServices;
  /** The live profile being played (the order manager's). */
  profile: () => Profile;
}

export function parentArea(host: ParentAreaHost): Pick<ParentGateOptions, 'info' | 'actions'> {
  return { info: () => parentInfo(host), actions: () => parentActions(host) };
}

function parentInfo({ services, profile }: ParentAreaHost): string[] {
  const p = profile();
  const last = p.roundHistory[p.roundHistory.length - 1];
  const lastRound = last ? `   ·   Last round: ${last.firstTryCorrect}/${last.ordersCompleted} first try` : '';
  return [
    `Player: ${p.displayName}   ·   Sprinkles: ${p.sprinkles} (earned in total: ${p.lifetimeSprinkles})`,
    `Rounds finished: ${p.roundHistory.length}${lastRound}`,
    ...services.subject.progressReport(subjectProgress(p, services.subject)),
    services.persistent
      ? 'Progress is saved in this browser on this device.'
      : 'This browser is not allowing saves; progress will be lost on reload.',
  ];
}

function parentActions(host: ParentAreaHost): ParentAction[] {
  const { scene, services, profile } = host;
  return [
    { label: 'Progress', enabled: true, run: (gate) => showProgress(gate, scene, profile().roundHistory) },
    dailyGoalAction(host),
    characterAction(scene, services),
    ...backupActions(services, () => void restartWithCharacters(scene, services)),
    restoreAction(host),
    ...resetActions(host),
  ];
}

/** Each tap moves the calendar's daily goal to the next choice; hearts already earned stay. */
function dailyGoalAction({ services, profile }: ParentAreaHost): ParentAction {
  const goal = profile().settings.dailyGoal;
  return {
    label: `Heart goal: ${goal} ${goal === 1 ? 'game' : 'games'} a day`,
    enabled: true,
    run: (gate) => {
      const settings = profile().settings;
      const before = settings.dailyGoal;
      settings.dailyGoal = nextGoal(before);
      const result = services.saves.write(services.save);
      if (result.ok) return gate.showMenu();
      settings.dailyGoal = before;
      gate.notice('Not saved', `The change could not be saved: ${result.error}`);
    },
  };
}

function restoreAction({ scene, services }: ParentAreaHost): ParentAction {
  return {
    label: 'Restore previous save',
    confirm: 'Goes back to the backup copy from the previous save. The current copy is kept aside, not deleted.',
    enabled: services.saves.hasBackup(),
    run: (gate) => {
      try {
        const restored = services.saves.restoreBackup();
        if (!restored) return gate.notice('Nothing restored', 'There is no backup copy to go back to.');
        services.save = restored;
        services.needsSetup = false;
      } catch (err) {
        return gate.notice('Nothing restored', `The backup could not be put back: ${String(err)}`);
      }
      scene.scene.restart();
    },
  };
}

function resetActions(host: ParentAreaHost): ParentAction[] {
  const { services, profile } = host;
  return [
    {
      label: 'Reset learning progress',
      confirm: 'Clears all practice progress. Sprinkles and items are kept.',
      enabled: true,
      run: (gate) => {
        resetLearning(profile(), services.subject);
        saveAndRestart(host, gate);
      },
    },
    {
      label: 'Reset whole profile',
      confirm: 'Starts this player over: Sprinkles, items, history and learning progress are all cleared.',
      enabled: true,
      run: (gate) => {
        resetProfile(services.save, Date.now());
        saveAndRestart(host, gate);
      },
    },
  ];
}

function saveAndRestart({ scene, services }: ParentAreaHost, gate: ParentGate): void {
  const result = services.saves.write(services.save);
  if (!result.ok) return gate.notice('Not saved', `The change could not be saved: ${result.error}`);
  scene.scene.restart();
}

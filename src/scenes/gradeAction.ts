/**
 * Grown-ups area action for a player's grade. The screen lists the grades
 * (the child picks which game to play, see GamePicker); each tap is saved at once. When the grown-ups area closes, the shop restarts if the
 * choice changed, so the next round follows it (see ShopScene).
 */
import type Phaser from 'phaser';
import { GAME_CONFIG, type GradeLevel } from '../config/gameConfig';
import { gradeLevel } from '../learning/grades';
import type { GameServices } from '../game/services';
import { chooseGradeLevel } from '../save/profileActions';
import type { Profile } from '../save/saveTypes';
import { Button } from '../ui/Button';
import type { ParentAction, ParentGate } from '../ui/ParentGate';
import { COLORS, CSS, text } from '../ui/theme';

type Add = <T extends Phaser.GameObjects.GameObject>(obj: T) => T;

/** On the grown-ups area's 1280x880 canvas. */
const GRADE_Y = 250;
const NOTE_Y = 360;

export function gradeAction(scene: Phaser.Scene, services: GameServices, profile: () => Profile): ParentAction {
  return {
    label: `Grade: ${gradeLevel(profile().settings.grade).label}`,
    enabled: true,
    run: (gate) => showGradeScreen(gate, scene, services, profile),
  };
}

function showGradeScreen(gate: ParentGate, scene: Phaser.Scene, services: GameServices, profile: () => Profile): void {
  const pick = (change: (p: Profile) => boolean) => {
    const before = { ...profile().settings };
    const round = profile().currentRound;
    if (!change(profile())) return;
    const result = services.saves.write(services.save);
    if (!result.ok) {
      Object.assign(profile().settings, before);
      profile().currentRound = round;
      return gate.notice('Not saved', `The change could not be saved: ${result.error}`);
    }
    showGradeScreen(gate, scene, services, profile);
  };
  gate.custom((add) => {
    const settings = profile().settings;
    const grade = gradeLevel(settings.grade);
    add(scene.add.text(640, 90, `${profile().displayName}'s grade`, text(40)).setOrigin(0.5, 0));
    gradeButtons(scene, add, grade, (id) => pick((p) => chooseGradeLevel(p, id)));
    const note =
      'Kids pick their own game before each round. A new grade starts a fresh round, and what each kind of math has learned is kept.';
    add(
      scene.add
        .text(640, NOTE_Y, note, text(24, CSS.inkSoft, { align: 'center', wordWrap: { width: 760 } }))
        .setOrigin(0.5, 0),
    );
  });
}

function gradeButtons(scene: Phaser.Scene, add: Add, chosen: GradeLevel, onPick: (id: string) => void): void {
  const levels = GAME_CONFIG.grades.levels;
  const width = 300;
  const gap = 24;
  const left = 640 - ((levels.length - 1) * (width + gap)) / 2;
  levels.forEach((g, i) => {
    const x = left + i * (width + gap);
    add(
      choiceButton(scene, {
        x,
        y: GRADE_Y,
        width,
        label: g.label,
        chosen: g.id === chosen.id,
        onTap: () => onPick(g.id),
      }),
    );
  });
}

interface Choice {
  x: number;
  y: number;
  width: number;
  label: string;
  chosen: boolean;
  onTap: () => void;
}

/** The chosen grade is lemon with a tick, like the chosen shopkeeper card. */
function choiceButton(scene: Phaser.Scene, { x, y, width, label, chosen, onTap }: Choice): Button {
  const look = chosen ? { fill: COLORS.lemon, shade: COLORS.creamDark } : { fill: COLORS.peach, shade: 0xe8a888 };
  return new Button(scene, x, y, {
    width,
    height: 74,
    label: chosen ? `✓ ${label}` : label,
    fontSize: 28,
    ...look,
    onTap,
  });
}

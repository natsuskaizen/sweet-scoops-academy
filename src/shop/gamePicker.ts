/**
 * What the "pick your next game" screen shows. Before every round a child
 * chooses which game to play; a heart needs several different ones, so each
 * card says whether it has been played today and the heart shows how many
 * slices are filled. Phaser-free: src/ui/GamePicker.ts only draws this.
 */
import { GAME_CONFIG } from '../config/gameConfig';
import { gameCount, gameTypeOf, gradeLevel } from '../learning/grades';
import type { Profile, RoundState } from '../save/saveTypes';
import { gamesForHeart, todayProgress, typesToday } from './progressCalendar';

export interface PickCard {
  /** The math mode this card plays. */
  id: string;
  label: string;
  /** A short symbol on the card: "×", "123". */
  symbol: string;
  hint: string;
  /** Played already today: it still plays, but adds no new slice to the heart. */
  played: boolean;
}

export interface PickerView {
  cards: PickCard[];
  /** Heart slices filled today, out of `goal`. */
  filled: number;
  goal: number;
  title: string;
  /** The line under the cards. */
  foot: string;
}

/** A player picks only when their grade has more than one game to choose from. */
export const offersChoice = (profile: Profile): boolean => gameCount(profile.settings) > 1;

/** True once the child has answered something in this round: carry on with it rather than ask again. */
export function roundStarted(round: RoundState | null): boolean {
  if (!round) return false;
  const first = round.orders[0];
  return round.currentIndex > 0 || (first !== undefined && (first.attempts > 0 || first.outcome !== null));
}

/** The picker for `profile` today; `justEarned` is set right after the round that earned the day's heart. */
export function pickerView(profile: Profile, now: number, justEarned = false): PickerView {
  const { settings } = profile;
  const grade = gradeLevel(settings.grade);
  const playedToday = new Set(typesToday(profile, now));
  const { filled, goal, heart } = todayProgress(profile, now);
  return {
    cards: grade.games.map((m) => ({
      id: m.id,
      label: m.label,
      symbol: m.symbol,
      hint: m.hint,
      played: playedToday.has(gameTypeOf({ grade: grade.id, game: m.id })),
    })),
    filled,
    goal: Math.max(goal, gamesForHeart(profile, GAME_CONFIG.calendar)),
    title: justEarned ? 'You earned a heart!' : 'What shall we play?',
    foot: heart ? 'Play any game you like!' : 'Try a new kind of game to fill your heart!',
  };
}

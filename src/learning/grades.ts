/**
 * Grade levels. Each player has a grade and, inside it, a math mode (3rd
 * grade can practise multiplication only, division only, or both). The pair
 * picks the math subject the shop plays: the grade's number ranges and the
 * mode's operations. All of it is data in GAME_CONFIG.grades.
 */
import { GAME_CONFIG, type GameConfig, type GradeLevel, type MathConfig, type MathMode } from '../config/gameConfig';
import { createOperations } from './math/registry';
import { createMathSubject, type MathSubject } from './mathSubject';

/** What a player's settings store: ids from GAME_CONFIG.grades. */
export interface GradeChoice {
  grade: string;
  mathMode: string;
}

type GradesConfig = GameConfig['grades'];

/** The grade with this id; an unknown one (from an older or newer game) plays the default grade. */
export function gradeLevel(id: string, grades: GradesConfig = GAME_CONFIG.grades): GradeLevel {
  const found = grades.levels.find((g) => g.id === id) ?? grades.levels.find((g) => g.id === grades.defaultGrade);
  if (!found) throw new Error(`Default grade "${grades.defaultGrade}" is not in GAME_CONFIG.grades`);
  return found;
}

/** The chosen mode within its grade, or the grade's first mode when it has no such mode. */
export function mathModeOf(choice: GradeChoice, grades: GradesConfig = GAME_CONFIG.grades): MathMode {
  const { mathModes } = gradeLevel(choice.grade, grades);
  return mathModes.find((m) => m.id === choice.mathMode) ?? mathModes[0]!;
}

/** A grade's starting choice: its start mode, else its first math mode. */
export function startOfGrade(id: string, grades: GradesConfig = GAME_CONFIG.grades): GradeChoice {
  const grade = gradeLevel(id, grades);
  return { grade: grade.id, mathMode: grade.startMode ?? grade.mathModes[0]!.id };
}

/** The id the progress calendar files a round under, so a heart needs different games: "grade3/division". */
export function gameTypeOf(choice: GradeChoice, grades: GradesConfig = GAME_CONFIG.grades): string {
  const settled = settleChoice(choice, grades);
  return `${settled.grade}/${settled.mathMode}`;
}

/** How many different games a player's grade offers; a heart never needs more different games than this. */
export const gameCount = (choice: GradeChoice, grades: GradesConfig = GAME_CONFIG.grades): number =>
  gradeLevel(choice.grade, grades).mathModes.length;

/** Where every new player (and every player from before grades) starts. */
export const defaultGradeChoice = (grades: GradesConfig = GAME_CONFIG.grades): GradeChoice =>
  startOfGrade(grades.defaultGrade, grades);

/** The choice as it will actually play, with unknown ids replaced by their fallbacks. */
export function settleChoice(choice: GradeChoice, grades: GradesConfig = GAME_CONFIG.grades): GradeChoice {
  return { grade: gradeLevel(choice.grade, grades).id, mathMode: mathModeOf(choice, grades).id };
}

/** "3rd grade · Division only"; a grade with a single mode shows just the grade. */
export function describeChoice(choice: GradeChoice, grades: GradesConfig = GAME_CONFIG.grades): string {
  const grade = gradeLevel(choice.grade, grades);
  return grade.mathModes.length > 1 ? `${grade.label} · ${mathModeOf(choice, grades).label}` : grade.label;
}

/** The math rules for a choice: the grade's ranges with the mode's operations switched on. */
export function mathConfigFor(choice: GradeChoice, config: GameConfig = GAME_CONFIG): MathConfig {
  return {
    ...config.math,
    ...gradeLevel(choice.grade, config.grades).math,
    enabledOperations: mathModeOf(choice, config.grades).operations,
  };
}

/**
 * Builds (once per grade and mode) the math subject a choice plays. Every
 * choice shares the subject id "math", and each operation keeps its own
 * record, so switching mode keeps what a child has already mastered.
 */
export function gradeSubjects(config: GameConfig = GAME_CONFIG): (choice: GradeChoice) => MathSubject {
  const built = new Map<string, MathSubject>();
  return (choice) => {
    const settled = settleChoice(choice, config.grades);
    const key = gameTypeOf(settled, config.grades);
    let subject = built.get(key);
    if (!subject) {
      subject = createMathSubject({
        adaptive: config.adaptive,
        operations: createOperations(mathConfigFor(settled, config)),
        preReaders: gradeLevel(settled.grade, config.grades).preReaders ?? false,
        gameType: key,
      });
      built.set(key, subject);
    }
    return subject;
  };
}

/** The subject for a choice, built from GAME_CONFIG. */
export const subjectForGrade = gradeSubjects();

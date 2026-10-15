/**
 * Grade levels. Each player has a grade and, inside it, a game the child
 * picked (3rd grade: grouping, sharing or both; kindergarten: counting,
 * adding, a mix, or first letters). The pair picks the subject the shop
 * plays: the grade's number ranges and the game's skills. All of it is data
 * in GAME_CONFIG.grades.
 */
import { GAME_CONFIG, type GameConfig, type GradeLevel, type MathConfig, type GradeGame } from '../config/gameConfig';
import { createOperations } from './math/registry';
import { createMathSubject } from './mathSubject';
import type { ChallengeSpec, LearningSubject } from './types';
import { createVocabSkills } from './vocab/registry';
import { createVocabSubject } from './vocab/vocabSubject';

/** What a player's settings store: ids from GAME_CONFIG.grades. */
export interface GradeChoice {
  grade: string;
  game: string;
}

type GradesConfig = GameConfig['grades'];

/** The grade with this id; an unknown one (from an older or newer game) plays the default grade. */
export function gradeLevel(id: string, grades: GradesConfig = GAME_CONFIG.grades): GradeLevel {
  const found = grades.levels.find((g) => g.id === id) ?? grades.levels.find((g) => g.id === grades.defaultGrade);
  if (!found) throw new Error(`Default grade "${grades.defaultGrade}" is not in GAME_CONFIG.grades`);
  return found;
}

/** The chosen mode within its grade, or the grade's first mode when it has no such mode. */
export function gameOf(choice: GradeChoice, grades: GradesConfig = GAME_CONFIG.grades): GradeGame {
  const { games } = gradeLevel(choice.grade, grades);
  return games.find((m) => m.id === choice.game) ?? games[0]!;
}

/** A grade's starting choice: its start mode, else its first math mode. */
export function startOfGrade(id: string, grades: GradesConfig = GAME_CONFIG.grades): GradeChoice {
  const grade = gradeLevel(id, grades);
  return { grade: grade.id, game: grade.startGame ?? grade.games[0]!.id };
}

/** The id the progress calendar files a round under, so a heart needs different games: "grade3/division". */
export function gameTypeOf(choice: GradeChoice, grades: GradesConfig = GAME_CONFIG.grades): string {
  const settled = settleChoice(choice, grades);
  return `${settled.grade}/${settled.game}`;
}

/** How many different games a player's grade offers; a heart never needs more different games than this. */
export const gameCount = (choice: GradeChoice, grades: GradesConfig = GAME_CONFIG.grades): number =>
  gradeLevel(choice.grade, grades).games.length;

/** Where every new player (and every player from before grades) starts. */
export const defaultGradeChoice = (grades: GradesConfig = GAME_CONFIG.grades): GradeChoice =>
  startOfGrade(grades.defaultGrade, grades);

/** The choice as it will actually play, with unknown ids replaced by their fallbacks. */
export function settleChoice(choice: GradeChoice, grades: GradesConfig = GAME_CONFIG.grades): GradeChoice {
  return { grade: gradeLevel(choice.grade, grades).id, game: gameOf(choice, grades).id };
}

/** "3rd grade · Division only"; a grade with a single mode shows just the grade. */
export function describeChoice(choice: GradeChoice, grades: GradesConfig = GAME_CONFIG.grades): string {
  const grade = gradeLevel(choice.grade, grades);
  return grade.games.length > 1 ? `${grade.label} · ${gameOf(choice, grades).label}` : grade.label;
}

/** The grade's number ranges with `skills` switched on as the math operations. */
function mathConfigWith(grade: GradeLevel, skills: readonly string[], config: GameConfig): MathConfig {
  return { ...config.math, ...grade.math, enabledOperations: skills };
}

/** The math rules for a choice: the grade's ranges with the game's operations switched on. */
export function mathConfigFor(choice: GradeChoice, config: GameConfig = GAME_CONFIG): MathConfig {
  return mathConfigWith(gradeLevel(choice.grade, config.grades), gameOf(choice, config.grades).skills, config);
}

/** What a game plays: a subject of any kind, which the shop only talks to through its contract. */
export type GameSubject = LearningSubject<ChallengeSpec, unknown>;

/** What a factory builds a subject from: the grade and the skills to put in its rounds. */
interface SubjectSpec {
  grade: GradeLevel;
  skills: readonly string[];
  config: GameConfig;
  gameType: string;
}

type SubjectFactory = (spec: SubjectSpec) => GameSubject;

/** How each subject a game can name is built. Adding a subject adds one line here. */
const SUBJECT_FACTORIES: Record<string, SubjectFactory> = {
  math: ({ grade, skills, config, gameType }) =>
    createMathSubject({
      adaptive: config.adaptive,
      operations: createOperations(mathConfigWith(grade, skills, config)),
      preReaders: grade.preReaders ?? false,
      gameType,
    }),
  vocab: ({ skills, config, gameType }) =>
    createVocabSubject({ adaptive: config.adaptive, skills: createVocabSkills(skills, config.vocab), gameType }),
};

function buildSubject(subjectId: string, spec: SubjectSpec): GameSubject {
  const make = SUBJECT_FACTORIES[subjectId];
  if (!make) throw new Error(`Game "${spec.gameType}" names a subject the game does not have`);
  return make(spec);
}

/**
 * Builds (once per grade and game) the subject a choice plays. Each subject
 * keeps its own progress under its id, and each skill its own record, so
 * switching game keeps what a child has already mastered.
 */
export function gradeSubjects(config: GameConfig = GAME_CONFIG): (choice: GradeChoice) => GameSubject {
  const built = new Map<string, GameSubject>();
  return (choice) => {
    const settled = settleChoice(choice, config.grades);
    const key = gameTypeOf(settled, config.grades);
    let subject = built.get(key);
    if (!subject) {
      const game = gameOf(settled, config.grades);
      const grade = gradeLevel(settled.grade, config.grades);
      subject = buildSubject(game.subject, { grade, skills: game.skills, config, gameType: key });
      built.set(key, subject);
    }
    return subject;
  };
}

/**
 * One subject per kind a grade plays (math, vocab), each with every skill the
 * grade's games use, so the grown-ups' progress covers all of a child's practice.
 */
export function gradeSubjectList(grade: string, config: GameConfig = GAME_CONFIG): GameSubject[] {
  const level = gradeLevel(grade, config.grades);
  const skills = new Map<string, string[]>();
  for (const game of level.games) {
    const list = skills.get(game.subject) ?? [];
    skills.set(game.subject, [...list, ...game.skills.filter((id) => !list.includes(id))]);
  }
  return [...skills].map(([id, list]) => buildSubject(id, { grade: level, skills: list, config, gameType: id }));
}

/** The subject for a choice, built from GAME_CONFIG. */
export const subjectForGrade = gradeSubjects();

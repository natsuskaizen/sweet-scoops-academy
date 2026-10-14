import { describe, expect, it } from 'vitest';
import { GAME_CONFIG, type GameConfig } from '../config/gameConfig';
import { createRng } from '../core/rng';
import {
  defaultGradeChoice,
  describeChoice,
  gradeLevel,
  gradeSubjects,
  mathConfigFor,
  settleChoice,
  subjectForGrade,
} from '../learning/grades';
import type { MathChallengeSpec } from '../learning/math/operation';
import { chooseGrade, chooseGradeLevel, resetProfile } from '../save/profileActions';
import { MemoryStorage, SaveManager, createSaveFile, parseSave } from '../save/saveManager';
import { subjectProgress } from '../save/saveTypes';
import { OrderManager } from '../shop/orderManager';

const K = { grade: 'kindergarten', mathMode: 'addSubtract' };
const plan = (choice: { grade: string; mathMode: string }) =>
  subjectForGrade(choice).planRound(
    {},
    { roundNumber: 1, rng: createRng(7), count: 10, now: 0 },
  ) as MathChallengeSpec[];

describe('grade levels', () => {
  it('starts everyone in 3rd grade with multiplication and division mixed', () => {
    expect(defaultGradeChoice()).toEqual({ grade: 'grade3', mathMode: 'mixed' });
    expect(describeChoice(defaultGradeChoice())).toBe('3rd grade · Multiplication and division');
    expect(describeChoice(K)).toBe('Kindergarten');
  });

  it('plays an unknown grade or mode as the nearest one it has', () => {
    expect(gradeLevel('grade9').id).toBe('grade3');
    expect(settleChoice({ grade: 'grade3', mathMode: 'fractions' })).toEqual({ grade: 'grade3', mathMode: 'mixed' });
    expect(settleChoice({ grade: 'kindergarten', mathMode: 'division' })).toEqual(K);
  });

  it('throws when the default grade is missing from the config', () => {
    expect(() => gradeLevel('x', { defaultGrade: 'nope', levels: [] })).toThrow(/Default grade/);
  });

  it.each([
    ['mixed', ['division', 'multiplication']],
    ['multiplication', ['multiplication']],
    ['division', ['division']],
  ])('3rd grade %s rounds only practise %j', (mathMode, ops) => {
    const skills = new Set(plan({ grade: 'grade3', mathMode }).map((s) => s.skillId));
    expect([...skills].sort()).toEqual(ops);
  });

  it('kindergarten adds and takes away within 5', () => {
    const specs = plan(K);
    expect(new Set(specs.map((s) => s.skillId))).toEqual(new Set(['addition', 'subtraction']));
    for (const s of specs) expect(Math.max(s.left, s.right, s.answer)).toBeLessThanOrEqual(5);
    expect(mathConfigFor(K).addition).toEqual({ addend: { min: 1, max: 5 }, maxSum: 5 });
  });

  it('builds each grade and mode once, from the config it is given', () => {
    expect(subjectForGrade(K)).toBe(subjectForGrade({ ...K }));
    expect(subjectForGrade(K)).not.toBe(subjectForGrade(defaultGradeChoice()));
    const onlyK: GameConfig = {
      ...GAME_CONFIG,
      grades: { defaultGrade: 'kindergarten', levels: [GAME_CONFIG.grades.levels[0]!] },
    };
    expect(gradeSubjects(onlyK)(defaultGradeChoice()).progressReport({})[0]).toMatch(/^Addition/);
  });
});

describe('choosing a grade', () => {
  it('switches mode and drops the round planned for the old one', () => {
    const save = createSaveFile(1);
    const p = save.profiles[save.activeProfileId]!;
    p.currentRound = {} as never;
    expect(chooseGrade(p, { grade: 'grade3', mathMode: 'mixed' })).toBe(false);
    expect(p.currentRound).not.toBeNull();
    expect(chooseGrade(p, { grade: 'grade3', mathMode: 'division' })).toBe(true);
    expect(p.settings).toMatchObject({ grade: 'grade3', mathMode: 'division' });
    expect(p.currentRound).toBeNull();
  });

  it('moving grade starts on its first mode; picking the same grade keeps the mode', () => {
    const save = createSaveFile(1);
    const p = save.profiles[save.activeProfileId]!;
    chooseGrade(p, { grade: 'grade3', mathMode: 'division' });
    expect(chooseGradeLevel(p, 'grade3')).toBe(false);
    expect(p.settings.mathMode).toBe('division');
    expect(chooseGradeLevel(p, 'kindergarten')).toBe(true);
    expect(p.settings).toMatchObject(K);
  });

  it('keeps 3rd grade progress when a player tries kindergarten and comes back', () => {
    const save = createSaveFile(1);
    const p = save.profiles[save.activeProfileId]!;
    const progress = subjectProgress(p, subjectForGrade(p.settings)) as Record<string, { facts: object }>;
    progress.multiplication = { facts: { 'mul:2x3': {} } };
    chooseGradeLevel(p, 'kindergarten');
    chooseGradeLevel(p, 'grade3');
    expect(subjectProgress(p, subjectForGrade(p.settings))).toBe(progress);
  });

  it('a whole-profile reset keeps the grade', () => {
    const save = createSaveFile(1);
    chooseGradeLevel(save.profiles[save.activeProfileId]!, 'kindergarten');
    const fresh = resetProfile(save, 2);
    expect(fresh.settings).toMatchObject(K);
  });

  it('a kindergarten round in play survives a reload, checked against the player’s own grade', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage, () => 5);
    const { save } = saves.load();
    const p = save.profiles[save.activeProfileId]!;
    chooseGradeLevel(p, 'kindergarten');
    const manager = new OrderManager({ save, persister: saves, subject: subjectForGrade(p.settings), now: () => 5 });
    const round = manager.ensureRound();
    // 1 − 1 is a kindergarten question but outside the default subtraction ranges.
    const zero = { subjectId: 'math', skillId: 'subtraction', factKey: 'sub:1-1', left: 1, right: 1, answer: 0 };
    round.orders[0]!.spec = zero;
    saves.write(save);

    const reloaded = saves.load().save.profiles[save.activeProfileId]!;
    expect(reloaded.currentRound?.orders[0]?.spec).toEqual(zero);
  });

  it('drops a saved round that no longer fits the player’s grade, keeping the rest', () => {
    const save = createSaveFile(1);
    const p = save.profiles[save.activeProfileId]!;
    const zero = { subjectId: 'math', skillId: 'subtraction', factKey: 'sub:1-1', left: 1, right: 1, answer: 0 };
    const order = { spec: zero, customerId: 'c', attempts: 0, outcome: null, paid: false, sprinklesPaid: 0 };
    p.currentRound = {
      ...{ id: 'r', roundNumber: 1, seed: 1, startedAt: 1, playMs: 0, lastActiveAt: 1 },
      ...{ orders: [order], currentIndex: 0, bonusPaid: false, bonus: null },
    };
    p.settings.grade = 'kindergarten';
    expect(parseSave(JSON.stringify(save))).toMatchObject({ ok: true });

    p.settings.grade = 'grade3';
    p.sprinkles = 40;
    const parsed = parseSave(JSON.stringify(save));
    if (!parsed.ok) throw new Error(parsed.problems.join());
    const loaded = parsed.save.profiles[p.id]!;
    expect(loaded.currentRound).toBeNull();
    expect(loaded.sprinkles).toBe(40);
  });
});

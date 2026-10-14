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

const K = { grade: 'kindergarten', mathMode: 'mixed' };
const plan = (choice: { grade: string; mathMode: string }) =>
  subjectForGrade(choice).planRound(
    {},
    { roundNumber: 1, rng: createRng(7), count: 10, now: 0 },
  ) as MathChallengeSpec[];

describe('grade levels', () => {
  it('starts everyone in 3rd grade with multiplication and division mixed', () => {
    expect(defaultGradeChoice()).toEqual({ grade: 'grade3', mathMode: 'mixed' });
    expect(describeChoice(defaultGradeChoice())).toBe('3rd grade · Mix it up');
    expect(describeChoice(K)).toBe('Kindergarten · Mix it up');
  });

  it('plays an unknown grade or mode as the nearest one it has', () => {
    expect(gradeLevel('grade9').id).toBe('grade3');
    expect(settleChoice({ grade: 'grade3', mathMode: 'fractions' })).toEqual({
      grade: 'grade3',
      mathMode: 'multiplication',
    });
    expect(settleChoice({ grade: 'kindergarten', mathMode: 'division' })).toEqual({
      grade: 'kindergarten',
      mathMode: 'counting',
    });
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

  it('kindergarten counts scoops and adds within 5, drawn as pictures with dotted keys', () => {
    const specs = plan(K);
    expect(new Set(specs.map((s) => s.skillId))).toEqual(new Set(['counting', 'addition']));
    for (const s of specs) expect(s.answer).toBeLessThanOrEqual(5);
    expect(mathConfigFor(K).enabledOperations).toEqual(['counting', 'addition']);
    expect(mathConfigFor(K).addition.maxSum).toBe(5);
    const subject = subjectForGrade(K);
    const count = specs.find((s) => s.skillId === 'counting')!;
    expect(subject.present(count, { flavor: 'mint' })).toMatchObject({
      orderPicture: { kind: 'cone', scoops: count.left },
      ticketPicture: { kind: 'cone', scoops: count.left },
      answerInput: { kind: 'integer', dots: true },
    });
    const add = specs.find((s) => s.skillId === 'addition')!;
    const added = subject.present(add, { flavor: 'mint' });
    expect(added.orderPicture).toEqual({ kind: 'piles', parts: [add.left, add.right] });
    expect(added.ticketPicture).toBeUndefined();
  });

  it('3rd grade orders stay in words', () => {
    const spec = plan(defaultGradeChoice())[0]!;
    const shown = subjectForGrade(defaultGradeChoice()).present(spec, { flavor: 'mint' });
    expect(shown.orderPicture).toBeUndefined();
    expect(shown.answerInput).toEqual({ kind: 'integer', maxDigits: 3 });
  });

  it('builds each grade and mode once, from the config it is given', () => {
    expect(subjectForGrade(K)).toBe(subjectForGrade({ ...K }));
    expect(subjectForGrade(K)).not.toBe(subjectForGrade(defaultGradeChoice()));
    const onlyK: GameConfig = {
      ...GAME_CONFIG,
      grades: { defaultGrade: 'kindergarten', levels: [GAME_CONFIG.grades.levels[0]!] },
    };
    expect(gradeSubjects(onlyK)(defaultGradeChoice()).progressReport({})[0]).toMatch(/^Counting/);
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

  it('moving grade starts on its start mode; picking the same grade keeps the mode', () => {
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

  it('a kindergarten round in play survives a reload', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage, () => 5);
    const { save } = saves.load();
    const p = save.profiles[save.activeProfileId]!;
    chooseGradeLevel(p, 'kindergarten');
    const manager = new OrderManager({ save, persister: saves, subject: subjectForGrade(p.settings), now: () => 5 });
    const round = manager.ensureRound();
    expect(saves.load().save.profiles[p.id]!.currentRound).toEqual(round);
  });

  it('drops a saved round that no longer fits the player’s grade, keeping the rest', () => {
    const save = createSaveFile(1);
    const p = save.profiles[save.activeProfileId]!;
    const big = { subjectId: 'math', skillId: 'addition', factKey: 'add:9+9', left: 9, right: 9, answer: 18 };
    const order = { spec: big, customerId: 'c', attempts: 0, outcome: null, paid: false, sprinklesPaid: 0 };
    p.currentRound = {
      ...{ id: 'r', roundNumber: 1, seed: 1, startedAt: 1, playMs: 0, lastActiveAt: 1 },
      ...{ orders: [order], currentIndex: 0, bonusPaid: false, bonus: null },
    };
    expect(parseSave(JSON.stringify(save))).toMatchObject({ ok: true });

    // 9 + 9 is fine in 3rd grade but beyond kindergarten's sums, so that round can't be resumed.
    Object.assign(p.settings, K);
    p.sprinkles = 40;
    const parsed = parseSave(JSON.stringify(save));
    if (!parsed.ok) throw new Error(parsed.problems.join());
    const loaded = parsed.save.profiles[p.id]!;
    expect(loaded.currentRound).toBeNull();
    expect(loaded.sprinkles).toBe(40);
  });
});

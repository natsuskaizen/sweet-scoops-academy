import { expect, test, type Page } from '@playwright/test';

interface GameObj {
  type: string;
  text?: string;
  x: number;
  y: number;
  originX: number;
  width: number;
  height: number;
  list?: GameObj[];
  emit: (event: string) => void;
}
interface Gate {
  showMenu: () => void;
  content: { list: GameObj[] };
}
interface Hook {
  scene: {
    gate: Gate | null;
    openParentGate: () => void;
    parentArea: { actions: () => { label: string; run: (gate: Gate) => void }[] };
  };
}
type HookWindow = Window & { __ssa?: Hook };
interface Shown {
  texts: string[];
  /** Texts that spill past the panel's content area or into the bottom buttons. */
  outside: string[];
}

const SAVE_KEY = 'sweet-scoops-academy.save';

/** One round from before timing existed, then timed rounds over the last few days. */
async function seedHistory(page: Page): Promise<void> {
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key)!);
    const hour = 3_600_000;
    const outcomes: [number, number, number][] = [
      [9, 1, 0],
      [7, 2, 1],
      [8, 2, 0],
      [6, 3, 1],
      [10, 0, 0],
      [5, 3, 2],
    ];
    const facts = ['12 × 12', '7 × 8', '96 ÷ 12', '6 × 7', '84 ÷ 12', '99 ÷ 11', '8 × 4'];
    const round = ([first, retry, miss]: [number, number, number], n: number) => {
      const startedAt = Date.now() - (outcomes.length - n) * 20 * hour;
      return {
        roundNumber: n + 1,
        startedAt: n === 0 ? null : startedAt,
        finishedAt: startedAt + 400_000,
        playMs: n === 0 ? null : 300_000 + n * 60_000,
        ordersCompleted: 10,
        firstTryCorrect: first,
        retryCorrect: retry,
        missed: miss,
        orderSprinkles: first * 10 + retry * 5 + miss * 2,
        completionBonus: 10,
        perfectBonus: first === 10 ? 50 : 0,
        total: first * 10 + retry * 5 + miss * 2 + 10 + (first === 10 ? 50 : 0),
        perfect: first === 10,
        retryFacts: facts.slice(n % 3, (n % 3) + retry),
        missFacts: facts.slice(4, 4 + miss),
      };
    };
    save.profiles[save.activeProfileId].roundHistory = outcomes.map(round);
    localStorage.setItem(key, JSON.stringify(save));
  }, SAVE_KEY);
}

/** Texts on the gate's current screen, and any that spill outside the content area. */
function readScreen(page: Page): Promise<Shown> {
  return page.evaluate(() => {
    const gate = (window as HookWindow).__ssa!.scene.gate!;
    const texts = gate.content.list.filter((o) => o.type === 'Text');
    const left = (t: GameObj) => t.x - t.originX * t.width;
    const outside = texts.filter((t) => left(t) < 200 || left(t) + t.width > 1080 || t.y + t.height > 700);
    return { texts: texts.map((t) => t.text!), outside: outside.map((t) => t.text!) };
  });
}

function tapButton(page: Page, label: string): Promise<void> {
  return page.evaluate((label) => {
    const gate = (window as HookWindow).__ssa!.scene.gate!;
    const button = gate.content.list.find((o) => o.list?.some((c) => c.text === label))!;
    button.emit('pointerdown');
    button.emit('pointerup');
  }, label);
}

test('grown-ups see round cards and an overview, switched from the top left', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?e2e&fast');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => (window as HookWindow).__ssa !== undefined);
  await seedHistory(page);
  await page.reload();
  await page.waitForFunction(() => (window as HookWindow).__ssa !== undefined);

  await page.evaluate(() => {
    const { scene } = (window as HookWindow).__ssa!;
    scene.openParentGate();
    scene.gate!.showMenu(); // skip the number challenge
    scene.parentArea
      .actions()
      .find((a) => a.label === 'Progress')!
      .run(scene.gate!);
  });

  const rounds = await readScreen(page);
  expect(rounds.texts).toEqual(expect.arrayContaining(['Progress', '6', 'rounds played', '75%', '★ 5', '★ 10']));
  expect(rounds.texts).toContain('Perfect round!');
  expect(rounds.texts.filter((t) => t.startsWith('Practise:'))).toHaveLength(3);
  expect(rounds.outside).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('progress-rounds.png') });

  await tapButton(page, 'Older');
  const older = await readScreen(page);
  expect(older.texts).toContain('–'); // the round from before timing existed
  expect(older.outside).toEqual([]);

  await tapButton(page, 'Overview');
  const overview = await readScreen(page);
  expect(overview.texts).toEqual(expect.arrayContaining(['Last 10 rounds', 'Needs practice', '84 ÷ 12']));
  expect(overview.outside).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('progress-overview.png') });
  expect(errors).toEqual([]);
});

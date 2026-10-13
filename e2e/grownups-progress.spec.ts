import { expect, test } from '@playwright/test';

interface TextObj {
  type: string;
  text: string;
  y: number;
  height: number;
}
interface Gate {
  showMenu: () => void;
  content: { list: TextObj[] };
}
interface Hook {
  scene: {
    gate: Gate | null;
    openParentGate: () => void;
    parentActions: () => { label: string; run: (gate: Gate) => void }[];
  };
}
type HookWindow = Window & { __ssa?: Hook };

const SAVE_KEY = 'sweet-scoops-academy.save';

test('grown-ups see each round with its play time, on pages that fit the screen', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('./?e2e&fast');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => (window as HookWindow).__ssa !== undefined);

  // Give the save a history: one round from before timing existed, then several timed rounds that needed help.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key)!);
    const base = { ordersCompleted: 10, firstTryCorrect: 1, retryCorrect: 5, missed: 4, orderSprinkles: 43 };
    const round = (n: number, timed: boolean) => ({
      ...base,
      roundNumber: n,
      startedAt: timed ? Date.now() - (8 - n) * 3_600_000 : null,
      finishedAt: Date.now() - (8 - n) * 3_600_000 + 400_000,
      playMs: timed ? 400_000 + n * 1000 : null,
      completionBonus: 10,
      perfectBonus: 0,
      total: 53,
      perfect: false,
      retryFacts: ['12 × 12', '11 × 12', '96 ÷ 12', '84 ÷ 12', '7 × 8'],
      missFacts: ['12 × 11', '99 ÷ 11', '6 × 7', '72 ÷ 12'],
    });
    const profile = save.profiles[save.activeProfileId];
    profile.roundHistory = [round(1, false), ...[2, 3, 4, 5, 6].map((n) => round(n, true))];
    localStorage.setItem(key, JSON.stringify(save));
  }, SAVE_KEY);
  await page.reload();
  await page.waitForFunction(() => (window as HookWindow).__ssa !== undefined);

  const shown = await page.evaluate(() => {
    const { scene } = (window as HookWindow).__ssa!;
    scene.openParentGate();
    const gate = scene.gate!;
    gate.showMenu(); // skip the number challenge
    scene
      .parentActions()
      .find((a) => a.label === 'Progress by round')!
      .run(gate);
    const texts = gate.content.list.filter((o) => o.type === 'Text');
    return {
      title: texts[0]!.text,
      body: texts[1]!.text,
      bottom: texts[1]!.y + texts[1]!.height,
      pageNote: texts[2]?.text,
    };
  });

  expect(shown.title).toBe('Progress by round');
  expect(shown.pageNote).toBe('Page 1 of 2');
  expect(shown.body).toMatch(/^6 rounds finished {3}· {3}\d+ min \d+ s of play \(1 older round not timed\)/);
  expect(shown.body).toMatch(/Round 6 {3}· {3}6 min 46 s/);
  expect(shown.body).toContain('Answer shown: 12 × 11, 99 ÷ 11, 6 × 7, 72 ÷ 12');
  expect(shown.bottom).toBeLessThan(680); // clear of the page number and the Newer / Back / Older buttons

  await page.screenshot({ path: testInfo.outputPath('progress-report.png') });
  expect(errors).toEqual([]);
});

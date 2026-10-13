import { expect, test, type Page } from '@playwright/test';

interface Hook {
  scene: {
    keypad: { isEnabled: boolean };
    scale: { gameSize: { width: number; height: number } };
    results: { x: number; y: number } | null;
    decorate: { pick: (tier: string) => void; act: () => void; close: () => void } | null;
    showResults: (summary: object, stickers: [], outcomes: []) => Promise<void>;
  };
  manager: () => { profile: { sprinkles: number; decorations: { itemId: string; spot: string }[] } };
}
type HookWindow = Window & { __ssa?: Hook };

const SAVE_KEY = 'sweet-scoops-academy.save';

async function tapAt(page: Page, x: number, y: number): Promise<void> {
  const width = await page.evaluate(() => (window as HookWindow).__ssa!.scene.scale.gameSize.width);
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / width;
  await page.touchscreen.tap(box.x + x * k, box.y + y * k);
}

/** A fresh game with 200 Sprinkles, at the end-of-round card. */
async function atResultsWith200(page: Page, errors: string[]): Promise<void> {
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e&fast');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.keypad.isEnabled, null, { timeout: 30_000 });
  await page.evaluate(() => {
    const ssa = (window as HookWindow).__ssa!;
    ssa.manager().profile.sprinkles = 200;
    const summary = { perfect: false, ordersCompleted: 10, firstTryCorrect: 8, total: 120 };
    void ssa.scene.showResults({ ...summary, orderSprinkles: 90, completionBonus: 30, perfectBonus: 0 }, [], []);
  });
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.results !== null);
  await page.waitForTimeout(500); // the card pops in
}

test('Decorate opens from the results card, and a bought plant is saved in its spot', async ({ page }, testInfo) => {
  const errors: string[] = [];
  await atResultsWith200(page, errors);
  const card = await page.evaluate(() => {
    const { x, y } = (window as HookWindow).__ssa!.scene.results!;
    return { x, y };
  });
  await tapAt(page, card.x + 150, card.y + 630); // the Decorate button
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.decorate !== null);

  // The plant (the cheapest decoration) is shown first; pick Mint and buy it.
  await page.evaluate(() => {
    const decorate = (window as HookWindow).__ssa!.scene.decorate!;
    decorate.pick('mint');
    decorate.act();
    decorate.act(); // a second tap takes it away again, without charging
    decorate.act(); // and a third puts it back
  });
  const profile = await page.evaluate(() => {
    const { sprinkles, decorations } = (window as HookWindow).__ssa!.manager().profile;
    return { sprinkles, decorations };
  });
  expect(profile.sprinkles).toBe(140);
  expect(profile.decorations).toEqual([{ itemId: 'deco-plant.mint', spot: 'floor-left' }]);
  await page.screenshot({ path: testInfo.outputPath('decorate.png') });

  await page.evaluate(() => (window as HookWindow).__ssa!.scene.decorate!.close());
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.decorate === null);

  const saved = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key)!);
    const p = save.profiles[save.activeProfileId];
    return { owned: p.ownedItems, sprinkles: p.sprinkles };
  }, SAVE_KEY);
  expect(saved).toEqual({ owned: ['deco-plant.mint'], sprinkles: 140 });
  expect(errors).toEqual([]);
});

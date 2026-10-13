import { expect, test, type Page } from '@playwright/test';

interface ShopHook {
  scene: {
    keypad: {
      isEnabled: boolean;
      buttons: { x: number; y: number; visible: boolean; list: { type: string; text?: string }[] }[];
    };
    scale: { gameSize: { width: number; height: number } };
    aid: { visible: boolean };
    gotIt: { x: number; y: number } | null;
  };
  manager: () => { current: () => { index: number; presentation: { correctAnswer: string } } | null };
}
type HookWindow = Window & { __ssa?: ShopHook };

async function startFresh(page: Page, errors: string[]): Promise<void> {
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e&fast');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => (window as HookWindow).__ssa !== undefined);
}

const keypadReady = (page: Page) =>
  page.waitForFunction(() => (window as HookWindow).__ssa!.scene.keypad.isEnabled, null, { timeout: 30_000 });

async function tapKey(page: Page, label: string): Promise<void> {
  const pos = await page.evaluate((label) => {
    const { scene } = (window as HookWindow).__ssa!;
    const b = scene.keypad.buttons.find((c) => c.visible && c.list.some((t) => t.type === 'Text' && t.text === label))!;
    return { x: b.x, y: b.y, width: scene.scale.gameSize.width };
  }, label);
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / pos.width;
  await page.touchscreen.tap(box.x + pos.x * k, box.y + pos.y * k);
}

test('the shop opens and an order can be served', async ({ page }, testInfo) => {
  const errors: string[] = [];
  await startFresh(page, errors);
  await expect(page.locator('canvas')).toHaveCount(1);

  const size = await page.evaluate(() => {
    const { width, height } = (window as HookWindow).__ssa!.scene.scale.gameSize;
    return { width, height }; // Phaser's Size uses getters, so copy them out
  });
  const portrait = testInfo.project.name.includes('portrait');
  expect(size.height > size.width).toBe(portrait);

  await keypadReady(page);
  const answer = await page.evaluate(
    () => (window as HookWindow).__ssa!.manager().current()!.presentation.correctAnswer,
  );
  for (const digit of answer) await tapKey(page, digit);
  await tapKey(page, '✓');
  await page.waitForFunction(() => (window as HookWindow).__ssa!.manager().current()?.index === 1, null, {
    timeout: 30_000,
  });

  await page.screenshot({ path: testInfo.outputPath('after-first-order.png') });
  expect(errors).toEqual([]);
});

async function tapAt(page: Page, x: number, y: number): Promise<void> {
  const width = await page.evaluate(() => (window as HookWindow).__ssa!.scene.scale.gameSize.width);
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / width;
  await page.touchscreen.tap(box.x + x * k, box.y + y * k);
}

test('two misses show the hint, then the explanation, and the order still completes', async ({ page }, testInfo) => {
  const errors: string[] = [];
  await startFresh(page, errors);
  await keypadReady(page);
  const answer = await page.evaluate(
    () => (window as HookWindow).__ssa!.manager().current()!.presentation.correctAnswer,
  );
  const wrong = String(Number(answer) + 1);

  for (const digit of wrong) await tapKey(page, digit);
  await tapKey(page, '✓');
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.aid.visible);
  await keypadReady(page);

  for (const digit of wrong) await tapKey(page, digit);
  await tapKey(page, '✓');
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.gotIt !== null);
  expect(await page.evaluate(() => (window as HookWindow).__ssa!.scene.aid.visible)).toBe(true);
  await page.waitForTimeout(1500); // let the explanation play out for the screenshot
  await page.screenshot({ path: testInfo.outputPath('explanation.png') });

  const gotIt = await page.evaluate(() => {
    const { x, y } = (window as HookWindow).__ssa!.scene.gotIt!;
    return { x, y };
  });
  await tapAt(page, gotIt.x, gotIt.y);
  await page.waitForFunction(() => (window as HookWindow).__ssa!.manager().current()?.index === 1, null, {
    timeout: 30_000,
  });
  expect(errors).toEqual([]);
});

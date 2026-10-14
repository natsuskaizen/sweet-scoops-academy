import { expect, test, type Page } from '@playwright/test';
import { skipSetup } from './shopHelpers';

interface ShopHook {
  scene: {
    keypad: {
      isEnabled: boolean;
      buttons: { x: number; y: number; visible: boolean; list: { type: string; text?: string }[] }[];
    };
    scale: { gameSize: { width: number; height: number } };
    aid: { visible: boolean };
    gotIt: { x: number; y: number } | null;
    parade: { skipButton: { x: number; y: number } | null };
    busy: boolean;
    results: object | null;
    wallCalendar: { x: number; y: number };
    calendar: object | null;
    handleSubmit: (value: string) => Promise<void>;
    scene: { restart: () => void };
  };
  manager: () => {
    current: () => { index: number; phase: string; presentation: { correctAnswer: string } } | null;
  };
}
type HookWindow = Window & { __ssa?: ShopHook };

async function startFresh(page: Page, errors: string[]): Promise<void> {
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e&fast');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await skipSetup(page);
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

test('a perfect round brings the customers back, and Skip goes straight to the results', async ({ page }, testInfo) => {
  const errors: string[] = [];
  await startFresh(page, errors);
  for (let i = 0; i < 10; i++) {
    await page.waitForFunction(
      (i) => {
        const { scene, manager } = (window as HookWindow).__ssa!;
        return !scene.busy && scene.keypad.isEnabled && manager().current()?.index === i;
      },
      i,
      { timeout: 30_000 },
    );
    await page.evaluate(() => {
      const ssa = (window as HookWindow).__ssa!;
      void ssa.scene.handleSubmit(ssa.manager().current()!.presentation.correctAnswer);
    });
  }
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.parade.skipButton !== null, null, {
    timeout: 30_000,
  });
  const skip = await page.evaluate(() => {
    const { x, y } = (window as HookWindow).__ssa!.scene.parade.skipButton!;
    return { x, y };
  });
  await tapAt(page, skip.x, skip.y);
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.results !== null, null, { timeout: 5_000 });
  await page.screenshot({ path: testInfo.outputPath('perfect-round.png') });
  expect(errors).toEqual([]);
});

test('the wall calendar opens the progress calendar over the shop, and it closes again', async ({ page }, testInfo) => {
  const errors: string[] = [];
  await startFresh(page, errors);
  await keypadReady(page);
  const wall = await page.evaluate(() => {
    const { x, y } = (window as HookWindow).__ssa!.scene.wallCalendar;
    return { x, y };
  });
  await tapAt(page, wall.x + 60, wall.y + 60);
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.calendar !== null);
  expect(await page.evaluate(() => (window as HookWindow).__ssa!.scene.keypad.isEnabled)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('calendar.png') });

  await tapAt(page, 400, 40); // the shade above the card
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.calendar === null);
  await keypadReady(page);
  expect(errors).toEqual([]);
});

test('opening and closing the grown-ups area while a customer walks in leaves the keypad usable', async ({ page }) => {
  const errors: string[] = [];
  await startFresh(page, errors);
  await page.evaluate(() => {
    const scene = (window as HookWindow).__ssa!.scene as unknown as { openParentGate: () => void };
    scene.openParentGate();
  });
  // Close it once the customer has arrived and the order is waiting for an answer.
  await page.waitForFunction(() => !(window as HookWindow).__ssa!.scene.busy, null, { timeout: 30_000 });
  await page.evaluate(() => {
    const scene = (window as HookWindow).__ssa!.scene as unknown as { gate: { close: () => void } };
    scene.gate.close();
  });
  await keypadReady(page);
  expect(errors).toEqual([]);
});

test('a grown-up moves the player to kindergarten and the next round adds and takes away', async ({ page }) => {
  const errors: string[] = [];
  await startFresh(page, errors);
  await keypadReady(page);
  await page.evaluate(() => {
    type Tappable = { list?: Tappable[]; text?: string; emit?: (event: string) => void };
    const scene = (window as HookWindow).__ssa!.scene as unknown as {
      openParentGate: () => void;
      gate: { showMenu: () => void; close: () => void; content: { list: Tappable[] } };
      parentArea: { actions: () => { label: string; run: (gate: unknown) => void }[] };
    };
    scene.openParentGate();
    scene.gate.showMenu();
    scene.parentArea
      .actions()
      .find((a) => a.label.startsWith('Grade:'))!
      .run(scene.gate);
    const button = scene.gate.content.list.find((o) => o.list?.some((t) => t.text === 'Kindergarten'))!;
    button.emit!('pointerdown');
    button.emit!('pointerup');
    scene.gate.close();
  });
  await keypadReady(page);
  const skills = await page.evaluate(() => {
    const manager = (window as HookWindow).__ssa!.manager() as unknown as {
      profile: { settings: { grade: string }; currentRound: { orders: { spec: { skillId: string } }[] } };
    };
    return {
      grade: manager.profile.settings.grade,
      ops: manager.profile.currentRound.orders.map((o) => o.spec.skillId),
    };
  });
  expect(skills.grade).toBe('kindergarten');
  expect(new Set(skills.ops)).toEqual(new Set(['addition', 'subtraction']));
  expect(errors).toEqual([]);
});

test('restarting while the results card is open (as rotating does) starts clean', async ({ page }) => {
  const errors: string[] = [];
  await startFresh(page, errors);
  await keypadReady(page);
  await page.evaluate(() => {
    const scene = (window as HookWindow).__ssa!.scene as unknown as {
      showResults: (summary: object, stickers: [], outcomes: []) => Promise<void>;
    };
    const summary = { perfect: false, ordersCompleted: 10, firstTryCorrect: 8, total: 120 };
    void scene.showResults({ ...summary, orderSprinkles: 90, completionBonus: 30, perfectBonus: 0 }, [], []);
  });
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.results !== null);
  await page.evaluate(() => {
    (window as HookWindow).__ssa!.scene.scene.restart();
  });
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.results === null, null, { timeout: 10_000 });
  await keypadReady(page);
  expect(errors).toEqual([]);
});

/** A mint blob drawn for this test: 5 frames of 32x40. */
const TEST_CHARACTER_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAKAAAAAoCAYAAAB5LPGYAAABpUlEQVR4nO3bvU0DMRjG8RdEQxOxAwtQhYYJmCACegokJCgYggIkpBQMEIkJmIAGqixAwQaIJmUo0BXnyOeP8/HA+f+r7fdJJPu9Mw5mAAAAAADUYit34vrzdt0qtHeTXYv8evO3y3wcIE/yqnVX/kbBgXci+ePKpwNCigUIKRYgpHZSJ5ydfAzxOcivNJ8OCKlgBzw9vmidei6frrsnzKw1fvE873UqI3/c+XRASAV3x+vXe+fffUIOJ/u9diD5486nA0LK+w7oPvtzNXVS30XIryOfDgipjVXZrNjgaSfRw+zOzMI7kfy68umAkIq+Cbk6Ojczs/uXxyLjUv2V/Iavfuy43Hz19y+dTweEVPJd8G9zd5Rvh8WOyxVbp3TnGTs6IKSiO6CqA7j1fPVjx/1X6g48VD4dEFLBBThdrmy6XCUXzp1Hfl35dEBIBd8B3w52swrnziO/rnw6IKS894Kl7gRj7yDJrzOfDggpfhFNvjSfDgip4Cm4eYY3Qu8E7vi+yB93Ph0QUsm/hgk900v9LwH5P9zT42Iy7xyv/v6p6ICQ+gabR3VcDI1eewAAAABJRU5ErkJggg==';

test('a grown-up can add a character from a picture', async ({ page }) => {
  const errors: string[] = [];
  await startFresh(page, errors);
  await keypadReady(page);
  await page.evaluate(() => {
    type Gate = { showMenu: () => void };
    const scene = (window as HookWindow).__ssa!.scene as unknown as {
      gate: Gate;
      openParentGate: () => void;
      parentArea: { actions: () => { label: string; run: (gate: Gate) => void }[] };
    };
    scene.openParentGate();
    scene.gate.showMenu();
    scene.parentArea
      .actions()
      .find((a) => a.label === 'Characters')!
      .run(scene.gate);
  });
  const chooser = page.waitForEvent('filechooser');
  await page.getByText('Add a character').click();
  await (
    await chooser
  ).setFiles({
    name: 'minty.png',
    mimeType: 'image/png',
    buffer: Buffer.from(TEST_CHARACTER_PNG, 'base64'),
  });
  await expect(page.getByText('5 frames of 32×40', { exact: false })).toBeVisible();
  await page.locator('.ssa-chars input').fill('Minty');
  await page.getByRole('button', { name: 'Add character' }).click();
  await expect(page.locator('.ssa-chars').getByText('Minty')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await keypadReady(page);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sweet-scoops-academy.characters')!));
  expect(stored.characters).toMatchObject([{ name: 'Minty', role: 'customer', frames: 5, frameW: 32 }]);
  expect(errors).toEqual([]);
});

import { expect, test } from '@playwright/test';
import { skipSetup, tapAt, type HookWindow } from './shopHelpers';

type Spots = Record<string, { x: number; y: number }>;
type PickerWindow = Window & {
  __ssa?: {
    scene: {
      picker: { spots: Spots } | null;
      wallCalendar: { x: number; y: number };
      calendar: object | null;
      keypad: { isEnabled: boolean };
      choices: { isEnabled: boolean; spots: Spots };
      scene: { restart: () => void };
    };
    manager: () => {
      profile: {
        settings: { grade: string; game: string };
        currentRound: { orders: { spec: { skillId: string } }[] } | null;
      };
      current: () => { index: number; presentation: { correctAnswer: string } } | null;
    };
  };
};

test('a child picks the game before the first round, and the round plays just that game', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e&fast&picker');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await skipSetup(page);

  // Opening the shop restarts it; the picker shows before any customer comes in.
  await page.waitForFunction(() => (window as PickerWindow).__ssa?.scene.picker, null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as HookWindow).__ssa!.scene.keypad.isEnabled)).toBe(false);
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath('picker.png') });

  const spot = await page.evaluate(() => (window as PickerWindow).__ssa!.scene.picker!.spots.division!);
  await tapAt(page, spot.x, spot.y);
  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.keypad.isEnabled, null, { timeout: 30_000 });

  const round = await page.evaluate(() => {
    const { profile } = (window as PickerWindow).__ssa!.manager();
    return { mode: profile.settings.game, ops: profile.currentRound!.orders.map((o) => o.spec.skillId) };
  });
  expect(round.mode).toBe('division');
  expect(new Set(round.ops)).toEqual(new Set(['division']));
  expect(await page.evaluate(() => (window as PickerWindow).__ssa!.scene.picker)).toBeNull();
  expect(errors).toEqual([]);
});

test('the wall calendar opens while a child picks a game, and the picker is still there after', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e&fast&picker');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await skipSetup(page);
  await page.waitForFunction(() => (window as PickerWindow).__ssa?.scene.picker, null, { timeout: 30_000 });

  const wall = await page.evaluate(() => {
    const { x, y } = (window as PickerWindow).__ssa!.scene.wallCalendar;
    return { x, y };
  });
  await tapAt(page, wall.x + 60, wall.y + 60);
  await page.waitForFunction(() => (window as PickerWindow).__ssa!.scene.calendar !== null);
  await tapAt(page, 400, 40); // the shade above the card
  await page.waitForFunction(() => (window as PickerWindow).__ssa!.scene.calendar === null);

  const spot = await page.evaluate(() => (window as PickerWindow).__ssa!.scene.picker!.spots.division!);
  await tapAt(page, spot.x, spot.y);
  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.keypad.isEnabled, null, { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('a kindergarten child picks reading, then answers by tapping a button', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e&fast&picker');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await skipSetup(page);
  await page.waitForFunction(() => (window as PickerWindow).__ssa?.scene.picker, null, { timeout: 30_000 });

  // Move the player to kindergarten, as a grown-up would, and ask for the picker again.
  await page.evaluate(() => {
    const ssa = (window as PickerWindow).__ssa!;
    const { profile } = ssa.manager();
    profile.settings.grade = 'kindergarten';
    profile.settings.game = 'mixed';
    profile.currentRound = null;
    ssa.scene.scene.restart();
  });
  await page.waitForFunction(() => (window as PickerWindow).__ssa?.scene.picker?.spots.reading, null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath('picker-kindergarten.png') });
  const reading = await page.evaluate(() => (window as PickerWindow).__ssa!.scene.picker!.spots.reading!);
  await tapAt(page, reading.x, reading.y);

  await page.waitForFunction(() => (window as PickerWindow).__ssa?.scene.choices.isEnabled, null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as PickerWindow).__ssa!.scene.keypad.isEnabled)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('reading.png') });
  const right = await page.evaluate(() => {
    const ssa = (window as PickerWindow).__ssa!;
    const { correctAnswer } = ssa.manager().current()!.presentation;
    return {
      id: correctAnswer,
      spot: ssa.scene.choices.spots[correctAnswer]!,
      game: ssa.manager().profile.settings.game,
    };
  });
  expect(right.game).toBe('reading');
  await tapAt(page, right.spot.x, right.spot.y);
  await page.waitForFunction(() => (window as PickerWindow).__ssa!.manager().current()?.index === 1, null, {
    timeout: 30_000,
  });
  expect(errors).toEqual([]);
});

test('reading mixes first letters, reading the order and words to pictures, all answered by tapping', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e&fast&picker');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await skipSetup(page);
  await page.waitForFunction(() => (window as PickerWindow).__ssa?.scene.picker, null, { timeout: 30_000 });
  await page.evaluate(() => {
    const ssa = (window as PickerWindow).__ssa!;
    const { profile } = ssa.manager();
    profile.settings.grade = 'kindergarten';
    profile.currentRound = null;
    ssa.scene.scene.restart();
  });
  await page.waitForFunction(() => (window as PickerWindow).__ssa?.scene.picker?.spots.reading, null, {
    timeout: 30_000,
  });
  const reading = await page.evaluate(() => (window as PickerWindow).__ssa!.scene.picker!.spots.reading!);
  await tapAt(page, reading.x, reading.y);

  const seen = new Set<string>();
  for (let index = 0; index < 10 && seen.size < 3; index++) {
    await page.waitForFunction(() => (window as PickerWindow).__ssa?.scene.choices.isEnabled, null, {
      timeout: 30_000,
    });
    const now = await page.evaluate(() => {
      const ssa = (window as PickerWindow).__ssa!;
      const manager = ssa.manager();
      const { profile } = manager;
      const order = manager.current()!;
      return {
        skill: profile.currentRound!.orders[order.index]!.spec.skillId,
        spot: ssa.scene.choices.spots[order.presentation.correctAnswer]!,
      };
    });
    if (!seen.has(now.skill)) await page.screenshot({ path: testInfo.outputPath(`reading-${now.skill}.png`) });
    seen.add(now.skill);
    await tapAt(page, now.spot.x, now.spot.y);
    await page.waitForFunction((i) => (window as PickerWindow).__ssa!.manager().current()?.index === i + 1, index, {
      timeout: 30_000,
    });
  }
  expect([...seen].sort()).toEqual(['firstLetter', 'readOrder', 'wordToPicture']);
  expect(errors).toEqual([]);
});

import { expect, test } from '@playwright/test';
import { skipSetup, tapAt, type HookWindow } from './shopHelpers';

type PickerWindow = Window & {
  __ssa?: {
    scene: { picker: { spots: Record<string, { x: number; y: number }> } | null; keypad: { isEnabled: boolean } };
    manager: () => {
      profile: { settings: { mathMode: string }; currentRound: { orders: { spec: { skillId: string } }[] } };
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
    return { mode: profile.settings.mathMode, ops: profile.currentRound.orders.map((o) => o.spec.skillId) };
  });
  expect(round.mode).toBe('division');
  expect(new Set(round.ops)).toEqual(new Set(['division']));
  expect(await page.evaluate(() => (window as PickerWindow).__ssa!.scene.picker)).toBeNull();
  expect(errors).toEqual([]);
});

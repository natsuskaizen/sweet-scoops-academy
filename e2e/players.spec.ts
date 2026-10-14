import { expect, test } from '@playwright/test';
import { SAVE_KEY, skipSetup, tapAt } from './shopHelpers';

interface Hook {
  scene: {
    keypad: { isEnabled: boolean };
    setup: { complete: (player: object) => void } | null;
    start: { spots: Record<string, { x: number; y: number }>; host: { player: { displayName: string } } } | null;
    openParentGate: () => void;
    gate: { showMenu: () => void };
    parentArea: { actions: () => { label: string; run: (gate: unknown) => void }[] };
  };
}
type HookWindow = Window & { __ssa?: Hook };

test('a grown-up renames one player and removes the one playing, and the start screen greets who is left', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e&fast');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await skipSetup(page);

  // A second child joins from the start screen.
  await page.reload();
  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.start, null, { timeout: 30_000 });
  const add = await page.evaluate(() => (window as HookWindow).__ssa!.scene.start!.spots['new']!);
  await tapAt(page, add.x, add.y);
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.setup);
  await page.evaluate(() =>
    (window as HookWindow).__ssa!.scene.setup!.complete({ name: 'Leo', shop: { name: "Leo's Shop", keeper: 'kiki' } }),
  );
  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.keypad.isEnabled, null, { timeout: 30_000 });

  await page.evaluate(() => {
    const { scene } = (window as HookWindow).__ssa!;
    scene.openParentGate();
    scene.gate.showMenu();
  });
  await page.screenshot({ path: testInfo.outputPath('grown-ups-menu.png') });
  await page.evaluate(() => {
    const { scene } = (window as HookWindow).__ssa!;
    scene.parentArea
      .actions()
      .find((a) => a.label === 'Players')!
      .run(scene.gate);
  });
  const dialog = page.locator('.ssa-players');
  await expect(dialog.locator('.row')).toHaveCount(2);
  await expect(dialog.locator('.row').first()).toContainText('Leo');
  await expect(dialog.locator('.row').first()).toContainText('playing now');

  // Rename Player 1 to Ava; a blank name is refused.
  const player1 = dialog.locator('.row', { hasText: 'Player 1' });
  await player1.getByRole('button', { name: 'Rename' }).click();
  await dialog.locator('input').fill('   ');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByText('Type a name first.')).toBeVisible();
  await dialog.locator('input').fill('Ava');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.locator('.row', { hasText: 'Ava' })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('players.png') });

  // Remove Leo (two taps); the last player can't be removed.
  const leo = dialog.locator('.row', { hasText: 'Leo' }).getByRole('button', { name: 'Remove' });
  await leo.click();
  await dialog.getByRole('button', { name: 'Tap again to remove' }).click();
  await expect(dialog.locator('.row')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Remove' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Close' }).click();

  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.start?.host.player.displayName === 'Ava', null, {
    timeout: 30_000,
  });
  const saved = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key)!);
    return Object.values(save.profiles as Record<string, { displayName: string }>).map((p) => p.displayName);
  }, SAVE_KEY);
  expect(saved).toEqual(['Ava']);
  expect(errors).toEqual([]);
});

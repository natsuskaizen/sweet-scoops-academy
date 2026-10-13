import { expect, test } from '@playwright/test';
import { atResultsWith200, SAVE_KEY, tapAt, type HookWindow } from './shopHelpers';

test('Decorate opens from the results card, and a bought plant is saved in its spot', async ({ page }, testInfo) => {
  const errors: string[] = [];
  await atResultsWith200(page, errors);
  const card = await page.evaluate(() => {
    const { x, y } = (window as HookWindow).__ssa!.scene.results!;
    return { x, y };
  });
  await tapAt(page, card.x + 110, card.y + 630); // the Decorate button
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

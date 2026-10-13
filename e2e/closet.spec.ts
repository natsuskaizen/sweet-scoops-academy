import { expect, test } from '@playwright/test';
import { atResultsWith200, SAVE_KEY, tapAt, type HookWindow } from './shopHelpers';

test("Momo's Closet opens from the results card, and what she buys she wears in the shop", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  await atResultsWith200(page, errors);
  const card = await page.evaluate(() => {
    const { x, y } = (window as HookWindow).__ssa!.scene.results!;
    return { x, y };
  });
  await tapAt(page, card.x + 302, card.y + 630); // the Closet button
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.closet !== null);

  // Hats come first, with the Beret (the cheapest); buy it in Mint, then a Pink scooper.
  await page.evaluate(() => {
    const closet = (window as HookWindow).__ssa!.scene.closet!;
    closet.pick('mint');
    closet.act();
    closet.showTab('handheld');
    closet.pick('pink');
    closet.act();
    closet.pick('golden'); // too dear: tried on, not bought
    closet.act();
  });
  await page.screenshot({ path: testInfo.outputPath('closet.png') });
  const profile = await page.evaluate(() => {
    const { sprinkles, equipped } = (window as HookWindow).__ssa!.manager().profile;
    return { sprinkles, equipped };
  });
  expect(profile).toEqual({ sprinkles: 20, equipped: { hat: 'hat-beret.mint', handheld: 'scooper.pink' } });

  await page.evaluate(() => (window as HookWindow).__ssa!.scene.closet!.close());
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.closet === null);
  // Back at the counter, Momo has her chef hat off and the beret on.
  const keeper = await page.evaluate(() =>
    (window as HookWindow).__ssa!.scene.shopkeeper.list.map((part) => part.texture.key),
  );
  expect(keeper).toEqual(['friend-momo-hatless', 'wear-hat-beret.mint']);

  const saved = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key)!);
    const p = save.profiles[save.activeProfileId];
    return { owned: p.ownedItems, equipped: p.equipped };
  }, SAVE_KEY);
  expect(saved).toEqual({
    owned: ['hat-beret.mint', 'scooper.pink'],
    equipped: { hat: 'hat-beret.mint', handheld: 'scooper.pink' },
  });
  expect(errors).toEqual([]);
});

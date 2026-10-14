import { expect, test } from '@playwright/test';
import { atResultsWith200, SAVE_KEY, skipSetup, tapAt, type HookWindow } from './shopHelpers';

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

  // Clothing comes first, starting with the Beret; buy it in Mint, then a Pink scooper.
  await page.evaluate(() => {
    const closet = (window as HookWindow).__ssa!.scene.closet!;
    closet.pick('mint');
    closet.act();
    closet.showTab('tools');
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
  expect(keeper).toEqual(['friend-momo-bare', 'wear-hat-beret.mint']);

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

test('the Sprinkles balance opens the shop while a customer waits, and the order carries on after', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e&fast');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await skipSetup(page);
  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.keypad.isEnabled, null, { timeout: 30_000 });
  const pill = await page.evaluate(() => {
    const { width } = (window as HookWindow).__ssa!.scene.scale.gameSize;
    return width > 1000 ? { x: 1025, y: 34 } : { x: 632, y: 34 }; // the middle of the balance pill
  });
  await tapAt(page, pill.x, pill.y);
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.shopMenu !== null);
  expect(await page.evaluate(() => (window as HookWindow).__ssa!.scene.keypad.isEnabled)).toBe(false);

  // The menu's card is 380 tall in the middle of the screen; Momo's Closet is its second button.
  const closetButton = await page.evaluate(() => {
    const { width, height } = (window as HookWindow).__ssa!.scene.scale.gameSize;
    return { x: width / 2, y: (height - 380) / 2 + 286 };
  });
  await tapAt(page, closetButton.x, closetButton.y);
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.closet !== null);
  await page.evaluate(() => (window as HookWindow).__ssa!.scene.closet!.close());
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.keypad.isEnabled);
  expect(errors).toEqual([]);
});

test('another shopkeeper has their own Closet: a hat takes the place of Kiki’s star', async ({ page }) => {
  const errors: string[] = [];
  await atResultsWith200(page, errors, 'kiki');
  await page.evaluate(() => (window as HookWindow).__ssa!.scene.openCloset());
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.closet !== null);
  await page.evaluate(() => {
    const closet = (window as HookWindow).__ssa!.scene.closet!;
    closet.pick('mint'); // the Beret
    closet.act();
    closet.close();
  });
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.closet === null);
  const keeper = await page.evaluate(() =>
    (window as HookWindow).__ssa!.scene.shopkeeper.list.map((part) => part.texture.key),
  );
  expect(keeper).toEqual(['friend-kiki-bare', 'wear-hat-beret.mint']);
  expect(errors).toEqual([]);
});

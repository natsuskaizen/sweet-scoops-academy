import { expect, test, type Page } from '@playwright/test';
import { SAVE_KEY, skipSetup, tapAt } from './shopHelpers';

interface Hook {
  scene: {
    keypad: { isEnabled: boolean };
    myShop: { spots: Record<string, { x: number; y: number }> } | null;
    setup: {
      current: string;
      page: { list: { x: number; y: number; list?: { type: string; text?: string }[] }[] };
    } | null;
    start: object | null;
    room: { sign: { text: string } };
    shopkeeper: { list: { texture: { key: string } }[] };
    openMyShop: () => void;
  };
}
type HookWindow = Window & { __ssa?: Hook };

const keypadReady = (page: Page) =>
  page.waitForFunction(() => (window as HookWindow).__ssa?.scene.keypad.isEnabled, null, { timeout: 30_000 });

const myShopOpen = (page: Page) =>
  page.waitForFunction(() => Boolean((window as HookWindow).__ssa?.scene.myShop), null, { timeout: 30_000 });

const savedPlayer = (page: Page) =>
  page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key)!);
    const { shop, settings } = save.profiles[save.activeProfileId];
    return { shop, hints: settings.showHints, calm: settings.reduceMotion };
  }, SAVE_KEY);

/** Opens My shop with a tap on ⚙ (where the top bar puts it). */
async function openMyShop(page: Page): Promise<void> {
  const gear = await page.evaluate(() => {
    const { width } = (window as unknown as { __ssa: { scene: { scale: { gameSize: { width: number } } } } }).__ssa
      .scene.scale.gameSize;
    return width > 1000 ? { x: 1214, y: 31 } : { x: 762, y: 31 };
  });
  await tapAt(page, gear.x, gear.y);
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.myShop !== null);
}

async function tapMyShop(page: Page, id: string): Promise<void> {
  const spot = await page.evaluate((id) => (window as HookWindow).__ssa!.scene.myShop!.spots[id]!, id);
  await tapAt(page, spot.x, spot.y);
}

async function tapSetupLabel(page: Page, label: string): Promise<void> {
  const pos = await page.evaluate((label) => {
    const items = (window as HookWindow).__ssa!.scene.setup!.page.list;
    const b = items.find((c) => c.list?.some((t) => t.type === 'Text' && t.text === label))!;
    return { x: b.x, y: b.y };
  }, label);
  await tapAt(page, pos.x, pos.y);
}

test('My shop: a child turns hints off, calm mode on, renames the shop, changes shopkeeper and hands over', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e&fast');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await skipSetup(page);
  await keypadReady(page);

  await openMyShop(page);
  expect(await page.evaluate(() => (window as HookWindow).__ssa!.scene.keypad.isEnabled)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('my-shop.png') });
  await tapMyShop(page, 'showHints');
  await tapMyShop(page, 'reduceMotion');
  expect(await savedPlayer(page)).toMatchObject({ hints: false, calm: true });

  // Back to the shop: calm mode rebuilds it, and the order carries on.
  await tapMyShop(page, 'back');
  await keypadReady(page);

  // A new shop name from the ideas; the sign follows, and Done keeps it and goes back to My shop.
  await openMyShop(page);
  await tapMyShop(page, 'shopName');
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.setup?.current === 'shop');
  await tapSetupLabel(page, 'Sugar Cloud');
  expect(await page.evaluate(() => (window as HookWindow).__ssa!.scene.room.sign.text)).toBe("Player 1's Sugar Cloud");
  await tapSetupLabel(page, 'Done ✓');
  await myShopOpen(page);
  expect((await savedPlayer(page)).shop).toEqual({ name: "Player 1's Sugar Cloud", keeper: 'momo' });

  // Trying Bonbon then ✕ keeps Momo, back in My shop.
  await tapMyShop(page, 'keeper');
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.setup?.current === 'keeper');
  await tapSetupLabel(page, 'Bonbon');
  await tapSetupLabel(page, '✕');
  await myShopOpen(page);
  expect((await savedPlayer(page)).shop.keeper).toBe('momo');
  expect(await page.evaluate(() => (window as HookWindow).__ssa!.scene.shopkeeper.list[0]!.texture.key)).not.toBe(
    'friend-bonbon',
  );

  // Kiki takes over the counter, then Back to the shop carries on the order.
  await tapMyShop(page, 'keeper');
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.setup?.current === 'keeper');
  await tapSetupLabel(page, 'Kiki');
  await tapSetupLabel(page, 'Done ✓');
  await myShopOpen(page);
  expect((await savedPlayer(page)).shop.keeper).toBe('kiki');
  expect(await page.evaluate(() => (window as HookWindow).__ssa!.scene.shopkeeper.list[0]!.texture.key)).toBe(
    'friend-kiki',
  );
  await tapMyShop(page, 'back');
  await keypadReady(page);

  // Calm mode off, then straight to Shop name: the step still opens (the calm rebuild waits), and ✕ comes back.
  await openMyShop(page);
  await tapMyShop(page, 'reduceMotion');
  await tapMyShop(page, 'shopName');
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.setup?.current === 'shop');
  await tapSetupLabel(page, '✕');
  await myShopOpen(page);
  expect(await savedPlayer(page)).toMatchObject({ calm: false, shop: { name: "Player 1's Sugar Cloud" } });

  // Switch player goes to the start screen.
  await tapMyShop(page, 'switch');
  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.start !== null, null, { timeout: 30_000 });
  expect(errors).toEqual([]);
});

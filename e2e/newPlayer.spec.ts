import { expect, test, type Page } from '@playwright/test';
import { tapAt } from './shopHelpers';

interface Hook {
  scene: {
    keypad: { isEnabled: boolean };
    setup: {
      current: string;
      page: { list: { x: number; y: number; list?: { type: string; text?: string }[] }[] };
    } | null;
    room: { sign: { text: string }; doorSign: { text: string } };
    shopkeeper: { list: { texture: { key: string } }[] };
  };
  manager: () => { profile: { displayName: string; shop: { name: string; keeper: string } } };
}
type HookWindow = Window & { __ssa?: Hook };

/** What the shop shows now; Phaser's text and texture fields are getters, so they are read in the page. */
const shown = (page: Page) =>
  page.evaluate(() => {
    const { scene } = (window as HookWindow).__ssa!;
    const { sign, doorSign } = scene.room;
    return {
      sign: sign.text,
      door: doorSign.text,
      keeper: scene.shopkeeper.list[0]!.texture.key,
      setup: !!scene.setup,
    };
  });

/** Taps the setup's button showing `label` (a key, an idea, a friend's name, Next). */
async function tapLabel(page: Page, label: string): Promise<void> {
  const pos = await page.evaluate((label) => {
    const items = (window as HookWindow).__ssa!.scene.setup!.page.list;
    const b = items.find((c) => c.list?.some((t) => t.type === 'Text' && t.text === label))!;
    return { x: b.x, y: b.y };
  }, label);
  await tapAt(page, pos.x, pos.y);
}

const onStep = (page: Page, step: string) =>
  page.waitForFunction((step) => (window as HookWindow).__ssa!.scene.setup?.current === step, step);

test('a new game sets up the player: name, shop name and shopkeeper, then opens the shop', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e&fast');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.setup, null, { timeout: 30_000 });
  expect((await shown(page)).door).toBe('CLOSED');

  for (const key of ['A', 'V', 'A', '✓']) await tapLabel(page, key);
  await onStep(page, 'shop');
  expect((await shown(page)).sign).toMatch(/^Ava's /);
  await tapLabel(page, 'Sugar Cloud');
  expect((await shown(page)).sign).toBe("Ava's Sugar Cloud");

  await tapLabel(page, 'Next ▶');
  await onStep(page, 'keeper');
  await tapLabel(page, 'Bonbon');
  expect((await shown(page)).keeper).toBe('friend-bonbon');
  await tapLabel(page, 'Next ▶');
  await onStep(page, 'ready');
  await tapLabel(page, 'Open the shop!');

  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.keypad.isEnabled, null, { timeout: 30_000 });
  const { displayName, shop } = await page.evaluate(() => (window as HookWindow).__ssa!.manager().profile);
  expect({ displayName, shop }).toEqual({ displayName: 'Ava', shop: { name: "Ava's Sugar Cloud", keeper: 'bonbon' } });

  // Coming back goes straight to the shop.
  await page.reload();
  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.keypad.isEnabled, null, { timeout: 30_000 });
  expect(await shown(page)).toEqual({ sign: "Ava's Sugar Cloud", door: 'OPEN', keeper: 'friend-bonbon', setup: false });
  expect(errors).toEqual([]);
});

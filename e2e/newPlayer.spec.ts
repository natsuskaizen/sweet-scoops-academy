import { expect, test, type Page } from '@playwright/test';
import { tapAt } from './shopHelpers';

interface Hook {
  scene: {
    keypad: { isEnabled: boolean };
    setup: {
      current: string;
      page: { list: { x: number; y: number; list?: { type: string; text?: string }[] }[] };
    } | null;
    start: {
      spots: Record<string, { x: number; y: number }>;
      host: { player: { displayName: string }; others: { id: string; displayName: string }[] };
    } | null;
    room: { sign: { text: string }; doorSign: { text: string } };
    shopkeeper: { list: { texture: { key: string } }[] };
  };
  manager: () => {
    profile: { displayName: string; shop: { name: string; keeper: string }; settings: { grade: string } };
  };
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

/** Who the start screen greets, and the other players under "Not …?", once it shows. */
const greeting = async (page: Page) => {
  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.start, null, { timeout: 30_000 });
  return page.evaluate(() => {
    const { host } = (window as HookWindow).__ssa!.scene.start!;
    return { hello: host.player.displayName, others: host.others.map((p) => p.displayName) };
  });
};

/** Taps a start-screen button: 'open', 'new', 'grownUps', or another player's card by name. */
async function tapStart(page: Page, what: string): Promise<void> {
  const pos = await page.evaluate((what) => {
    const { spots, host } = (window as HookWindow).__ssa!.scene.start!;
    const other = host.others.find((p) => p.displayName === what);
    return spots[other ? other.id : what]!;
  }, what);
  await tapAt(page, pos.x, pos.y);
}

const keypadReady = (page: Page) =>
  page.waitForFunction(() => (window as HookWindow).__ssa?.scene.keypad.isEnabled, null, { timeout: 30_000 });

const onStep = (page: Page, step: string) =>
  page.waitForFunction((step) => (window as HookWindow).__ssa!.scene.setup?.current === step, step);

test('a new game sets up the player, and the start screen greets whoever played last and lets the others switch in', async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000); // two players set up and three reloads
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e&fast');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.setup, null, { timeout: 30_000 });
  expect((await shown(page)).door).toBe('CLOSED');

  // Keys show the case they type: a capital first, then small letters.
  for (const key of ['A', 'v', 'a']) await tapLabel(page, key);
  await page.screenshot({ path: testInfo.outputPath('keyboard.png') });
  await tapLabel(page, '✓');
  await onStep(page, 'shop');
  // ◀ goes back to the name, still typed, and on again.
  await tapLabel(page, '◀');
  await onStep(page, 'name');
  await tapLabel(page, '✓');
  await onStep(page, 'shop');
  expect((await shown(page)).sign).toMatch(/^Ava's /);
  await tapLabel(page, 'Sugar Cloud');
  expect((await shown(page)).sign).toBe("Ava's Sugar Cloud");

  await tapLabel(page, 'Next ▶');
  await onStep(page, 'keeper');
  await tapLabel(page, 'Bonbon');
  expect((await shown(page)).keeper).toBe('friend-bonbon');
  await tapLabel(page, 'Next ▶');
  await onStep(page, 'grade');
  await tapLabel(page, 'Kindergarten');
  await page.screenshot({ path: testInfo.outputPath('grade-step.png') });
  await tapLabel(page, 'Next ▶');
  await onStep(page, 'ready');
  await tapLabel(page, 'Open the shop!');

  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.keypad.isEnabled, null, { timeout: 30_000 });
  const { displayName, shop } = await page.evaluate(() => (window as HookWindow).__ssa!.manager().profile);
  expect({ displayName, shop }).toEqual({ displayName: 'Ava', shop: { name: "Ava's Sugar Cloud", keeper: 'bonbon' } });
  // The grade picked in the setup is the one she plays.
  expect(await page.evaluate(() => (window as HookWindow).__ssa!.manager().profile.settings.grade)).toBe(
    'kindergarten',
  );

  // Coming back opens on the start screen: Ava's shop, door shut until she opens it.
  await page.reload();
  expect(await greeting(page)).toEqual({ hello: 'Ava', others: [] });
  expect(await shown(page)).toMatchObject({ door: 'CLOSED', keeper: 'friend-bonbon' });

  // A second child joins; ✕ backs out of the setup first.
  await tapStart(page, 'new');
  await onStep(page, 'name');
  await tapLabel(page, '✕');
  expect(await greeting(page)).toEqual({ hello: 'Ava', others: [] });
  await tapStart(page, 'new');
  await onStep(page, 'name');
  for (const key of ['L', 'e', 'o', '✓']) await tapLabel(page, key);
  await onStep(page, 'shop');
  await tapLabel(page, 'Next ▶');
  await onStep(page, 'keeper');
  await tapLabel(page, 'Kiki');
  await tapLabel(page, 'Next ▶');
  await onStep(page, 'grade');
  await tapLabel(page, 'Next ▶');
  await onStep(page, 'ready');
  await tapLabel(page, 'Open the shop!');
  await keypadReady(page);
  expect((await shown(page)).keeper).toBe('friend-kiki');
  expect(await page.evaluate(() => (window as HookWindow).__ssa!.manager().profile.displayName)).toBe('Leo');

  // Whoever played last is greeted; "Not Leo?" switches to Ava's shop, just as she left it.
  await page.reload();
  expect(await greeting(page)).toEqual({ hello: 'Leo', others: ['Ava'] });
  await page.screenshot({ path: testInfo.outputPath('start-screen.png') });
  await tapStart(page, 'Ava');
  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.start?.host.player.displayName === 'Ava');
  expect(await greeting(page)).toEqual({ hello: 'Ava', others: ['Leo'] });
  await tapStart(page, 'open');
  await keypadReady(page);
  expect(await shown(page)).toEqual({ sign: "Ava's Sugar Cloud", door: 'OPEN', keeper: 'friend-bonbon', setup: false });
  expect(errors).toEqual([]);
});

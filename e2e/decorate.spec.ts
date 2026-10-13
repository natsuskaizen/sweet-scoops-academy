import { expect, test } from '@playwright/test';
import { atResultsWith200, SAVE_KEY, tapAt, type HookWindow } from './shopHelpers';

test('Decorate opens from the results card, and a bought plant is saved in its spot', async ({ page }, testInfo) => {
  const errors: string[] = [];
  await atResultsWith200(page, errors);
  const card = await page.evaluate(() => {
    const { x, y } = (window as HookWindow).__ssa!.scene.results!;
    return { x, y };
  });
  // At the end of a real round the customer has left and the speech bubble is gone.
  await page.evaluate(() => (window as HookWindow).__ssa!.scene.bubble.hide());
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

  // What was hidden before Decorate stays hidden after it: no stale hint board or speech bubble.
  const shown = () =>
    page.evaluate(() => {
      const { aid, bubble } = (window as HookWindow).__ssa!.scene;
      return { aid: aid.visible, bubble: bubble.visible };
    });
  expect(await shown()).toEqual({ aid: false, bubble: false });
  await tapAt(page, card.x + 450, card.y + 630); // Keep scooping!
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.keypad.isEnabled);
  expect((await shown()).aid).toBe(false);

  const saved = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key)!);
    const p = save.profiles[save.activeProfileId];
    return { owned: p.ownedItems, sprinkles: p.sprinkles };
  }, SAVE_KEY);
  expect(saved).toEqual({ owned: ['deco-plant.mint'], sprinkles: 140 });
  expect(errors).toEqual([]);
});

test('Wall paint and a new door repaint the room, and taking the paint away brings back the plain wall', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  await atResultsWith200(page, errors);
  await page.evaluate(() => {
    const ssa = (window as HookWindow).__ssa!;
    ssa.manager().profile.sprinkles = 2000;
    (ssa.scene as unknown as { openDecorate: (cover: unknown[]) => void }).openDecorate([ssa.scene.results]);
  });
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.decorate !== null);
  const roomKey = () => page.evaluate(() => (window as HookWindow).__ssa!.scene.placed.room.texture.key);

  await page.evaluate(() => {
    const decorate = (window as HookWindow).__ssa!.scene.decorate!;
    decorate.turnPage(1);
    decorate.selectById('wall-paint');
    decorate.pick('sky');
    decorate.act();
    decorate.selectById('door-cottage');
    decorate.pick('golden');
    decorate.act();
    decorate.selectById('deco-cafe');
  });
  expect(await roomKey()).toMatch(/-sky-door-cottage\.golden$/);
  await page.screenshot({ path: testInfo.outputPath('decorate-wall-door.png') });

  // Trying another door only previews it; leaving puts the bought one back.
  await page.evaluate(() => (window as HookWindow).__ssa!.scene.decorate!.selectById('door-candy'));
  expect(await roomKey()).toMatch(/-sky-door-candy\.pink$/);
  await page.evaluate(() => {
    const decorate = (window as HookWindow).__ssa!.scene.decorate!;
    decorate.selectById('wall-paint');
    decorate.act(); // take the paint away
    decorate.close();
  });
  expect(await roomKey()).toMatch(/-plain-door-cottage\.golden$/);
  const profile = await page.evaluate(() => (window as HookWindow).__ssa!.manager().profile);
  expect(profile.sprinkles).toBe(2000 - 150 - 900);
  expect(profile.decorations).toEqual([{ itemId: 'door-cottage.golden', spot: 'door' }]);
  expect(errors).toEqual([]);
});

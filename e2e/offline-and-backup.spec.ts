/// <reference types="node" />
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

interface Action {
  label: string;
  run: (gate: unknown) => void;
}
interface FakeGate {
  notices: string[];
  asked: Action[];
}
type HookWindow = Window & {
  __ssa?: {
    scene: { parentArea: { actions: () => Action[] } };
    manager: () => { profile: { sprinkles: number } };
  };
  __gate?: FakeGate;
};

// One screen shape is enough here; the smoke test covers layouts.
// eslint-disable-next-line no-empty-pattern -- Playwright needs a destructured fixtures argument
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'ipad-landscape'));

async function openGame(page: Page): Promise<void> {
  await page.goto('./?e2e&fast');
  await page.waitForFunction(() => (window as HookWindow).__ssa !== undefined);
}

/** Runs a grown-ups action with a stand-in for the gate that records what it would show. */
async function runAction(page: Page, label: string): Promise<void> {
  await page.evaluate((label) => {
    const w = window as HookWindow;
    const gate: FakeGate = { notices: [], asked: [] };
    w.__gate = Object.assign(gate, {
      notice: (title: string) => gate.notices.push(title),
      ask: (action: Action) => gate.asked.push(action),
    });
    w.__ssa!.scene.parentArea.actions()
      .find((a) => a.label === label)!
      .run(w.__gate);
  }, label);
}

test('the game starts offline after the first visit', async ({ page, context }) => {
  await openGame(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => (window as HookWindow).__ssa !== undefined, null, { timeout: 30_000 });
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('a backup file can be saved and loaded back', async ({ page }, testInfo) => {
  await openGame(page);
  const downloading = page.waitForEvent('download');
  await runAction(page, 'Save a backup file');
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^sweet-scoops-backup-\d{4}-\d{2}-\d{2}\.json$/);

  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  backup.profiles[backup.activeProfileId].sprinkles = 123;
  backup.profiles[backup.activeProfileId].lifetimeSprinkles = 123;
  const edited = testInfo.outputPath('edited-backup.json');
  await writeFile(edited, JSON.stringify(backup));

  const choosing = page.waitForEvent('filechooser');
  await runAction(page, 'Load a backup file');
  await (await choosing).setFiles(edited);
  await page.waitForFunction(() => (window as HookWindow).__gate!.asked.length === 1);
  await page.evaluate(() => {
    const w = window as HookWindow;
    w.__gate!.asked[0]!.run(w.__gate);
  });
  await page.waitForFunction(() => (window as HookWindow).__ssa!.manager().profile.sprinkles === 123);
});

test('a file that is not a backup is refused', async ({ page }, testInfo) => {
  await openGame(page);
  const bogus = testInfo.outputPath('not-a-backup.json');
  await writeFile(bogus, '{"hello": "world"}');
  const choosing = page.waitForEvent('filechooser');
  await runAction(page, 'Load a backup file');
  await (await choosing).setFiles(bogus);
  await page.waitForFunction(() => (window as HookWindow).__gate!.notices.length === 1);
  expect(await page.evaluate(() => (window as HookWindow).__gate!)).toMatchObject({
    notices: ['Backup not loaded'],
    asked: [],
  });
});

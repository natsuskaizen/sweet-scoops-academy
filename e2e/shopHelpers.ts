/** Shared steps for the Sprinkle Shop tests (Decorate and the Closet). */
import type { Page } from '@playwright/test';

export interface Hook {
  scene: {
    keypad: { isEnabled: boolean };
    scale: { gameSize: { width: number; height: number } };
    results: { x: number; y: number } | null;
    decorate: {
      pick: (tier: string) => void;
      act: () => void;
      close: () => void;
      selectById: (id: string) => void;
      turnPage: (step: number) => void;
    } | null;
    closet: {
      showTab: (tab: string) => void;
      pick: (tier: string) => void;
      act: () => void;
      close: () => void;
    } | null;
    shopkeeper: { list: { texture: { key: string } }[] };
    setup: { complete: (player: object) => void } | null;
    shopMenu: { close: () => void } | null;
    openCloset: () => void;
    placed: { room: { texture: { key: string } } };
    aid: { visible: boolean };
    bubble: { visible: boolean; hide: () => void };
    showResults: (summary: object, stickers: [], outcomes: []) => Promise<void>;
  };
  manager: () => {
    profile: { sprinkles: number; decorations: { itemId: string; spot: string }[]; equipped: Record<string, string> };
  };
}
export type HookWindow = Window & { __ssa?: Hook };

export const SAVE_KEY = 'sweet-scoops-academy.save';

/** A brand new game opens on the new-player setup; this finishes it as "Player 1" at Sweet Scoops, with Momo unless told otherwise. */
export async function skipSetup(page: Page, keeper = 'momo'): Promise<void> {
  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.setup, null, { timeout: 30_000 });
  await page.evaluate(
    (keeper) =>
      (window as HookWindow).__ssa!.scene.setup!.complete({ name: 'Player 1', shop: { name: 'Sweet Scoops', keeper } }),
    keeper,
  );
}

export async function tapAt(page: Page, x: number, y: number): Promise<void> {
  const width = await page.evaluate(() => (window as HookWindow).__ssa!.scene.scale.gameSize.width);
  const box = (await page.locator('canvas').boundingBox())!;
  const k = box.width / width;
  await page.touchscreen.tap(box.x + x * k, box.y + y * k);
}

/** A fresh game with 200 Sprinkles, at the end-of-round card. */
export async function atResultsWith200(page: Page, errors: string[], keeper = 'momo'): Promise<void> {
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e&fast');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await skipSetup(page, keeper);
  await page.waitForFunction(() => (window as HookWindow).__ssa?.scene.keypad.isEnabled, null, { timeout: 30_000 });
  await page.evaluate(() => {
    const ssa = (window as HookWindow).__ssa!;
    ssa.manager().profile.sprinkles = 200;
    const summary = { perfect: false, ordersCompleted: 10, firstTryCorrect: 8, total: 120 };
    void ssa.scene.showResults({ ...summary, orderSprinkles: 90, completionBonus: 30, perfectBonus: 0 }, [], []);
  });
  await page.waitForFunction(() => (window as HookWindow).__ssa!.scene.results !== null);
  await page.waitForTimeout(500); // the card pops in
}

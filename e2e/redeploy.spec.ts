/// <reference types="node" />
import { cpSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { writeServiceWorker } from '../scripts/offline-plugin.mjs';

/**
 * A deploy must reach players whose game is already installed: the service
 * worker may not keep serving the old page. Serves dist like GitHub Pages
 * (10-minute HTTP cache), then swaps in a second build mid-test.
 */
type HookWindow = Window & { __ssa?: unknown };

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

// eslint-disable-next-line no-empty-pattern -- Playwright needs a destructured fixtures argument
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'ipad-landscape'));

/** Static server whose folder can be swapped, like a Pages deploy. */
function pagesServer(): { server: Server; deploy: (dir: string) => void } {
  let root = '';
  const server = createServer((req, res) => {
    const path = new URL(req.url!, 'http://x').pathname;
    const file = join(root, path.endsWith('/') ? `${path}index.html` : path);
    try {
      const body = readFileSync(file);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'max-age=600',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return { server, deploy: (dir) => (root = dir) };
}

/** A copy of dist with its game script renamed and changed, as a code change would, and a fresh sw.js. */
function secondBuild(from: string, to: string): void {
  cpSync(from, to, { recursive: true });
  const script = readdirSync(join(to, 'assets')).find((f) => /^index-.*\.js$/.test(f))!;
  const renamed = 'index-redeployed.js';
  renameSync(join(to, 'assets', script), join(to, 'assets', renamed));
  writeFileSync(join(to, 'assets', renamed), `${readFileSync(join(to, 'assets', renamed), 'utf8')}\n// redeployed\n`);
  const html = readFileSync(join(to, 'index.html'), 'utf8').replace(script, renamed);
  writeFileSync(join(to, 'index.html'), html);
  writeServiceWorker(to);
}

const gameScript = (page: Page) => page.locator('script[type=module]').getAttribute('src');
const gameCaches = (page: Page) =>
  page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('sweet-scoops-')));
const booted = (page: Page) => page.waitForFunction(() => (window as HookWindow).__ssa !== undefined);

test('a new deploy replaces the installed game on the next launch', async ({ page }) => {
  const work = mkdtempSync(join(tmpdir(), 'ssa-redeploy-'));
  const { server, deploy } = pagesServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const url = `http://localhost:${(server.address() as AddressInfo).port}/?e2e`;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    deploy('dist');
    await page.goto(url);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // now served through the service worker
    await booted(page);
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    const [oldCache] = await gameCaches(page);

    secondBuild('dist', join(work, 'next'));
    deploy(join(work, 'next'));
    await page.reload();
    await booted(page);
    expect(await gameScript(page)).toBe('./assets/index-redeployed.js');

    // The new worker takes over and drops the old build's cache.
    await expect.poll(() => gameCaches(page)).toEqual([expect.not.stringMatching(oldCache!)]);
    expect(errors).toEqual([]);
  } finally {
    server.close();
    rmSync(work, { recursive: true, force: true });
  }
});

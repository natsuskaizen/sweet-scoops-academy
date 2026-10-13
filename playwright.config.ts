import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke test against the production build (`vite preview`), at the
 * screen shapes the game supports. Run with `npm run e2e` after `npm run build`.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'iphone-portrait', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'ipad-portrait', use: { ...devices['iPad (gen 7)'], browserName: 'chromium' } },
    { name: 'ipad-landscape', use: { ...devices['iPad (gen 7) landscape'], browserName: 'chromium' } },
  ],
});

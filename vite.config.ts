/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { offlinePlugin } from './scripts/offline-plugin.mjs';

// Relative base so the build works under any GitHub Pages project URL
// (https://<user>.github.io/<repo>/) without knowing the repo name.
// Override with BASE_PATH=/my-repo/ if you prefer an absolute base.
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [offlinePlugin()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600, // Phaser alone is ~1.2 MB minified
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // The Phaser-free game logic; scenes and UI are covered by the browser smoke test.
      include: ['src/config/**', 'src/core/**', 'src/learning/**', 'src/shop/**', 'src/save/**'],
      reporter: ['text-summary', 'text'],
      // Floors just under today's numbers: CI fails if game-logic tests are lost.
      thresholds: { statements: 85, branches: 80, functions: 88, lines: 90 },
    },
  },
});

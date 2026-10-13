/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Relative base so the build works under any GitHub Pages project URL
// (https://<user>.github.io/<repo>/) without knowing the repo name.
// Override with BASE_PATH=/my-repo/ if you prefer an absolute base.
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
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
  },
});

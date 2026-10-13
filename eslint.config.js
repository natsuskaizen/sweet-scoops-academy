// Lint rules that keep the code in the shape we agreed on: small functions,
// shallow nesting, no unused code. Run with `npm run lint`.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      'max-lines-per-function': ['error', { max: 45, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 12],
      'max-depth': ['error', 3],
      'max-params': ['error', 5],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Node scripts (CI helpers).
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // Service worker template; the plugin in scripts/offline-plugin.mjs fills in the placeholder.
    files: ['src/pwa/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker, __PRECACHE_FILES__: 'readonly' } },
  },
  {
    // Tests read best as one long scenario per `it`.
    files: ['src/tests/**/*.ts', 'e2e/**/*.ts'],
    rules: { 'max-lines-per-function': 'off', complexity: 'off' },
  },
);

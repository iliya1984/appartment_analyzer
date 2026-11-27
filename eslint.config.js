import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Layer rules from the migration plan (§4.1): dependencies point downward only. */
const restrict = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'legacy',
      'fixtures',
      'playwright-report',
      'test-results',
      'src/data/apartments.data.ts',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.typescript,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser },
    },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.test.json' }, node: true },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      'import/no-cycle': 'error',
      'import/no-duplicates': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-unresolved': 'off', // TypeScript already resolves imports
      'import/named': 'off',
    },
  },
  {
    files: ['src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    extends: [jsxA11y.flatConfigs.recommended],
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: restrict([
      {
        group: ['react', 'react-dom', 'react-*', 'zustand', 'three', 'xlsx'],
        message: 'domain/ must stay framework-free.',
      },
      {
        group: ['@/store/*', '@/features/*', '@/app/*', '@/shared/*', '@/data/*'],
        message: 'domain/ may not import upper layers.',
      },
    ]),
  },
  {
    files: ['src/store/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: restrict([
      { group: ['@/features/*', '@/app/*'], message: 'store/ may not import features or app.' },
    ]),
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    rules: restrict([
      { group: ['@/app/*'], message: 'features may not import app/.' },
      { group: ['@/features/*/*'], message: 'Import other features through their index.ts only.' },
    ]),
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      // expect(mock.method) is the normal Vitest idiom
      '@typescript-eslint/unbound-method': 'off',
      // the router probe in renderApp records the location for assertions
      'react-hooks/immutability': 'off',
    },
  },
  {
    files: ['*.config.{js,ts}', 'scripts/**/*.{js,mjs}', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.node }, sourceType: 'module' },
  },
);

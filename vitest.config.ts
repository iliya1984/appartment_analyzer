import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
          'src/main.tsx',
          'src/data/apartments.data.ts',
          'src/**/index.ts',
          'src/vite-env.d.ts',
        ],
        reporter: ['text-summary', 'text', 'html', 'lcov'],
        thresholds: {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85,
          'src/domain/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        },
      },
    },
  }),
);

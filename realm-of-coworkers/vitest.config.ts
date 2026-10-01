import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.{ts,tsx}',
      'tools/balance/src/**/*.test.ts',
    ],
    environment: 'node',
    testTimeout: 60_000,
  },
});

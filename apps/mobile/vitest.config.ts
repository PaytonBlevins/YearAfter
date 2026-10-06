import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/nativeHosts.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});

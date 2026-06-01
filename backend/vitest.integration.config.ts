import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/integration/**/*.integration.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    setupFiles: ['src/integration/setup.integration.ts'],
  },
  resolve: {
    alias: {
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@dtos': path.resolve(__dirname, 'src/dtos'),
      '@mappers': path.resolve(__dirname, 'src/mappers'),
      '@constants': path.resolve(__dirname, 'src/constants'),
      '@middleware': path.resolve(__dirname, 'src/middleware'),
      '@jobs': path.resolve(__dirname, 'src/jobs'),
    },
  },
});

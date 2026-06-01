import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/integration/**', 'src/**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/routes/**/*.ts',
        'src/services/**/*.ts',
        'src/middleware/**/*.ts',
        'src/dtos/**/*.ts',
        'src/domain/errors/**/*.ts',
      ],
      exclude: [
        'src/index.ts',
        'src/app.ts',
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/integration/**',
        'src/domain/entities/**',
        'src/domain/repositories/**',
        'src/constants/**',
        'src/routes/admin-queue.routes.ts',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 75,
        functions: 75,
      },
    },
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

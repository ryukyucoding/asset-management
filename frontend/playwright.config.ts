import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const frontendPort = process.env.CI ? 4173 : 5173
const frontendBaseUrl = `http://localhost:${frontendPort}`

const backendEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5434/asset_management',
  JWT_SECRET: 'test-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  STORAGE_DRIVER: 'local',
  FRONTEND_URL: frontendBaseUrl,
  BASE_URL: 'http://localhost:3000',
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10_000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    actionTimeout: 0,
    baseURL: frontendBaseUrl,
    trace: 'on-first-retry',
    headless: !!process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: process.env.CI
    ? [
        {
          command: 'cd ../backend && npx tsx src/index.ts',
          url: 'http://localhost:3000/health',
          reuseExistingServer: false,
          timeout: 120_000,
          env: backendEnv,
        },
        {
          command: 'npm run preview -- --port 4173 --strictPort',
          url: frontendBaseUrl,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            VITE_API_URL: 'http://localhost:3000',
          },
        },
      ]
    : {
        command: 'npm run dev',
        port: 5173,
        reuseExistingServer: true,
      },
})

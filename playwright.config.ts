import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  outputDir: 'test-results/browser',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  workers: 1,
  projects: [
    {
      name: 'populated',
      testMatch: 'smoke.spec.ts',
      use: { baseURL: process.env.LWE_BROWSER_URL },
    },
    {
      name: 'empty',
      testMatch: 'states.spec.ts',
      use: { baseURL: process.env.LWE_BROWSER_EMPTY_URL },
    },
    {
      name: 'missing-backend',
      testMatch: 'states.spec.ts',
      use: { baseURL: process.env.LWE_BROWSER_MISSING_URL },
    },
  ],
  use: {
    baseURL: process.env.LWE_BROWSER_URL,
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
    screenshot: 'on',
    trace: 'on',
    video: 'retain-on-failure',
  },
})

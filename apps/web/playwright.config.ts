import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright E2E configuration for byrdOS web.
 *
 * The web stack is started externally (see M5 runbook). Playwright only runs
 * the tests against the running servers.
 *
 * Run discovery:
 *   npx playwright test --list
 * Run all specs:
 *   npx playwright test
 * Run with UI:
 *   npx playwright test --ui
 */
export default defineConfig({
  testDir: './e2e',

  /* Run tests sequentially — shared API can't handle parallel auth flows */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* No retries — CI handles retries externally */
  retries: 0,

  /* Single worker for deterministic auth state */
  workers: 1,

  /* Reporters */
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],

  /* Maximum time one test can run */
  timeout: 30000,

  expect: {
    /* Maximum time expect() should wait */
    timeout: 5000,
  },

  use: {
    /* Base URL for all page navigations */
    baseURL: 'http://localhost:3000',

    /* Collect trace on first retry */
    trace: 'on-first-retry',

    /* Capture screenshot on failure */
    screenshot: 'only-on-failure',

    /* Default viewport */
    viewport: { width: 1280, height: 720 },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  /* The stack is started externally for M5 acceptance testing. */
  webServer: undefined,

  /* Global output directory for test artifacts */
  outputDir: path.join('e2e', 'test-results'),
});

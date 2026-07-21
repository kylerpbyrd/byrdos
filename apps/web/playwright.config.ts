import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Playwright E2E configuration for byrdOS web.
 *
 * The full stack is started automatically via the `webServer` block below.
 * Pre-requisites: Docker running, migrations applied.
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

  /* Run tests in files in parallel where possible */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* No retries — CI handles retries externally */
  retries: 0,

  /* Opt out of parallel tests on CI for deterministic auth state */
  workers: process.env.CI ? 1 : undefined,

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
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  /* Start the whole monorepo dev stack. The Turbo command boots both the API (4000)
     and the web (3000) processes. We wait for the web port; the API is started
     in the same command and should be ready shortly after. */
  webServer: {
    command: 'pnpm dev --concurrency 20',
    cwd: path.resolve(__dirname, '..', '..'),
    url: 'http://localhost:3000',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },

  /* Global output directory for test artifacts */
  outputDir: path.join('e2e', 'test-results'),
});

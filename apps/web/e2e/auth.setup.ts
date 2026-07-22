import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  createTestUser,
  signupTestUser,
  TEST_USER_PASSWORD,
} from './helpers.js';

export {
  API_BASE_URL,
  WEB_BASE_URL,
  TEST_USER_PASSWORD,
  createTestUser,
  signupTestUser,
  getAuthToken,
  globalTestUser,
} from './helpers.js';

const authFile = path.join('e2e', '.auth', 'user.json');

/**
 * Setup test that creates a user via the API, logs in through the browser,
 * and saves the encrypted Auth.js session so downstream tests can reuse it.
 */
setup('authenticate', async ({ page }) => {
  const credentials = createTestUser();
  await signupTestUser(credentials);

  await page.goto('/login');
  await expect(page).toHaveTitle(/byrdOS|Sign in/);

  await page.fill('#email', credentials.email);
  await page.fill('#password', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForURL('/', { timeout: 10000 });
  await expect(page.locator('h1')).toContainText('Welcome');

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});

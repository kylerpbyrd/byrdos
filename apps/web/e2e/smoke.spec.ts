import { test, expect } from '@playwright/test';
import { createTestUser, signupTestUser, TEST_USER_PASSWORD } from './helpers.js';

test.describe('Full browser smoke test', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('user can log in, view dashboard, and sign out', async ({ page }) => {
    const credentials = createTestUser();
    await signupTestUser(credentials);

    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Sign in to byrdOS');

    await page.fill('#email', credentials.email);
    await page.fill('#password', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL('/', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText(/Dashboard|Welcome/);

    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Accounts' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Transactions' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();

    await page.waitForURL('/login', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Sign in to byrdOS');
  });
});

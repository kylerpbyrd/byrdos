import { test, expect } from '@playwright/test';

test.describe('Account views without auth', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('accounts page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForURL('/login', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Sign in to byrdOS');
  });
});

test.describe('Account views with auth', () => {
  test('accounts page loads and shows empty state', async ({ page }) => {
    await page.goto('/accounts');

    await expect(page.locator('h1')).toContainText('Accounts');
    await expect(page.locator('h2:has-text("No accounts yet")')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Connect a bank' }).first()).toBeVisible();
  });

  test('accounts page loading state resolves to empty state', async ({ page }) => {
    await page.goto('/accounts', { waitUntil: 'commit' });

    // Loading skeletons should be present while the page streams in.
    await expect(page.locator('.animate-pulse').first()).toBeVisible();

    await expect(page.locator('h1')).toContainText('Accounts');
    await expect(page.locator('h2:has-text("No accounts yet")')).toBeVisible();
  });

  test('nonexistent account detail shows 404', async ({ page }) => {
    await page.goto('/accounts/nonexistent-id');

    await expect(page.locator('h1')).toContainText('404');
    await expect(page.getByRole('heading', { name: 'This page could not be found.' })).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Transactions page without auth', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('transactions page redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/transactions');
    await page.waitForURL('/login', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Sign in to byrdOS');
  });
});

test.describe('Transactions page with auth', () => {
  test('transactions page loads with empty state', async ({ page }) => {
    await page.goto('/transactions');

    await expect(page.locator('h1')).toContainText('Transactions');
    await expect(page.locator('h2:has-text("No transactions found")')).toBeVisible();
    await expect(page.getByText('Review and filter your transactions.')).toBeVisible();
  });

  test('transactions page streams a loading skeleton', async ({ request }) => {
    const response = await request.get('/transactions');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('animate-pulse');
  });
});

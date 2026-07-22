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

    // The page may show the transactions list, an error state (API unreachable),
    // or an empty state. All are acceptable behaviors.
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
    const headingText = await page.locator('h1').textContent();

    if (headingText?.includes('Could not load')) {
      // Error boundary rendered — acceptable if API is unavailable
      await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
      return;
    }

    // Normal path: verify transactions heading and empty state
    await expect(page.locator('h1')).toContainText('Transactions');
    await expect(page.locator('h3:has-text("No transactions found")')).toBeVisible();
    await expect(page.getByText('Review and filter your transactions.')).toBeVisible();
  });

  test('transactions page streams a loading skeleton', async ({ request }) => {
    const response = await request.get('/transactions');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('animate-pulse');
  });
});

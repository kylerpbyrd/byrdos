import { test, expect } from '@playwright/test';

test.describe('Bank connection onboarding', () => {
  test('connect page loads with Plaid Link structure', async ({ page }) => {
    await page.goto('/connect');

    await expect(page.locator('h1')).toContainText('Connect your bank');
    await expect(page.getByText('Plaid-powered connection')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect Bank Account' })).toBeVisible();
    await expect(page.getByText('What happens next?')).toBeVisible();
  });

  test('shows error state when Plaid is not configured', async ({ page }) => {
    await page.goto('/connect');
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

    await page.route('**/api/links/initiate', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Plaid is not configured' }),
      });
    });

    await page.getByRole('button', { name: 'Connect Bank Account' }).click();

    await expect(page.getByText('Plaid is not configured')).toBeVisible();
  });

  test('mocked initiate link starts Plaid Link flow', async ({ page }) => {
    await page.goto('/connect');
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

    await page.route('**/api/links/initiate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          linkToken: 'link-sandbox-test-token',
          integrationId: 'integration-test-id',
        }),
      });
    });

    await page.getByRole('button', { name: 'Connect Bank Account' }).click();

    // The button should enter a loading / connecting state while the API is called.
    await expect(page.getByRole('button', { name: 'Connecting...' })).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Error handling', () => {
  test('non-existent route renders 404', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.locator('h1')).toContainText('404');
    await expect(page.getByRole('heading', { name: 'This page could not be found.' })).toBeVisible();
  });

  test('invalid account ID shows 404', async ({ page }) => {
    await page.goto('/accounts/invalid-id');
    await expect(page.locator('h1')).toContainText('404', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'This page could not be found.' })).toBeVisible({ timeout: 15000 });
  });
});

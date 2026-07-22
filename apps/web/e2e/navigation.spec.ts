import { test, expect } from '@playwright/test';

test.describe('Page navigation', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('homepage redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('/login', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Sign in to byrdOS');
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Sign in to byrdOS');
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign in');
  });

  test('signup page renders', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('h1')).toContainText('Create your account');
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input#name')).toBeVisible();
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Create account');
  });
});

import { test, expect, type Page } from '@playwright/test';

async function waitForAuthNavbar(page: Page) {
  // The navbar renders the "Sign out" button only once the client session
  // has loaded. Waiting for it guarantees the nav links are interactive.
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

test.describe('Navbar navigation', () => {
  test('navbar shows dashboard, accounts, transactions, and settings links', async ({ page }) => {
    await page.goto('/');
    await waitForAuthNavbar(page);

    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Accounts' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Transactions' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  });

  test('clicking dashboard link navigates to dashboard', async ({ page }) => {
    await page.goto('/accounts');
    await waitForAuthNavbar(page);
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('Welcome');
  });

  test('clicking accounts link navigates to accounts', async ({ page }) => {
    await page.goto('/');
    await waitForAuthNavbar(page);
    await page.getByRole('link', { name: 'Accounts' }).click();
    await expect(page).toHaveURL('/accounts');
    await expect(page.locator('h1')).toContainText('Accounts');
  });

  test('clicking transactions link navigates to transactions', async ({ page }) => {
    await page.goto('/');
    await waitForAuthNavbar(page);
    await page.getByRole('link', { name: 'Transactions' }).click();
    await expect(page).toHaveURL('/transactions');
    await expect(page.locator('h1')).toContainText('Transactions');
  });

  test('clicking settings link navigates to settings route', async ({ page }) => {
    await page.goto('/');
    await waitForAuthNavbar(page);
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL('/settings');
  });

  test('sign out redirects to login', async ({ page }) => {
    await page.goto('/');
    await waitForAuthNavbar(page);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL('/login', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Sign in to byrdOS');
  });
});

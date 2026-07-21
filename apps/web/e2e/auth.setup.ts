import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api';
export const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3000';
export const TEST_USER_EMAIL_PREFIX = 'e2e+';
export const TEST_USER_PASSWORD = 'TestPassword123!';

export interface TestUserCredentials {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: { id: string; email: string; name: string | null };
  accessToken: string;
}

/**
 * Create a unique test user credential set. Does NOT create the user in the API.
 */
export function createTestUser(): TestUserCredentials {
  const timestamp = Date.now();
  return {
    email: `${TEST_USER_EMAIL_PREFIX}${timestamp}@example.com`,
    password: TEST_USER_PASSWORD,
    name: `E2E User ${timestamp}`,
  };
}

/**
 * Sign up a test user directly via the API.
 */
export async function signupTestUser(credentials: TestUserCredentials): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: `Signup failed: ${res.status}` }));
    throw new Error(error.message || `Signup failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Get a JWT access token directly via the API signin endpoint.
 */
export async function getAuthToken(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: `Signin failed: ${res.status}` }));
    throw new Error(error.message || `Signin failed: ${res.status}`);
  }

  const data: AuthResponse = await res.json();
  return data.accessToken;
}

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
  await page.fill('#password', credentials.password);
  await page.click('button[type="submit"]');

  await page.waitForURL('/', { timeout: 10000 });
  await expect(page.locator('h1')).toContainText('Welcome');

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});

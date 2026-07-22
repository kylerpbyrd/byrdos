import { test, expect } from '@playwright/test';
import { API_BASE_URL, createTestUser } from './helpers.js';

test.describe('Authentication API flows', () => {
  /* Auth flow tests must start with a clean browser state */
  test.use({ storageState: { cookies: [], origins: [] } });

  test('signup creates a new user', async ({ request }) => {
    const credentials = createTestUser();

    const response = await request.post(`${API_BASE_URL}/auth/signup`, {
      data: credentials,
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('id');
    expect(body.user.email).toBe(credentials.email);
    expect(body).toHaveProperty('accessToken');
    expect(typeof body.accessToken).toBe('string');
    expect(body.accessToken.length).toBeGreaterThan(0);
  });

  test('login returns JWT', async ({ request }) => {
    const credentials = createTestUser();

    const signup = await request.post(`${API_BASE_URL}/auth/signup`, {
      data: credentials,
    });
    expect(signup.status()).toBe(201);

    const response = await request.post(`${API_BASE_URL}/auth/signin`, {
      data: { email: credentials.email, password: credentials.password },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('accessToken');
    expect(typeof body.accessToken).toBe('string');
    expect(body.accessToken.length).toBeGreaterThan(0);
  });

  test('invalid login returns 401', async ({ request }) => {
    const credentials = createTestUser();

    const signup = await request.post(`${API_BASE_URL}/auth/signup`, {
      data: credentials,
    });
    expect(signup.status()).toBe(201);

    const response = await request.post(`${API_BASE_URL}/auth/signin`, {
      data: { email: credentials.email, password: 'wrong-password-123' },
    });

    expect(response.status()).toBe(401);
  });

  test('duplicate signup returns 409', async ({ request }) => {
    const credentials = createTestUser();

    const first = await request.post(`${API_BASE_URL}/auth/signup`, {
      data: credentials,
    });
    expect(first.status()).toBe(201);

    const second = await request.post(`${API_BASE_URL}/auth/signup`, {
      data: credentials,
    });

    expect(second.status()).toBe(409);
    const body = await second.json().catch(() => ({}));
    expect(body.message || second.statusText()).toBeTruthy();
  });

  test('protected route requires auth', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/accounts`);
    expect(response.status()).toBe(401);
  });
});

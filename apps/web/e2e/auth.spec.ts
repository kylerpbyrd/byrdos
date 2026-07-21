import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api';

function uniqueEmail() {
  return `test-${Date.now()}@example.com`;
}

interface SignupResponse {
  user: { id: string; email: string };
  accessToken: string;
}

interface ApiError {
  message?: string;
  statusCode?: number;
}

test.describe('Authentication API flows', () => {
  /* Auth flow tests must start with a clean browser state */
  test.use({ storageState: { cookies: [], origins: [] } });

  test('signup creates account and returns tokens', async () => {
    const email = uniqueEmail();
    const password = 'TestPassword123!';
    const name = 'E2E Test User';

    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as SignupResponse;
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('id');
    expect(body.user.email).toBe(email);
    expect(body).toHaveProperty('accessToken');
    expect(typeof body.accessToken).toBe('string');
    expect(body.accessToken.length).toBeGreaterThan(0);
  });

  test('signin returns access token for valid credentials', async () => {
    const email = uniqueEmail();
    const password = 'TestPassword123!';

    const signup = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'E2E User' }),
    });
    expect(signup.status).toBe(201);

    const response = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as SignupResponse;
    expect(body).toHaveProperty('accessToken');
    expect(typeof body.accessToken).toBe('string');
    expect(body.accessToken.length).toBeGreaterThan(0);
  });

  test('duplicate signup returns conflict', async () => {
    const email = uniqueEmail();
    const password = 'TestPassword123!';

    const first = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'E2E User' }),
    });
    expect(first.status).toBe(201);

    const second = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'E2E User' }),
    });

    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.status).toBeLessThan(500);
    const body = (await second.json().catch(() => ({}))) as ApiError;
    expect(body.message || second.statusText).toBeTruthy();
  });

  test('invalid signin returns unauthorized', async () => {
    const email = uniqueEmail();
    const password = 'TestPassword123!';

    const signup = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'E2E User' }),
    });
    expect(signup.status).toBe(201);

    const response = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrong-password-123' }),
    });

    expect(response.status).toBe(401);
  });
});

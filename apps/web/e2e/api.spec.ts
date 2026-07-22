import { test, expect } from '@playwright/test';
import { API_BASE_URL, createTestUser, signupTestUser } from './helpers.js';

test.describe('API endpoints', () => {
  test('health endpoint returns 200', async ({ request }) => {
    const response = await request.get('http://localhost:4000/health');
    expect(response.status()).toBe(200);
  });

  test('health/ready returns 200 with checks', async ({ request }) => {
    const response = await request.get('http://localhost:4000/health/ready');
    expect(response.status()).toBe(200);
    const body = await response.json().catch(() => ({}));
    expect(body).toHaveProperty('status', 'ready');
    expect(body).toHaveProperty('checks');
  });

  test('Swagger docs accessible', async ({ request }) => {
    const response = await request.get('http://localhost:4000/docs');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('Swagger');
  });

  test('GET /api/accounts returns 401 without auth', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/accounts`);
    expect(response.status()).toBe(401);
  });

  test('GET /api/accounts returns paginated result with valid token', async ({ request }) => {
    const credentials = createTestUser();
    const auth = await signupTestUser(credentials);

    const response = await request.get(`${API_BASE_URL}/accounts`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('nextCursor');
    expect(body).toHaveProperty('hasMore');
  });
});

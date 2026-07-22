export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api';
export const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3000';
export const TEST_USER_PASSWORD = 'Test1234!';

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
 * The credentials of the most recently created test user.
 * Stored globally so specs can reference the same account when needed.
 */
export let globalTestUser: TestUserCredentials | null = null;

/**
 * Create a unique test user credential set. Does NOT create the user in the API.
 */
export function createTestUser(): TestUserCredentials {
  const timestamp = Date.now();
  return {
    email: `test-${timestamp}@byrdos.dev`,
    password: TEST_USER_PASSWORD,
    name: 'Test User',
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

  globalTestUser = credentials;
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

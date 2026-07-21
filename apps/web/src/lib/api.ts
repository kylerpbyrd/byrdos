const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface SignupResponse {
  user: { id: string; email: string; name: string | null };
  accessToken: string;
}

interface SigninResponse {
  user: { id: string; email: string; name: string | null };
  accessToken: string;
}

export async function signupApi(
  email: string,
  password: string,
  name?: string,
): Promise<SignupResponse> {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Signup failed' }));
    throw new Error(error.message || 'Signup failed');
  }

  return res.json();
}

export async function signinApi(email: string, password: string): Promise<SigninResponse> {
  const res = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Signin failed' }));
    throw new Error(error.message || 'Signin failed');
  }

  return res.json();
}

interface InitiateLinkResponse {
  linkToken: string;
  integrationId: string;
}

interface ExchangeLinkResponse {
  id: string;
  externalId: string;
  institutionName: string | null;
  status: string;
}

export async function initiateLink(providerId: string): Promise<InitiateLinkResponse> {
  const res = await fetch(`${API_URL}/links/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to initiate link' }));
    throw new Error(error.message || 'Failed to initiate link');
  }
  return res.json();
}

export async function exchangeLinkToken(
  integrationId: string,
  publicToken: string,
  metadata?: unknown,
): Promise<ExchangeLinkResponse> {
  const res = await fetch(`${API_URL}/links/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrationId, publicToken, metadata }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to link account' }));
    throw new Error(error.message || 'Failed to link account');
  }
  return res.json();
}

export async function listIntegrations(): Promise<unknown[]> {
  const res = await fetch(`${API_URL}/links`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function revokeConnection(connectionId: string): Promise<void> {
  await fetch(`${API_URL}/links/${connectionId}`, { method: 'DELETE' });
}

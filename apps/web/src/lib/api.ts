import type { Account, PaginatedResult, Transaction } from '@byrdos/domain';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface SignupResponse {
  user: { id: string; email: string; name: string | null };
  accessToken: string;
}

interface SigninResponse {
  user: { id: string; email: string; name: string | null };
  accessToken: string;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: `Request failed: ${res.status}` }));
    throw new Error(error.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

export async function signupApi(
  email: string,
  password: string,
  name?: string,
): Promise<SignupResponse> {
  return apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

export async function signinApi(email: string, password: string): Promise<SigninResponse> {
  return apiFetch('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
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

export async function initiateLink(
  providerId: string,
  token?: string,
): Promise<InitiateLinkResponse> {
  return apiFetch('/links/initiate', {
    method: 'POST',
    token,
    body: JSON.stringify({ providerId }),
  });
}

export async function exchangeLinkToken(
  integrationId: string,
  publicToken: string,
  metadata?: unknown,
  token?: string,
): Promise<ExchangeLinkResponse> {
  return apiFetch('/links/exchange', {
    method: 'POST',
    token,
    body: JSON.stringify({ integrationId, publicToken, metadata }),
  });
}

export async function listIntegrations(token?: string): Promise<unknown[]> {
  try {
    return await apiFetch<unknown[]>('/links', { token });
  } catch {
    return [];
  }
}

export async function revokeConnection(connectionId: string, token?: string): Promise<void> {
  await apiFetch(`/links/${connectionId}`, { method: 'DELETE', token });
}

export async function fetchAccounts(
  token: string,
  options?: { cursor?: string; limit?: number },
): Promise<PaginatedResult<Account>> {
  const params = new URLSearchParams();
  if (options?.cursor) params.set('cursor', options.cursor);
  if (options?.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return apiFetch(`/accounts${query ? `?${query}` : ''}`, { token });
}

export async function fetchAccount(token: string, id: string): Promise<Account> {
  const result = await apiFetch<Account | { error: string }>(`/accounts/${id}`, { token });
  if ('error' in result) {
    throw new Error(result.error);
  }
  return result;
}

export interface TransactionFilters {
  accountId?: string;
  startDate?: string;
  endDate?: string;
  pending?: boolean;
}

export async function fetchTransactions(
  token: string,
  options?: { cursor?: string; limit?: number } & TransactionFilters,
): Promise<PaginatedResult<Transaction>> {
  const params = new URLSearchParams();
  if (options?.cursor) params.set('cursor', options.cursor);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.accountId) params.set('accountId', options.accountId);
  if (options?.startDate) params.set('startDate', options.startDate);
  if (options?.endDate) params.set('endDate', options.endDate);
  if (options?.pending !== undefined) params.set('pending', String(options.pending));
  const query = params.toString();
  return apiFetch(`/transactions${query ? `?${query}` : ''}`, { token });
}

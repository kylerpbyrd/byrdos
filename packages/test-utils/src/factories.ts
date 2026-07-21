import { v7 as uuidv7 } from 'uuid';

export function createTestUser(overrides?: Partial<{ id: string; email: string; name: string }>) {
  return {
    id: overrides?.id ?? uuidv7(),
    email: overrides?.email ?? 'test@example.com',
    name: overrides?.name ?? 'Test User',
    status: 'active' as const,
    passwordHash: '$2b$10$...', // fake hash
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createTestAccount(
  overrides?: Partial<{
    id: string;
    connectionId: string;
    externalId: string;
    mask: string | null;
    name: string;
    officialName: string | null;
    type: 'depository' | 'credit' | 'loan' | 'investment';
    subtype: string | null;
    currentBalanceCents: number;
    availableBalanceCents: number | null;
    balanceLimitCents: number | null;
    currency: string;
    status: 'active' | 'closed';
  }>,
) {
  return {
    id: overrides?.id ?? uuidv7(),
    connectionId: overrides?.connectionId ?? uuidv7(),
    externalId: overrides?.externalId ?? 'acc-123',
    mask: overrides?.mask ?? '1234',
    name: overrides?.name ?? 'Test Checking',
    officialName: overrides?.officialName ?? 'Test Checking Account',
    type: overrides?.type ?? 'depository',
    subtype: overrides?.subtype ?? 'checking',
    currentBalanceCents: overrides?.currentBalanceCents ?? 150000,
    availableBalanceCents: overrides?.availableBalanceCents ?? 100000,
    balanceLimitCents: overrides?.balanceLimitCents ?? null,
    currency: overrides?.currency ?? 'USD',
    status: overrides?.status ?? 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createTestTransaction(
  overrides?: Partial<{
    id: string;
    accountId: string;
    externalId: string;
    amountCents: number;
    date: string;
    authorizedDate: string | null;
    name: string;
    merchantName: string | null;
    pending: boolean;
    pendingTransactionExternalId: string | null;
    paymentChannel: string | null;
    isoCurrencyCode: string | null;
    categoryHash: string | null;
    raw: Record<string, unknown> | null;
  }>,
) {
  return {
    id: overrides?.id ?? uuidv7(),
    accountId: overrides?.accountId ?? uuidv7(),
    externalId: overrides?.externalId ?? 'txn-123',
    amountCents: overrides?.amountCents ?? -2550,
    date: overrides?.date ?? '2026-07-20',
    authorizedDate: overrides?.authorizedDate ?? '2026-07-19',
    name: overrides?.name ?? 'Starbucks',
    merchantName: overrides?.merchantName ?? 'Starbucks Coffee',
    pending: overrides?.pending ?? false,
    pendingTransactionExternalId: overrides?.pendingTransactionExternalId ?? null,
    paymentChannel: overrides?.paymentChannel ?? 'in store',
    isoCurrencyCode: overrides?.isoCurrencyCode ?? 'USD',
    categoryHash: overrides?.categoryHash ?? null,
    raw: overrides?.raw ?? null,
    createdAt: new Date(),
  };
}

export function createTestIntegration(
  overrides?: Partial<{
    id: string;
    userId: string;
    providerId: 'plaid' | 'mx' | 'akoya' | 'varo-direct';
    status: 'active' | 'error' | 'revoked';
  }>,
) {
  return {
    id: overrides?.id ?? uuidv7(),
    userId: overrides?.userId ?? uuidv7(),
    providerId: overrides?.providerId ?? 'plaid',
    status: overrides?.status ?? 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createTestProviderConnection(
  overrides?: Partial<{
    id: string;
    integrationId: string;
    externalId: string;
    providerId: string;
    institutionName: string | null;
    status: 'active' | 'error' | 'pending_reconnect';
    lastWebhookAt: Date | null;
  }>,
) {
  return {
    id: overrides?.id ?? uuidv7(),
    integrationId: overrides?.integrationId ?? uuidv7(),
    externalId: overrides?.externalId ?? 'item-sandbox-xxx',
    providerId: overrides?.providerId ?? 'plaid',
    institutionName: overrides?.institutionName ?? 'Test Bank',
    status: overrides?.status ?? 'active',
    lastWebhookAt: overrides?.lastWebhookAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createTestBalance(
  overrides?: Partial<{
    id: string;
    accountId: string;
    current: number;
    available: number | null;
    limit: number | null;
    currency: string;
    recordedAt: Date;
  }>,
) {
  return {
    id: overrides?.id ?? uuidv7(),
    accountId: overrides?.accountId ?? uuidv7(),
    current: overrides?.current ?? 150000,
    available: overrides?.available ?? 100000,
    limit: overrides?.limit ?? null,
    currency: overrides?.currency ?? 'USD',
    recordedAt: overrides?.recordedAt ?? new Date(),
    createdAt: new Date(),
  };
}

export function createTestCredential(
  overrides?: Partial<{
    id: string;
    integrationId: string;
    keyId: string;
    cipher: string;
    expiresAt: Date | null;
  }>,
) {
  return {
    id: overrides?.id ?? uuidv7(),
    integrationId: overrides?.integrationId ?? uuidv7(),
    keyId: overrides?.keyId ?? 'v1',
    cipher: overrides?.cipher ?? 'fake-cipher-base64',
    expiresAt: overrides?.expiresAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

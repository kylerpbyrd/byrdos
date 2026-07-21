// Mock Plaid API responses for adapter tests
export const mockPlaidLinkToken = {
  link_token: 'link-sandbox-xxx',
  expiration: '2026-12-31T00:00:00Z',
};

export const mockPlaidAccessToken = 'access-sandbox-xxx';
export const mockPlaidItemId = 'item-sandbox-xxx';

export function createMockPlaidAccount(overrides?: Record<string, unknown>) {
  return {
    account_id: 'acc-123',
    mask: '1234',
    name: 'Plaid Checking',
    official_name: 'Plaid Checking Account',
    type: 'depository',
    subtype: 'checking',
    balances: {
      available: 1000.0,
      current: 1500.0,
      limit: null,
      iso_currency_code: 'USD',
    },
    ...overrides,
  };
}

export function createMockPlaidTransaction(overrides?: Record<string, unknown>) {
  return {
    transaction_id: 'txn-123',
    account_id: 'acc-123',
    amount: -25.5,
    date: '2026-07-20',
    authorized_date: '2026-07-19',
    name: 'Starbucks',
    merchant_name: 'Starbucks Coffee',
    pending: false,
    pending_transaction_id: null,
    category: ['Food and Drink', 'Coffee Shop'],
    payment_channel: 'in store',
    iso_currency_code: 'USD',
    ...overrides,
  };
}

import { ProviderRegistry } from './registry.js';
import { FakeProviderAdapter } from './adapters/fake.adapter.js';
import { PlaidAdapter, type PlaidAdapterConfig } from './adapters/plaid.adapter.js';

/**
 * Factory that builds a ProviderRegistry from environment variables.
 *
 * Resolution order:
 *   1. If PROVIDER=fake, register the deterministic FakeProviderAdapter.
 *   2. Otherwise, if PLAID_CLIENT_ID and PLAID_SECRET are present,
 *      register PlaidAdapter (its constructor enforces the production guard).
 */
export function createProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();

  if (process.env.PROVIDER === 'fake') {
    registry.register(new FakeProviderAdapter());
  } else if (process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET) {
    registry.register(
      new PlaidAdapter({
        clientId: process.env.PLAID_CLIENT_ID,
        secret: process.env.PLAID_SECRET,
        environment: (process.env.PLAID_ENV as PlaidAdapterConfig['environment']) || 'sandbox',
        webhookVerificationKey: process.env.PLAID_WEBHOOK_KEY || '',
      }),
    );
  }

  return registry;
}

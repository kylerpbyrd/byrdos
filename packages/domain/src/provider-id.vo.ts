export type ProviderId = 'plaid' | 'mx' | 'akoya' | 'varo-direct';

export const VALID_PROVIDER_IDS: readonly ProviderId[] = ['plaid', 'mx', 'akoya', 'varo-direct'];

export function assertProviderId(value: string): asserts value is ProviderId {
  if (!VALID_PROVIDER_IDS.includes(value as ProviderId)) {
    throw new Error(`Invalid provider ID: ${value}`);
  }
}

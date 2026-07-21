import type { IProviderAdapter } from './adapter.interface';
import type { ProviderId } from '@byrdos/contracts';

export class ProviderRegistry {
  private readonly adapters = new Map<ProviderId, IProviderAdapter>();

  register(adapter: IProviderAdapter): void {
    if (this.adapters.has(adapter.providerId)) {
      throw new Error(`Provider '${adapter.providerId}' is already registered`);
    }
    this.adapters.set(adapter.providerId, adapter);
  }

  get(providerId: ProviderId): IProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new Error(`No adapter registered for provider '${providerId}'`);
    }
    return adapter;
  }

  list(): ProviderId[] {
    return Array.from(this.adapters.keys());
  }

  has(providerId: ProviderId): boolean {
    return this.adapters.has(providerId);
  }
}

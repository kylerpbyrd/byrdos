import type { ProviderId } from './provider-id.vo';

export type IntegrationStatus = 'active' | 'error' | 'revoked';

export interface Integration {
  readonly id: string;
  readonly userId: string;
  readonly providerId: ProviderId;
  readonly status: IntegrationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

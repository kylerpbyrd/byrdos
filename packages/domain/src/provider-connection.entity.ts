export type ConnectionStatus = 'active' | 'error' | 'pending_reconnect';

export interface ProviderConnection {
  readonly id: string;
  readonly integrationId: string;
  readonly externalId: string;
  readonly providerId: string;
  readonly institutionName: string | null;
  readonly status: ConnectionStatus;
  readonly lastWebhookAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

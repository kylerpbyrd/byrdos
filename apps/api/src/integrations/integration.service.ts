import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { assertProviderId, type Integration, type ProviderConnection } from '@byrdos/domain';
import { ProviderRegistry } from '@byrdos/provider-sdk';
import { CredentialService } from '@byrdos/auth';
import type { ProviderConnection as ContractProviderConnection } from '@byrdos/contracts';
import type {
  DrizzleIntegrationRepository,
  DrizzleCredentialRepository,
  DrizzleProviderConnectionRepository,
} from '@byrdos/db';
import { Queue } from 'bullmq';
import { QUEUES, type SyncJobData } from '@byrdos/queue';

export interface LinkMetadata {
  institution?: { name: string; institution_id: string };
  accounts?: { id: string; name: string; mask?: string; type: string; subtype?: string }[];
}

export interface LinkListItem {
  id: string;
  providerId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  connection: ProviderConnection | null;
}

@Injectable()
export class IntegrationService {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly integrationRepo: DrizzleIntegrationRepository,
    private readonly credentialRepo: DrizzleCredentialRepository,
    private readonly connectionRepo: DrizzleProviderConnectionRepository,
    private readonly credentialService: CredentialService,
    private readonly syncQueue: Queue<SyncJobData>,
  ) {}

  async initiateLink(
    userId: string,
    providerId: string,
  ): Promise<{ linkToken: string; integrationId: string }> {
    assertProviderId(providerId);
    const adapter = this.registry.get(providerId);
    const linkToken = await adapter.initiateLink(userId, 'byrdos://callback');

    // Create integration record (pending until exchange)
    const integration = await this.integrationRepo.create(userId, providerId);

    return { linkToken: linkToken.token, integrationId: integration.id };
  }

  async exchangeToken(
    integrationId: string,
    publicToken: string,
    userId: string,
    metadata?: LinkMetadata,
  ): Promise<ProviderConnection> {
    const integration = await this.integrationRepo.findById(integrationId);
    if (!integration) throw new NotFoundException('Integration not found');
    if (integration.userId !== userId) throw new ForbiddenException('Forbidden');

    const adapter = this.registry.get(integration.providerId);
    const result = await adapter.exchangePublicToken({ publicToken, metadata });

    await this.credentialService.storeToken(integrationId, result.accessToken);

    const connection = await this.connectionRepo.create({
      integrationId,
      externalId: result.connection.externalId,
      institutionName: result.connection.institutionName,
    });

    await this.syncQueue.add(`initial-${connection.id}`, {
      connectionId: connection.id,
      integrationId,
      userId,
      providerId: integration.providerId,
      trigger: 'initial',
    });

    return connection;
  }

  async listIntegrations(userId: string): Promise<LinkListItem[]> {
    const integrations = await this.integrationRepo.findByUserId(userId);
    return Promise.all(
      integrations.map(async (integration) => {
        const connections = await this.connectionRepo.findByIntegrationId(integration.id);
        return {
          id: integration.id,
          providerId: integration.providerId,
          status: integration.status,
          createdAt: integration.createdAt,
          updatedAt: integration.updatedAt,
          connection: connections[0] ?? null,
        };
      }),
    );
  }

  async getConnection(connectionId: string): Promise<ProviderConnection> {
    const conn = await this.connectionRepo.findById(connectionId);
    if (!conn) throw new NotFoundException('Connection not found');
    return conn;
  }

  async revokeConnection(connectionId: string, userId: string): Promise<void> {
    const conn = await this.getConnection(connectionId);
    const integration = await this.integrationRepo.findById(conn.integrationId);
    if (!integration) {
      throw new NotFoundException('Integration not found');
    }
    if (integration.userId !== userId) {
      throw new ForbiddenException('Forbidden');
    }
    const adapter = this.registry.get('plaid');

    // Inject decrypted token for revoke
    const credential = await this.credentialRepo.findByIntegrationId(conn.integrationId);
    if (credential) {
      const token = await this.credentialService.getToken(credential.id);
      (conn as { __accessToken?: string }).__accessToken = token;
    }

    await adapter.revoke(conn as unknown as ContractProviderConnection);
    await this.connectionRepo.updateStatus(connectionId, 'error');
    await this.integrationRepo.updateStatus(conn.integrationId, 'revoked');

    // Revoke credential
    if (credential) {
      await this.credentialService.revoke(credential.id);
    }
  }
}

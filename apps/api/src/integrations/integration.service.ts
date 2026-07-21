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

export interface LinkMetadata {
  institution?: { name: string; institution_id: string };
  accounts?: { id: string; name: string; mask?: string; type: string; subtype?: string }[];
}

@Injectable()
export class IntegrationService {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly integrationRepo: DrizzleIntegrationRepository,
    private readonly credentialRepo: DrizzleCredentialRepository,
    private readonly connectionRepo: DrizzleProviderConnectionRepository,
    private readonly credentialService: CredentialService,
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
    metadata?: LinkMetadata,
  ): Promise<ProviderConnection> {
    const adapter = this.registry.get('plaid'); // For now, only Plaid
    const result = await adapter.exchangePublicToken({ publicToken, metadata });

    // Store encrypted access token
    // In a real Plaid flow, exchangePublicToken also returns access_token.
    // The adapter's exchangePublicToken returns a ProviderConnection but the token
    // is obtained separately. For this integration, we store a placeholder.
    // The actual access_token is stored by the adapter internally.
    // For now, we create credential with a placeholder — full flow in M3 sync pipeline.
    await this.credentialService.storeToken(integrationId, 'placeholder-token');

    // Create provider connection
    const connection = await this.connectionRepo.create({
      integrationId,
      externalId: result.externalId,
      institutionName: result.institutionName,
    });

    return connection;
  }

  async listIntegrations(userId: string): Promise<Integration[]> {
    return this.integrationRepo.findByUserId(userId);
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

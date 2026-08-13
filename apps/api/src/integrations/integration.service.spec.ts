import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import type { DrizzleIntegrationRepository, DrizzleCredentialRepository, DrizzleProviderConnectionRepository } from '@byrdos/db';
import { CredentialService } from '@byrdos/auth';
import { ProviderRegistry } from '@byrdos/provider-sdk';
import type { IProviderAdapter } from '@byrdos/provider-sdk';
import type { ProviderConnection } from '@byrdos/domain';
import type { ExchangeResult } from '@byrdos/contracts';
import { IntegrationService, type LinkMetadata } from './integration.service.js';

const currentUser = 'current-user';
const otherUser = 'other-user';
const integrationId = 'int-1';

function makeIntegration(overrides: { userId: string }): Awaited<ReturnType<DrizzleIntegrationRepository['findById']>> {
  return {
    id: integrationId,
    userId: overrides.userId,
    providerId: 'plaid',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeExchangeResult(): ExchangeResult {
  return {
    connection: {
      id: '',
      integrationId: '',
      externalId: 'item-1',
      providerId: 'plaid',
      institutionName: 'Bank',
      status: 'active',
      lastWebhookAt: null,
      createdAt: new Date().toISOString(),
    },
    accessToken: 'real-token',
  };
}

function makeProviderConnection(): ProviderConnection {
  return {
    id: 'conn-1',
    integrationId,
    externalId: 'item-1',
    providerId: 'plaid',
    institutionName: 'Bank',
    status: 'active',
    lastWebhookAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('IntegrationService', () => {
  let service: IntegrationService;

  const findById = vi.fn<DrizzleIntegrationRepository['findById']>();
  const integrationRepo = { findById } as unknown as DrizzleIntegrationRepository;

  const credentialRepo = {} as unknown as DrizzleCredentialRepository;

  const createConnection = vi.fn<DrizzleProviderConnectionRepository['create']>();
  const connectionRepo = { create: createConnection } as unknown as DrizzleProviderConnectionRepository;

  const storeToken = vi.fn<CredentialService['storeToken']>();
  const credentialService = { storeToken } as unknown as CredentialService;

  const exchangePublicToken = vi.fn<IProviderAdapter['exchangePublicToken']>();
  const adapter = { exchangePublicToken } as unknown as IProviderAdapter;

  const registryGet = vi.fn<ProviderRegistry['get']>();
  const registry = { get: registryGet } as unknown as ProviderRegistry;

  beforeEach(() => {
    vi.resetAllMocks();
    registryGet.mockReturnValue(adapter);
    service = new IntegrationService(
      registry,
      integrationRepo,
      credentialRepo,
      connectionRepo,
      credentialService,
    );
  });

  describe('exchangeToken', () => {
    it('rejects cross-user access with ForbiddenException and never exchanges or stores tokens (IDOR regression)', async () => {
      findById.mockResolvedValue(makeIntegration({ userId: otherUser }));

      await expect(
        service.exchangeToken(integrationId, 'pt', currentUser),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(registryGet).not.toHaveBeenCalled();
      expect(exchangePublicToken).not.toHaveBeenCalled();
      expect(storeToken).not.toHaveBeenCalled();
      expect(createConnection).not.toHaveBeenCalled();
    });

    it('rejects missing integration with NotFoundException', async () => {
      findById.mockResolvedValue(null);

      await expect(service.exchangeToken(integrationId, 'pt', currentUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('exchanges the public token, stores credentials, creates the connection, and returns it', async () => {
      const metadata: LinkMetadata = {
        institution: { name: 'Bank', institution_id: 'ins-1' },
      };
      const exchangeResult = makeExchangeResult();
      const createdConnection = makeProviderConnection();

      findById.mockResolvedValue(makeIntegration({ userId: currentUser }));
      exchangePublicToken.mockResolvedValue(exchangeResult);
      createConnection.mockResolvedValue(createdConnection);
      storeToken.mockResolvedValue({
        id: 'cred-1',
        integrationId,
        keyId: 'v1',
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.exchangeToken(integrationId, 'pt', currentUser, metadata);

      expect(registryGet).toHaveBeenCalledWith('plaid');
      expect(exchangePublicToken).toHaveBeenCalledWith({ publicToken: 'pt', metadata });
      expect(storeToken).toHaveBeenCalledWith(integrationId, 'real-token');
      expect(createConnection).toHaveBeenCalledWith({
        integrationId,
        externalId: 'item-1',
        institutionName: 'Bank',
      });
      expect(result).toBe(createdConnection);
    });
  });
});

import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationService } from './integration.service.js';
import { ProviderRegistry, PlaidAdapter } from '@byrdos/provider-sdk';
import type { PlaidAdapterConfig } from '@byrdos/provider-sdk';
import { CredentialService } from '@byrdos/auth';
import {
  DrizzleIntegrationRepository,
  DrizzleCredentialRepository,
  DrizzleProviderConnectionRepository,
  db,
} from '@byrdos/db';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [IntegrationsController],
  providers: [
    {
      provide: IntegrationService,
      useFactory: () => {
        const registry = new ProviderRegistry();
        // Register Plaid adapter if credentials exist, else skip for dev
        if (process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET) {
          registry.register(
            new PlaidAdapter({
              clientId: process.env.PLAID_CLIENT_ID,
              secret: process.env.PLAID_SECRET,
              environment: (process.env.PLAID_ENV as PlaidAdapterConfig['environment']) || 'sandbox',
              webhookVerificationKey: process.env.PLAID_WEBHOOK_KEY || '',
            }),
          );
        }

        const integrationRepo = new DrizzleIntegrationRepository(db);
        const credentialRepo = new DrizzleCredentialRepository(db);
        const connectionRepo = new DrizzleProviderConnectionRepository(db);
        const credentialService = new CredentialService(credentialRepo);

        return new IntegrationService(registry, integrationRepo, credentialRepo, connectionRepo, credentialService);
      },
    },
  ],
  exports: [IntegrationService],
})
export class IntegrationsModule {}

import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationService } from './integration.service.js';
import { createProviderRegistry } from '@byrdos/provider-sdk';
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
        const registry = createProviderRegistry();

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

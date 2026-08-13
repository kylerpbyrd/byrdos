import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
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
import { QUEUES, type SyncJobData } from '@byrdos/queue';

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

        const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
        });
        const syncQueue = new Queue<SyncJobData>(QUEUES.SYNC, { connection: redisConnection });

        return new IntegrationService(registry, integrationRepo, credentialRepo, connectionRepo, credentialService, syncQueue);
      },
    },
  ],
  exports: [IntegrationService],
})
export class IntegrationsModule {}

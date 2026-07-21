import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { SyncModule } from './sync/sync.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';

@Module({
  imports: [AuthModule, IntegrationsModule, SyncModule, WebhooksModule],
})
export class AppModule {}

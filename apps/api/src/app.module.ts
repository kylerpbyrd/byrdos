import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { SyncModule } from './sync/sync.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    AuthModule,
    IntegrationsModule,
    SyncModule,
    WebhooksModule,
    AccountsModule,
    TransactionsModule,
    HealthModule,
  ],
})
export class AppModule {}

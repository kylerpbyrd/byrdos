import { Module, type Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { SyncModule } from './sync/sync.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { HealthModule } from './health/health.module.js';
import { CommonThrottlerModule } from './common/throttler.module.js';

const globalGuards: Provider[] = [
  {
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  },
];

@Module({
  imports: [
    CommonThrottlerModule,
    AuthModule,
    IntegrationsModule,
    SyncModule,
    WebhooksModule,
    AccountsModule,
    TransactionsModule,
    HealthModule,
  ],
  providers: globalGuards,
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';

@Module({
  imports: [AuthModule, IntegrationsModule],
})
export class AppModule {}

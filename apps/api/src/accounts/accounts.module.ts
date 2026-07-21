import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccountsController } from './accounts.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [AccountsController],
})
export class AccountsModule {}

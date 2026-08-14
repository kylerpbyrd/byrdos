import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [{ ttl: 60000, limit: 100 }],
        storage,
      }),
      inject: [RedisThrottlerStorage],
    }),
  ],
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage, ThrottlerModule],
})
export class CommonThrottlerModule {}

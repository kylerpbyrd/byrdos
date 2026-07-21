import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { db } from '@byrdos/db';
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  async isDatabaseHealthy(): Promise<boolean> {
    try {
      await db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  }

  async isRedisHealthy(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const KEY_PREFIX = 'thrl:';

/**
 * Lightweight Redis-backed storage for @nestjs/throttler.
 *
 * The community `throttler-storage-redis` package was not available in the
 * registry, so this in-repo implementation provides distributed rate-limit
 * state using the existing ioredis connection.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly redis = new Redis(REDIS_URL);

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const prefixedKey = `${KEY_PREFIX}${key}`;
    const blockKey = `${prefixedKey}:block`;

    // Fail open: if Redis is unreachable, requests are allowed so the API
    // stays available. In production this should be paired with monitoring.
    try {
      const blockCheck = await this.redis.pipeline().get(blockKey).pttl(blockKey).exec();
      if (blockCheck) {
        const [, blocked] = blockCheck[0] as [null, string | null];
        const [, blockTtl] = blockCheck[1] as [null, number];
        if (blocked) {
          return {
            totalHits: limit + 1,
            timeToExpire: ttl,
            isBlocked: true,
            timeToBlockExpire: blockTtl > 0 ? blockTtl : blockDuration,
          };
        }
      }

      const totalHits = await this.redis.incr(prefixedKey);
      let timeToExpire = await this.redis.pttl(prefixedKey);

      if (totalHits === 1 || timeToExpire < 0) {
        await this.redis.pexpire(prefixedKey, ttl);
        timeToExpire = ttl;
      }

      if (totalHits > limit) {
        await this.redis.set(blockKey, '1', 'PX', blockDuration);
        return {
          totalHits,
          timeToExpire,
          isBlocked: true,
          timeToBlockExpire: blockDuration,
        };
      }

      return {
        totalHits,
        timeToExpire,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch {
      return {
        totalHits: 0,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}

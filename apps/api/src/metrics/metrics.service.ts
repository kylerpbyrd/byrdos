import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import {
  getMetricsText,
  queueDepthGauge,
  syncCursorFreshnessRatioGauge,
  syncSuccessRatioGauge,
} from '@byrdos/observability';
import { db, providerConnections, syncCursors, syncJobs } from '@byrdos/db';
import { QUEUES } from '@byrdos/queue';

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const MONITORED_QUEUES = [
  QUEUES.SYNC,
  QUEUES.ACCOUNTS,
  QUEUES.TRANSACTIONS,
  QUEUES.WEBHOOKS,
  QUEUES.OUTBOX,
  QUEUES.SYNC_DEAD,
] as const;

const QUEUE_STATES = ['waiting', 'active', 'failed', 'delayed'] as const;

@Injectable()
export class MetricsService {
  async getMetricsText(): Promise<string> {
    await this.refreshGauges();
    return getMetricsText();
  }

  private async refreshGauges(): Promise<void> {
    await Promise.all([
      this.refreshCursorFreshnessRatio(),
      this.refreshSuccessRatio(),
      this.refreshQueueDepths(),
    ]);
  }

  private async refreshCursorFreshnessRatio(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [activeRows] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(providerConnections)
      .where(eq(providerConnections.status, 'active'));

    const totalActive = activeRows?.count ?? 0;

    if (totalActive === 0) {
      syncCursorFreshnessRatioGauge.set(0);
      return;
    }

    const [freshRows] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(providerConnections)
      .innerJoin(syncCursors, eq(providerConnections.id, syncCursors.connectionId))
      .where(
        and(
          eq(providerConnections.status, 'active'),
          eq(syncCursors.resourceType, 'transactions'),
          gte(syncCursors.updatedAt, cutoff),
        ),
      );

    const freshCount = freshRows?.count ?? 0;
    syncCursorFreshnessRatioGauge.set(freshCount / totalActive);
  }

  private async refreshSuccessRatio(): Promise<void> {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);

    const rows = await db
      .select({ status: syncJobs.status, count: sql<number>`count(*)::int` })
      .from(syncJobs)
      .where(and(gte(syncJobs.finishedAt, cutoff), inArray(syncJobs.status, ['completed', 'failed'])))
      .groupBy(syncJobs.status);

    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.status, row.count);
    }

    const completed = counts.get('completed') ?? 0;
    const failed = counts.get('failed') ?? 0;
    const terminal = completed + failed;

    syncSuccessRatioGauge.set(terminal === 0 ? 1 : completed / terminal);
  }

  private async refreshQueueDepths(): Promise<void> {
    const queues = MONITORED_QUEUES.map((name) => new Queue(name, { connection: redisConnection }));

    try {
      await Promise.all(
        queues.map(async (queue) => {
          const counts = await queue.getJobCounts(...QUEUE_STATES);
          for (const state of QUEUE_STATES) {
            const value = counts[state] ?? 0;
            queueDepthGauge.set({ queue: queue.name, state }, value);
          }
        }),
      );
    } finally {
      await Promise.all(queues.map((queue) => queue.close()));
    }
  }
}

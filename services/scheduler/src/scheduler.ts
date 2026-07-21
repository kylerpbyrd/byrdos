import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, integrations, providerConnections } from '@byrdos/db';
import { QUEUES, type SyncJobData } from '@byrdos/queue';
import { connection } from './redis.js';

export class Scheduler {
  private syncQueue: Queue<SyncJobData>;

  constructor() {
    this.syncQueue = new Queue<SyncJobData>(QUEUES.SYNC, { connection });
  }

  /**
   * Enqueue incremental sync for all active connections (every 4 hours).
   */
  async enqueueScheduledSyncs(): Promise<number> {
    const conns = await db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.status, 'active'));

    let count = 0;
    for (const conn of conns) {
      const intRows = await db
        .select()
        .from(integrations)
        .where(eq(integrations.id, conn.integrationId))
        .limit(1);

      if (intRows.length === 0) continue;

      const integration = intRows[0];
      await this.syncQueue.add(`scheduled-${conn.id}`, {
        connectionId: conn.id,
        integrationId: conn.integrationId,
        userId: integration.userId,
        providerId: integration.providerId,
        trigger: 'incremental',
      });

      count++;
    }

    return count;
  }

  /**
   * Balance fast-lane: light balance-only sync every 30 minutes.
   * For now, this enqueues a full sync — will be optimized in M4.
   */
  async enqueueBalanceFastlane(): Promise<number> {
    return this.enqueueScheduledSyncs();
  }

  /**
   * Check dead-letter queue and emit alerts for stuck jobs.
   */
  async checkDeadLetterQueue(): Promise<void> {
    const deadQueue = new Queue(QUEUES.SYNC_DEAD, { connection });
    const waiting = await deadQueue.getWaitingCount();

    if (waiting > 0) {
      console.warn(`[ALERT] ${waiting} jobs stuck in dead-letter queue`);
      // In production: emit to monitoring/alerting system
    }
  }
}

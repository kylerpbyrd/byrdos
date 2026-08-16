import { Queue } from 'bullmq';
import { eq, lt } from 'drizzle-orm';
import { createLogger, sendAlert } from '@byrdos/observability';
import { db, integrations, providerConnections, transactions } from '@byrdos/db';
import { QUEUES, type SyncJobData } from '@byrdos/queue';
import { connection } from './redis.js';

const logger = createLogger('scheduler');

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
   *
   * TODO: Implement a balance-only fast-lane path. Currently balances refresh
   * via the 4-hour scheduled sync and webhook/on-demand triggers.
   */
  async enqueueBalanceFastlane(): Promise<number> {
    return 0;
  }

  /**
   * Null out heavy raw provider payloads older than 90 days.
   * Returns the number of affected transaction rows.
   */
  async retentionPurge(): Promise<number> {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const updated = await db
      .update(transactions)
      .set({ raw: null })
      .where(lt(transactions.createdAt, cutoff))
      .returning({ id: transactions.id });

    return updated.length;
  }

  /**
   * Check dead-letter queue and emit alerts for stuck jobs.
   */
  async checkDeadLetterQueue(): Promise<void> {
    const deadQueue = new Queue(QUEUES.SYNC_DEAD, { connection });
    const waiting = await deadQueue.getWaitingCount();

    if (waiting > 0) {
      logger.warn(`[ALERT] ${waiting} jobs stuck in dead-letter queue`);
      await sendAlert(`${waiting} jobs stuck in dead-letter queue`);
    }
  }
}

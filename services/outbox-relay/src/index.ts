import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { QUEUES } from '@byrdos/queue';
import { db, eventLog } from '@byrdos/db';
import { eq, and, asc } from 'drizzle-orm';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

async function main() {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const outboxQueue = new Queue(QUEUES.OUTBOX, { connection });

  console.log('[outbox-relay] Polling for pending events...');

  // Poll every 5 seconds for pending events
  setInterval(async () => {
    try {
      const pending = await db
        .select()
        .from(eventLog)
        .where(and(eq(eventLog.status, 'pending')))
        .orderBy(asc(eventLog.occurredAt))
        .limit(10);

      for (const event of pending) {
        // Mark as processing
        await db
          .update(eventLog)
          .set({ status: 'processing', attempts: (event.attempts ?? 0) + 1 })
          .where(eq(eventLog.id, event.id));

        // Emit to outbox queue for downstream consumers
        await outboxQueue.add(event.eventType, {
          eventId: event.id,
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          payload: event.payload,
        });

        // Mark as delivered
        await db
          .update(eventLog)
          .set({ status: 'delivered', processedAt: new Date() })
          .where(eq(eventLog.id, event.id));
      }
    } catch (err) {
      console.error('[outbox-relay] Error polling events:', err);
    }
  }, 5000);

  console.log('[outbox-relay] Running — press Ctrl+C to stop');
}

main().catch(console.error);

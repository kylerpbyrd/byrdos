import { FlowProducer } from 'bullmq';
import { connection } from './redis.js';
import { QUEUES, ACCOUNTS_JOB, TRANSACTIONS_JOB, DEFAULT_RETRY } from '@byrdos/queue';
import type { SyncJobData, AccountsJobData, TransactionsJobData } from '@byrdos/queue';
import { db, syncJobs } from '@byrdos/db';
import { v7 as uuidv7 } from 'uuid';
import { eq } from 'drizzle-orm';

const flowProducer = new FlowProducer({ connection });

export class SyncOrchestrator {
  async startSync(data: SyncJobData): Promise<string> {
    const syncJobId = uuidv7();

    // Create sync job record
    await db.insert(syncJobs).values({
      id: syncJobId,
      connectionId: data.connectionId,
      type: data.trigger === 'initial' ? 'initial' : 'incremental',
      status: 'running',
      trigger: data.trigger,
      startedAt: new Date(),
    });

    // Stage 1: Accounts first, then Transactions (FlowProducer dependency)
    const accountsJob: AccountsJobData = {
      syncJobId,
      connectionId: data.connectionId,
      integrationId: data.integrationId,
      providerId: data.providerId,
      userId: data.userId,
    };

    const transactionsJob: TransactionsJobData = {
      syncJobId,
      connectionId: data.connectionId,
      integrationId: data.integrationId,
      providerId: data.providerId,
      userId: data.userId,
      cursor: null, // Will be loaded from DB by the worker
      startDate: data.dateRange?.start,
    };

    await flowProducer.add({
      name: `sync-${syncJobId}`,
      queueName: QUEUES.SYNC,
      data: { syncJobId },
      children: [
        {
          name: `${ACCOUNTS_JOB}-${syncJobId}`,
          queueName: QUEUES.ACCOUNTS,
          data: accountsJob,
          opts: DEFAULT_RETRY,
        },
        {
          name: `${TRANSACTIONS_JOB}-${syncJobId}`,
          queueName: QUEUES.TRANSACTIONS,
          data: transactionsJob,
          opts: DEFAULT_RETRY,
        },
      ],
      opts: DEFAULT_RETRY,
    });

    return syncJobId;
  }

  async markComplete(syncJobId: string): Promise<void> {
    await db
      .update(syncJobs)
      .set({ status: 'completed', finishedAt: new Date() })
      .where(eq(syncJobs.id, syncJobId));
  }

  async markFailed(syncJobId: string, error: string): Promise<void> {
    await db
      .update(syncJobs)
      .set({ status: 'failed', error, finishedAt: new Date() })
      .where(eq(syncJobs.id, syncJobId));
  }
}

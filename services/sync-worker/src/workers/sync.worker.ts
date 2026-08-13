import { Worker, FlowProducer } from 'bullmq';
import { connection } from '../redis.js';
import {
  QUEUES,
  ACCOUNTS_JOB,
  TRANSACTIONS_JOB,
  DEFAULT_RETRY,
} from '@byrdos/queue';
import type {
  SyncJobData,
  AccountsJobData,
  TransactionsJobData,
} from '@byrdos/queue';
import { db, syncJobs } from '@byrdos/db';
import { v7 as uuidv7 } from 'uuid';

export function createSyncWorker(): Worker<SyncJobData> {
  const flowProducer = new FlowProducer({ connection });

  return new Worker<SyncJobData>(
    QUEUES.SYNC,
    async (job) => {
      const data = job.data;
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

      // Accounts runs first; transactions waits for accounts to complete
      await flowProducer.add({
        name: `${ACCOUNTS_JOB}-${syncJobId}`,
        queueName: QUEUES.ACCOUNTS,
        data: accountsJob,
        opts: DEFAULT_RETRY,
        children: [
          {
            name: `${TRANSACTIONS_JOB}-${syncJobId}`,
            queueName: QUEUES.TRANSACTIONS,
            data: transactionsJob,
            opts: DEFAULT_RETRY,
          },
        ],
      });

      return { syncJobId };
    },
    { connection, concurrency: 5 },
  );
}

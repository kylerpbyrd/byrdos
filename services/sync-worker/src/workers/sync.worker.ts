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
import { getTracer, injectTraceContext } from '@byrdos/observability';

export function createSyncWorker(): Worker<SyncJobData> {
  const flowProducer = new FlowProducer({ connection });

  return new Worker<SyncJobData>(
    QUEUES.SYNC,
    async (job) => {
      const data = job.data;
      const syncJobId = uuidv7();

      const span = getTracer().startSpan('sync.orchestrate', {
        attributes: {
          syncJobId,
          providerConnectionId: data.connectionId,
          integrationId: data.integrationId,
          userId: data.userId,
          stage: 'orchestrate',
          'sync.initial': data.trigger === 'initial',
          'sync.trigger': data.trigger,
        },
      });

      try {
        // Create sync job record
        await db.insert(syncJobs).values({
          id: syncJobId,
          connectionId: data.connectionId,
          type: data.trigger === 'initial' ? 'initial' : 'incremental',
          status: 'running',
          trigger: data.trigger,
          startedAt: new Date(),
        });

        const traceContext = injectTraceContext(span);

        const accountsJob: AccountsJobData = {
          syncJobId,
          connectionId: data.connectionId,
          integrationId: data.integrationId,
          providerId: data.providerId,
          userId: data.userId,
          traceContext,
        };

        const transactionsJob: TransactionsJobData = {
          syncJobId,
          connectionId: data.connectionId,
          integrationId: data.integrationId,
          providerId: data.providerId,
          userId: data.userId,
          cursor: null, // Will be loaded from DB by the worker
          startDate: data.dateRange?.start,
          traceContext,
        };

        // Accounts must run before transactions (children complete before parent)
        await flowProducer.add({
          name: `${TRANSACTIONS_JOB}-${syncJobId}`,
          queueName: QUEUES.TRANSACTIONS,
          data: transactionsJob,
          opts: DEFAULT_RETRY,
          children: [
            {
              name: `${ACCOUNTS_JOB}-${syncJobId}`,
              queueName: QUEUES.ACCOUNTS,
              data: accountsJob,
              opts: DEFAULT_RETRY,
            },
          ],
        });

        span.setStatus('OK');

        return { syncJobId };
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus('ERROR');
        throw err;
      } finally {
        span.end();
      }
    },
    { connection, concurrency: 5 },
  );
}

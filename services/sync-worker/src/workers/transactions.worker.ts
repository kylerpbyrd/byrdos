import { Worker } from 'bullmq';
import { connection } from '../redis.js';
import { QUEUES, type TransactionsJobData } from '@byrdos/queue';
import { db, transactions, syncCursors, accounts, DrizzleCredentialRepository } from '@byrdos/db';
import { createProviderRegistry } from '@byrdos/provider-sdk';
import { CredentialService } from '@byrdos/auth';
import { v7 as uuidv7 } from 'uuid';
import { eq, and, inArray, sql } from 'drizzle-orm';
import type { ProviderConnection, ProviderId } from '@byrdos/contracts';
import {
  markSyncJobComplete,
  markSyncJobFailed,
} from '../sync-job-status.js';

export function createTransactionsWorker(): Worker<TransactionsJobData> {
  const worker = new Worker<TransactionsJobData>(
    QUEUES.TRANSACTIONS,
    async (job) => {
      const { syncJobId, connectionId, integrationId } = job.data;

      // Get decrypted access token
      const credentialRepo = new DrizzleCredentialRepository(db);
      const credService = new CredentialService(credentialRepo);
      const credential = await credentialRepo.findByIntegrationId(integrationId);
      if (!credential) {
        throw new Error(`No credential for integration ${integrationId}`);
      }
      const accessToken = await credService.getToken(credential.id);

      // Load cursor
      const cursorRows = await db
        .select()
        .from(syncCursors)
        .where(eq(syncCursors.connectionId, connectionId));
      const txnCursor = cursorRows.find((c) => c.resourceType === 'transactions');

      // Resolve account external IDs to local account IDs
      const accountRows = await db
        .select({ id: accounts.id, externalId: accounts.externalId })
        .from(accounts)
        .where(eq(accounts.connectionId, connectionId));
      const accountMap = new Map(accountRows.map((a) => [a.externalId, a.id]));
      const accountIdsForConnection = accountRows.map((a) => a.id);

      const adapter = createProviderRegistry().get(job.data.providerId as ProviderId);

      let count = 0;
      const batchTxIds: string[] = [];
      let finalCursor: string | null = null;

      const connectionStub: ProviderConnection & { __accessToken: string } = {
        id: connectionId,
        integrationId,
        externalId: '',
        providerId: 'plaid',
        institutionName: null,
        status: 'active',
        lastWebhookAt: null,
        createdAt: new Date().toISOString(),
        __accessToken: accessToken,
      };

      const iterable = adapter.listTransactions(
        connectionStub,
        {
          resourceType: 'transactions',
          cursor: txnCursor?.cursor || '',
          updatedAt: new Date().toISOString(),
        },
        {
          start: job.data.startDate || '2024-01-01',
          end: new Date().toISOString().split('T')[0],
        },
      );

      for await (const batch of iterable) {
        const upsertTxns = [...batch.added, ...batch.modified];

        if (upsertTxns.length > 0) {
          await db
            .insert(transactions)
            .values(
              upsertTxns.map((pt) => {
                const accountId = accountMap.get(pt.accountExternalId);
                if (!accountId) {
                  throw new Error(
                    `No local account found for external account ${pt.accountExternalId}`,
                  );
                }
                const txId = uuidv7();
                if (batch.added.includes(pt)) {
                  batchTxIds.push(txId);
                }
                return {
                  id: txId,
                  accountId,
                  externalId: pt.externalId,
                  amountCents: pt.amount,
                  date: pt.date,
                  authorizedDate: pt.authorizedDate,
                  name: pt.name,
                  merchantName: pt.merchantName,
                  pending: pt.pending,
                  pendingTransactionExternalId: pt.pendingTransactionExternalId,
                  paymentChannel: pt.paymentChannel,
                  isoCurrencyCode: pt.isoCurrencyCode,
                  raw: pt.raw,
                  categoryHash:
                    pt.category && pt.category.length > 0
                      ? pt.category.join('|').toLowerCase()
                      : null,
                };
              }),
            )
            .onConflictDoUpdate({
              target: [transactions.accountId, transactions.externalId],
              set: {
                amountCents: sql`excluded.amount_cents`,
                date: sql`excluded.date`,
                authorizedDate: sql`excluded.authorized_date`,
                name: sql`excluded.name`,
                merchantName: sql`excluded.merchant_name`,
                pending: sql`excluded.pending`,
                pendingTransactionExternalId: sql`excluded.pending_transaction_external_id`,
                paymentChannel: sql`excluded.payment_channel`,
                isoCurrencyCode: sql`excluded.iso_currency_code`,
                raw: sql`excluded.raw`,
                categoryHash: sql`excluded.category_hash`,
              },
            });
        }

        if (batch.removed.length > 0) {
          await db
            .delete(transactions)
            .where(
              and(
                inArray(transactions.externalId, batch.removed),
                inArray(transactions.accountId, accountIdsForConnection),
              ),
            );
        }

        count += upsertTxns.length;

        // Update progress every 100 transactions
        if (count % 100 === 0) {
          await job.updateProgress(count);
        }

        if (batch.nextCursor !== null) {
          finalCursor = batch.nextCursor;
        }
      }

      // Persist the final cursor for incremental syncs
      if (txnCursor) {
        await db
          .update(syncCursors)
          .set({ cursor: finalCursor ?? '', updatedAt: new Date() })
          .where(eq(syncCursors.id, txnCursor.id));
      } else {
        await db.insert(syncCursors).values({
          id: uuidv7(),
          connectionId,
          resourceType: 'transactions',
          cursor: finalCursor ?? '',
        });
      }

      // Classification is stubbed for v3 AI feature
      void batchTxIds;

      await markSyncJobComplete(syncJobId);

      await job.updateProgress(100);
      return { syncJobId, transactionsCount: count };
    },
    { connection, concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    if (!job) return;
    if (job.attemptsMade >= (job.opts.attempts ?? 1) - 1) {
      void markSyncJobFailed(job.data.syncJobId, err.message);
    }
  });

  return worker;
}

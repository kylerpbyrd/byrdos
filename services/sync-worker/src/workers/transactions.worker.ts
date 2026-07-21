import { Worker } from 'bullmq';
import { connection } from '../redis.js';
import { QUEUES, type TransactionsJobData } from '@byrdos/queue';
import { db, transactions, syncCursors, accounts, DrizzleCredentialRepository } from '@byrdos/db';
import { PlaidAdapter } from '@byrdos/provider-sdk';
import { CredentialService } from '@byrdos/auth';
import { v7 as uuidv7 } from 'uuid';
import { eq } from 'drizzle-orm';
import type { ProviderConnection } from '@byrdos/contracts';

export function createTransactionsWorker(): Worker<TransactionsJobData> {
  return new Worker<TransactionsJobData>(
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

      const adapter = new PlaidAdapter({
        clientId: process.env.PLAID_CLIENT_ID || '',
        secret: process.env.PLAID_SECRET || '',
        environment:
          (process.env.PLAID_ENV as 'sandbox' | 'development' | 'production') || 'sandbox',
        webhookVerificationKey: process.env.PLAID_WEBHOOK_KEY || '',
      });

      let count = 0;
      const batchTxIds: string[] = [];

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

      for await (const pt of iterable) {
        const accountId = accountMap.get(pt.accountExternalId);
        if (!accountId) {
          throw new Error(`No local account found for external account ${pt.accountExternalId}`);
        }

        const txId = uuidv7();
        await db
          .insert(transactions)
          .values({
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
          })
          .onConflictDoNothing({ target: [transactions.externalId, transactions.accountId] });

        count++;
        batchTxIds.push(txId);

        // Update progress every 100 transactions
        if (count % 100 === 0) {
          await job.updateProgress(count);
        }
      }

      // Update cursor (empty for M3; final cursor should be captured from adapter in v2)
      const newCursor = '';
      if (txnCursor) {
        await db
          .update(syncCursors)
          .set({ cursor: newCursor, updatedAt: new Date() })
          .where(eq(syncCursors.id, txnCursor.id));
      } else {
        await db.insert(syncCursors).values({
          id: uuidv7(),
          connectionId,
          resourceType: 'transactions',
          cursor: newCursor,
        });
      }

      // Classification is stubbed for v3 AI feature
      void batchTxIds;

      await job.updateProgress(100);
      return { syncJobId, transactionsCount: count };
    },
    { connection, concurrency: 5 },
  );
}

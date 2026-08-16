import { Queue, Worker } from 'bullmq';
import { connection } from '../redis.js';
import { QUEUES, type AccountsJobData } from '@byrdos/queue';
import {
  db,
  accounts,
  balances,
  providerConnections,
  DrizzleCredentialRepository,
} from '@byrdos/db';
import { createProviderRegistry, ProviderError } from '@byrdos/provider-sdk';
import { CredentialService } from '@byrdos/auth';
import { v7 as uuidv7 } from 'uuid';
import { eq } from 'drizzle-orm';
import type { ProviderConnection, ProviderId } from '@byrdos/contracts';
import { markSyncJobFailed } from '../sync-job-status.js';
import {
  extractTraceContext,
  getTracer,
} from '@byrdos/observability';

export function createAccountsWorker(): Worker<AccountsJobData> {
  const worker = new Worker<AccountsJobData>(
    QUEUES.ACCOUNTS,
    async (job) => {
      const { syncJobId, connectionId, integrationId, userId } = job.data;

      const parentContext = extractTraceContext(job.data.traceContext);
      const span = getTracer().startSpan('sync.accounts', {
        parentContext,
        attributes: {
          syncJobId,
          providerConnectionId: connectionId,
          integrationId,
          userId,
          stage: 'accounts',
        },
      });

      try {
        // Get decrypted access token
        const credentialRepo = new DrizzleCredentialRepository(db);
        const credService = new CredentialService(credentialRepo);
        const credential = await credentialRepo.findByIntegrationId(integrationId);

        if (!credential) {
          throw new Error(`No credential found for integration ${integrationId}`);
        }

        const accessToken = await credService.getToken(credential.id);

        // Create adapter
        const adapter = createProviderRegistry().get(job.data.providerId as ProviderId);

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

        // Fetch accounts
        let providerAccounts;
        const latencyStart = performance.now();
        try {
          providerAccounts = await adapter.listAccounts(connectionStub);
        } catch (err) {
          if (
            err instanceof ProviderError &&
            err.code === 'reauth_required'
          ) {
            await db
              .update(providerConnections)
              .set({ status: 'pending_reconnect', updatedAt: new Date() })
              .where(eq(providerConnections.id, connectionId));
          }
          throw err;
        }
        const providerLatencyMs = performance.now() - latencyStart;

        span.setAttribute('provider.latency.ms', providerLatencyMs);
        span.setAttribute('account.count', providerAccounts.length);

        // Upsert accounts and balances
        for (const pa of providerAccounts) {
          const [upserted] = await db
            .insert(accounts)
            .values({
              id: uuidv7(),
              connectionId,
              externalId: pa.externalId,
              mask: pa.mask,
              name: pa.name,
              officialName: pa.officialName,
              type: pa.type,
              subtype: pa.subtype,
              currentBalanceCents: pa.balanceCurrent,
              availableBalanceCents: pa.balanceAvailable,
              balanceLimitCents: pa.balanceLimit,
              currency: pa.currency,
              status: 'active',
            })
            .onConflictDoUpdate({
              target: [accounts.connectionId, accounts.externalId],
              set: {
                name: pa.name,
                officialName: pa.officialName,
                type: pa.type,
                subtype: pa.subtype,
                currentBalanceCents: pa.balanceCurrent,
                availableBalanceCents: pa.balanceAvailable,
                balanceLimitCents: pa.balanceLimit,
                currency: pa.currency,
                updatedAt: new Date(),
              },
            })
            .returning({ id: accounts.id });

          const accountId = upserted?.id;
          if (!accountId) {
            throw new Error(
              `Failed to upsert account ${pa.externalId} for connection ${connectionId}`,
            );
          }

          // Record balance snapshot
          await db.insert(balances).values({
            id: uuidv7(),
            accountId,
            current: pa.balanceCurrent,
            available: pa.balanceAvailable,
            limit: pa.balanceLimit,
            currency: pa.currency,
            recordedAt: new Date(),
          });
        }

        span.setStatus('OK');

        await job.updateProgress(100);
        return { syncJobId, accountsCount: providerAccounts.length };
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

  worker.on('failed', (job, err) => {
    if (!job) return;
    if (job.attemptsMade >= (job.opts.attempts ?? 1) - 1) {
      const outcome =
        err instanceof ProviderError && err.code === 'reauth_required'
          ? 'reauth_required'
          : 'failed';
      void (async () => {
        const transitioned = await markSyncJobFailed(job.data.syncJobId, err.message, outcome);
        if (transitioned) {
          const deadQueue = new Queue(QUEUES.SYNC_DEAD, { connection });
          await deadQueue.add(`dead-${job.data.syncJobId}`, job.data);
        }
      })();
    }
  });

  return worker;
}

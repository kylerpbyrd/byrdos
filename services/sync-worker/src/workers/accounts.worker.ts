import { Worker } from 'bullmq';
import { connection } from '../redis.js';
import { QUEUES, type AccountsJobData } from '@byrdos/queue';
import { db, accounts, balances, DrizzleCredentialRepository } from '@byrdos/db';
import { PlaidAdapter } from '@byrdos/provider-sdk';
import { CredentialService } from '@byrdos/auth';
import { v7 as uuidv7 } from 'uuid';
import type { ProviderConnection } from '@byrdos/contracts';

export function createAccountsWorker(): Worker<AccountsJobData> {
  return new Worker<AccountsJobData>(
    QUEUES.ACCOUNTS,
    async (job) => {
      const { syncJobId, connectionId, integrationId } = job.data;

      // Get decrypted access token
      const credentialRepo = new DrizzleCredentialRepository(db);
      const credService = new CredentialService(credentialRepo);
      const credential = await credentialRepo.findByIntegrationId(integrationId);

      if (!credential) {
        throw new Error(`No credential found for integration ${integrationId}`);
      }

      const accessToken = await credService.getToken(credential.id);

      // Create adapter
      const adapter = new PlaidAdapter({
        clientId: process.env.PLAID_CLIENT_ID || '',
        secret: process.env.PLAID_SECRET || '',
        environment:
          (process.env.PLAID_ENV as 'sandbox' | 'development' | 'production') || 'sandbox',
        webhookVerificationKey: process.env.PLAID_WEBHOOK_KEY || '',
      });

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
      const providerAccounts = await adapter.listAccounts(connectionStub);

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

      await job.updateProgress(100);
      return { syncJobId, accountsCount: providerAccounts.length };
    },
    { connection, concurrency: 5 },
  );
}

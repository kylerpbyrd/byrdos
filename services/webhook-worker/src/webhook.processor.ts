import { Worker } from 'bullmq';
import { QUEUES, type WebhookJobData, type SyncJobData } from '@byrdos/queue';
import { PlaidAdapter } from '@byrdos/provider-sdk';
import type { ProviderId } from '@byrdos/contracts';
import { syncQueue } from './queues.js';
import { connection } from './redis.js';

export function createWebhookWorker(): Worker<WebhookJobData> {
  return new Worker<WebhookJobData>(
    QUEUES.WEBHOOKS,
    async (job) => {
      const { providerId, webhookType, webhookCode, payload, signature } = job.data;

      const adapter = new PlaidAdapter({
        clientId: process.env.PLAID_CLIENT_ID || '',
        secret: process.env.PLAID_SECRET || '',
        environment:
          (process.env.PLAID_ENV as 'sandbox' | 'development' | 'production') ||
          'sandbox',
        webhookVerificationKey: process.env.PLAID_WEBHOOK_KEY || '',
      });

      const result = await adapter.handleWebhook({
        providerId: providerId as ProviderId,
        payload,
        signature,
        webhookType,
        webhookCode,
      });

      // If sync is needed, enqueue sync job
      if (result.action === 'sync_triggered') {
        // Extract connection info from webhook payload
        const itemId =
          typeof payload.item_id === 'string' ? payload.item_id : undefined;
        if (itemId) {
          // Look up the connection by externalId (item_id)
          const { providerConnections, integrations, db } = await import('@byrdos/db');
          const { eq } = await import('drizzle-orm');

          const connRows = await db
            .select()
            .from(providerConnections)
            .where(eq(providerConnections.externalId, itemId))
            .limit(1);

          if (connRows.length > 0) {
            const conn = connRows[0];
            const intRows = await db
              .select()
              .from(integrations)
              .where(eq(integrations.id, conn.integrationId))
              .limit(1);

            if (intRows.length > 0) {
              const syncData: SyncJobData = {
                connectionId: conn.id,
                integrationId: conn.integrationId,
                userId: intRows[0].userId,
                providerId: intRows[0].providerId as ProviderId,
                trigger: 'webhook',
              };
              await syncQueue.add(`webhook-${webhookCode}`, syncData);
            }
          }
        }
      }

      return { action: result.action, message: result.message };
    },
    { connection, concurrency: 5 },
  );
}

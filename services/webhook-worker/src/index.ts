import { createLogger } from '@byrdos/observability';
import { createWebhookWorker } from './webhook.processor.js';

const logger = createLogger('webhook-worker');

async function main() {
  logger.info('Starting webhook worker...');
  const worker = createWebhookWorker();
  logger.info(`Webhook worker: ${worker.name}`);

  process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    await worker.close();
    process.exit(0);
  });
}

main().catch((err) => logger.error(err));

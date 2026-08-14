import { createLogger } from '@byrdos/observability';
import { Scheduler } from './scheduler.js';

const logger = createLogger('scheduler');

async function main() {
  logger.info('Starting scheduler...');
  const scheduler = new Scheduler();

  // Run immediately on startup, then on interval
  logger.info('Running initial scheduled sync...');
  const count = await scheduler.enqueueScheduledSyncs();
  logger.info(`Enqueued ${count} sync jobs`);

  // Every 4 hours: scheduled sync
  setInterval(async () => {
    logger.info('Running scheduled sync...');
    const c = await scheduler.enqueueScheduledSyncs();
    logger.info(`Enqueued ${c} sync jobs`);
  }, 4 * 60 * 60 * 1000);

  // Every 30 minutes: balance fast-lane
  setInterval(async () => {
    logger.info('Running balance fast-lane...');
    const c = await scheduler.enqueueBalanceFastlane();
    logger.info(`Enqueued ${c} balance syncs`);
  }, 30 * 60 * 1000);

  // Every 30 minutes: DLQ check
  setInterval(async () => {
    await scheduler.checkDeadLetterQueue();
  }, 30 * 60 * 1000);

  process.on('SIGTERM', () => {
    logger.info('Scheduler shutting down...');
    process.exit(0);
  });
}

main().catch((err) => logger.error(err));

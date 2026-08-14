import { createLogger } from '@byrdos/observability';
import {
  createAccountsWorker,
  createTransactionsWorker,
  createSyncWorker,
} from './workers/index.js';

const logger = createLogger('sync-worker');

async function main() {
  logger.info('Starting sync worker...');

  const syncWorker = createSyncWorker();
  const accountsWorker = createAccountsWorker();
  const transactionsWorker = createTransactionsWorker();

  logger.info(`Sync worker: ${syncWorker.name}`);
  logger.info(`Accounts worker: ${accountsWorker.name}`);
  logger.info(`Transactions worker: ${transactionsWorker.name}`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('Shutting down workers...');
    await syncWorker.close();
    await accountsWorker.close();
    await transactionsWorker.close();
    process.exit(0);
  });
}

main().catch((err) => logger.error(err));

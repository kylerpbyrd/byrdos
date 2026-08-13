import {
  createAccountsWorker,
  createTransactionsWorker,
  createSyncWorker,
} from './workers/index.js';

async function main() {
  console.log('Starting sync worker...');

  const syncWorker = createSyncWorker();
  const accountsWorker = createAccountsWorker();
  const transactionsWorker = createTransactionsWorker();

  console.log(`Sync worker: ${syncWorker.name}`);
  console.log(`Accounts worker: ${accountsWorker.name}`);
  console.log(`Transactions worker: ${transactionsWorker.name}`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down workers...');
    await syncWorker.close();
    await accountsWorker.close();
    await transactionsWorker.close();
    process.exit(0);
  });
}

main().catch(console.error);

import { createAccountsWorker, createTransactionsWorker } from './workers/index.js';

async function main() {
  console.log('Starting sync worker...');

  const accountsWorker = createAccountsWorker();
  const transactionsWorker = createTransactionsWorker();

  console.log(`Accounts worker: ${accountsWorker.name}`);
  console.log(`Transactions worker: ${transactionsWorker.name}`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down workers...');
    await accountsWorker.close();
    await transactionsWorker.close();
    process.exit(0);
  });
}

main().catch(console.error);

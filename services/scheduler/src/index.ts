import { Scheduler } from './scheduler.js';

async function main() {
  console.log('Starting scheduler...');
  const scheduler = new Scheduler();

  // Run immediately on startup, then on interval
  console.log('Running initial scheduled sync...');
  const count = await scheduler.enqueueScheduledSyncs();
  console.log(`Enqueued ${count} sync jobs`);

  // Every 4 hours: scheduled sync
  setInterval(async () => {
    console.log('Running scheduled sync...');
    const c = await scheduler.enqueueScheduledSyncs();
    console.log(`Enqueued ${c} sync jobs`);
  }, 4 * 60 * 60 * 1000);

  // Every 30 minutes: balance fast-lane
  setInterval(async () => {
    console.log('Running balance fast-lane...');
    const c = await scheduler.enqueueBalanceFastlane();
    console.log(`Enqueued ${c} balance syncs`);
  }, 30 * 60 * 1000);

  // Every 30 minutes: DLQ check
  setInterval(async () => {
    await scheduler.checkDeadLetterQueue();
  }, 30 * 60 * 1000);

  process.on('SIGTERM', () => {
    console.log('Scheduler shutting down...');
    process.exit(0);
  });
}

main().catch(console.error);

import { createWebhookWorker } from './webhook.processor.js';

async function main() {
  console.log('Starting webhook worker...');
  const worker = createWebhookWorker();
  console.log(`Webhook worker: ${worker.name}`);

  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await worker.close();
    process.exit(0);
  });
}

main().catch(console.error);

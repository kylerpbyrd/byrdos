import { Queue } from 'bullmq';
import { connection } from './redis.js';
import { QUEUES } from '@byrdos/queue';
import type { SyncJobData, WebhookJobData } from '@byrdos/queue';

export const webhookQueue = new Queue<WebhookJobData>(QUEUES.WEBHOOKS, { connection });
export const syncQueue = new Queue<SyncJobData>(QUEUES.SYNC, { connection });

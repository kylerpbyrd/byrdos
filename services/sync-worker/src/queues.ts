import { Queue } from 'bullmq';
import { connection } from './redis.js';
import { QUEUES } from '@byrdos/queue';

export const syncQueue = new Queue(QUEUES.SYNC, { connection });
export const accountsQueue = new Queue(QUEUES.ACCOUNTS, { connection });
export const transactionsQueue = new Queue(QUEUES.TRANSACTIONS, { connection });
export const classifyQueue = new Queue(QUEUES.CLASSIFY, { connection });

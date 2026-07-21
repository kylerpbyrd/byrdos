import type { QueueName } from '../queue-names.js';

export interface ClassifyJobData {
  transactionIds: string[];
  userId: string;
}

export const CLASSIFY_JOB: QueueName = 'classify';

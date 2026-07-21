import type { QueueName } from '../queue-names';

export interface ClassifyJobData {
  transactionIds: string[];
  userId: string;
}

export const CLASSIFY_JOB: QueueName = 'classify';

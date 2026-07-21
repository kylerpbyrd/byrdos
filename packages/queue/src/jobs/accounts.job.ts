import type { QueueName } from '../queue-names.js';

export interface AccountsJobData {
  syncJobId: string;
  connectionId: string;
  integrationId: string;
  providerId: string;
  userId: string;
}

export const ACCOUNTS_JOB: QueueName = 'accounts';

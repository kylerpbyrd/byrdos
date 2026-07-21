import type { QueueName } from '../queue-names';

export interface TransactionsJobData {
  syncJobId: string;
  connectionId: string;
  integrationId: string;
  providerId: string;
  userId: string;
  cursor: string | null;
  /** Start date for initial sync */
  startDate?: string;
}

export const TRANSACTIONS_JOB: QueueName = 'transactions';

import type { QueueName } from '../queue-names.js';

export type SyncTrigger = 'initial' | 'incremental' | 'on_demand' | 'backfill' | 'webhook';

export interface SyncJobData {
  connectionId: string;
  integrationId: string;
  userId: string;
  providerId: string;
  trigger: SyncTrigger;
  /** Date range for backfill syncs (ISO date strings) */
  dateRange?: { start: string; end: string };
}

export const SYNC_JOB: QueueName = 'sync';

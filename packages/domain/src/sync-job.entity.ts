export type SyncJobType = 'initial' | 'incremental' | 'on_demand' | 'backfill';

export type SyncJobStatus =
  'queued' | 'running' | 'accounts_done' | 'tx_done' | 'completed' | 'failed' | 'partial';

export type SyncJobTrigger = 'initial' | 'incremental' | 'on_demand' | 'backfill' | 'webhook';

export interface SyncJob {
  readonly id: string;
  readonly connectionId: string;
  readonly type: SyncJobType;
  readonly status: SyncJobStatus;
  readonly trigger: SyncJobTrigger;
  readonly error: string | null;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly createdAt: Date;
}

import { db, syncJobs } from '@byrdos/db';
import { and, eq, inArray } from 'drizzle-orm';
import { getTracer } from '@byrdos/observability';

const ACTIVE_STATUSES = ['queued', 'running', 'accounts_done', 'tx_done'];

export async function markSyncJobComplete(syncJobId: string): Promise<void> {
  const [row] = await db
    .update(syncJobs)
    .set({ status: 'completed', finishedAt: new Date() })
    .where(
      and(
        eq(syncJobs.id, syncJobId),
        inArray(syncJobs.status, ACTIVE_STATUSES),
      ),
    )
    .returning({ startedAt: syncJobs.startedAt });

  if (!row?.startedAt) {
    return;
  }

  emitSyncJobSpan({
    syncJobId,
    startedAt: row.startedAt,
    outcome: 'completed',
    error: undefined,
  });
}

export async function markSyncJobFailed(
  syncJobId: string,
  error: string,
  outcome: 'failed' | 'reauth_required' = 'failed',
): Promise<boolean> {
  const [row] = await db
    .update(syncJobs)
    .set({ status: 'failed', error, finishedAt: new Date() })
    .where(
      and(
        eq(syncJobs.id, syncJobId),
        inArray(syncJobs.status, ACTIVE_STATUSES),
      ),
    )
    .returning({ startedAt: syncJobs.startedAt });

  if (!row?.startedAt) {
    return false;
  }

  emitSyncJobSpan({
    syncJobId,
    startedAt: row.startedAt,
    outcome,
    error,
  });

  return true;
}

interface EmitSyncJobSpanOptions {
  syncJobId: string;
  startedAt: Date;
  outcome: 'completed' | 'failed' | 'reauth_required';
  error?: string;
}

function emitSyncJobSpan(options: EmitSyncJobSpanOptions): void {
  const { syncJobId, startedAt, outcome, error } = options;
  const finishedAt = Date.now();
  const durationMs = finishedAt - startedAt.getTime();

  const span = getTracer().startSpan('sync.job', {
    startTime: startedAt.getTime(),
    attributes: {
      syncJobId,
      stage: 'job',
      outcome,
      'duration.ms': durationMs,
    },
  });

  if (error !== undefined) {
    span.recordException(new Error(error));
    span.setStatus('ERROR');
  } else {
    span.setStatus('OK');
  }

  span.end(finishedAt);
}

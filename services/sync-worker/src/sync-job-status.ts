import { db, syncJobs } from '@byrdos/db';
import { eq } from 'drizzle-orm';

export async function markSyncJobComplete(syncJobId: string): Promise<void> {
  await db
    .update(syncJobs)
    .set({ status: 'completed', finishedAt: new Date() })
    .where(eq(syncJobs.id, syncJobId));
}

export async function markSyncJobFailed(
  syncJobId: string,
  error: string,
): Promise<void> {
  await db
    .update(syncJobs)
    .set({ status: 'failed', error, finishedAt: new Date() })
    .where(eq(syncJobs.id, syncJobId));
}

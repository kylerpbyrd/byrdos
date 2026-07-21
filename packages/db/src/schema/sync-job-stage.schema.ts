import { pgTable, integer, text, varchar, index } from 'drizzle-orm/pg-core';
import { syncJobs } from './sync-job.schema.js';

export const syncJobStages = pgTable(
  'sync_job_stages',
  {
    id: text('id').primaryKey(), // UUID v7
    jobId: text('job_id')
      .notNull()
      .references(() => syncJobs.id, { onDelete: 'cascade' }),
    stage: varchar('stage', { length: 20 }).notNull(), // 'accounts' | 'transactions' | 'classify'
    status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'running' | 'completed' | 'failed'
    attempts: integer('attempts').notNull().default(0),
    detail: text('detail'), // error message or progress info
  },
  (table) => [index('sync_job_stages_job_id_idx').on(table.jobId)],
);

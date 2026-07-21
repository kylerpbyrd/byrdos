import { z } from 'zod';

export const TransactionsSyncedEventSchema = z.object({
  type: z.literal('TransactionsSynced'),
  aggregateId: z.string(), // connectionId
  data: z.object({
    connectionId: z.string(),
    integrationId: z.string(),
    userId: z.string(),
    accountId: z.string(),
    transactionCount: z.number().int().nonnegative(),
    cursor: z.string(),
    added: z.number().int().nonnegative(),
    modified: z.number().int().nonnegative(),
    removed: z.number().int().nonnegative(),
  }),
  occurredAt: z.string().datetime(),
});
export type TransactionsSyncedEvent = z.infer<typeof TransactionsSyncedEventSchema>;

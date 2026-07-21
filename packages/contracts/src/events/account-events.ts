import { z } from 'zod';

export const AccountsSyncedEventSchema = z.object({
  type: z.literal('AccountsSynced'),
  aggregateId: z.string(), // connectionId
  data: z.object({
    connectionId: z.string(),
    integrationId: z.string(),
    userId: z.string(),
    accountCount: z.number().int().nonnegative(),
    accounts: z.array(
      z.object({
        id: z.string(),
        externalId: z.string(),
        name: z.string(),
        type: z.string(),
        currentBalanceCents: z.number().int(),
      }),
    ),
  }),
  occurredAt: z.string().datetime(),
});
export type AccountsSyncedEvent = z.infer<typeof AccountsSyncedEventSchema>;

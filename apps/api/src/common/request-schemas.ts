import { z } from 'zod';
import { ProviderId } from '@byrdos/contracts';

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>;

export const transactionListQuerySchema = paginationQuerySchema.extend({
  accountId: z.string().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  pending: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
});
export type TransactionListQueryDto = z.infer<typeof transactionListQuerySchema>;

export const signupBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});
export type SignupBodyDto = z.infer<typeof signupBodySchema>;

export const signinBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type SigninBodyDto = z.infer<typeof signinBodySchema>;

export const initiateLinkBodySchema = z.object({
  providerId: ProviderId,
});
export type InitiateLinkBodyDto = z.infer<typeof initiateLinkBodySchema>;

export const exchangeTokenBodySchema = z.object({
  integrationId: z.string(),
  publicToken: z.string(),
  metadata: z
    .object({
      institution: z
        .object({
          name: z.string(),
          institution_id: z.string(),
        })
        .optional(),
      accounts: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            mask: z.string().optional(),
            type: z.string(),
            subtype: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});
export type ExchangeTokenBodyDto = z.infer<typeof exchangeTokenBodySchema>;

export const plaidWebhookBodySchema = z.record(z.unknown());
export type PlaidWebhookBodyDto = z.infer<typeof plaidWebhookBodySchema>;

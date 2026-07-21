import type { Transaction } from './transaction.entity.js';
import type { PaginationOptions, PaginatedResult } from './pagination.js';

export interface TransactionPaginationOptions extends PaginationOptions {
  startDate?: string;
  endDate?: string;
  pending?: boolean;
}

export interface UpsertTransactionInput {
  accountId: string;
  externalId: string;
  amountCents: number;
  date: string;
  authorizedDate: string | null;
  name: string;
  merchantName: string | null;
  pending: boolean;
  pendingTransactionExternalId: string | null;
  paymentChannel: string | null;
  isoCurrencyCode: string | null;
  categoryHash: string | null;
  raw: Record<string, unknown> | null;
}

export interface TransactionRepository {
  findById(id: string): Promise<Transaction | null>;
  findByAccountId(
    accountId: string,
    options?: TransactionPaginationOptions,
  ): Promise<PaginatedResult<Transaction>>;
  findByAccountIdAndUserId(
    accountId: string,
    userId: string,
    options?: TransactionPaginationOptions,
  ): Promise<PaginatedResult<Transaction>>;
  findByUserId(
    userId: string,
    options?: TransactionPaginationOptions,
  ): Promise<PaginatedResult<Transaction>>;
  upsert(input: UpsertTransactionInput): Promise<Transaction>;
  updateCategory(transactionId: string, categoryHash: string): Promise<Transaction>;
}

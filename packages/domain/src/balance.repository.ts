import type { Balance } from './balance.entity.js';
import type { PaginationOptions, PaginatedResult } from './pagination.js';

export interface CreateBalanceInput {
  accountId: string;
  current: number;
  available: number | null;
  limit: number | null;
  currency: string;
  recordedAt: Date;
}

export interface BalanceRepository {
  findLatestByAccountId(accountId: string): Promise<Balance | null>;
  findByAccountId(accountId: string, options?: PaginationOptions): Promise<PaginatedResult<Balance>>;
  create(input: CreateBalanceInput): Promise<Balance>;
}

import type { Account, AccountStatus, AccountType } from './account.entity.js';
import type { PaginationOptions, PaginatedResult } from './pagination.js';

export interface CreateAccountInput {
  connectionId: string;
  externalId: string;
  mask: string | null;
  name: string;
  officialName: string | null;
  type: AccountType;
  subtype: string | null;
  currentBalanceCents: number;
  availableBalanceCents: number | null;
  balanceLimitCents: number | null;
  currency: string;
  status: AccountStatus;
}

export interface AccountRepository {
  findById(id: string): Promise<Account | null>;
  findByIdAndUserId(id: string, userId: string): Promise<Account | null>;
  findByConnectionId(connectionId: string): Promise<Account[]>;
  findByUserId(userId: string, options?: PaginationOptions): Promise<PaginatedResult<Account>>;
  create(input: CreateAccountInput): Promise<Account>;
  updateBalance(
    id: string,
    currentBalanceCents: number,
    availableBalanceCents: number | null,
    balanceLimitCents: number | null,
  ): Promise<Account>;
  updateStatus(id: string, status: AccountStatus): Promise<Account>;
}

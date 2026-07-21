export type AccountType = 'depository' | 'credit' | 'loan' | 'investment';

export type AccountStatus = 'active' | 'closed';

export interface Account {
  readonly id: string;
  readonly connectionId: string;
  readonly externalId: string;
  readonly mask: string | null;
  readonly name: string;
  readonly officialName: string | null;
  readonly type: AccountType;
  readonly subtype: string | null;
  readonly currentBalanceCents: number;
  readonly availableBalanceCents: number | null;
  readonly balanceLimitCents: number | null;
  readonly currency: string;
  readonly status: AccountStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

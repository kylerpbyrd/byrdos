export interface Transaction {
  readonly id: string;
  readonly accountId: string;
  readonly externalId: string;
  readonly amountCents: number;
  readonly date: string; // YYYY-MM-DD
  readonly authorizedDate: string | null;
  readonly name: string;
  readonly merchantName: string | null;
  readonly pending: boolean;
  readonly pendingTransactionExternalId: string | null;
  readonly paymentChannel: string | null;
  readonly isoCurrencyCode: string | null;
  readonly categoryHash: string | null;
  readonly raw: Record<string, unknown> | null;
  readonly createdAt: Date;
}

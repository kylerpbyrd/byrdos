export interface SyncCursor {
  readonly id: string;
  readonly connectionId: string;
  readonly resourceType: 'accounts' | 'transactions';
  readonly cursor: string;
  readonly updatedAt: Date;
}

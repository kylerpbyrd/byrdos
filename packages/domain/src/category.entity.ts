export type CategoryKind = 'income' | 'expense' | 'transfer';

export interface Category {
  readonly id: string;
  readonly userId: string | null;
  readonly name: string;
  readonly normName: string;
  readonly kind: CategoryKind;
  readonly parentId: string | null;
  readonly createdAt: Date;
}

'use client';

import { DataTable, DataTableColumn, Money, Badge, EmptyState } from '@byrdos/ui';
import type { Transaction } from '@byrdos/domain';
import { ArrowRight } from 'lucide-react';

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const transactionColumns: DataTableColumn<Transaction>[] = [
  {
    key: 'name',
    header: 'Transaction',
    cell: (t) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{t.name}</p>
        <p className="text-xs text-muted">
          {formatDate(t.date)}
          {t.merchantName && t.merchantName !== t.name && ` • ${t.merchantName}`}
        </p>
      </div>
    ),
  },
  {
    key: 'amount',
    header: 'Amount',
    cell: (t) => (
      <div className="text-right">
        <Money cents={t.amountCents} currency={t.isoCurrencyCode ?? 'USD'} sign />
        {t.pending && (
          <Badge variant="warning" className="ml-2">
            Pending
          </Badge>
        )}
      </div>
    ),
    className: 'text-right',
    headerClassName: 'text-right',
  },
];

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <DataTable
      columns={transactionColumns}
      data={transactions}
      keyExtractor={(t) => t.id}
      emptyState={
        <EmptyState
          icon={<ArrowRight className="size-6" />}
          title="No transactions yet"
          description="Transactions will appear here after your first sync."
        />
      }
    />
  );
}

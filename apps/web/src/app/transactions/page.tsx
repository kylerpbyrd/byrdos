import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { fetchAccounts, fetchTransactions } from '@/lib/api';
import { Money } from '@byrdos/ui';

interface TransactionsPageProps {
  searchParams: Promise<{
    accountId?: string;
    startDate?: string;
    endDate?: string;
    pending?: string;
    cursor?: string;
  }>;
}

function toSearchParams(params: Record<string, string | undefined>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      sp.set(key, value);
    }
  }
  return sp;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const token = session.accessToken;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const params = await searchParams;
  const accountId = params.accountId;
  const startDate = params.startDate;
  const endDate = params.endDate;
  const pending = params.pending === 'true' ? true : params.pending === 'false' ? false : undefined;
  const cursor = params.cursor;

  const [{ items: accounts }, { items: transactions, nextCursor, hasMore }] = await Promise.all([
    fetchAccounts(token, { limit: 100 }),
    fetchTransactions(token, {
      accountId,
      startDate,
      endDate,
      pending,
      cursor,
      limit: 25,
    }),
  ]);

  const currentFilters = {
    accountId,
    startDate,
    endDate,
    pending: pending !== undefined ? String(pending) : undefined,
  };

  const loadMoreUrl = (() => {
    if (!nextCursor) return null;
    const sp = toSearchParams({ ...currentFilters, cursor: nextCursor });
    return `/transactions?${sp.toString()}`;
  })();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
            <p className="mt-1 text-muted">Review and filter your transactions.</p>
          </div>
        </div>

        <form
          method="get"
          action="/transactions"
          className="mt-6 grid gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <label htmlFor="accountId" className="text-sm font-medium text-foreground">
              Account
            </label>
            <select
              id="accountId"
              name="accountId"
              defaultValue={accountId || ''}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="startDate" className="text-sm font-medium text-foreground">
              Start date
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={startDate}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="endDate" className="text-sm font-medium text-foreground">
              End date
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={endDate}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="pending" className="text-sm font-medium text-foreground">
              Status
            </label>
            <select
              id="pending"
              name="pending"
              defaultValue={pending !== undefined ? String(pending) : ''}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">All</option>
              <option value="true">Pending</option>
              <option value="false">Posted</option>
            </select>
          </div>

          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Apply filters
            </button>
            <Link
              href="/transactions"
              className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Clear
            </Link>
          </div>
        </form>

        {transactions.length === 0 ? (
          <div className="mt-8 rounded-lg border border-border bg-surface p-12 text-center">
            <h2 className="text-lg font-semibold text-foreground">No transactions found</h2>
            <p className="mt-2 text-muted">
              Try adjusting your filters or connect a bank to start syncing transactions.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{transaction.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span>{formatDate(transaction.date)}</span>
                    {transaction.merchantName && transaction.merchantName !== transaction.name && (
                      <span className="hidden sm:inline">• {transaction.merchantName}</span>
                    )}
                    {transaction.pending && (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-lg font-semibold text-foreground sm:text-right">
                  <Money cents={transaction.amountCents} currency={transaction.isoCurrencyCode ?? 'USD'} />
                </p>
              </div>
            ))}
          </div>
        )}

        {hasMore && loadMoreUrl && (
          <div className="mt-8 flex justify-center">
            <Link
              href={loadMoreUrl}
              className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-6 py-2 text-sm font-medium text-foreground hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Load more
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

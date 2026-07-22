import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { fetchAccounts, fetchTransactions } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  EmptyState,
  Input,
  Label,
  Money,
} from '@byrdos/ui';
import type { Transaction } from '@byrdos/domain';
import { ArrowLeftRight, Filter, X } from 'lucide-react';

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

  const hasFilters = accountId || startDate || endDate || pending !== undefined;

  const transactionColumns: import('@byrdos/ui').DataTableColumn<Transaction>[] = [
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
      sortable: true,
    },
    {
      key: 'account',
      header: 'Account',
      cell: (t) => {
        const account = accounts.find((a) => a.id === t.accountId);
        if (!account) return <span className="text-muted">—</span>;
        return (
          <Link
            href={`/accounts/${account.id}`}
            className="text-sm text-primary hover:underline"
          >
            {account.name}
          </Link>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (t) =>
        t.pending ? (
          <Badge variant="warning">Pending</Badge>
        ) : (
          <Badge variant="secondary">Posted</Badge>
        ),
    },
    {
      key: 'amount',
      header: 'Amount',
      cell: (t) => (
        <Money cents={t.amountCents} currency={t.isoCurrencyCode ?? 'USD'} sign />
      ),
      className: 'text-right',
      headerClassName: 'text-right',
      sortable: true,
    },
  ];

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground md:text-3xl">Transactions</h1>
            <p className="mt-1 text-muted">Review and filter your transactions.</p>
          </div>
          {hasFilters && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/transactions">
                <X className="size-4" />
                Clear filters
              </Link>
            </Button>
          )}
        </div>

        <Card className="mt-6">
          <CardContent className="p-4">
            <form method="get" action="/transactions" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="accountId">Account</Label>
                <select
                  id="accountId"
                  name="accountId"
                  defaultValue={accountId || ''}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="">All accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input id="startDate" name="startDate" type="date" defaultValue={startDate} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End date</Label>
                <Input id="endDate" name="endDate" type="date" defaultValue={endDate} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pending">Status</Label>
                <select
                  id="pending"
                  name="pending"
                  defaultValue={pending !== undefined ? String(pending) : ''}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="">All</option>
                  <option value="true">Pending</option>
                  <option value="false">Posted</option>
                </select>
              </div>

              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                <Button type="submit">
                  <Filter className="size-4" />
                  Apply filters
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/transactions">Clear</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6">
          <DataTable
            columns={transactionColumns}
            data={transactions}
            keyExtractor={(t) => t.id}
            emptyState={
              <EmptyState
                icon={<ArrowLeftRight className="size-6" />}
                title="No transactions found"
                description="Try adjusting your filters or connect a bank to start syncing transactions."
                action={{ label: 'Connect a bank', href: '/connect' }}
              />
            }
          />
        </div>

        {hasMore && loadMoreUrl && (
          <div className="mt-6 flex justify-center">
            <Button variant="outline" asChild>
              <Link href={loadMoreUrl}>Load more</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

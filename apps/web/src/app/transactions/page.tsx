import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { fetchAccounts, fetchTransactions } from '@/lib/api';
import { TransactionsTable } from './transactions-table';

interface TransactionsPageProps {
  searchParams: Promise<{
    accountId?: string;
    startDate?: string;
    endDate?: string;
    pending?: string;
    cursor?: string;
  }>;
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

  const filters = {
    accountId,
    startDate,
    endDate,
    pending: pending !== undefined ? String(pending) : undefined,
  };

  const hasFilters = Boolean(accountId || startDate || endDate || pending !== undefined);

  return (
    <TransactionsTable
      transactions={transactions}
      accounts={accounts}
      nextCursor={nextCursor}
      hasMore={hasMore}
      filters={filters}
      hasFilters={hasFilters}
    />
  );
}

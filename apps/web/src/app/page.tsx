import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { fetchAccounts, fetchTransactions, listIntegrations } from '@/lib/api';
import {
  AccountBadge,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  Money,
  ProviderIcon,
  SyncStatusBar,
} from '@byrdos/ui';
import type { Transaction } from '@byrdos/domain';
import { ArrowRight, Plus } from 'lucide-react';

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getProviderStatus(integrations: unknown[]): 'success' | 'error' | 'idle' {
  if (integrations.length === 0) return 'idle';
  const statuses = integrations.map((i) => (i as { status?: string }).status);
  if (statuses.some((s) => s === 'error' || s === 'pending_reconnect')) return 'error';
  return 'success';
}

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const token = session.accessToken;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const [{ items: accounts }, { items: transactions }, integrations] = await Promise.all([
    fetchAccounts(token, { limit: 100 }),
    fetchTransactions(token, { limit: 5 }),
    listIntegrations(token),
  ]);

  const totalBalanceCents = accounts.reduce(
    (sum, account) => sum + account.currentBalanceCents,
    0,
  );

  if (accounts.length === 0) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
              Welcome, {session.user.name || session.user.email}
            </h1>
            <p className="mt-1 text-muted">Let&apos;s get your financial data connected.</p>
          </div>
          <EmptyState
            icon={<Plus className="size-6" />}
            title="Connect your first account"
            description="Link a bank to see balances, transactions, and insights all in one place."
            action={{ label: 'Connect a bank', href: '/connect' }}
          />
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
              Dashboard
            </h1>
            <p className="mt-1 text-muted">
              Welcome back, {session.user.name || session.user.email}
            </p>
          </div>
          <Button asChild>
            <Link href="/connect">
              <Plus className="size-4" />
              Connect a bank
            </Link>
          </Button>
        </div>

        <section className="rounded-2xl border border-border bg-surface p-6 md:p-8">
          <p className="text-sm font-medium text-muted">Total balance</p>
          <p className="mt-2 font-mono text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            <Money cents={totalBalanceCents} />
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <SyncStatusBar status={getProviderStatus(integrations)} />
            <span>•</span>
            <span>
              {accounts.length} account{accounts.length === 1 ? '' : 's'} connected
            </span>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Accounts</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/accounts">
                View all
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <Link key={account.id} href={`/accounts/${account.id}`} className="group">
                <Card className="h-full transition-colors hover:border-primary/50 hover:bg-surface-elevated">
                  <CardHeader className="pb-3">
                    <AccountBadge
                      type={account.type}
                      subtype={account.subtype}
                      mask={account.mask}
                      name={account.name}
                    />
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted">Current balance</p>
                    <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                      <Money cents={account.currentBalanceCents} currency={account.currency} />
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent transactions</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/transactions">
                View all
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <Card>
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
          </Card>
        </section>

        {integrations.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Connected providers</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {integrations.map((integration) => {
                const i = integration as {
                  id: string;
                  providerId: string;
                  institutionName: string | null;
                  status: string;
                };
                const status: import('@byrdos/ui').SyncStatus =
                  i.status === 'active'
                    ? 'success'
                    : i.status === 'pending_reconnect'
                      ? 'error'
                      : 'idle';
                return (
                  <Card key={i.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <ProviderIcon
                          providerId={i.providerId as 'plaid' | 'mx' | 'akoya'}
                          className="size-8"
                        />
                        <div>
                          <CardTitle className="text-base">{i.institutionName || i.providerId}</CardTitle>
                          <CardDescription className="capitalize">{i.providerId}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <SyncStatusBar status={status} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

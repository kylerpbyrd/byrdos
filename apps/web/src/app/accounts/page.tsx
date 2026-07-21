import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { fetchAccounts } from '@/lib/api';
import { Money } from '@byrdos/ui';

export default async function AccountsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const token = session.accessToken;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const { items: accounts } = await fetchAccounts(token, { limit: 100 });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Accounts</h1>
            <p className="mt-1 text-muted">All your connected accounts in one place.</p>
          </div>
          <Link
            href="/connect"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Connect a bank
          </Link>
        </div>

        {accounts.length === 0 ? (
          <div className="mt-8 rounded-lg border border-border bg-surface p-12 text-center">
            <h2 className="text-lg font-semibold text-foreground">No accounts yet</h2>
            <p className="mt-2 text-muted">Connect a bank to see your accounts here.</p>
            <Link
              href="/connect"
              className="mt-6 inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Connect a bank
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {accounts.map((account) => (
              <Link
                key={account.id}
                href={`/accounts/${account.id}`}
                className="rounded-lg border border-border bg-surface p-6 transition-colors hover:border-primary hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-foreground">{account.name}</h2>
                    {account.mask && <p className="text-sm text-muted">•••• {account.mask}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-muted/20 px-2 py-1 text-xs font-medium uppercase text-muted">
                    {account.type}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-muted">Current balance</p>
                  <p className="text-2xl font-semibold text-foreground">
                    <Money cents={account.currentBalanceCents} currency={account.currency} />
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

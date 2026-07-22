import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { fetchAccounts } from '@/lib/api';
import {
  AccountBadge,
  Card,
  CardContent,
  EmptyState,
  Money,
} from '@byrdos/ui';
import { Plus } from 'lucide-react';

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
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-4xl">
        <div>
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">Accounts</h1>
          <p className="mt-1 text-muted">All your connected accounts in one place.</p>
        </div>

        {accounts.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<Plus className="size-6" />}
              title="No accounts yet"
              description="Connect a bank to see your accounts here."
              action={{ label: 'Connect a bank', href: '/connect' }}
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {accounts.map((account) => (
              <Link key={account.id} href={`/accounts/${account.id}`} className="group">
                <Card className="h-full transition-colors hover:border-primary/50 hover:bg-surface-elevated">
                  <CardContent className="p-6">
                    <AccountBadge
                      type={account.type}
                      subtype={account.subtype}
                      mask={account.mask}
                      name={account.name}
                    />
                    <div className="mt-6">
                      <p className="text-xs text-muted">Current balance</p>
                      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                        <Money cents={account.currentBalanceCents} currency={account.currency} />
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

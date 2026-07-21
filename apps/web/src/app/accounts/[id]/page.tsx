import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchAccount } from '@/lib/api';
import { Money } from '@byrdos/ui';

interface AccountDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const token = session.accessToken;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const { id } = await params;
  let account;
  try {
    account = await fetchAccount(token, id);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/accounts"
          className="text-sm text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          ← Back to accounts
        </Link>

        <div className="mt-4 rounded-lg border border-border bg-surface p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{account.name}</h1>
              {account.officialName && account.officialName !== account.name && (
                <p className="text-muted">{account.officialName}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-muted/20 px-2 py-1 text-xs font-medium uppercase text-muted">
                  {account.type}
                </span>
                {account.subtype && (
                  <span className="rounded-full bg-muted/20 px-2 py-1 text-xs font-medium text-muted">
                    {account.subtype}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted">Current balance</p>
              <p className="text-2xl font-semibold text-foreground">
                <Money cents={account.currentBalanceCents} currency={account.currency} />
              </p>
            </div>
            {account.availableBalanceCents !== null && (
              <div>
                <p className="text-sm text-muted">Available balance</p>
                <p className="text-2xl font-semibold text-foreground">
                  <Money cents={account.availableBalanceCents} currency={account.currency} />
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <Link
            href={`/transactions?accountId=${encodeURIComponent(account.id)}`}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            View transactions
          </Link>
        </div>
      </div>
    </div>
  );
}

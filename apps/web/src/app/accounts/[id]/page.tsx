import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchAccount } from '@/lib/api';
import {
  AccountBadge,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Money,
  Separator,
} from '@byrdos/ui';
import { ArrowLeft, ArrowRight } from 'lucide-react';

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
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" size="sm" className="-ml-2 px-2" asChild>
          <Link href="/accounts">
            <ArrowLeft className="size-4" />
            Back to accounts
          </Link>
        </Button>

        <Card className="mt-4">
          <CardHeader>
            <AccountBadge
              type={account.type}
              subtype={account.subtype}
              mask={account.mask}
              name={account.name}
            />
            {account.officialName && account.officialName !== account.name && (
              <p className="text-sm text-muted">{account.officialName}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Current balance
                </p>
                <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                  <Money cents={account.currentBalanceCents} currency={account.currency} />
                </p>
              </div>
              {account.availableBalanceCents !== null && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    Available balance
                  </p>
                  <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                    <Money cents={account.availableBalanceCents} currency={account.currency} />
                  </p>
                </div>
              )}
            </div>

            <Separator />

            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted">Account type</p>
                <p className="font-medium capitalize text-foreground">
                  {account.type}
                  {account.subtype && ` • ${account.subtype}`}
                </p>
              </div>
              <div>
                <p className="text-muted">Status</p>
                <Badge
                  variant={account.status === 'active' ? 'success' : 'secondary'}
                  className="mt-1 capitalize"
                >
                  {account.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/transactions?accountId=${encodeURIComponent(account.id)}`}>
              View transactions
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

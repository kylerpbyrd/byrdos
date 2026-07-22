'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AccountBadge,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ProviderIcon,
  Separator,
  SyncStatusBar,
} from '@byrdos/ui';
import { PlaidLinkButton } from '@/components/plaid-link-button';
import { revokeConnection } from '@/lib/api';
import { useSession } from 'next-auth/react';
import { ArrowLeft, RefreshCw, Unlink } from 'lucide-react';
import type { Account } from '@byrdos/domain';

interface IntegrationDetailPageClientProps {
  integration: {
    id: string;
    providerId: string;
    institutionName: string | null;
    status: string;
    externalId: string;
  };
  accounts: Account[];
}

export function IntegrationDetailPageClient({
  integration,
  accounts,
}: IntegrationDetailPageClientProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = session?.accessToken;
  const status: import('@byrdos/ui').SyncStatus =
    integration.status === 'active'
      ? 'success'
      : integration.status === 'pending_reconnect'
        ? 'error'
        : 'idle';
  const needsRelink = integration.status === 'pending_reconnect';

  const handleRevoke = async () => {
    if (!token) {
      setError('Not authenticated');
      return;
    }
    setRevoking(true);
    setError(null);
    try {
      await revokeConnection(integration.id, token);
      router.push('/settings/integrations');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" size="sm" className="-ml-2 px-2" asChild>
          <Link href="/settings/integrations">
            <ArrowLeft className="size-4" />
            Back to integrations
          </Link>
        </Button>

        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-start gap-4">
              <ProviderIcon
                providerId={integration.providerId as 'plaid' | 'mx' | 'akoya'}
                className="size-12"
              />
              <div>
                <CardTitle className="text-xl">
                  {integration.institutionName || integration.providerId}
                </CardTitle>
                <CardDescription className="capitalize">
                  {integration.providerId} connection
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <SyncStatusBar status={status} />
              {needsRelink && (
                <Badge variant="warning">Re-link required</Badge>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-medium text-foreground">Connected accounts</h3>
              {accounts.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No accounts connected.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {accounts.map((account) => (
                    <li key={account.id}>
                      <Link
                        href={`/accounts/${account.id}`}
                        className="block rounded-md border border-border bg-surface p-3 transition-colors hover:bg-surface-elevated"
                      >
                        <AccountBadge
                          type={account.type}
                          subtype={account.subtype}
                          mask={account.mask}
                          name={account.name}
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Separator />

            <div className="flex flex-wrap gap-3">
              {needsRelink && (
                <PlaidLinkButton onSuccess={() => router.refresh()}>
                  <RefreshCw className="size-4" />
                  Re-link account
                </PlaidLinkButton>
              )}
              <Button
                variant="destructive"
                onClick={handleRevoke}
                disabled={revoking}
              >
                <Unlink className="size-4" />
                {revoking ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

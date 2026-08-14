import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { fetchAccounts, listIntegrations } from '@/lib/api';
import {
  Button,
  Card,
  CardContent,
  ProviderIcon,
  Separator,
  SyncStatusBar,
} from '@byrdos/ui';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react';

function mapConnectionStatus(status: string | undefined): import('@byrdos/ui').SyncStatus {
  if (status === 'active') return 'success';
  if (status === 'pending_reconnect' || status === 'error') return 'error';
  return 'idle';
}

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const token = session.accessToken;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const [integrations, { items: accounts }] = await Promise.all([
    listIntegrations(token),
    fetchAccounts(token, { limit: 100 }),
  ]);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" size="sm" className="-ml-2 px-2" asChild>
          <Link href="/settings">
            <ArrowLeft className="size-4" />
            Back to settings
          </Link>
        </Button>

        <h1 className="mt-4 text-2xl font-semibold text-foreground md:text-3xl">
          Integrations
        </h1>
        <p className="mt-1 text-muted">Manage your connected banks and providers.</p>

        <div className="mt-6 space-y-3">
          {integrations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted">No integrations connected yet.</p>
                <Button asChild className="mt-4">
                  <Link href="/connect">
                    <Plus className="size-4" />
                    Connect a bank
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            integrations.map((integration) => {
              const conn = integration.connection;
              const status = mapConnectionStatus(conn?.status);
              const accountCount = accounts.filter((a) => a.connectionId === conn?.id).length;
              return (
                <Link key={integration.id} href={`/settings/integrations/${integration.id}`} className="group">
                  <Card className="transition-colors hover:border-primary/50 hover:bg-surface-elevated">
                    <CardContent className="flex items-center gap-4 p-4">
                      <ProviderIcon
                        providerId={integration.providerId as 'plaid' | 'mx' | 'akoya'}
                        className="size-10"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {conn?.institutionName ?? integration.providerId}
                        </p>
                        <p className="text-sm capitalize text-muted">
                          {integration.providerId} • {accountCount} account
                          {accountCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <SyncStatusBar status={status} />
                        <ChevronRight className="size-4 text-muted" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </div>

        <Separator className="my-6" />

        <Button variant="outline" asChild>
          <Link href="/connect">
            <Plus className="size-4" />
            Add integration
          </Link>
        </Button>
      </div>
    </div>
  );
}

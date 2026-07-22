import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { fetchAccounts, fetchIntegration } from '@/lib/api';
import { IntegrationDetailPageClient } from './integration-detail-client';

interface IntegrationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function IntegrationDetailPage({ params }: IntegrationDetailPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const token = session.accessToken;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const { id } = await params;
  let integration: unknown;
  try {
    integration = await fetchIntegration(token, id);
  } catch {
    notFound();
  }

  const i = integration as {
    id: string;
    providerId: string;
    institutionName: string | null;
    status: string;
    externalId: string;
  };

  const { items: accounts } = await fetchAccounts(token, { limit: 100 });
  const connectedAccounts = accounts.filter((a) => a.connectionId === i.id);

  return (
    <IntegrationDetailPageClient
      integration={{
        id: i.id,
        providerId: i.providerId,
        institutionName: i.institutionName,
        status: i.status,
        externalId: i.externalId,
      }}
      accounts={connectedAccounts}
    />
  );
}

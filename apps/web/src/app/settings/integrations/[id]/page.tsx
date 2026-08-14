import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { fetchAccounts, fetchIntegration, type LinkListItem } from '@/lib/api';
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
  let integration: LinkListItem;
  try {
    integration = await fetchIntegration(token, id);
  } catch {
    notFound();
  }

  const { items: accounts } = await fetchAccounts(token, { limit: 100 });
  const connectedAccounts = accounts.filter((a) => a.connectionId === integration.connection?.id);

  return (
    <IntegrationDetailPageClient
      integration={integration}
      accounts={connectedAccounts}
    />
  );
}

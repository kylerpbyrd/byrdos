'use client';

import { useRouter } from 'next/navigation';
import { SyncStatusBar } from '@byrdos/ui';
import { fetchSyncStatus } from '@/lib/api';

interface SyncStatusClientProps {
  connectionId: string;
  token: string;
}

export function SyncStatusClient({ connectionId, token }: SyncStatusClientProps) {
  const router = useRouter();
  return (
    <SyncStatusBar
      connectionId={connectionId}
      token={token}
      syncStatusFetcher={fetchSyncStatus}
      onSynced={() => router.refresh()}
    />
  );
}

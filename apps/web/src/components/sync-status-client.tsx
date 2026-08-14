'use client';

import { useRouter } from 'next/navigation';
import { SyncStatusBar } from '@byrdos/ui';
import { fetchSyncStatus } from '@/lib/api';
import { RelinkButton } from '@/components/relink-button';

interface SyncStatusClientProps {
  connectionId: string;
  status?: string;
  token: string;
}

export function SyncStatusClient({ connectionId, status, token }: SyncStatusClientProps) {
  const router = useRouter();
  const needsRelink = status === 'pending_reconnect';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SyncStatusBar
        connectionId={connectionId}
        token={token}
        syncStatusFetcher={fetchSyncStatus}
        onSynced={() => router.refresh()}
      />
      {needsRelink && (
        <RelinkButton
          connectionId={connectionId}
          token={token}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  );
}

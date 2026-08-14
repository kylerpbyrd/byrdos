'use client';

import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { cn } from './lib/utils.js';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

export interface SyncJob {
  id: string;
  type: string;
  status: string;
  trigger: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface SyncStatusResponse {
  connectionId: string;
  status: string;
  lastWebhookAt: string | null;
  recentJobs: SyncJob[];
}

export interface SyncStatusBarProps {
  status?: SyncStatus;
  className?: string;
  connectionId?: string;
  token?: string;
  syncStatusFetcher?: (connectionId: string, token: string) => Promise<SyncStatusResponse>;
  onSynced?: () => void;
}

const statusConfig: Record<
  SyncStatus,
  { label: string; ariaLabel: string; icon: ComponentType<{ className?: string }> | null; color: string }
> = {
  idle: { label: 'Idle', ariaLabel: 'Sync idle', icon: Circle, color: 'text-muted' },
  syncing: { label: 'Syncing…', ariaLabel: 'Sync in progress', icon: null, color: 'text-info' },
  error: { label: 'Sync error', ariaLabel: 'Sync error', icon: AlertTriangle, color: 'text-destructive' },
  success: { label: 'Last synced', ariaLabel: 'Sync complete', icon: CheckCircle2, color: 'text-success' },
};

const defaultFetcher: NonNullable<SyncStatusBarProps['syncStatusFetcher']> = async () => ({
  connectionId: '',
  status: 'idle',
  lastWebhookAt: null,
  recentJobs: [],
});

function deriveSyncStatus(recentJobs: SyncJob[]): SyncStatus {
  const job = recentJobs[0];
  if (!job) return 'idle';
  switch (job.status) {
    case 'running':
      return 'syncing';
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    default:
      return 'idle';
  }
}

export function SyncStatusBar({
  status,
  className,
  connectionId,
  token,
  syncStatusFetcher = defaultFetcher,
  onSynced,
}: SyncStatusBarProps) {
  const [liveStatus, setLiveStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const hasFiredSyncedRef = useRef(false);

  const isControlled = status !== undefined;
  const effectiveStatus = isControlled ? status : liveStatus;

  useEffect(() => {
    if (!connectionId || !token || isControlled) return;

    const connectionId_ = connectionId;
    const token_ = token;
    const fetcher = syncStatusFetcher;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval>;

    async function tick() {
      try {
        const data = await fetcher(connectionId_, token_);
        if (cancelled) return;
        const derived = deriveSyncStatus(data.recentJobs);
        setLiveStatus(derived);
        setLastSyncedAt(data.lastWebhookAt);
        if (derived === 'success' && !hasFiredSyncedRef.current) {
          hasFiredSyncedRef.current = true;
          onSynced?.();
        }
      } catch {
        // Polling errors are swallowed to avoid flashing error UI while a job
        // is still progressing. The consumer can surface fetch failures elsewhere.
      }
    }

    tick();
    intervalId = setInterval(tick, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [connectionId, token, syncStatusFetcher, onSynced, isControlled]);

  const config = statusConfig[effectiveStatus];
  const Icon = config.icon;

  return (
    <div
      className={cn('inline-flex items-center gap-2 text-sm', config.color, className)}
      aria-live="polite"
      aria-label={config.ariaLabel}
    >
      {effectiveStatus === 'syncing' ? (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full rounded-full bg-current opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      ) : Icon ? (
        <Icon className="size-4" aria-hidden="true" />
      ) : null}
      <span>{config.label}</span>
      {effectiveStatus === 'success' && lastSyncedAt && (
        <span className="text-muted">{new Date(lastSyncedAt).toLocaleTimeString()}</span>
      )}
    </div>
  );
}

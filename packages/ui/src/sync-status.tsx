export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

export interface SyncStatusBarProps {
  status: SyncStatus;
  className?: string;
}

const statusConfig: Record<
  SyncStatus,
  { label: string; ariaLabel: string; icon: string; color: string }
> = {
  idle: { label: 'Idle', ariaLabel: 'Sync idle', icon: '○', color: 'text-muted' },
  syncing: { label: 'Syncing…', ariaLabel: 'Sync in progress', icon: '↻', color: 'text-info' },
  error: { label: 'Sync error', ariaLabel: 'Sync error', icon: '⚠', color: 'text-destructive' },
  success: { label: 'Synced', ariaLabel: 'Sync complete', icon: '✓', color: 'text-success' },
};

export function SyncStatusBar({ status, className }: SyncStatusBarProps) {
  const config = statusConfig[status];
  return (
    <div
      className={`inline-flex items-center gap-2 text-sm ${config.color} ${className ?? ''}`}
      aria-live="polite"
      aria-label={config.ariaLabel}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
}

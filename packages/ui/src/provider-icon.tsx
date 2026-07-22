export type ProviderIconId = 'plaid' | 'mx' | 'akoya';

export interface ProviderIconProps {
  providerId: ProviderIconId;
  className?: string;
}

export function ProviderIcon({ providerId, className }: ProviderIconProps) {
  const icons: Record<ProviderIconId, React.ReactNode> = {
    plaid: (
      <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#0A85D1" />
        <path
          d="M22 11h-3v10h3V11zM13 11h-3v10h3V11zM17.5 11h-3v10h3V11z"
          fill="white"
        />
      </svg>
    ),
    mx: (
      <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#1A1A1A" />
        <path d="M8 12h3v8H8zM14.5 12h3v8h-3zM21 12h3v8h-3z" fill="white" />
      </svg>
    ),
    akoya: (
      <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#FF6B00" />
        <circle cx="16" cy="16" r="6" fill="white" />
      </svg>
    ),
  };

  return (
    <span title={providerId} className="inline-flex shrink-0">
      {icons[providerId] ?? (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect width="32" height="32" rx="6" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

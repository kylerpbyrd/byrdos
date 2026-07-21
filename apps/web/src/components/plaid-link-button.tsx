'use client';

import { useCallback, useState } from 'react';
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from 'react-plaid-link';
import { initiateLink, exchangeLinkToken } from '@/lib/api';

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
  onExit?: () => void;
}

export function PlaidLinkButton({ onSuccess, onExit }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPlaidSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      try {
        // Exchange the public token
        // The integrationId was stored when we called initiateLink
        const storedIntegrationId = sessionStorage.getItem('pendingIntegrationId');
        if (!storedIntegrationId) {
          throw new Error('No pending integration found');
        }

        await exchangeLinkToken(storedIntegrationId, publicToken, metadata);
        sessionStorage.removeItem('pendingIntegrationId');
        setLinkToken(null);
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to link account');
      }
    },
    [onSuccess],
  );

  const onPlaidExit = useCallback(() => {
    setLinkToken(null);
    sessionStorage.removeItem('pendingIntegrationId');
    onExit?.();
  }, [onExit]);

  const { open, ready } = usePlaidLink({
    token: linkToken || '',
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  });

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await initiateLink('plaid');
      sessionStorage.setItem('pendingIntegrationId', result.integrationId);
      setLinkToken(result.linkToken);
      // Plaid Link will open automatically when token is set
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  // Open Plaid Link when token is ready
  if (linkToken && ready) {
    open();
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <button
        onClick={handleConnect}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
      >
        {loading ? (
          <>Connecting...</>
        ) : (
          <>
            <svg
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Connect Bank Account
          </>
        )}
      </button>
    </div>
  );
}

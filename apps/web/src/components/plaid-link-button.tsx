'use client';

import { useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from 'react-plaid-link';
import { initiateLink, exchangeLinkToken } from '@/lib/api';
import { Button } from '@byrdos/ui';

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
  onExit?: () => void;
  children?: React.ReactNode;
}

export function PlaidLinkButton({ onSuccess, onExit, children }: PlaidLinkButtonProps) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPlaidSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      try {
        const storedIntegrationId = sessionStorage.getItem('pendingIntegrationId');
        if (!storedIntegrationId) {
          throw new Error('No pending integration found');
        }

        if (!token) {
          throw new Error('Not authenticated');
        }

        await exchangeLinkToken(storedIntegrationId, publicToken, metadata, token);
        sessionStorage.removeItem('pendingIntegrationId');
        setLinkToken(null);
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to link account');
      }
    },
    [onSuccess, token],
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
    if (!token) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await initiateLink('plaid', token);
      sessionStorage.setItem('pendingIntegrationId', result.integrationId);
      setLinkToken(result.linkToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

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
      <Button onClick={handleConnect} disabled={loading}>
        {loading ? (
          <>Connecting…</>
        ) : (
          children || (
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
          )
        )}
      </Button>
    </div>
  );
}

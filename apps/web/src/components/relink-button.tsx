'use client';

import { useCallback, useState } from 'react';
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from 'react-plaid-link';
import { Button } from '@byrdos/ui';
import { initiateReconnect, exchangeReconnect, triggerSync } from '@/lib/api';

interface RelinkButtonProps {
  connectionId: string;
  token: string;
  onSuccess?: () => void;
}

export function RelinkButton({ connectionId, token, onSuccess }: RelinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPlaidSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      try {
        setLoading(true);
        setError(null);
        await exchangeReconnect(connectionId, publicToken, metadata, token);
        await triggerSync(connectionId, token);
        setLinkToken(null);
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reconnect');
      } finally {
        setLoading(false);
      }
    },
    [connectionId, token, onSuccess],
  );

  const onPlaidExit = useCallback(() => {
    setLinkToken(null);
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken || '',
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  });

  const handleReconnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await initiateReconnect(connectionId, token);
      setLinkToken(result.linkToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start reconnect');
    } finally {
      setLoading(false);
    }
  };

  if (linkToken && ready) {
    open();
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <Button onClick={handleReconnect} disabled={loading} variant="outline" size="sm">
        {loading ? 'Reconnecting…' : 'Reconnect'}
      </Button>
    </div>
  );
}

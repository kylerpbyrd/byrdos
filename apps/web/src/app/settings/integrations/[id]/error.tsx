'use client';

import { useEffect } from 'react';
import { Button } from '@byrdos/ui';

export default function IntegrationDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Integration detail error:', error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-2xl font-bold text-foreground">Could not load integration</h1>
        <p className="mt-2 text-muted">
          {error.message || 'Something went wrong while loading this integration.'}
        </p>
        <Button onClick={reset} className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}

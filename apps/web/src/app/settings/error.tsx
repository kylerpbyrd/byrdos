'use client';

import { useEffect } from 'react';
import { Button } from '@byrdos/ui';

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Settings error:', error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-bold text-foreground">Could not load settings</h1>
        <p className="mt-2 text-muted">
          {error.message || 'Something went wrong while loading your settings.'}
        </p>
        <Button onClick={reset} className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { Button } from '@byrdos/ui';

export default function TransactionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Transactions page error:', error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-2xl font-bold text-foreground">Could not load transactions</h1>
        <p className="mt-2 text-muted">
          {error.message || 'Something went wrong while loading your transactions.'}
        </p>
        <Button onClick={reset} className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}

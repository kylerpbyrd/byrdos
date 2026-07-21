'use client';

import { useEffect } from 'react';

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
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-2xl font-bold text-foreground">Could not load transactions</h1>
        <p className="mt-2 text-muted">
          {error.message || 'Something went wrong while loading your transactions.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

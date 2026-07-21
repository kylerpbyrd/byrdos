'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AccountDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Account detail error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-2xl font-bold text-foreground">Could not load account</h1>
        <p className="mt-2 text-muted">
          {error.message || 'Something went wrong while loading this account.'}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/accounts"
            className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            All accounts
          </Link>
        </div>
      </div>
    </div>
  );
}

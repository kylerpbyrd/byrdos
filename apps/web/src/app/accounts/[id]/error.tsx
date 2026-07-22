'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@byrdos/ui';

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
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-2xl font-bold text-foreground">Could not load account</h1>
        <p className="mt-2 text-muted">
          {error.message || 'Something went wrong while loading this account.'}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/accounts">All accounts</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

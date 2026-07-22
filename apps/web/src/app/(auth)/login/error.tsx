'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@byrdos/ui';

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Login page error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Could not load sign in</h1>
        <p className="mt-2 text-muted">
          {error.message || 'Something went wrong while loading the sign in page.'}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

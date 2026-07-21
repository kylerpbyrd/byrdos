import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-foreground">Welcome, {session.user.email}</h1>
        <p className="mt-4 text-muted">Your financial dashboard is being built.</p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <Link
            href="/connect"
            className="rounded-lg border-2 border-dashed border-border bg-surface p-8 text-center hover:border-primary hover:bg-surface-elevated transition-colors"
          >
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10">
              <svg
                className="size-6 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground">Connect a bank</h2>
            <p className="mt-2 text-sm text-muted">
              Link your first account to see your financial data here.
            </p>
          </Link>

          <div className="rounded-lg border border-border bg-surface p-8 text-center opacity-50 cursor-not-allowed">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted/20">
              <svg
                className="size-6 text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 3v18h18" />
                <path d="M7 16l4-8 4 4 4-6" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground">Spending insights</h2>
            <p className="mt-2 text-sm text-muted">Available after connecting an account.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

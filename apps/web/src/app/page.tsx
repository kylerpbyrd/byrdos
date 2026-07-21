import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-foreground">Welcome, {session.user.email}</h1>
        <p className="mt-4 text-muted">Your financial dashboard is being built. Check back soon.</p>
        <div className="mt-8 rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold text-foreground">Getting Started</h2>
          <p className="mt-2 text-sm text-muted">
            Connect your first bank account to see your financial data here.
          </p>
        </div>
        <form action={async () => {
          'use server';
          const { signOut } = await import('@/lib/auth');
          await signOut({ redirectTo: '/login' });
        }}>
          <button type="submit" className="mt-4 text-sm text-muted hover:text-foreground underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

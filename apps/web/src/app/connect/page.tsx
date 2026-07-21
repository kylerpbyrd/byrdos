import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PlaidLinkButton } from '@/components/plaid-link-button';

export default async function ConnectPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Connect your bank</h1>
          <p className="mt-3 text-muted">
            Link your financial accounts to get a complete view of your money.
          </p>
        </div>

        <div className="mt-12 rounded-lg border border-border bg-surface p-8">
          <h2 className="text-lg font-semibold text-foreground">Plaid-powered connection</h2>
          <p className="mt-2 text-sm text-muted">
            byrdOS uses Plaid to securely connect to over 12,000 financial institutions. Your
            credentials are never stored on our servers.
          </p>

          <div className="mt-8 flex justify-center">
            <PlaidLinkButton />
          </div>

          <div className="mt-8 space-y-4 border-t border-border pt-6">
            <h3 className="text-sm font-medium text-foreground">What happens next?</h3>
            <ol className="ml-4 list-decimal space-y-2 text-sm text-muted">
              <li>You&apos;ll be redirected to Plaid&apos;s secure connection flow</li>
              <li>Select your bank and enter your online banking credentials</li>
              <li>Plaid verifies your account and returns you to byrdOS</li>
              <li>Your accounts and transactions sync automatically</li>
            </ol>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Secured with 256-bit encryption. Read our security documentation.
        </p>
      </div>
    </div>
  );
}

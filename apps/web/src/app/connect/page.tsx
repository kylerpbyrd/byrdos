import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PlaidLinkButton } from '@/components/plaid-link-button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@byrdos/ui';
import { Shield } from 'lucide-react';

export default async function ConnectPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-12 md:py-16">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
            Connect your bank
          </h1>
          <p className="mt-3 text-muted">
            Link your financial accounts to get a complete view of your money.
          </p>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Shield className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Plaid-powered connection</CardTitle>
                <CardDescription>
                  Securely connect to over 12,000 institutions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted">
              byrdOS uses Plaid to securely connect to your bank. Your credentials are never
              stored on our servers.
            </p>

            <div className="flex justify-center">
              <PlaidLinkButton />
            </div>

            <ol className="space-y-3 border-t border-border pt-6 text-sm text-muted">
              <li className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/10 text-xs font-medium text-muted">
                  1
                </span>
                You&apos;ll be redirected to Plaid&apos;s secure connection flow
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/10 text-xs font-medium text-muted">
                  2
                </span>
                Select your bank and enter your online banking credentials
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/10 text-xs font-medium text-muted">
                  3
                </span>
                Plaid verifies your account and returns you to byrdOS
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/10 text-xs font-medium text-muted">
                  4
                </span>
                Your accounts and transactions sync automatically
              </li>
            </ol>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted">
          Secured with 256-bit encryption. Read our security documentation.
        </p>
      </div>
    </div>
  );
}

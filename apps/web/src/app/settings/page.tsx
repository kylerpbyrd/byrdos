import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@byrdos/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { User, Plug, ChevronRight } from 'lucide-react';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-background p-4 md:min-h-screen md:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">Settings</h1>
        <p className="mt-1 text-muted">Manage your account and preferences.</p>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Profile</CardTitle>
                <CardDescription>Your account information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted">Email</p>
              <p className="font-medium text-foreground">{session.user.email}</p>
            </div>
            {session.user.name && (
              <div>
                <p className="text-sm text-muted">Name</p>
                <p className="font-medium text-foreground">{session.user.name}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted/10 text-muted">
                <Plug className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">Integrations</CardTitle>
                <CardDescription>Connected banks and providers</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="justify-between">
              <Link href="/settings/integrations">
                Manage integrations
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Choose your preferred theme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Theme</span>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

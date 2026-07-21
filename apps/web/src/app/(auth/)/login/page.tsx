import { signIn } from '@/lib/auth';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-surface p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Sign in to byrdOS</h1>
          <p className="mt-2 text-sm text-muted">Enter your email to continue</p>
        </div>

        <form
          action={async (formData) => {
            'use server';
            try {
              await signIn('credentials', {
                email: formData.get('email') as string,
                password: formData.get('password') as string,
                redirectTo: '/',
              });
            } catch {
              // Auth.js throws on credentials error; redirect handled by Auth.js
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Enter your password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Sign in
          </button>
        </form>

        <p className="text-center text-sm text-muted">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

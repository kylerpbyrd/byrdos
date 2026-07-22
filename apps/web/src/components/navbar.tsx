'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LayoutDashboard, Wallet, ArrowLeftRight, Settings, LogOut } from 'lucide-react';
import { Button } from '@byrdos/ui';
import { ThemeToggle } from './theme-toggle';

const navLinks = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 p-4">
          <Link href="/" className="text-xl font-bold tracking-tight text-foreground">
            byrdOS
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`min-h-11 rounded-md px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted hover:bg-surface-elevated hover:text-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {status === 'authenticated' && session?.user?.email ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ redirectTo: '/login' })}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="size-5" />
                <span className="sr-only">Sign out</span>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/60 md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                  isActive ? 'text-primary' : 'text-muted hover:text-foreground'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

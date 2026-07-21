import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import { QueryProvider } from '@byrdos/ui';
import { Navbar } from '@/components/navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'byrdOS',
  description: 'AI-first personal financial operating system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <SessionProvider>
          <QueryProvider>
            <Navbar />
            <main>{children}</main>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

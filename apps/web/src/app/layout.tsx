import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'byrdOS',
  description: 'AI-first personal financial operating system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

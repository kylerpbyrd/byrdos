export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: [
    // Protect dashboard and settings routes
    '/((?!api|_next/static|_next/image|favicon.ico|login|signup|$).*)',
  ],
};

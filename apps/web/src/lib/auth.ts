import NextAuth from 'next-auth';
import type { Session } from 'next-auth';
import type { NextRequest } from 'next/server';
import { createAuthConfig } from '@byrdos/auth';

const authSecret = process.env.AUTH_SECRET || 'dev-secret-change-me';

const nextAuth = NextAuth(
  createAuthConfig({
    jwtSecret: authSecret,
    googleEnabled: !!process.env.AUTH_GOOGLE_ID,
    googleClientId: process.env.AUTH_GOOGLE_ID,
    googleClientSecret: process.env.AUTH_GOOGLE_SECRET,
  }),
);

export const handlers: { GET: (req: NextRequest) => Promise<Response>; POST: (req: NextRequest) => Promise<Response> } =
  nextAuth.handlers;
export const auth: () => Promise<Session | null> = nextAuth.auth;
export const signIn: (provider: string, options?: Record<string, unknown>) => Promise<never> = nextAuth.signIn;
export const signOut: (options?: { redirectTo?: string }) => Promise<never> = nextAuth.signOut;

import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

export interface AuthConfigOptions {
  /** JWT secret for signing */
  jwtSecret: string;
  /** Base URL of the NestJS API (e.g. http://localhost:4000/api) */
  apiUrl?: string;
  /** Whether to enable Google OAuth */
  googleEnabled?: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
}

export function createAuthConfig(options: AuthConfigOptions): NextAuthConfig {
  const providers: NextAuthConfig['providers'] = [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const apiUrl = options.apiUrl || process.env.API_URL || 'http://localhost:4000/api';

        try {
          const res = await fetch(`${apiUrl}/auth/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          if (!res.ok) return null;

          const data = (await res.json()) as {
            user: { id: string; email: string; name: string | null };
            accessToken: string;
          };

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            accessToken: data.accessToken,
          };
        } catch {
          return null;
        }
      },
    }),
  ];

  if (options.googleEnabled && options.googleClientId && options.googleClientSecret) {
    providers.push(
      Google({
        clientId: options.googleClientId,
        clientSecret: options.googleClientSecret,
      }),
    );
  }

  return {
    secret: options.jwtSecret,
    providers,
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    jwt: {
      maxAge: 15 * 60, // 15 minutes for access token
    },
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.sub = user.id as string;
          token.email = user.email as string;
          token.accessToken = user.accessToken as string;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.sub as string;
        }
        session.accessToken = token.accessToken as string;
        return session;
      },
    },
    pages: {
      signIn: '/login',
    },
  };
}

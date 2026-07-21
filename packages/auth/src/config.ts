import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

export interface AuthConfigOptions {
  /** JWT secret for signing */
  jwtSecret: string;
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
        // Stub — real implementation in apps/api uses UserRepository
        // For now, return null (auth fails) until M1.3 wires the real verify
        void credentials;
        return null;
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
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.sub as string;
        }
        return session;
      },
    },
    pages: {
      signIn: '/login',
    },
  };
}

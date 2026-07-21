import type { Session as NextAuthSession } from 'next-auth';

/** Extended session with userId */
export interface AppSession extends NextAuthSession {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
}

/** JWT token claims */
export interface TokenClaims {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

/** Refresh token record */
export interface RefreshToken {
  tokenId: string;
  userId: string;
  hash: string;
  expiresAt: Date;
}

import type { DefaultSession } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    accessToken?: string;
  }

  interface Session extends DefaultSession {
    accessToken: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    accessToken?: string;
  }
}

export { createAuthConfig, type AuthConfigOptions } from './config.js';
export { createJwksVerifier, createStaticJwtVerifier, type JwtPayload } from './jwt.js';
export { type AppSession, type TokenClaims, type RefreshToken } from './session.js';
export { hashPassword, verifyPassword } from './password.js';
export { encrypt, decrypt, deriveKey, getEncryptionKey, getKeyRing } from './encryption.js';
export { CredentialService, type CredentialRepository } from './credential.service.js';

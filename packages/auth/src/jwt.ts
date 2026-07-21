import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  iat: number;
  exp: number;
}

/**
 * Create a JWT verifier using a JWKS endpoint (Auth.js exposes JWKS at /api/auth/jwks).
 * For development without a running Auth.js server, use createStaticJwtVerifier below.
 */
export function createJwksVerifier(jwksUrl: string) {
  const JWKS = createRemoteJWKSet(new URL(jwksUrl));
  return async (token: string): Promise<JwtPayload> => {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['RS256'],
    });
    return payload as unknown as JwtPayload;
  };
}

/**
 * Static verifier using a symmetric secret (for development/testing).
 * In production, use RS256 with JWKS via createJwksVerifier.
 */
export function createStaticJwtVerifier(secret: string) {
  const encoder = new TextEncoder();
  const key = encoder.encode(secret);

  return async (token: string): Promise<JwtPayload> => {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    return payload as unknown as JwtPayload;
  };
}

export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly refreshHash: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  readonly createdAt: Date;
}

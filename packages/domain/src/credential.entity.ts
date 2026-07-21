export interface Credential {
  readonly id: string;
  readonly integrationId: string;
  readonly keyId: string;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
// Note: cipher is intentionally NOT on the domain entity — it's a security field
// accessed only via CredentialRepository.getCipher()

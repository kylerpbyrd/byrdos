import type { Credential } from './credential.entity';

export interface CredentialRepository {
  findById(id: string): Promise<Credential | null>;
  findByIntegrationId(integrationId: string): Promise<Credential | null>;
  create(input: { id: string; integrationId: string; cipher: string; keyId: string; expiresAt?: Date | null }): Promise<Credential>;
  updateCipher(id: string, cipher: string, keyId: string): Promise<Credential>;
  /** Security-layer only: retrieve the raw cipher for decryption. Never exposed to domain services. */
  getCipher(credentialId: string): Promise<string | null>;
}

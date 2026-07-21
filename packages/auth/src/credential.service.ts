import crypto from 'crypto';
import type { Credential } from '@byrdos/domain';
import { encrypt, decrypt, getKeyRing } from './encryption';

export interface CredentialRepository {
  findById(id: string): Promise<Credential | null>;
  findByIntegrationId(integrationId: string): Promise<Credential | null>;
  create(input: { id: string; integrationId: string; cipher: string; keyId: string; expiresAt?: Date | null }): Promise<Credential>;
  updateCipher(id: string, cipher: string, keyId: string): Promise<Credential>;
  /** Security-layer only: retrieve the raw cipher for decryption. Never exposed to domain services. */
  getCipher(credentialId: string): Promise<string | null>;
}

export class CredentialService {
  constructor(private readonly credentialRepo: CredentialRepository) {}

  /**
   * Encrypt and store a provider token (e.g., Plaid access_token).
   */
  async storeToken(integrationId: string, plaintextToken: string, expiresAt?: Date | null): Promise<Credential> {
    const key = getKeyRing().get('v1')!;
    const { cipher, keyId } = encrypt(plaintextToken, key);
    const id = crypto.randomUUID();

    return this.credentialRepo.create({ id, integrationId, cipher, keyId, expiresAt });
  }

  /**
   * Decrypt and return the plaintext token for a credential.
   */
  async getToken(credentialId: string): Promise<string> {
    const cred = await this.credentialRepo.findById(credentialId);
    if (!cred) {
      throw new Error(`Credential ${credentialId} not found`);
    }

    // We need the cipher from the repository. The domain entity doesn't expose it,
    // so we need a separate method on the repository interface.
    const cipher = await this.credentialRepo.getCipher(credentialId);
    if (!cipher) {
      throw new Error(`Cipher not found for credential ${credentialId}`);
    }

    const keyRing = getKeyRing();
    const key = keyRing.get(cred.keyId);
    if (!key) {
      throw new Error(`Encryption key '${cred.keyId}' not found in keyring. Key rotation may be incomplete.`);
    }

    return decrypt(cipher, key);
  }

  /**
   * Re-encrypt a credential with the current primary key (for key rotation).
   */
  async rotateKey(credentialId: string): Promise<Credential> {
    const plaintext = await this.getToken(credentialId);
    const cred = await this.credentialRepo.findById(credentialId);
    if (!cred) throw new Error(`Credential ${credentialId} not found`);

    const newKey = getKeyRing().get('v1')!;
    const { cipher, keyId } = encrypt(plaintext, newKey);

    return this.credentialRepo.updateCipher(credentialId, cipher, keyId);
  }

  /**
   * Revoke a credential by deleting the cipher (renders it unusable).
   */
  async revoke(credentialId: string): Promise<void> {
    // Overwrite cipher with empty string; repository should handle
    await this.credentialRepo.updateCipher(credentialId, '', 'revoked');
  }
}

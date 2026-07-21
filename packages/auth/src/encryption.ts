import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns base64-encoded: iv(12) || ciphertext || authTag(16)
 */
export function encrypt(plaintext: string, key: Buffer): { cipher: string; keyId: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: iv || encrypted || authTag
  const packed = Buffer.concat([iv, encrypted, authTag]);
  return {
    cipher: packed.toString('base64'),
    keyId: 'v1', // Current key version; rotate by incrementing
  };
}

/**
 * Decrypt a ciphertext produced by encrypt().
 */
export function decrypt(cipherBase64: string, key: Buffer): string {
  const packed = Buffer.from(cipherBase64, 'base64');

  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Ciphertext too short: invalid or corrupted data');
  }

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(packed.length - AUTH_TAG_LENGTH);
  const encrypted = packed.subarray(IV_LENGTH, packed.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Derive a 256-bit encryption key from an environment variable.
 * Uses SHA-256 to ensure consistent 32-byte key regardless of input length.
 */
export function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Get the encryption key from the environment.
 * In production, this should come from a KMS/HSM, not an env var.
 */
export function getEncryptionKey(): Buffer {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY environment variable is required. ' +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return deriveKey(secret);
}

/**
 * Key rotation support.
 * Returns a map of keyId -> Buffer for all active keys.
 * The current key is always 'v1'. On rotation, old keys get new IDs and 'v1' gets the new key.
 */
export function getKeyRing(): Map<string, Buffer> {
  const primaryKey = getEncryptionKey();
  const keys = new Map<string, Buffer>();
  keys.set('v1', primaryKey);

  // Check for rotated keys in env: CREDENTIAL_ENCRYPTION_KEY_V2, _V3, etc.
  let version = 2;
  while (true) {
    const legacyKey = process.env[`CREDENTIAL_ENCRYPTION_KEY_V${version}`];
    if (!legacyKey) break;
    keys.set(`v${version}`, deriveKey(legacyKey));
    version++;
  }

  return keys;
}

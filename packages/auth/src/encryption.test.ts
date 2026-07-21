import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, deriveKey, getEncryptionKey, getKeyRing } from './encryption.js';

describe('encryption', () => {
  const testKey = deriveKey('test-secret-that-can-be-any-length');

  describe('encrypt / decrypt', () => {
    it('should round-trip plaintext', () => {
      const plaintext = 'hello world';
      const { cipher } = encrypt(plaintext, testKey);

      const decrypted = decrypt(cipher, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different output each time due to random IV', () => {
      const plaintext = 'same plaintext';
      const { cipher: cipher1 } = encrypt(plaintext, testKey);
      const { cipher: cipher2 } = encrypt(plaintext, testKey);

      expect(cipher1).not.toBe(cipher2);
      expect(decrypt(cipher1, testKey)).toBe(plaintext);
      expect(decrypt(cipher2, testKey)).toBe(plaintext);
    });

    it('should reject tampered ciphertext', () => {
      const { cipher } = encrypt('secret message', testKey);
      const tampered = Buffer.from(cipher, 'base64');
      tampered[15] = tampered[15] ^ 0xff; // flip bits somewhere in the ciphertext
      const tamperedBase64 = tampered.toString('base64');

      expect(() => decrypt(tamperedBase64, testKey)).toThrow();
    });

    it('should reject ciphertext that is too short', () => {
      const shortCipher = Buffer.alloc(10).toString('base64');

      expect(() => decrypt(shortCipher, testKey)).toThrow('Ciphertext too short');
    });
  });

  describe('deriveKey', () => {
    it('should produce a 32-byte buffer', () => {
      const key = deriveKey('short');

      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(32);
    });

    it('should be deterministic', () => {
      const key1 = deriveKey('same input');
      const key2 = deriveKey('same input');

      expect(key1.equals(key2)).toBe(true);
    });
  });

  describe('getEncryptionKey', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Clone env so we can mutate it safely for each test
      process.env = { ...originalEnv };
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should throw when env var is missing', () => {
      expect(() => getEncryptionKey()).toThrow('CREDENTIAL_ENCRYPTION_KEY environment variable is required');
    });

    it('should return a Buffer when env var is set', () => {
      process.env.CREDENTIAL_ENCRYPTION_KEY = 'my-secret-key';

      const key = getEncryptionKey();

      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(32);
    });
  });

  describe('getKeyRing', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      process.env.CREDENTIAL_ENCRYPTION_KEY = 'primary-secret';
      delete process.env.CREDENTIAL_ENCRYPTION_KEY_V2;
      delete process.env.CREDENTIAL_ENCRYPTION_KEY_V3;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should include v1 key', () => {
      const ring = getKeyRing();

      expect(ring.has('v1')).toBe(true);
      expect(Buffer.isBuffer(ring.get('v1'))).toBe(true);
      expect(ring.get('v1')?.length).toBe(32);
    });

    it('should include legacy keys', () => {
      process.env.CREDENTIAL_ENCRYPTION_KEY_V2 = 'legacy-secret-2';

      const ring = getKeyRing();

      expect(ring.has('v1')).toBe(true);
      expect(ring.has('v2')).toBe(true);
      expect(ring.get('v1')?.equals(deriveKey('primary-secret'))).toBe(true);
      expect(ring.get('v2')?.equals(deriveKey('legacy-secret-2'))).toBe(true);
    });
  });
});

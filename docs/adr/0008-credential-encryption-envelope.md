# ADR-0008: Credential Encryption Envelope

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-20 |
| Author | Architect (byrdOS) |
| Supersedes | — |
| Superseded by | — |
| Inherits | ADR-0000 |
| Implements | §6 Security-first |

## Context

byrdOS stores long-lived credentials and tokens obtained from financial aggregators (e.g., Plaid `access_token`) and, eventually, direct OAuth providers. ADR-0000 §6 requires that credentials and tokens be stored as envelope-encrypted blobs and that the encryption key never reside in the database. This ADR specifies the exact envelope format, key management rules, and rotation procedure.

## Decision

- Encryption algorithm: AES-256-GCM envelope.
- Key source: derived from the `CREDENTIAL_ENCRYPTION_KEY` environment variable; never stored in the database.
- Key rotation support: `keyId` stored on the `Credential` row identifies which key encrypted the blob.
- Ciphertext storage: the encrypted value is stored in the `Credential.cipher` column.
- Audit logging: every token write logs actor, action, target `tokenId`, and timestamp; token values are never logged.

### Encryption flow

1. Generate a random 12-byte IV (nonce).
2. Encrypt the plaintext with AES-256-GCM using the key and IV.
3. Assemble the payload: `iv (12 bytes) || ciphertext || authTag (16 bytes)`.
4. Base64-encode the result and store it with the corresponding `keyId`.

### Decryption flow

1. Decode the base64 value.
2. Extract the IV from the first 12 bytes.
3. Decrypt the remainder and verify the authentication tag.

### Key rotation

- New keys are appended to the active key set; old keys are retained for decrypting existing rows.
- Re-encryption is performed lazily on access or via a background job.
- Rotation cadence is quarterly or immediately on a security incident.
- The active key used for new encryption is identified by the highest `keyId`.

## Consequences

- **Positive**: AES-256-GCM provides authenticated encryption, protecting both confidentiality and integrity.
- **Positive**: Storing `keyId` per row enables seamless key rotation without a global re-encryption event.
- **Negative**: Loss of the encryption key renders all stored credentials permanently inaccessible; key management and backups are critical operational concerns.
- **Negative**: Slightly larger storage than plaintext due to IV and authTag overhead.

## Alternatives considered

- **AES-256-CBC with HMAC** — rejected: GCM provides combined confidentiality and authenticity with one primitive and is the modern standard for envelope encryption.
- **Database-level encryption (TDE)** — rejected: Does not satisfy ADR-0000 §6's requirement that the key be separated from the database and that credentials be stored as encrypted blobs.

## Changelog

| Date | Change | Author |
|---|---|---|
| 2026-07-20 | Accepted AES-256-GCM credential encryption envelope | Architect (byrdOS) |

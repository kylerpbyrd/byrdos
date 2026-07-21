import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Credential, CredentialRepository } from '@byrdos/domain';
import type { DbClient } from '../client.js';
import { credentials } from '../schema/credential.schema.js';

export class DrizzleCredentialRepository implements CredentialRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Credential | null> {
    const rows = await this.db.select().from(credentials).where(eq(credentials.id, id)).limit(1);
    return rows[0] ? mapCredentialRow(rows[0]) : null;
  }

  async findByIntegrationId(integrationId: string): Promise<Credential | null> {
    const rows = await this.db
      .select()
      .from(credentials)
      .where(eq(credentials.integrationId, integrationId))
      .limit(1);
    return rows[0] ? mapCredentialRow(rows[0]) : null;
  }

  async create(input: {
    id: string;
    integrationId: string;
    cipher: string;
    keyId: string;
    expiresAt?: Date | null;
  }): Promise<Credential> {
    const id = input.id || uuidv7();
    const [row] = await this.db
      .insert(credentials)
      .values({
        id,
        integrationId: input.integrationId,
        cipher: input.cipher,
        keyId: input.keyId,
        expiresAt: input.expiresAt ?? null,
      })
      .returning();
    return mapCredentialRow(row);
  }

  async updateCipher(id: string, cipher: string, keyId: string): Promise<Credential> {
    const [row] = await this.db
      .update(credentials)
      .set({ cipher, keyId, updatedAt: new Date() })
      .where(eq(credentials.id, id))
      .returning();
    return mapCredentialRow(row);
  }

  async getCipher(credentialId: string): Promise<string | null> {
    const rows = await this.db
      .select({ cipher: credentials.cipher })
      .from(credentials)
      .where(eq(credentials.id, credentialId))
      .limit(1);
    return rows[0]?.cipher ?? null;
  }
}

function mapCredentialRow(row: typeof credentials.$inferSelect): Credential {
  return {
    id: row.id,
    integrationId: row.integrationId,
    keyId: row.keyId,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

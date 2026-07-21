import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { ProviderConnection, ConnectionStatus } from '@byrdos/domain';
import type { DbClient } from '../client.js';
import { providerConnections } from '../schema/provider-connection.schema.js';

export class DrizzleProviderConnectionRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: {
    integrationId: string;
    externalId: string;
    institutionName: string | null;
  }): Promise<ProviderConnection> {
    const id = uuidv7();
    const [row] = await this.db
      .insert(providerConnections)
      .values({
        id,
        integrationId: input.integrationId,
        externalId: input.externalId,
        institutionName: input.institutionName,
      })
      .returning();
    return mapConnectionRow(row);
  }

  async findById(id: string): Promise<ProviderConnection | null> {
    const rows = await this.db.select().from(providerConnections).where(eq(providerConnections.id, id)).limit(1);
    return rows[0] ? mapConnectionRow(rows[0]) : null;
  }

  async findByIntegrationId(integrationId: string): Promise<ProviderConnection[]> {
    const rows = await this.db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.integrationId, integrationId));
    return rows.map(mapConnectionRow);
  }

  async updateStatus(id: string, status: ConnectionStatus): Promise<ProviderConnection> {
    const [row] = await this.db
      .update(providerConnections)
      .set({ status, updatedAt: new Date() })
      .where(eq(providerConnections.id, id))
      .returning();
    return mapConnectionRow(row);
  }

  async updateWebhookCursor(id: string, cursor: string): Promise<void> {
    await this.db
      .update(providerConnections)
      .set({ webhookCursor: cursor, lastWebhookAt: new Date(), updatedAt: new Date() })
      .where(eq(providerConnections.id, id));
  }
}

function mapConnectionRow(row: typeof providerConnections.$inferSelect): ProviderConnection {
  return {
    id: row.id,
    integrationId: row.integrationId,
    externalId: row.externalId,
    providerId: '', // Resolved via join with integrations table
    institutionName: row.institutionName,
    status: row.status as ConnectionStatus,
    lastWebhookAt: row.lastWebhookAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

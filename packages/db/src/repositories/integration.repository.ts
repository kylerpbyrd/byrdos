import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Integration, IntegrationStatus, ProviderId } from '@byrdos/domain';
import type { DbClient } from '../client.js';
import { integrations } from '../schema/integration.schema.js';

export class DrizzleIntegrationRepository {
  constructor(private readonly db: DbClient) {}

  async create(userId: string, providerId: ProviderId): Promise<Integration> {
    const id = uuidv7();
    const [row] = await this.db.insert(integrations).values({ id, userId, providerId }).returning();
    return mapIntegrationRow(row);
  }

  async findById(id: string): Promise<Integration | null> {
    const rows = await this.db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
    return rows[0] ? mapIntegrationRow(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Integration[]> {
    const rows = await this.db.select().from(integrations).where(eq(integrations.userId, userId));
    return rows.map(mapIntegrationRow);
  }

  async updateStatus(id: string, status: IntegrationStatus): Promise<Integration> {
    const [row] = await this.db
      .update(integrations)
      .set({ status, updatedAt: new Date() })
      .where(eq(integrations.id, id))
      .returning();
    return mapIntegrationRow(row);
  }
}

function mapIntegrationRow(row: typeof integrations.$inferSelect): Integration {
  return {
    id: row.id,
    userId: row.userId,
    providerId: row.providerId as ProviderId,
    status: row.status as IntegrationStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { v7 as uuidv7 } from 'uuid';
import { sql } from 'drizzle-orm';
import path from 'node:path';
import * as schema from '../schema/index.js';
import type { DbClient } from '../client.js';

const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/byrdos_dev';

export interface TestContext {
  db: DbClient;
  client: postgres.Sql;
  cleanup: () => Promise<void>;
}

export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const client = postgres(dbUrl, { max: 1, idle_timeout: 2, connect_timeout: 5 });
    await client`SELECT 1`;
    await client.end({ timeout: 5 });
    return true;
  } catch {
    return false;
  }
}

export async function createTestContext(): Promise<TestContext> {
  const client = postgres(dbUrl, { max: 1 });
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });

  return {
    db,
    client,
    cleanup: async () => {
      await client.end({ timeout: 10 });
    },
  };
}

export async function truncateTables(db: DbClient): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      event_log,
      sync_job_stages,
      sync_jobs,
      sync_cursors,
      categories,
      transactions,
      balances,
      accounts,
      provider_connections,
      credentials,
      integrations,
      audit_logs,
      sessions,
      users
    CASCADE
  `);
}

export async function seedUser(db: DbClient): Promise<string> {
  const id = uuidv7();
  await db.insert(schema.users).values({
    id,
    email: `test-${id}@example.com`,
    name: 'Test User',
  });
  return id;
}

export async function seedIntegration(db: DbClient, userId: string): Promise<string> {
  const id = uuidv7();
  await db.insert(schema.integrations).values({
    id,
    userId,
    providerId: 'plaid',
  });
  return id;
}

export async function seedConnection(db: DbClient, integrationId: string): Promise<string> {
  const id = uuidv7();
  await db.insert(schema.providerConnections).values({
    id,
    integrationId,
    externalId: `conn-${id}`,
    institutionName: 'Test Bank',
  });
  return id;
}

export async function seedAccount(
  db: DbClient,
  connectionId: string,
  overrides?: Partial<typeof schema.accounts.$inferInsert> & { id?: string },
): Promise<string> {
  const { id: overrideId, ...rest } = overrides ?? {};
  const id = overrideId ?? uuidv7();
  await db.insert(schema.accounts).values({
    id,
    connectionId,
    externalId: `acct-${id}`,
    name: 'Test Account',
    type: 'depository',
    currentBalanceCents: 10000,
    currency: 'USD',
    status: 'active',
    ...rest,
  });
  return id;
}

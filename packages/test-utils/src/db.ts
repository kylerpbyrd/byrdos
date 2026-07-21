import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@byrdos/db/schema';

export async function createTestDb() {
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!;
  const client = postgres(dbUrl, { max: 1 });
  const db = drizzle(client, { schema });
  return { db, client, cleanup: () => client.end() };
}

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { loadEnvFile } from 'process';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import * as schema from './schema/index.js';

// Auto-load .env from project root so that all consumers of @byrdos/db
// (API, workers, scheduler, etc.) pick up DATABASE_URL without manual setup.
// Walks up from this compiled file's location to find the first .env.
if (!process.env.DATABASE_URL) {
  let dir = dirname(fileURLToPath(import.meta.url));
  const root = resolve(dir, '/');
  while (dir !== root) {
    const envPath = resolve(dir, '.env');
    if (existsSync(envPath)) {
      loadEnvFile(envPath);
      break;
    }
    dir = resolve(dir, '..');
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Ensure a .env file with DATABASE_URL exists ' +
    'in the project root, or set the environment variable directly.',
  );
}
const client = postgres(connectionString, { max: 10 });
export const db = drizzle(client, { schema });
export type DbClient = typeof db;

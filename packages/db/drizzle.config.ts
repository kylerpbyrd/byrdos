import { defineConfig } from 'drizzle-kit';
import { resolve } from 'path';
import { loadEnvFile } from 'process';

// Load root .env so drizzle-kit can read DATABASE_URL
// CWD during drizzle-kit execution is the package root (packages/db)
loadEnvFile(resolve('../../.env'));

export default defineConfig({
  schema: './src/schema/*.schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

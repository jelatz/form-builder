import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.ts';

export function createNeonDb(databaseUrl: string) {
  if (!databaseUrl.trim()) {
    throw new Error(
      'DATABASE_URL is not set. Add your Neon PostgreSQL connection string to .env.',
    );
  }
  const sqlClient = neon(databaseUrl);
  return drizzle({ client: sqlClient, schema });
}

export type NeonDb = ReturnType<typeof createNeonDb>;

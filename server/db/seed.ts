import { loadServerEnv } from '../env.ts';
import { hashPassword } from '../lib/crypto.ts';
import { createNeonDb } from './client.ts';
import { NeonDrizzleStore } from './neon-store.ts';
import type { AppStore } from './store.ts';

/**
 * Seeds the database idempotently with only the initial superadmin user.
 */
export async function seedDatabase(
  store: AppStore,
  options?: {
    superadminUsername?: string;
    superadminPassword?: string;
  },
): Promise<void> {
  const superadminUsername = options?.superadminUsername ?? 'superadmin';
  const superadminPassword = options?.superadminPassword ?? 'admin123';
  const nowIso = new Date().toISOString();

  const existingSuperadmin = await store.findUserByUsername(superadminUsername);
  if (!existingSuperadmin) {
    await store.createUser({
      id: 'user_superadmin',
      clientId: null,
      username: superadminUsername,
      displayName: 'Super Admin',
      passwordHash: await hashPassword(superadminPassword),
      role: 'superadmin',
      isActive: true,
      nowIso,
    });
  }
}

async function main(): Promise<void> {
  const env = loadServerEnv();
  const db = createNeonDb(env.databaseUrl);
  const store = new NeonDrizzleStore(db);
  await seedDatabase(store, {
    superadminUsername: env.seedSuperadminUsername,
    superadminPassword: env.seedSuperadminPassword,
  });
  console.log('Seeded Neon PostgreSQL database successfully.');
}

const isEntrypoint =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1]?.endsWith('seed.ts');

if (isEntrypoint) {
  main().catch((error: unknown) => {
    console.error('Failed to seed database:', error);
    process.exit(1);
  });
}

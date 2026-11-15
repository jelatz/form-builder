import { SEED_FORMS, SEED_SUBMISSIONS, SEED_TENANTS } from './seed-data.ts';
import { loadServerEnv } from '../env.ts';
import { hashPassword } from '../lib/crypto.ts';
import { createNeonDb } from './client.ts';
import { NeonDrizzleStore } from './neon-store.ts';
import type { AppStore } from './store.ts';

/**
 * Seeds the database idempotently with:
 * - Initial superadmin user
 * - Starter client tenants (Acme Corp, Globex Cloud)
 * - Default tenant admin login for Acme Corp (acme_admin / acme1234)
 * - Starter forms and sample submissions
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

  for (const tenant of SEED_TENANTS) {
    const existing = await store.findClientById(tenant.id);
    if (!existing) {
      await store.createClient({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status ?? 'active',
        nowIso: tenant.createdAt,
      });
    }
  }

  const existingAcmeAdmin = await store.findUserByUsername('acme_admin');
  if (!existingAcmeAdmin) {
    await store.createUser({
      id: 'user_acme_admin',
      clientId: 'tenant_acme',
      username: 'acme_admin',
      displayName: 'Acme Admin',
      passwordHash: await hashPassword('acme1234'),
      role: 'tenant_admin',
      isActive: true,
      nowIso,
    });
  }

  const existingGlobexAdmin = await store.findUserByUsername('globex_admin');
  if (!existingGlobexAdmin) {
    await store.createUser({
      id: 'user_globex_admin',
      clientId: 'tenant_globex',
      username: 'globex_admin',
      displayName: 'Globex Admin',
      passwordHash: await hashPassword('globex1234'),
      role: 'tenant_admin',
      isActive: true,
      nowIso,
    });
  }

  for (const form of SEED_FORMS) {
    const existing = await store.findFormById(form.id, form.clientId);
    if (!existing) {
      await store.createForm({
        id: form.id,
        clientId: form.clientId,
        slug: form.slug,
        title: form.title,
        description: form.description,
        submitButtonText: form.submitButtonText,
        isPublished: form.isPublished ?? true,
        fields: form.fields,
        nowIso: form.updatedAt,
      });
    }
  }

  const existingSubs = await store.listSubmissions({ limit: 1, offset: 0 });
  if (existingSubs.total === 0) {
    for (const sub of SEED_SUBMISSIONS) {
      await store.createSubmission(sub);
    }
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

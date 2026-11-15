import type {
  ClientTenant,
  FormSchema,
  SubmissionRecord,
} from '../../../src/domain/form-schema/types.ts';
import type { AppStore } from '../../db/store.ts';
import { createEntityId, hashPassword } from '../../lib/crypto.ts';
import { ensureUniqueSlug } from '../../lib/slug.ts';
import type { PaginatedResult, PublicUser } from '../../types.ts';
import type {
  CreateTenantDto,
  CreateTenantUserDto,
  UpdateTenantDto,
  UpdateTenantUserDto,
} from './dto.ts';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; statusCode: number; error: string };

export async function listAllTenantsAction(
  store: AppStore,
): Promise<ClientTenant[]> {
  return store.listClients();
}

export async function createTenantAction(
  store: AppStore,
  dto: CreateTenantDto,
): Promise<{ tenant: ClientTenant; starterForm: FormSchema }> {
  const existingTenants = await store.listClients();
  const slugSet = new Set(existingTenants.map((t) => t.slug));
  const uniqueSlug = ensureUniqueSlug(
    dto.slug || dto.name,
    slugSet,
    'tenant',
  );
  const nowIso = new Date().toISOString();

  const tenant = await store.createClient({
    id: createEntityId('tenant'),
    name: dto.name,
    slug: uniqueSlug,
    status: 'active',
    nowIso,
  });

  const starterForm = await store.createForm({
    id: createEntityId('form'),
    clientId: tenant.id,
    slug: 'default-intake',
    title: `${tenant.name} Intake Form`,
    description: `Default intake form for ${tenant.name}`,
    submitButtonText: 'Submit',
    isPublished: true,
    fields: [
      {
        id: createEntityId('field_text'),
        type: 'text',
        label: 'Full Name',
        placeholder: 'Enter your name',
        required: true,
      },
    ],
    nowIso,
  });

  return { tenant, starterForm };
}

export async function updateTenantAction(
  store: AppStore,
  tenantId: string,
  dto: UpdateTenantDto,
): Promise<ActionResult<ClientTenant>> {
  const existing = await store.findClientById(tenantId);
  if (!existing) {
    return { ok: false, statusCode: 404, error: 'Tenant not found.' };
  }

  let nextSlug = dto.slug;
  if (dto.slug !== undefined) {
    const allTenants = await store.listClients();
    const otherSlugs = new Set(
      allTenants.filter((t) => t.id !== tenantId).map((t) => t.slug),
    );
    nextSlug = ensureUniqueSlug(dto.slug, otherSlugs, 'tenant');
  }

  const updated = await store.updateClient(tenantId, {
    name: dto.name,
    slug: nextSlug,
    status: dto.status,
    nowIso: new Date().toISOString(),
  });

  if (!updated) {
    return { ok: false, statusCode: 404, error: 'Tenant not found.' };
  }

  return { ok: true, data: updated };
}

export async function deleteTenantAction(
  store: AppStore,
  tenantId: string,
): Promise<ActionResult<{ deleted: true }>> {
  const existingTenants = await store.listClients();
  if (existingTenants.length <= 1) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Cannot delete the last remaining tenant.',
    };
  }

  const deleted = await store.deleteClient(tenantId);
  if (!deleted) {
    return { ok: false, statusCode: 404, error: 'Tenant not found.' };
  }

  return { ok: true, data: { deleted: true } };
}

export async function listUsersAction(
  store: AppStore,
  clientId?: string,
): Promise<PublicUser[]> {
  return store.listUsers(clientId);
}

export async function createTenantUserAction(
  store: AppStore,
  dto: CreateTenantUserDto,
): Promise<ActionResult<PublicUser>> {
  const tenant = await store.findClientById(dto.clientId);
  if (!tenant) {
    return { ok: false, statusCode: 404, error: 'Target tenant not found.' };
  }

  const duplicate = await store.findUserByUsername(dto.username);
  if (duplicate) {
    return {
      ok: false,
      statusCode: 409,
      error: 'Username is already taken.',
    };
  }

  const nowIso = new Date().toISOString();
  const passwordHash = await hashPassword(dto.password);
  const created = await store.createUser({
    id: createEntityId('user'),
    clientId: tenant.id,
    username: dto.username,
    displayName: dto.displayName,
    passwordHash,
    role: dto.role,
    isActive: true,
    nowIso,
  });

  return { ok: true, data: created };
}

export async function updateTenantUserAction(
  store: AppStore,
  userId: string,
  dto: UpdateTenantUserDto,
): Promise<ActionResult<PublicUser>> {
  const existing = await store.findUserById(userId);
  if (!existing) {
    return { ok: false, statusCode: 404, error: 'User not found.' };
  }
  if (existing.role === 'superadmin') {
    return {
      ok: false,
      statusCode: 403,
      error: 'Superadmin account cannot be modified via tenant user endpoint.',
    };
  }

  const nowIso = new Date().toISOString();
  const passwordHash =
    dto.password !== undefined ? await hashPassword(dto.password) : undefined;

  const updated = await store.updateUser(userId, {
    displayName: dto.displayName,
    role: dto.role,
    isActive: dto.isActive,
    passwordHash,
    nowIso,
  });

  if (!updated) {
    return { ok: false, statusCode: 404, error: 'User not found.' };
  }

  if (dto.isActive === false || dto.password !== undefined) {
    await store.revokeUserSessions(userId, nowIso);
  }

  return { ok: true, data: updated };
}

export async function deleteTenantUserAction(
  store: AppStore,
  userId: string,
  actingUserId: string,
): Promise<ActionResult<{ deleted: true }>> {
  if (userId === actingUserId) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Cannot delete the currently authenticated user.',
    };
  }

  const existing = await store.findUserById(userId);
  if (!existing) {
    return { ok: false, statusCode: 404, error: 'User not found.' };
  }
  if (existing.role === 'superadmin') {
    return {
      ok: false,
      statusCode: 403,
      error: 'Superadmin account cannot be deleted.',
    };
  }

  await store.deleteUser(userId);
  return { ok: true, data: { deleted: true } };
}

export async function listGlobalFormsAction(
  store: AppStore,
  clientId?: string,
  search?: string,
): Promise<FormSchema[]> {
  return store.listForms({ clientId, search });
}

export async function listGlobalSubmissionsAction(
  store: AppStore,
  query: {
    clientId?: string;
    formId?: string;
    search?: string;
    limit: number;
    offset: number;
  },
): Promise<PaginatedResult<SubmissionRecord>> {
  return store.listSubmissions(query);
}

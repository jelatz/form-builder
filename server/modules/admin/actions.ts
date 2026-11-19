import type {
  ClientTenant,
  FormSchema,
  SubmissionRecord,
} from '../../../src/domain/form-schema/types.ts';
import {
  ensureUniqueUsername,
  toSnakeCaseUsername,
} from '../../../src/shared/lib/username.ts';
import type { AppStore } from '../../db/store.ts';
import {
  createEntityId,
  generateHexPassword,
  hashPassword,
} from '../../lib/crypto.ts';
import type { EmailDeliveryResult, EmailService } from '../../lib/email.ts';
import { ensureUniqueSlug, slugify } from '../../lib/slug.ts';
import type { PaginatedResult, PublicUser } from '../../types.ts';
import type {
  CreateTenantDto,
  CreateTenantUserDto,
  ResetUserCredentialsDto,
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

export interface CreateTenantDependencies {
  emailService: EmailService;
  appOrigin: string;
}

export interface CreateTenantProvisionResult {
  tenant: ClientTenant;
  adminUser: PublicUser;
  emailDelivery: EmailDeliveryResult;
}

export async function createTenantAction(
  store: AppStore,
  dto: CreateTenantDto,
  deps: CreateTenantDependencies,
): Promise<ActionResult<CreateTenantProvisionResult>> {
  let adminUsername: string;
  if (dto.adminUsername !== undefined) {
    const duplicateUser = await store.findUserByUsername(dto.adminUsername);
    if (duplicateUser) {
      return {
        ok: false,
        statusCode: 409,
        error: `Username "${dto.adminUsername}" is already taken.`,
      };
    }
    adminUsername = dto.adminUsername;
  } else {
    adminUsername = await ensureUniqueUsername(
      toSnakeCaseUsername(dto.name),
      async (candidate) => (await store.findUserByUsername(candidate)) !== null,
    );
  }

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

  try {
    const rawPassword = generateHexPassword();
    const passwordHash = await hashPassword(rawPassword);
    const adminUser = await store.createUser({
      id: createEntityId('user'),
      clientId: tenant.id,
      username: adminUsername,
      displayName: `${tenant.name} Admin`,
      passwordHash,
      role: 'tenant_admin',
      isActive: true,
      nowIso,
    });

    const normalizedOrigin = deps.appOrigin.replace(/\/+$/, '');
    const loginUrl = `${normalizedOrigin}/t/${tenant.slug}/login`;

    const emailDelivery = await deps.emailService.sendTenantWelcomeEmail({
      to: dto.email,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      username: adminUser.username,
      password: rawPassword,
      loginUrl,
    });

    return {
      ok: true,
      data: { tenant, adminUser, emailDelivery },
    };
  } catch (err) {
    // Roll back tenant (cascades to provisioned admin user)
    try {
      await store.deleteClient(tenant.id);
    } catch {
      // Best-effort rollback
    }
    const reason =
      err instanceof Error && err.message.trim()
        ? err.message
        : 'Failed to deliver onboarding credentials email.';
    return {
      ok: false,
      statusCode: 502,
      error: `Tenant provisioning rolled back: ${reason}`,
    };
  }
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

  let nextSlug: string | undefined;
  if (dto.slug !== undefined) {
    const normalizedSlug = slugify(dto.slug, '');
    if (!normalizedSlug) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Tenant slug must contain at least one letter or number.',
      };
    }
    if (normalizedSlug !== existing.slug) {
      const conflict = await store.findClientBySlug(normalizedSlug);
      if (conflict && conflict.id !== tenantId) {
        return {
          ok: false,
          statusCode: 409,
          error: `Tenant slug "${normalizedSlug}" is already in use.`,
        };
      }
    }
    nextSlug = normalizedSlug;
  }

  const nowIso = new Date().toISOString();
  const updated = await store.updateClient(tenantId, {
    name: dto.name,
    slug: nextSlug,
    status: dto.status,
    nowIso,
  });

  if (!updated) {
    return { ok: false, statusCode: 404, error: 'Tenant not found.' };
  }

  if (dto.status === 'suspended') {
    await store.revokeTenantSessions(tenantId, nowIso);
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

  if (dto.username !== undefined) {
    const conflict = await store.findUserByUsername(dto.username);
    if (conflict && conflict.id !== userId) {
      return {
        ok: false,
        statusCode: 409,
        error: `Username "${dto.username}" is already taken.`,
      };
    }
  }

  const nowIso = new Date().toISOString();
  const passwordHash =
    dto.password !== undefined ? await hashPassword(dto.password) : undefined;

  const updated = await store.updateUser(userId, {
    username: dto.username,
    displayName: dto.displayName,
    role: dto.role,
    isActive: dto.isActive,
    passwordHash,
    nowIso,
  });

  if (!updated) {
    return { ok: false, statusCode: 404, error: 'User not found.' };
  }

  if (
    dto.isActive === false ||
    dto.password !== undefined ||
    dto.username !== undefined
  ) {
    await store.revokeUserSessions(userId, nowIso);
  }

  return { ok: true, data: updated };
}

export interface ResetUserCredentialsResult {
  user: PublicUser;
  generatedPassword?: string;
  emailDelivery?: EmailDeliveryResult;
}

export async function resetTenantUserCredentialsAction(
  store: AppStore,
  userId: string,
  dto: ResetUserCredentialsDto,
  deps: CreateTenantDependencies,
): Promise<ActionResult<ResetUserCredentialsResult>> {
  const existing = await store.findUserById(userId);
  if (!existing) {
    return { ok: false, statusCode: 404, error: 'User not found.' };
  }
  if (existing.role === 'superadmin' || !existing.clientId) {
    return {
      ok: false,
      statusCode: 403,
      error: 'Superadmin account cannot be modified via tenant user endpoint.',
    };
  }

  const tenant = await store.findClientById(existing.clientId);
  if (!tenant) {
    return { ok: false, statusCode: 404, error: 'Target tenant not found.' };
  }

  const isGenerated = dto.password === undefined;
  const rawPassword = dto.password ?? generateHexPassword();
  const passwordHash = await hashPassword(rawPassword);
  const nowIso = new Date().toISOString();

  const updated = await store.updateUser(userId, {
    passwordHash,
    nowIso,
  });
  if (!updated) {
    return { ok: false, statusCode: 404, error: 'User not found.' };
  }

  await store.revokeUserSessions(userId, nowIso);

  let emailDelivery: EmailDeliveryResult | undefined;
  if (dto.email) {
    const normalizedOrigin = deps.appOrigin.replace(/\/+$/, '');
    const loginUrl = `${normalizedOrigin}/t/${tenant.slug}/login`;
    try {
      emailDelivery = await deps.emailService.sendTenantWelcomeEmail({
        to: dto.email,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        username: updated.username,
        password: rawPassword,
        loginUrl,
      });
    } catch (err) {
      const reason =
        err instanceof Error && err.message.trim()
          ? err.message
          : 'Failed to deliver credentials email.';
      return {
        ok: false,
        statusCode: 502,
        error: `Password was updated, but credential email delivery failed: ${reason}`,
      };
    }
  }

  return {
    ok: true,
    data: {
      user: updated,
      ...(isGenerated ? { generatedPassword: rawPassword } : {}),
      ...(emailDelivery ? { emailDelivery } : {}),
    },
  };
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

import {
  EMAIL_PATTERN,
  USERNAME_PATTERN,
} from '../../../src/shared/lib/username.ts';
import { slugify } from '../../lib/slug.ts';

export interface CreateTenantDto {
  name: string;
  slug?: string;
  email: string;
  adminUsername?: string;
}

export interface UpdateTenantDto {
  name?: string;
  slug?: string;
  status?: 'active' | 'suspended';
}

export interface CreateTenantUserDto {
  clientId: string;
  username: string;
  displayName: string;
  password: string;
  role: 'tenant_admin' | 'tenant_member';
}

export interface UpdateTenantUserDto {
  displayName?: string;
  role?: 'tenant_admin' | 'tenant_member';
  isActive?: boolean;
  password?: string;
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function validateCreateTenantDto(
  raw: unknown,
): ValidationResult<CreateTenantDto> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Invalid tenant payload.' };
  }
  const body = raw as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim() : undefined;
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const rawAdminUsername =
    typeof body.adminUsername === 'string' ? body.adminUsername.trim() : '';
  const adminUsername = rawAdminUsername || undefined;

  const fieldErrors: Record<string, string> = {};

  if (name.length < 2) {
    fieldErrors.name = 'Tenant name must be at least 2 characters.';
  }
  if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = 'A valid admin email address is required.';
  }
  if (adminUsername !== undefined && !USERNAME_PATTERN.test(adminUsername)) {
    fieldErrors.adminUsername =
      'Admin username must be 3–32 characters (letters, numbers, _, ., or -).';
  }

  const firstError =
    fieldErrors.name ?? fieldErrors.email ?? fieldErrors.adminUsername;

  if (firstError) {
    return { ok: false, error: firstError, fieldErrors };
  }

  return { ok: true, data: { name, slug, email, adminUsername } };
}

export function validateUpdateTenantDto(
  raw: unknown,
): ValidationResult<UpdateTenantDto> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Invalid tenant update payload.' };
  }
  const body = raw as Record<string, unknown>;
  const data: UpdateTenantDto = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      return {
        ok: false,
        error: 'Tenant name must be at least 2 characters.',
        fieldErrors: { name: 'Tenant name must be at least 2 characters.' },
      };
    }
    data.name = body.name.trim();
  }

  if (body.slug !== undefined) {
    if (typeof body.slug !== 'string') {
      return {
        ok: false,
        error: 'Tenant slug must be a non-empty string.',
        fieldErrors: { slug: 'Tenant slug must be a non-empty string.' },
      };
    }
    const normalizedSlug = slugify(body.slug, '');
    if (!normalizedSlug) {
      return {
        ok: false,
        error: 'Tenant slug must contain at least one letter or number.',
        fieldErrors: {
          slug: 'Tenant slug must contain at least one letter or number.',
        },
      };
    }
    data.slug = normalizedSlug;
  }

  if (body.status !== undefined) {
    if (body.status !== 'active' && body.status !== 'suspended') {
      return {
        ok: false,
        error: 'Status must be "active" or "suspended".',
        fieldErrors: { status: 'Invalid status.' },
      };
    }
    data.status = body.status;
  }

  if (
    data.name === undefined &&
    data.slug === undefined &&
    data.status === undefined
  ) {
    return {
      ok: false,
      error: 'At least one tenant field (name, slug, or status) must be provided.',
    };
  }

  return { ok: true, data };
}

export function validateCreateTenantUserDto(
  raw: unknown,
): ValidationResult<CreateTenantUserDto> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Invalid user payload.' };
  }
  const body = raw as Record<string, unknown>;
  const clientId =
    typeof body.clientId === 'string' ? body.clientId.trim() : '';
  const username =
    typeof body.username === 'string' ? body.username.trim() : '';
  const displayName =
    typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const role = body.role;

  const fieldErrors: Record<string, string> = {};

  if (!clientId) {
    fieldErrors.clientId = 'Tenant clientId is required.';
  }
  if (!USERNAME_PATTERN.test(username)) {
    fieldErrors.username =
      'Username must be 3–32 characters (letters, numbers, _, ., or -).';
  }
  if (displayName.length < 2) {
    fieldErrors.displayName = 'Display name must be at least 2 characters.';
  }
  if (password.length < 8) {
    fieldErrors.password = 'Password must be at least 8 characters.';
  }
  if (role !== 'tenant_admin' && role !== 'tenant_member') {
    fieldErrors.role = 'Role must be "tenant_admin" or "tenant_member".';
  }

  const firstError =
    fieldErrors.clientId ??
    fieldErrors.username ??
    fieldErrors.displayName ??
    fieldErrors.password ??
    fieldErrors.role;

  if (firstError) {
    return { ok: false, error: firstError, fieldErrors };
  }

  return {
    ok: true,
    data: {
      clientId,
      username,
      displayName,
      password,
      role: role as 'tenant_admin' | 'tenant_member',
    },
  };
}

export function validateUpdateTenantUserDto(
  raw: unknown,
): ValidationResult<UpdateTenantUserDto> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Invalid user update payload.' };
  }
  const body = raw as Record<string, unknown>;
  const data: UpdateTenantUserDto = {};

  if (body.displayName !== undefined) {
    if (
      typeof body.displayName !== 'string' ||
      body.displayName.trim().length < 2
    ) {
      return {
        ok: false,
        error: 'Display name must be at least 2 characters.',
      };
    }
    data.displayName = body.displayName.trim();
  }

  if (body.role !== undefined) {
    if (body.role !== 'tenant_admin' && body.role !== 'tenant_member') {
      return {
        ok: false,
        error: 'Role must be "tenant_admin" or "tenant_member".',
      };
    }
    data.role = body.role;
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      return { ok: false, error: 'isActive must be a boolean.' };
    }
    data.isActive = body.isActive;
  }

  if (body.password !== undefined) {
    if (typeof body.password !== 'string' || body.password.length < 8) {
      return {
        ok: false,
        error: 'New password must be at least 8 characters.',
      };
    }
    data.password = body.password;
  }

  return { ok: true, data };
}

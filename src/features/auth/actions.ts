import { ApiError, apiRequest } from '../../shared/lib';
import { validateLoginDto, type LoginRequestDto } from './dto';
import type { AuthSession, AuthUser, PublicTenantInfo } from './model';

export type AuthActionResult =
  | { ok: true; session: AuthSession }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Hydrates the active session from the Fastify HttpOnly cookie endpoint. */
export async function fetchCurrentSessionAction(): Promise<AuthSession | null> {
  try {
    return await apiRequest<AuthSession>('/api/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

/** Authenticates a user against `/api/auth/login` and establishes an HttpOnly cookie session. */
export async function authenticateUserAction(
  rawInput: LoginRequestDto,
): Promise<AuthActionResult> {
  const validation = validateLoginDto(rawInput);
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.error,
      fieldErrors: validation.fieldErrors,
    };
  }

  try {
    const session = await apiRequest<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(validation.data),
    });
    return { ok: true, session };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ok: false,
        error: error.message,
        fieldErrors: error.fieldErrors,
      };
    }
    return {
      ok: false,
      error: 'Unable to reach authentication server.',
    };
  }
}

/** Revokes the active session on the backend and clears the session cookie. */
export async function logoutUserAction(): Promise<void> {
  try {
    await apiRequest<{ ok: true }>('/api/auth/logout', { method: 'POST' });
  } catch {
    // Best-effort server revocation
  }
}

/** Resolves public tenant display metadata for dedicated `/t/:tenantSlug/login` pages. */
export async function fetchPublicTenantInfoAction(
  tenantSlug: string,
): Promise<PublicTenantInfo | null> {
  try {
    return await apiRequest<PublicTenantInfo>(
      `/api/public/tenants/${encodeURIComponent(tenantSlug)}`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/** RBAC gate verifying whether an identity can enter the Form Builder workspace. */
export function canAccessWorkspace(
  user: AuthUser | null | undefined,
): user is AuthUser {
  return Boolean(user && user.id && user.username && user.isActive);
}

/** RBAC gate verifying whether an identity holds global superadmin privileges. */
export function isSuperadmin(user: AuthUser | null | undefined): boolean {
  return Boolean(user && user.role === 'superadmin');
}

/** RBAC gate verifying whether an identity can manage tenants globally. */
export function canManageTenants(user: AuthUser | null | undefined): boolean {
  return isSuperadmin(user);
}

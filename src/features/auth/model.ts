import type { ClientTenant } from '../../domain/form-schema';

/**
 * Authentication data model (in-memory only; backed by HttpOnly session cookies).
 */

export const USER_ROLES = [
  'superadmin',
  'tenant_admin',
  'tenant_member',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Public authenticated user identity (excludes credentials). */
export interface AuthUser {
  id: string;
  clientId: string | null;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

/** Active authenticated workspace session hydrated from `/api/auth/me`. */
export interface AuthSession {
  user: AuthUser;
  tenant: ClientTenant | null;
}

export interface PublicTenantInfo {
  id: string;
  name: string;
  slug: string;
}

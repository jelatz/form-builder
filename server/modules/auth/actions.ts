import type { ClientTenant } from '../../../src/domain/form-schema/types.ts';
import type { AppStore } from '../../db/store.ts';
import {
  createSessionToken,
  hashSessionToken,
  verifyPassword,
} from '../../lib/crypto.ts';
import { SESSION_TTL_MS } from '../../middleware/auth.ts';
import type { PublicUser } from '../../types.ts';
import type { LoginRequestDto } from './dto.ts';

export type LoginActionResult =
  | {
      ok: true;
      rawToken: string;
      user: PublicUser;
      tenant: ClientTenant | null;
    }
  | {
      ok: false;
      statusCode: 401 | 403;
      error: string;
    };

const INVALID_CREDENTIALS_ERROR = 'Invalid username or password.';

/**
 * Authenticates a user (globally or scoped to a specific tenantSlug login URL),
 * verifies password in constant time, and issues a CSPRNG session stored hashed.
 */
export async function loginAction(
  store: AppStore,
  dto: LoginRequestDto,
): Promise<LoginActionResult> {
  const user = await store.findUserByUsername(dto.username);
  if (!user || !user.isActive) {
    return { ok: false, statusCode: 401, error: INVALID_CREDENTIALS_ERROR };
  }

  const passwordValid = await verifyPassword(dto.password, user.passwordHash);
  if (!passwordValid) {
    return { ok: false, statusCode: 401, error: INVALID_CREDENTIALS_ERROR };
  }

  let tenant: ClientTenant | null = null;
  if (user.clientId) {
    tenant = await store.findClientById(user.clientId);
    if (!tenant || tenant.status === 'suspended') {
      return {
        ok: false,
        statusCode: 403,
        error: 'This tenant workspace is currently suspended or unavailable.',
      };
    }
  }

  if (dto.tenantSlug) {
    const requestedTenant = await store.findClientBySlug(dto.tenantSlug);
    if (
      !requestedTenant ||
      requestedTenant.status === 'suspended' ||
      user.clientId !== requestedTenant.id
    ) {
      return { ok: false, statusCode: 401, error: INVALID_CREDENTIALS_ERROR };
    }
    tenant = requestedTenant;
  }

  const rawToken = createSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

  await store.createSession({
    id: tokenHash,
    userId: user.id,
    clientId: user.clientId,
    createdAt: now.toISOString(),
    expiresAt,
    revokedAt: null,
  });

  const publicUser: PublicUser = {
    id: user.id,
    clientId: user.clientId,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };

  return {
    ok: true,
    rawToken,
    user: publicUser,
    tenant,
  };
}

export async function logoutAction(
  store: AppStore,
  rawToken: string | undefined,
): Promise<void> {
  if (!rawToken) return;
  await store.revokeSession(
    hashSessionToken(rawToken),
    new Date().toISOString(),
  );
}

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthContext } from '../types.ts';

/**
 * Ensures the request has a valid authenticated session.
 */
export function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): AuthContext | null {
  if (!request.authContext) {
    void reply.code(401).send({ error: 'Authentication required.' });
    return null;
  }
  return request.authContext;
}

/**
 * Ensures the authenticated user holds the `superadmin` role.
 */
export function requireSuperadmin(
  request: FastifyRequest,
  reply: FastifyReply,
): AuthContext | null {
  const auth = requireAuth(request, reply);
  if (!auth) return null;

  if (auth.user.role !== 'superadmin') {
    void reply.code(403).send({ error: 'Superadmin privileges required.' });
    return null;
  }

  return auth;
}

/**
 * Enforces strict multi-tenant isolation:
 * - `superadmin` may operate on any requested `clientId`.
 * - Tenant-scoped users (`tenant_admin`, `tenant_member`) are locked to `user.clientId`;
 *   any attempt to access another `clientId` is rejected with HTTP 403.
 */
export function resolveTenantScope(
  request: FastifyRequest,
  reply: FastifyReply,
  requestedClientId: string,
): { auth: AuthContext; clientId: string } | null {
  const auth = requireAuth(request, reply);
  if (!auth) return null;

  if (auth.user.role === 'superadmin') {
    if (!requestedClientId.trim()) {
      void reply.code(400).send({ error: 'Target tenant clientId is required.' });
      return null;
    }
    return { auth, clientId: requestedClientId };
  }

  if (!auth.user.clientId || auth.user.clientId !== requestedClientId) {
    void reply
      .code(403)
      .send({ error: 'Forbidden: cross-tenant access is prohibited.' });
    return null;
  }

  return { auth, clientId: auth.user.clientId };
}

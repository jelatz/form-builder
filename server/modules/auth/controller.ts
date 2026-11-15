import type { FastifyInstance } from 'fastify';
import type { AppStore } from '../../db/store.ts';
import {
  clearSessionCookie,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from '../../middleware/auth.ts';
import { loginAction, logoutAction } from './actions.ts';
import { validateLoginDto } from './dto.ts';

export function registerAuthRoutes(
  app: FastifyInstance,
  store: AppStore,
  isProduction: boolean,
): void {
  app.post('/api/auth/login', async (request, reply) => {
    const parsed = validateLoginDto(request.body);
    if (!parsed.ok) {
      return reply.code(400).send({
        error: parsed.error,
        fieldErrors: parsed.fieldErrors,
      });
    }

    const result = await loginAction(store, parsed.data);
    if (!result.ok) {
      return reply.code(result.statusCode).send({ error: result.error });
    }

    setSessionCookie(reply, result.rawToken, isProduction);
    return reply.code(200).send({
      user: result.user,
      tenant: result.tenant,
    });
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const rawToken = request.cookies?.[SESSION_COOKIE_NAME];
    await logoutAction(store, rawToken);
    clearSessionCookie(reply, isProduction);
    return reply.code(200).send({ ok: true });
  });

  app.get('/api/auth/me', async (request, reply) => {
    if (!request.authContext) {
      return reply.code(401).send({ error: 'Not authenticated.' });
    }
    return reply.code(200).send({
      user: request.authContext.user,
      tenant: request.authContext.tenant,
    });
  });

  app.get<{ Params: { tenantSlug: string } }>(
    '/api/public/tenants/:tenantSlug',
    async (request, reply) => {
      const slug = request.params.tenantSlug.trim().toLowerCase();
      const tenant = await store.findClientBySlug(slug);
      if (!tenant || tenant.status === 'suspended') {
        return reply.code(404).send({ error: 'Tenant workspace not found.' });
      }
      return reply.code(200).send({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      });
    },
  );
}

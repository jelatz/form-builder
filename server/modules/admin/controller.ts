import type { FastifyInstance } from 'fastify';
import type { AppStore } from '../../db/store.ts';
import type { EmailService } from '../../lib/email.ts';
import { requireSuperadmin } from '../../middleware/rbac.ts';
import {
  createTenantAction,
  createTenantUserAction,
  deleteTenantAction,
  deleteTenantUserAction,
  listAllTenantsAction,
  listGlobalFormsAction,
  listGlobalSubmissionsAction,
  listUsersAction,
  resetTenantUserCredentialsAction,
  updateTenantAction,
  updateTenantUserAction,
} from './actions.ts';
import {
  validateCreateTenantDto,
  validateCreateTenantUserDto,
  validateResetUserCredentialsDto,
  validateUpdateTenantDto,
  validateUpdateTenantUserDto,
} from './dto.ts';

export interface AdminRoutesOptions {
  emailService: EmailService;
  appOrigin: string;
}

export function registerAdminRoutes(
  app: FastifyInstance,
  store: AppStore,
  options: AdminRoutesOptions,
): void {
  // Tenants management
  app.get('/api/admin/tenants', async (request, reply) => {
    if (!requireSuperadmin(request, reply)) return;
    const tenants = await listAllTenantsAction(store);
    return reply.code(200).send({ tenants });
  });

  app.post('/api/admin/tenants', async (request, reply) => {
    if (!requireSuperadmin(request, reply)) return;
    const parsed = validateCreateTenantDto(request.body);
    if (!parsed.ok) {
      return reply
        .code(400)
        .send({ error: parsed.error, fieldErrors: parsed.fieldErrors });
    }
    const result = await createTenantAction(store, parsed.data, {
      emailService: options.emailService,
      appOrigin: options.appOrigin,
    });
    if (!result.ok) {
      return reply.code(result.statusCode).send({ error: result.error });
    }
    return reply.code(201).send(result.data);
  });

  app.patch<{ Params: { tenantId: string } }>(
    '/api/admin/tenants/:tenantId',
    async (request, reply) => {
      if (!requireSuperadmin(request, reply)) return;
      const parsed = validateUpdateTenantDto(request.body);
      if (!parsed.ok) {
        return reply
          .code(400)
          .send({ error: parsed.error, fieldErrors: parsed.fieldErrors });
      }
      const result = await updateTenantAction(
        store,
        request.params.tenantId,
        parsed.data,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(200).send({ tenant: result.data });
    },
  );

  app.delete<{ Params: { tenantId: string } }>(
    '/api/admin/tenants/:tenantId',
    async (request, reply) => {
      if (!requireSuperadmin(request, reply)) return;
      const result = await deleteTenantAction(store, request.params.tenantId);
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(200).send(result.data);
    },
  );

  // Tenant User Accounts management
  app.get<{ Querystring: { clientId?: string } }>(
    '/api/admin/users',
    async (request, reply) => {
      if (!requireSuperadmin(request, reply)) return;
      const clientId = request.query.clientId?.trim() || undefined;
      const users = await listUsersAction(store, clientId);
      return reply.code(200).send({ users });
    },
  );

  app.post('/api/admin/users', async (request, reply) => {
    if (!requireSuperadmin(request, reply)) return;
    const parsed = validateCreateTenantUserDto(request.body);
    if (!parsed.ok) {
      return reply
        .code(400)
        .send({ error: parsed.error, fieldErrors: parsed.fieldErrors });
    }
    const result = await createTenantUserAction(store, parsed.data);
    if (!result.ok) {
      return reply.code(result.statusCode).send({ error: result.error });
    }
    return reply.code(201).send({ user: result.data });
  });

  app.patch<{ Params: { userId: string } }>(
    '/api/admin/users/:userId',
    async (request, reply) => {
      if (!requireSuperadmin(request, reply)) return;
      const parsed = validateUpdateTenantUserDto(request.body);
      if (!parsed.ok) {
        return reply
          .code(400)
          .send({ error: parsed.error, fieldErrors: parsed.fieldErrors });
      }
      const result = await updateTenantUserAction(
        store,
        request.params.userId,
        parsed.data,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(200).send({ user: result.data });
    },
  );

  app.post<{ Params: { userId: string } }>(
    '/api/admin/users/:userId/reset-credentials',
    async (request, reply) => {
      if (!requireSuperadmin(request, reply)) return;
      const parsed = validateResetUserCredentialsDto(request.body);
      if (!parsed.ok) {
        return reply
          .code(400)
          .send({ error: parsed.error, fieldErrors: parsed.fieldErrors });
      }
      const result = await resetTenantUserCredentialsAction(
        store,
        request.params.userId,
        parsed.data,
        {
          emailService: options.emailService,
          appOrigin: options.appOrigin,
        },
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(200).send(result.data);
    },
  );

  app.delete<{ Params: { userId: string } }>(
    '/api/admin/users/:userId',
    async (request, reply) => {
      const auth = requireSuperadmin(request, reply);
      if (!auth) return;
      const result = await deleteTenantUserAction(
        store,
        request.params.userId,
        auth.user.id,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(200).send(result.data);
    },
  );

  // Global Forms & Submissions Browser
  app.get<{ Querystring: { clientId?: string; search?: string } }>(
    '/api/admin/forms',
    async (request, reply) => {
      if (!requireSuperadmin(request, reply)) return;
      const forms = await listGlobalFormsAction(
        store,
        request.query.clientId?.trim() || undefined,
        request.query.search?.trim() || undefined,
      );
      return reply.code(200).send({ forms });
    },
  );

  app.get<{
    Querystring: {
      clientId?: string;
      formId?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };
  }>('/api/admin/submissions', async (request, reply) => {
    if (!requireSuperadmin(request, reply)) return;
    const parsedLimit = Number(request.query.limit ?? '100');
    const parsedOffset = Number(request.query.offset ?? '0');
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 500)
        : 100;
    const offset =
      Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

    const result = await listGlobalSubmissionsAction(store, {
      clientId: request.query.clientId?.trim() || undefined,
      formId: request.query.formId?.trim() || undefined,
      search: request.query.search?.trim() || undefined,
      limit,
      offset,
    });
    return reply.code(200).send(result);
  });
}

import type { FastifyInstance } from 'fastify';
import type { AppStore } from '../../db/store.ts';
import { resolveTenantScope } from '../../middleware/rbac.ts';
import {
  createTenantFormAction,
  deleteTenantFormAction,
  getTenantFormAction,
  listTenantFormsAction,
  updateTenantFormAction,
} from './actions.ts';
import { validateCreateFormDto, validateUpdateFormDto } from './dto.ts';

export function registerFormsRoutes(
  app: FastifyInstance,
  store: AppStore,
): void {
  app.get<{ Params: { clientId: string } }>(
    '/api/tenants/:clientId/forms',
    async (request, reply) => {
      const scope = resolveTenantScope(request, reply, request.params.clientId);
      if (!scope) return;
      const forms = await listTenantFormsAction(store, scope.clientId);
      return reply.code(200).send({ forms });
    },
  );

  app.post<{ Params: { clientId: string } }>(
    '/api/tenants/:clientId/forms',
    async (request, reply) => {
      const scope = resolveTenantScope(request, reply, request.params.clientId);
      if (!scope) return;
      const parsed = validateCreateFormDto(request.body, scope.clientId);
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error });
      }
      const result = await createTenantFormAction(
        store,
        scope.clientId,
        parsed.data,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(201).send({ form: result.data });
    },
  );

  app.get<{ Params: { clientId: string; formId: string } }>(
    '/api/tenants/:clientId/forms/:formId',
    async (request, reply) => {
      const scope = resolveTenantScope(request, reply, request.params.clientId);
      if (!scope) return;
      const result = await getTenantFormAction(
        store,
        scope.clientId,
        request.params.formId,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(200).send({ form: result.data });
    },
  );

  app.patch<{ Params: { clientId: string; formId: string } }>(
    '/api/tenants/:clientId/forms/:formId',
    async (request, reply) => {
      const scope = resolveTenantScope(request, reply, request.params.clientId);
      if (!scope) return;
      const parsed = validateUpdateFormDto(request.body, scope.clientId);
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error });
      }
      const result = await updateTenantFormAction(
        store,
        scope.clientId,
        request.params.formId,
        parsed.data,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(200).send({ form: result.data });
    },
  );

  app.delete<{ Params: { clientId: string; formId: string } }>(
    '/api/tenants/:clientId/forms/:formId',
    async (request, reply) => {
      const scope = resolveTenantScope(request, reply, request.params.clientId);
      if (!scope) return;
      const result = await deleteTenantFormAction(
        store,
        scope.clientId,
        request.params.formId,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(200).send(result.data);
    },
  );
}

import type { FastifyInstance } from 'fastify';
import type { AppStore } from '../../db/store.ts';
import {
  requireTenantAdminScope,
  resolveTenantScope,
} from '../../middleware/rbac.ts';
import type { WebhookHttpTransport } from '../webhooks/dispatcher.ts';
import {
  clearFormSubmissionsAction,
  createAuthenticatedSubmissionAction,
  deleteTenantSubmissionAction,
  getPublicFormAction,
  listTenantSubmissionsAction,
  submitPublicFormAction,
} from './actions.ts';
import { validateCreateSubmissionDto } from './dto.ts';

export function registerSubmissionsRoutes(
  app: FastifyInstance,
  store: AppStore,
  webhookTransport?: WebhookHttpTransport,
): void {
  app.get<{
    Params: { clientId: string };
    Querystring: {
      formId?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };
  }>('/api/tenants/:clientId/submissions', async (request, reply) => {
    const scope = resolveTenantScope(request, reply, request.params.clientId);
    if (!scope) return;

    const parsedLimit = Number(request.query.limit ?? '100');
    const parsedOffset = Number(request.query.offset ?? '0');
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 500)
        : 100;
    const offset =
      Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

    const result = await listTenantSubmissionsAction(store, {
      clientId: scope.clientId,
      formId: request.query.formId?.trim() || undefined,
      search: request.query.search?.trim() || undefined,
      limit,
      offset,
    });
    return reply.code(200).send(result);
  });

  app.post<{ Params: { clientId: string; formId: string } }>(
    '/api/tenants/:clientId/forms/:formId/submissions',
    async (request, reply) => {
      const scope = resolveTenantScope(request, reply, request.params.clientId);
      if (!scope) return;

      const parsed = validateCreateSubmissionDto(request.body);
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error });
      }

      const result = await createAuthenticatedSubmissionAction(
        store,
        scope.clientId,
        request.params.formId,
        parsed.data.values,
        webhookTransport,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({
          error: result.error,
          fieldErrors: result.fieldErrors,
        });
      }
      return reply.code(201).send({ submission: result.data });
    },
  );

  app.delete<{ Params: { clientId: string; submissionId: string } }>(
    '/api/tenants/:clientId/submissions/:submissionId',
    async (request, reply) => {
      const scope = resolveTenantScope(request, reply, request.params.clientId);
      if (!scope) return;
      const result = await deleteTenantSubmissionAction(
        store,
        scope.clientId,
        request.params.submissionId,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(200).send(result.data);
    },
  );

  app.delete<{ Params: { clientId: string; formId: string } }>(
    '/api/tenants/:clientId/forms/:formId/submissions',
    async (request, reply) => {
      const scope = requireTenantAdminScope(
        request,
        reply,
        request.params.clientId,
      );
      if (!scope) return;
      const result = await clearFormSubmissionsAction(
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

  // Public unauthenticated form runner endpoints
  app.get<{ Params: { tenantSlug: string; formSlug: string } }>(
    '/api/public/forms/:tenantSlug/:formSlug',
    async (request, reply) => {
      const result = await getPublicFormAction(
        store,
        request.params.tenantSlug,
        request.params.formSlug,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(200).send({
        tenant: {
          id: result.data.tenant.id,
          name: result.data.tenant.name,
          slug: result.data.tenant.slug,
        },
        form: result.data.form,
      });
    },
  );

  app.post<{ Params: { tenantSlug: string; formSlug: string } }>(
    '/api/public/forms/:tenantSlug/:formSlug/submissions',
    async (request, reply) => {
      const parsed = validateCreateSubmissionDto(request.body);
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error });
      }
      const result = await submitPublicFormAction(
        store,
        request.params.tenantSlug,
        request.params.formSlug,
        parsed.data.values,
        webhookTransport,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({
          error: result.error,
          fieldErrors: result.fieldErrors,
        });
      }
      return reply.code(201).send({
        submission: {
          id: result.data.id,
          formId: result.data.formId,
          submittedAt: result.data.submittedAt,
        },
      });
    },
  );
}

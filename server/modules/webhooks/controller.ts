import type { FastifyInstance } from 'fastify';
import type { AppStore } from '../../db/store.ts';
import {
  requireTenantAdminScope,
  resolveTenantScope,
} from '../../middleware/rbac.ts';
import {
  createFormWebhookAction,
  deleteFormWebhookAction,
  listFormWebhooksAction,
  retryWebhookDeliveryAction,
  testFormWebhookAction,
  updateFormWebhookAction,
} from './actions.ts';
import type { WebhookHttpTransport } from './dispatcher.ts';
import {
  validateCreateWebhookDto,
  validateUpdateWebhookDto,
} from './dto.ts';

export function registerWebhooksRoutes(
  app: FastifyInstance,
  store: AppStore,
  webhookTransport?: WebhookHttpTransport,
): void {
  app.get<{ Params: { clientId: string; formId: string } }>(
    '/api/tenants/:clientId/forms/:formId/webhooks',
    async (request, reply) => {
      const scope = resolveTenantScope(request, reply, request.params.clientId);
      if (!scope) return;

      const result = await listFormWebhooksAction(
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

  app.post<{ Params: { clientId: string; formId: string } }>(
    '/api/tenants/:clientId/forms/:formId/webhooks',
    async (request, reply) => {
      const scope = requireTenantAdminScope(
        request,
        reply,
        request.params.clientId,
      );
      if (!scope) return;

      const parsed = validateCreateWebhookDto(request.body);
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error });
      }

      const result = await createFormWebhookAction(
        store,
        scope.clientId,
        request.params.formId,
        parsed.data,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(201).send({ webhook: result.data });
    },
  );

  app.patch<{
    Params: { clientId: string; formId: string; webhookId: string };
  }>(
    '/api/tenants/:clientId/forms/:formId/webhooks/:webhookId',
    async (request, reply) => {
      const scope = requireTenantAdminScope(
        request,
        reply,
        request.params.clientId,
      );
      if (!scope) return;

      const parsed = validateUpdateWebhookDto(request.body);
      if (!parsed.ok) {
        return reply.code(400).send({ error: parsed.error });
      }

      const result = await updateFormWebhookAction(
        store,
        scope.clientId,
        request.params.formId,
        request.params.webhookId,
        parsed.data,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(200).send({ webhook: result.data });
    },
  );

  app.delete<{
    Params: { clientId: string; formId: string; webhookId: string };
  }>(
    '/api/tenants/:clientId/forms/:formId/webhooks/:webhookId',
    async (request, reply) => {
      const scope = requireTenantAdminScope(
        request,
        reply,
        request.params.clientId,
      );
      if (!scope) return;

      const result = await deleteFormWebhookAction(
        store,
        scope.clientId,
        request.params.formId,
        request.params.webhookId,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(200).send(result.data);
    },
  );

  app.post<{
    Params: { clientId: string; formId: string; webhookId: string };
  }>(
    '/api/tenants/:clientId/forms/:formId/webhooks/:webhookId/test',
    async (request, reply) => {
      const scope = resolveTenantScope(request, reply, request.params.clientId);
      if (!scope) return;

      const result = await testFormWebhookAction(
        store,
        scope.clientId,
        request.params.formId,
        request.params.webhookId,
        webhookTransport,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(200).send({ delivery: result.data });
    },
  );

  app.post<{ Params: { clientId: string; deliveryId: string } }>(
    '/api/tenants/:clientId/webhooks/deliveries/:deliveryId/retry',
    async (request, reply) => {
      const scope = resolveTenantScope(request, reply, request.params.clientId);
      if (!scope) return;

      const result = await retryWebhookDeliveryAction(
        store,
        scope.clientId,
        request.params.deliveryId,
        webhookTransport,
      );
      if (!result.ok) {
        return reply.code(result.statusCode).send({ error: result.error });
      }
      return reply.code(200).send({ delivery: result.data });
    },
  );
}

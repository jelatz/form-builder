import fastifyCookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppStore } from './db/store.ts';
import {
  createResendEmailService,
  type EmailService,
} from './lib/email.ts';
import { createAuthHook } from './middleware/auth.ts';
import { registerAdminRoutes } from './modules/admin/controller.ts';
import { registerAuthRoutes } from './modules/auth/controller.ts';
import { registerFormsRoutes } from './modules/forms/controller.ts';
import { registerSubmissionsRoutes } from './modules/submissions/controller.ts';
import { registerWebhooksRoutes } from './modules/webhooks/controller.ts';
import type { WebhookHttpTransport } from './modules/webhooks/dispatcher.ts';

export interface BuildServerOptions {
  store: AppStore;
  isProduction?: boolean;
  logger?: boolean;
  emailService?: EmailService;
  appOrigin?: string;
  webhookTransport?: WebhookHttpTransport;
}

export async function buildServer({
  store,
  isProduction = false,
  logger = false,
  emailService,
  appOrigin = 'http://localhost:5173',
  webhookTransport,
}: BuildServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  await app.register(fastifyCookie);

  app.decorateRequest('authContext', null);
  app.addHook('onRequest', createAuthHook(store));

  app.get('/api/health', async () => ({ ok: true }));

  const resolvedEmailService =
    emailService ??
    createResendEmailService({
      apiKey: '',
      from: 'FormBuilder <onboarding@resend.dev>',
      isProduction,
    });

  registerAuthRoutes(app, store, isProduction);
  registerAdminRoutes(app, store, {
    emailService: resolvedEmailService,
    appOrigin,
  });
  registerFormsRoutes(app, store);
  registerSubmissionsRoutes(app, store, webhookTransport);
  registerWebhooksRoutes(app, store, webhookTransport);

  app.setErrorHandler((error, _request, reply) => {
    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 500;
    const message =
      statusCode >= 500 && isProduction
        ? 'Internal server error.'
        : error instanceof Error
          ? error.message
          : 'Request failed.';
    void reply.code(statusCode).send({ error: message });
  });

  return app;
}

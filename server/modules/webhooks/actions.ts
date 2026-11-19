import type {
  FormField,
  FormWebhook,
  WebhookDelivery,
} from '../../../src/domain/form-schema/types.ts';
import type { AppStore } from '../../db/store.ts';
import { createEntityId, generateWebhookSecret } from '../../lib/crypto.ts';
import {
  buildWebhookPayload,
  executeWebhookDelivery,
  type WebhookHttpTransport,
} from './dispatcher.ts';
import type { CreateWebhookDto, UpdateWebhookDto } from './dto.ts';

export type WebhookActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; statusCode: number; error: string };

function buildSampleFieldValue(field: FormField): unknown {
  switch (field.type) {
    case 'email':
      return 'test@example.com';
    case 'number':
      return field.min ?? 42;
    case 'currency':
      return field.min ?? 100;
    case 'checkbox':
      return true;
    case 'select':
    case 'radio':
      return field.options[0]?.value ?? 'sample_option';
    case 'date':
      return '2026-11-19';
    case 'name':
      return { firstName: 'Sample', lastName: 'User' };
    case 'phone':
      return '+1 (555) 010-9999';
    case 'address':
      return {
        street: '100 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        country: 'United States',
      };
    case 'website':
      return 'https://example.com';
    case 'textarea':
    case 'text':
      return `Sample ${field.label}`;
    case 'section':
    case 'grid':
      return null;
  }
}

export async function listFormWebhooksAction(
  store: AppStore,
  clientId: string,
  formId: string,
): Promise<
  WebhookActionResult<{
    webhooks: FormWebhook[];
    deliveries: WebhookDelivery[];
  }>
> {
  const form = await store.findFormById(formId, clientId);
  if (!form) {
    return { ok: false, statusCode: 404, error: 'Form not found.' };
  }

  const [webhooks, deliveries] = await Promise.all([
    store.listFormWebhooks(formId, clientId),
    store.listWebhookDeliveries(formId, clientId, 50),
  ]);
  return { ok: true, data: { webhooks, deliveries } };
}

export async function createFormWebhookAction(
  store: AppStore,
  clientId: string,
  formId: string,
  dto: CreateWebhookDto,
): Promise<WebhookActionResult<FormWebhook>> {
  const form = await store.findFormById(formId, clientId);
  if (!form) {
    return { ok: false, statusCode: 404, error: 'Form not found.' };
  }

  const webhook = await store.createFormWebhook({
    id: createEntityId('wh'),
    formId,
    clientId,
    name: dto.name,
    url: dto.url,
    secret: dto.secret ?? generateWebhookSecret(),
    events: dto.events,
    isActive: dto.isActive,
    nowIso: new Date().toISOString(),
  });
  return { ok: true, data: webhook };
}

export async function updateFormWebhookAction(
  store: AppStore,
  clientId: string,
  formId: string,
  webhookId: string,
  dto: UpdateWebhookDto,
): Promise<WebhookActionResult<FormWebhook>> {
  const existing = await store.findWebhookById(webhookId, clientId);
  if (!existing || existing.formId !== formId) {
    return { ok: false, statusCode: 404, error: 'Webhook not found.' };
  }

  const updated = await store.updateFormWebhook(webhookId, clientId, {
    ...dto,
    nowIso: new Date().toISOString(),
  });
  if (!updated) {
    return { ok: false, statusCode: 404, error: 'Webhook not found.' };
  }
  return { ok: true, data: updated };
}

export async function deleteFormWebhookAction(
  store: AppStore,
  clientId: string,
  formId: string,
  webhookId: string,
): Promise<WebhookActionResult<{ deleted: true }>> {
  const existing = await store.findWebhookById(webhookId, clientId);
  if (!existing || existing.formId !== formId) {
    return { ok: false, statusCode: 404, error: 'Webhook not found.' };
  }

  const deleted = await store.deleteFormWebhook(webhookId, clientId);
  if (!deleted) {
    return { ok: false, statusCode: 404, error: 'Webhook not found.' };
  }
  return { ok: true, data: { deleted: true } };
}

export async function testFormWebhookAction(
  store: AppStore,
  clientId: string,
  formId: string,
  webhookId: string,
  transport?: WebhookHttpTransport,
): Promise<WebhookActionResult<WebhookDelivery>> {
  const [form, webhook] = await Promise.all([
    store.findFormById(formId, clientId),
    store.findWebhookById(webhookId, clientId),
  ]);
  if (!form || !webhook || webhook.formId !== formId) {
    return { ok: false, statusCode: 404, error: 'Webhook not found.' };
  }

  const sampleValues: Record<string, unknown> = {};
  for (const field of form.fields) {
    if (field.type === 'section' || field.type === 'grid') continue;
    sampleValues[field.id] = buildSampleFieldValue(field);
  }

  const deliveryId = createEntityId('whd');
  const nowIso = new Date().toISOString();
  const requestPayload = buildWebhookPayload({
    deliveryId,
    eventType: 'webhook.test',
    createdAt: nowIso,
    form,
    submission: {
      id: 'sub_test_preview',
      submittedAt: nowIso,
      values: sampleValues,
    },
  });

  const queued = await store.createWebhookDelivery({
    id: deliveryId,
    webhookId: webhook.id,
    formId: form.id,
    clientId,
    submissionId: null,
    eventType: 'webhook.test',
    status: 'queued',
    requestPayload,
    attemptCount: 1,
    nowIso,
  });

  const completed = await executeWebhookDelivery(
    store,
    webhook,
    queued,
    transport,
  );
  return { ok: true, data: completed };
}

export async function retryWebhookDeliveryAction(
  store: AppStore,
  clientId: string,
  deliveryId: string,
  transport?: WebhookHttpTransport,
): Promise<WebhookActionResult<WebhookDelivery>> {
  const delivery = await store.findWebhookDeliveryById(deliveryId, clientId);
  if (!delivery) {
    return { ok: false, statusCode: 404, error: 'Webhook delivery not found.' };
  }

  const webhook = await store.findWebhookById(delivery.webhookId, clientId);
  if (!webhook) {
    return { ok: false, statusCode: 404, error: 'Webhook endpoint not found.' };
  }

  const reset = await store.updateWebhookDelivery(delivery.id, clientId, {
    status: 'queued',
    attemptCount: delivery.attemptCount + 1,
    errorMessage: null,
    completedAt: null,
  });

  const completed = await executeWebhookDelivery(
    store,
    webhook,
    reset ?? {
      ...delivery,
      status: 'queued',
      attemptCount: delivery.attemptCount + 1,
    },
    transport,
  );
  return { ok: true, data: completed };
}

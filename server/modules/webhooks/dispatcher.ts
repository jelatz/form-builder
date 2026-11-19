import type {
  FormSchema,
  FormWebhook,
  SubmissionRecord,
  WebhookDelivery,
  WebhookEventType,
} from '../../../src/domain/form-schema/types.ts';
import type { AppStore } from '../../db/store.ts';
import { createEntityId, signWebhookPayload } from '../../lib/crypto.ts';

export type WebhookHttpTransport = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{ status: number; bodyText: string }>;

const MAX_RESPONSE_BODY_CHARS = 1000;
const WEBHOOK_TIMEOUT_MS = 5000;

export const defaultWebhookTransport: WebhookHttpTransport = async (
  url,
  init,
) => {
  const response = await fetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  });
  const text = await response.text();
  return {
    status: response.status,
    bodyText: text.slice(0, MAX_RESPONSE_BODY_CHARS),
  };
};

export function buildWebhookPayload(params: {
  deliveryId: string;
  eventType: WebhookEventType;
  createdAt: string;
  form: FormSchema;
  submission: Pick<SubmissionRecord, 'id' | 'submittedAt' | 'values'>;
}): Record<string, unknown> {
  const { deliveryId, eventType, createdAt, form, submission } = params;
  const dataFields = form.fields.filter(
    (field) => field.type !== 'section' && field.type !== 'grid',
  );

  return {
    id: deliveryId,
    event: eventType,
    createdAt,
    form: {
      id: form.id,
      clientId: form.clientId,
      slug: form.slug,
      title: form.title,
    },
    submission: {
      id: submission.id,
      submittedAt: submission.submittedAt,
      values: submission.values,
      fields: dataFields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type,
        value: submission.values[field.id] ?? null,
      })),
    },
  };
}

export async function executeWebhookDelivery(
  store: AppStore,
  webhook: FormWebhook,
  delivery: WebhookDelivery,
  transport: WebhookHttpTransport = defaultWebhookTransport,
): Promise<WebhookDelivery> {
  await store.updateWebhookDelivery(delivery.id, delivery.clientId, {
    status: 'running',
  });

  const rawBody = JSON.stringify(delivery.requestPayload);
  const signature = signWebhookPayload(webhook.secret, rawBody);

  try {
    const result = await transport(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FormBuilder-Webhook/1.0',
        'X-FormBuilder-Event': delivery.eventType,
        'X-FormBuilder-Delivery-Id': delivery.id,
        'X-FormBuilder-Signature': signature,
      },
      body: rawBody,
    });

    const truncatedBody = result.bodyText.slice(0, MAX_RESPONSE_BODY_CHARS);
    const completedAt = new Date().toISOString();

    if (result.status >= 200 && result.status < 300) {
      const updated = await store.updateWebhookDelivery(
        delivery.id,
        delivery.clientId,
        {
          status: 'completed',
          responseStatus: result.status,
          responseBody: truncatedBody,
          errorMessage: null,
          completedAt,
        },
      );
      return updated ?? delivery;
    }

    const failed = await store.updateWebhookDelivery(
      delivery.id,
      delivery.clientId,
      {
        status: 'failed',
        responseStatus: result.status,
        responseBody: truncatedBody,
        errorMessage: `Webhook endpoint returned HTTP ${result.status}.`,
        completedAt,
      },
    );
    return failed ?? delivery;
  } catch (err) {
    const failed = await store.updateWebhookDelivery(
      delivery.id,
      delivery.clientId,
      {
        status: 'failed',
        responseStatus: null,
        responseBody: null,
        errorMessage:
          err instanceof Error ? err.message : 'Webhook request failed.',
        completedAt: new Date().toISOString(),
      },
    );
    return failed ?? delivery;
  }
}

export async function dispatchSubmissionWebhooks(
  store: AppStore,
  form: FormSchema,
  submission: SubmissionRecord,
  transport: WebhookHttpTransport = defaultWebhookTransport,
): Promise<WebhookDelivery[]> {
  const webhooks = await store.listFormWebhooks(form.id, form.clientId);
  const matching = webhooks.filter(
    (w) => w.isActive && w.events.includes('submission.created'),
  );

  const results: WebhookDelivery[] = [];
  for (const webhook of matching) {
    const deliveryId = createEntityId('whd');
    const nowIso = new Date().toISOString();
    const requestPayload = buildWebhookPayload({
      deliveryId,
      eventType: 'submission.created',
      createdAt: nowIso,
      form,
      submission,
    });

    const queued = await store.createWebhookDelivery({
      id: deliveryId,
      webhookId: webhook.id,
      formId: form.id,
      clientId: form.clientId,
      submissionId: submission.id,
      eventType: 'submission.created',
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
    results.push(completed);
  }

  return results;
}

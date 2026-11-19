import {
  WEBHOOK_EVENT_TYPES,
  type WebhookEventType,
} from '../../../src/domain/form-schema/types.ts';

export interface CreateWebhookDto {
  name: string;
  url: string;
  secret?: string;
  events: WebhookEventType[];
  isActive: boolean;
}

export interface UpdateWebhookDto {
  name?: string;
  url?: string;
  secret?: string;
  events?: WebhookEventType[];
  isActive?: boolean;
}

function validateWebhookName(
  raw: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Webhook name is required.' };
  }
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    return {
      ok: false,
      error: 'Webhook name must be between 2 and 80 characters.',
    };
  }
  return { ok: true, value: trimmed };
}

function validateWebhookUrl(
  raw: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Webhook destination URL is required.' };
  }
  const trimmed = raw.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        ok: false,
        error: 'Webhook URL must use http:// or https://.',
      };
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return { ok: false, error: 'Webhook URL must be a valid URL.' };
  }
}

function validateWebhookEvents(
  raw: unknown,
): { ok: true; value: WebhookEventType[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return {
      ok: false,
      error: 'Webhook events must be a non-empty array of event types.',
    };
  }
  const validSet = new Set<string>(WEBHOOK_EVENT_TYPES);
  const deduped: WebhookEventType[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !validSet.has(item)) {
      return {
        ok: false,
        error: `Unsupported webhook event type: ${String(item)}`,
      };
    }
    const typed = item as WebhookEventType;
    if (!deduped.includes(typed)) {
      deduped.push(typed);
    }
  }
  return { ok: true, value: deduped };
}

export function validateCreateWebhookDto(
  raw: unknown,
): { ok: true; data: CreateWebhookDto } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Invalid webhook payload.' };
  }
  const body = raw as Record<string, unknown>;

  const nameRes = validateWebhookName(body.name);
  if (!nameRes.ok) return nameRes;

  const urlRes = validateWebhookUrl(body.url);
  if (!urlRes.ok) return urlRes;

  let secret: string | undefined;
  if (body.secret !== undefined && body.secret !== '') {
    if (typeof body.secret !== 'string' || body.secret.trim().length < 8) {
      return {
        ok: false,
        error: 'Webhook signing secret must be at least 8 characters.',
      };
    }
    secret = body.secret.trim();
  }

  let events: WebhookEventType[] = ['submission.created'];
  if (body.events !== undefined) {
    const eventsRes = validateWebhookEvents(body.events);
    if (!eventsRes.ok) return eventsRes;
    events = eventsRes.value;
  }

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    return { ok: false, error: 'isActive must be a boolean.' };
  }

  return {
    ok: true,
    data: {
      name: nameRes.value,
      url: urlRes.value,
      secret,
      events,
      isActive: body.isActive ?? true,
    },
  };
}

export function validateUpdateWebhookDto(
  raw: unknown,
): { ok: true; data: UpdateWebhookDto } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Invalid webhook update payload.' };
  }
  const body = raw as Record<string, unknown>;
  const data: UpdateWebhookDto = {};

  if (body.name !== undefined) {
    const nameRes = validateWebhookName(body.name);
    if (!nameRes.ok) return nameRes;
    data.name = nameRes.value;
  }

  if (body.url !== undefined) {
    const urlRes = validateWebhookUrl(body.url);
    if (!urlRes.ok) return urlRes;
    data.url = urlRes.value;
  }

  if (body.secret !== undefined) {
    if (typeof body.secret !== 'string' || body.secret.trim().length < 8) {
      return {
        ok: false,
        error: 'Webhook signing secret must be at least 8 characters.',
      };
    }
    data.secret = body.secret.trim();
  }

  if (body.events !== undefined) {
    const eventsRes = validateWebhookEvents(body.events);
    if (!eventsRes.ok) return eventsRes;
    data.events = eventsRes.value;
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      return { ok: false, error: 'isActive must be a boolean.' };
    }
    data.isActive = body.isActive;
  }

  return { ok: true, data };
}

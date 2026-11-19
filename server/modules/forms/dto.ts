import type { FormField } from '../../../src/domain/form-schema/types.ts';
import { parseFormSchemaJson } from '../../../src/domain/form-schema/validation.ts';

export interface CreateFormDto {
  id?: string;
  title: string;
  slug?: string;
  description?: string;
  submitButtonText?: string;
  thankYouTitle?: string;
  thankYouMessage?: string;
  redirectUrl?: string;
  isPublished: boolean;
  fields?: FormField[];
}

export interface UpdateFormDto {
  title?: string;
  slug?: string;
  description?: string;
  submitButtonText?: string;
  thankYouTitle?: string;
  thankYouMessage?: string;
  redirectUrl?: string;
  isPublished?: boolean;
  fields?: FormField[];
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function validateOptionalRedirectUrl(
  raw: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'redirectUrl must be a string.' };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: '' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        ok: false,
        error: 'redirectUrl must use http:// or https://.',
      };
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return { ok: false, error: 'redirectUrl must be a valid URL.' };
  }
}

function validateFieldsPayload(
  rawFields: unknown,
  title: string,
  clientId: string,
): { ok: true; fields: FormField[] } | { ok: false; error: string } {
  const probe = JSON.stringify({
    id: 'probe_form',
    clientId,
    title: title || 'Form',
    fields: rawFields,
  });
  const parsed = parseFormSchemaJson(probe, clientId);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  return { ok: true, fields: parsed.schema.fields };
}

export function validateCreateFormDto(
  raw: unknown,
  clientId: string,
): ValidationResult<CreateFormDto> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Invalid form payload.' };
  }
  const body = raw as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return { ok: false, error: 'Form title is required.' };
  }

  let fields: FormField[] | undefined;
  if (body.fields !== undefined) {
    const validated = validateFieldsPayload(body.fields, title, clientId);
    if (!validated.ok) return validated;
    fields = validated.fields;
  }

  let redirectUrl: string | undefined;
  if (body.redirectUrl !== undefined) {
    const redirectRes = validateOptionalRedirectUrl(body.redirectUrl);
    if (!redirectRes.ok) return redirectRes;
    redirectUrl = redirectRes.value || undefined;
  }

  return {
    ok: true,
    data: {
      id: typeof body.id === 'string' && body.id.trim() ? body.id.trim() : undefined,
      title,
      slug: typeof body.slug === 'string' ? body.slug.trim() : undefined,
      description:
        typeof body.description === 'string' ? body.description : undefined,
      submitButtonText:
        typeof body.submitButtonText === 'string'
          ? body.submitButtonText
          : undefined,
      thankYouTitle:
        typeof body.thankYouTitle === 'string'
          ? body.thankYouTitle
          : undefined,
      thankYouMessage:
        typeof body.thankYouMessage === 'string'
          ? body.thankYouMessage
          : undefined,
      redirectUrl,
      isPublished:
        typeof body.isPublished === 'boolean' ? body.isPublished : true,
      fields,
    },
  };
}

export function validateUpdateFormDto(
  raw: unknown,
  clientId: string,
): ValidationResult<UpdateFormDto> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Invalid form update payload.' };
  }
  const body = raw as Record<string, unknown>;
  const data: UpdateFormDto = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return { ok: false, error: 'Form title must be a non-empty string.' };
    }
    data.title = body.title.trim();
  }

  if (body.slug !== undefined) {
    if (typeof body.slug !== 'string' || !body.slug.trim()) {
      return { ok: false, error: 'Form slug must be a non-empty string.' };
    }
    data.slug = body.slug.trim();
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      return { ok: false, error: 'Description must be a string.' };
    }
    data.description = body.description;
  }

  if (body.submitButtonText !== undefined) {
    if (typeof body.submitButtonText !== 'string') {
      return { ok: false, error: 'submitButtonText must be a string.' };
    }
    data.submitButtonText = body.submitButtonText;
  }

  if (body.thankYouTitle !== undefined) {
    if (typeof body.thankYouTitle !== 'string') {
      return { ok: false, error: 'thankYouTitle must be a string.' };
    }
    data.thankYouTitle = body.thankYouTitle;
  }

  if (body.thankYouMessage !== undefined) {
    if (typeof body.thankYouMessage !== 'string') {
      return { ok: false, error: 'thankYouMessage must be a string.' };
    }
    data.thankYouMessage = body.thankYouMessage;
  }

  if (body.redirectUrl !== undefined) {
    const redirectRes = validateOptionalRedirectUrl(body.redirectUrl);
    if (!redirectRes.ok) return redirectRes;
    data.redirectUrl = redirectRes.value;
  }

  if (body.isPublished !== undefined) {
    if (typeof body.isPublished !== 'boolean') {
      return { ok: false, error: 'isPublished must be a boolean.' };
    }
    data.isPublished = body.isPublished;
  }

  if (body.fields !== undefined) {
    const validated = validateFieldsPayload(
      body.fields,
      data.title ?? 'Form',
      clientId,
    );
    if (!validated.ok) return validated;
    data.fields = validated.fields;
  }

  return { ok: true, data };
}

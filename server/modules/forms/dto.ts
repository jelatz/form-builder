import type { FormField } from '../../../src/domain/form-schema/types.ts';
import { parseFormSchemaJson } from '../../../src/domain/form-schema/validation.ts';

export interface CreateFormDto {
  id?: string;
  title: string;
  slug?: string;
  description?: string;
  submitButtonText?: string;
  isPublished: boolean;
  fields?: FormField[];
}

export interface UpdateFormDto {
  title?: string;
  slug?: string;
  description?: string;
  submitButtonText?: string;
  isPublished?: boolean;
  fields?: FormField[];
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

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

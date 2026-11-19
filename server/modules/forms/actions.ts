import type { FormSchema } from '../../../src/domain/form-schema/types.ts';
import type { AppStore } from '../../db/store.ts';
import { createEntityId } from '../../lib/crypto.ts';
import { ensureUniqueSlug } from '../../lib/slug.ts';
import type { CreateFormDto, UpdateFormDto } from './dto.ts';

export type FormActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; statusCode: number; error: string };

export async function listTenantFormsAction(
  store: AppStore,
  clientId: string,
): Promise<FormSchema[]> {
  return store.listForms({ clientId });
}

export async function getTenantFormAction(
  store: AppStore,
  clientId: string,
  formId: string,
): Promise<FormActionResult<FormSchema>> {
  const form = await store.findFormById(formId, clientId);
  if (!form) {
    return { ok: false, statusCode: 404, error: 'Form not found.' };
  }
  return { ok: true, data: form };
}

export async function createTenantFormAction(
  store: AppStore,
  clientId: string,
  dto: CreateFormDto,
): Promise<FormActionResult<FormSchema>> {
  const tenant = await store.findClientById(clientId);
  if (!tenant) {
    return { ok: false, statusCode: 404, error: 'Tenant not found.' };
  }

  const existingForms = await store.listForms({ clientId });
  const slugSet = new Set(existingForms.map((f) => f.slug));
  const uniqueSlug = ensureUniqueSlug(
    dto.slug || dto.title,
    slugSet,
    'untitled-form',
  );

  const starterSection = {
    id: createEntityId('field_section'),
    type: 'section' as const,
    label: 'Section 1',
    helperText: '',
    required: false,
    showLine: true,
  };

  const starterField = {
    id: createEntityId('field_text'),
    type: 'text' as const,
    label: 'Text Field',
    placeholder: 'Enter text',
    required: false,
  };

  const created = await store.createForm({
    id: dto.id ?? createEntityId('form'),
    clientId,
    slug: uniqueSlug,
    title: dto.title,
    description: dto.description ?? '',
    submitButtonText: dto.submitButtonText ?? 'Submit',
    thankYouTitle: dto.thankYouTitle,
    thankYouMessage: dto.thankYouMessage,
    redirectUrl: dto.redirectUrl,
    isPublished: dto.isPublished,
    fields:
      dto.fields && dto.fields.length > 0
        ? dto.fields
        : [starterSection, starterField],
    nowIso: new Date().toISOString(),
  });

  return { ok: true, data: created };
}

export async function updateTenantFormAction(
  store: AppStore,
  clientId: string,
  formId: string,
  dto: UpdateFormDto,
): Promise<FormActionResult<FormSchema>> {
  const existing = await store.findFormById(formId, clientId);
  if (!existing) {
    return { ok: false, statusCode: 404, error: 'Form not found.' };
  }

  let nextSlug = dto.slug;
  if (dto.slug !== undefined) {
    const tenantForms = await store.listForms({ clientId });
    const otherSlugs = new Set(
      tenantForms.filter((f) => f.id !== formId).map((f) => f.slug),
    );
    nextSlug = ensureUniqueSlug(dto.slug, otherSlugs, 'untitled-form');
  }

  const updated = await store.updateForm(formId, clientId, {
    slug: nextSlug,
    title: dto.title,
    description: dto.description,
    submitButtonText: dto.submitButtonText,
    thankYouTitle: dto.thankYouTitle,
    thankYouMessage: dto.thankYouMessage,
    redirectUrl: dto.redirectUrl,
    isPublished: dto.isPublished,
    fields: dto.fields,
    nowIso: new Date().toISOString(),
  });

  if (!updated) {
    return { ok: false, statusCode: 404, error: 'Form not found.' };
  }

  return { ok: true, data: updated };
}

export async function deleteTenantFormAction(
  store: AppStore,
  clientId: string,
  formId: string,
): Promise<FormActionResult<{ deleted: true; replacementForm?: FormSchema }>> {
  const existing = await store.findFormById(formId, clientId);
  if (!existing) {
    return { ok: false, statusCode: 404, error: 'Form not found.' };
  }

  await store.deleteForm(formId, clientId);

  const remaining = await store.listForms({ clientId });
  if (remaining.length === 0) {
    const replacementForm = await store.createForm({
      id: createEntityId('form'),
      clientId,
      slug: 'untitled-form',
      title: 'Untitled Form',
      description: '',
      submitButtonText: 'Submit',
      isPublished: true,
      fields: [
        {
          id: createEntityId('field_section'),
          type: 'section',
          label: 'Section 1',
          helperText: '',
          required: false,
          showLine: true,
        },
        {
          id: createEntityId('field_text'),
          type: 'text',
          label: 'Text Field',
          placeholder: 'Enter text',
          required: false,
        },
      ],
      nowIso: new Date().toISOString(),
    });
    return { ok: true, data: { deleted: true, replacementForm } };
  }

  return { ok: true, data: { deleted: true } };
}

import type {
  ClientTenant,
  FormSchema,
  SubmissionRecord,
} from '../../../src/domain/form-schema/types.ts';
import {
  validateForm,
  type FormErrors,
  type FormValues,
} from '../../../src/domain/form-schema/validation.ts';
import type { AppStore } from '../../db/store.ts';
import { createEntityId } from '../../lib/crypto.ts';
import type { PaginatedResult } from '../../types.ts';

export type SubmissionActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      statusCode: number;
      error: string;
      fieldErrors?: FormErrors;
    };

export async function listTenantSubmissionsAction(
  store: AppStore,
  query: {
    clientId: string;
    formId?: string;
    search?: string;
    limit: number;
    offset: number;
  },
): Promise<PaginatedResult<SubmissionRecord>> {
  return store.listSubmissions(query);
}

async function validateAndInsertSubmission(
  store: AppStore,
  form: FormSchema,
  values: FormValues,
): Promise<SubmissionActionResult<SubmissionRecord>> {
  const validation = validateForm(form, values);
  if (!validation.valid) {
    return {
      ok: false,
      statusCode: 422,
      error: 'Form validation failed.',
      fieldErrors: validation.errors,
    };
  }

  const record = await store.createSubmission({
    id: createEntityId('sub'),
    formId: form.id,
    clientId: form.clientId,
    values,
    submittedAt: new Date().toISOString(),
  });

  return { ok: true, data: record };
}

export async function createAuthenticatedSubmissionAction(
  store: AppStore,
  clientId: string,
  formId: string,
  values: FormValues,
): Promise<SubmissionActionResult<SubmissionRecord>> {
  const form = await store.findFormById(formId, clientId);
  if (!form) {
    return { ok: false, statusCode: 404, error: 'Form not found.' };
  }
  return validateAndInsertSubmission(store, form, values);
}

export async function deleteTenantSubmissionAction(
  store: AppStore,
  clientId: string,
  submissionId: string,
): Promise<SubmissionActionResult<{ deleted: true }>> {
  const deleted = await store.deleteSubmission(submissionId, clientId);
  if (!deleted) {
    return { ok: false, statusCode: 404, error: 'Submission not found.' };
  }
  return { ok: true, data: { deleted: true } };
}

export async function clearFormSubmissionsAction(
  store: AppStore,
  clientId: string,
  formId: string,
): Promise<SubmissionActionResult<{ clearedCount: number }>> {
  const form = await store.findFormById(formId, clientId);
  if (!form) {
    return { ok: false, statusCode: 404, error: 'Form not found.' };
  }
  const clearedCount = await store.clearFormSubmissions(formId, clientId);
  return { ok: true, data: { clearedCount } };
}

export async function getPublicFormAction(
  store: AppStore,
  tenantSlug: string,
  formSlug: string,
): Promise<
  SubmissionActionResult<{ tenant: ClientTenant; form: FormSchema }>
> {
  const match = await store.findPublishedFormBySlugs(
    tenantSlug.trim().toLowerCase(),
    formSlug.trim().toLowerCase(),
  );
  if (!match) {
    return {
      ok: false,
      statusCode: 404,
      error: 'Published form not found.',
    };
  }
  return { ok: true, data: match };
}

export async function submitPublicFormAction(
  store: AppStore,
  tenantSlug: string,
  formSlug: string,
  values: FormValues,
): Promise<SubmissionActionResult<SubmissionRecord>> {
  const match = await store.findPublishedFormBySlugs(
    tenantSlug.trim().toLowerCase(),
    formSlug.trim().toLowerCase(),
  );
  if (!match) {
    return {
      ok: false,
      statusCode: 404,
      error: 'Published form not found.',
    };
  }
  return validateAndInsertSubmission(store, match.form, values);
}

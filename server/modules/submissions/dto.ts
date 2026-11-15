import type { FormValues } from '../../../src/domain/form-schema/validation.ts';

export interface CreateSubmissionDto {
  values: FormValues;
}

export function validateCreateSubmissionDto(
  raw: unknown,
): { ok: true; data: CreateSubmissionDto } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Invalid submission payload.' };
  }
  const body = raw as Record<string, unknown>;
  if (
    typeof body.values !== 'object' ||
    body.values === null ||
    Array.isArray(body.values)
  ) {
    return { ok: false, error: 'Submission "values" must be a JSON object.' };
  }

  return {
    ok: true,
    data: { values: body.values as FormValues },
  };
}

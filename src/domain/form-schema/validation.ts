import type { FormErrors, FormField, FormSchema, FormValues } from './types.ts';

export function isFieldVisible(field: FormField, values: FormValues): boolean {
  if (!field.condition || !field.condition.sourceFieldId) {
    return true;
  }

  const rawSource = values[field.condition.sourceFieldId];
  const sourceStr = rawSource === undefined || rawSource === null ? '' : String(rawSource);
  const targetVal = field.condition.value ?? '';

  switch (field.condition.operator) {
    case 'equals':
      return sourceStr.trim().toLowerCase() === targetVal.trim().toLowerCase();
    case 'not_equals':
      return sourceStr.trim().toLowerCase() !== targetVal.trim().toLowerCase();
    case 'contains':
      return sourceStr.toLowerCase().includes(targetVal.toLowerCase());
    case 'not_empty':
      if (typeof rawSource === 'boolean') {
        return rawSource;
      }
      return sourceStr.trim().length > 0;
    default:
      return true;
  }
}

export function createDefaultFormValues(
  schema: FormSchema,
  urlParams: Record<string, string> = {},
): FormValues {
  const values: FormValues = {};

  for (const field of schema.fields) {
    if (field.type === 'section') {
      continue;
    }
    if (field.type === 'checkbox') {
      values[field.id] = field.defaultChecked ?? false;
    } else if (field.type === 'hidden') {
      values[field.id] = urlParams[field.urlParamKey] ?? field.defaultValue ?? '';
    } else {
      values[field.id] = field.defaultValue ?? '';
    }
  }

  return values;
}

export function validateFieldValue(
  field: FormField,
  value: string | boolean | undefined,
): string | null {
  // Hidden fields and section dividers never fail user validation
  if (field.type === 'hidden' || field.type === 'section') {
    return null;
  }

  if (field.required) {
    if (field.type === 'checkbox') {
      if (!value) {
        return `${field.label} is required`;
      }
    } else if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      return `${field.label} is required`;
    }
  }

  // If value is empty or not provided and not required, further validation does not fail
  if (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return null;
  }

  if (field.type === 'email' && typeof value === 'string') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      return `${field.label} must be a valid email address`;
    }
  }

  if (field.type === 'phone' && typeof value === 'string') {
    if (!/^[+\d\s().-]{7,20}$/.test(value.trim())) {
      return `${field.label} must be a valid phone number`;
    }
  }

  if (field.type === 'number') {
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(num)) {
      return `${field.label} must be a valid number`;
    }
    if (typeof field.min === 'number' && num < field.min) {
      return `${field.label} must be at least ${field.min}`;
    }
    if (typeof field.max === 'number' && num > field.max) {
      return `${field.label} must be at most ${field.max}`;
    }
  }

  if (
    (field.type === 'text' || field.type === 'textarea') &&
    typeof field.maxLength === 'number' &&
    field.maxLength > 0
  ) {
    if (typeof value === 'string' && value.length > field.maxLength) {
      return `${field.label} must be at most ${field.maxLength} characters`;
    }
  }

  if (field.type === 'date' && typeof value === 'string') {
    if (field.minDate && value < field.minDate) {
      return `${field.label} must be on or after ${field.minDate}`;
    }
    if (field.maxDate && value > field.maxDate) {
      return `${field.label} must be on or before ${field.maxDate}`;
    }
  }

  return null;
}

export function validateFormValues(
  schema: FormSchema,
  values: FormValues,
): { isValid: boolean; errors: FormErrors } {
  const errors: FormErrors = {};

  for (const field of schema.fields) {
    if (!isFieldVisible(field, values)) {
      continue;
    }

    const error = validateFieldValue(field, values[field.id]);
    if (error) {
      errors[field.id] = error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

import type { BaseFieldConfig, FormField, FormSchema } from './types';
import { isFieldType } from './types';
import type { FormSectionPage } from './sections';

export type FormValues = Record<string, unknown>;
export type FormErrors = Record<string, string>;

export interface FormValidationResult {
  valid: boolean;
  errors: FormErrors;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_PATTERN = /^[+\d\s()-]{6,25}$/;
const WEBSITE_PATTERN = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i;

function isValidIsoCalendarDate(str: string): boolean {
  if (!ISO_DATE_PATTERN.test(str)) return false;
  const [yearStr, monthStr, dayStr] = str.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    !Number.isNaN(dt.getTime()) &&
    dt.toISOString().slice(0, 10) === str
  );
}

function validateNumericBounds(
  label: string,
  required: boolean,
  rawValue: unknown,
  min?: number,
  max?: number,
): string | null {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return required ? `${label} is required.` : null;
  }
  if (typeof rawValue !== 'number' && typeof rawValue !== 'string') {
    return `${label} must be a valid number.`;
  }
  let num: number;
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return required ? `${label} is required.` : null;
    }
    num = Number(trimmed);
  } else {
    num = rawValue;
  }
  if (!Number.isFinite(num)) {
    return `${label} must be a valid number.`;
  }
  if (min !== undefined && num < min) {
    return `${label} must be at least ${min}.`;
  }
  if (max !== undefined && num > max) {
    return `${label} must be at most ${max}.`;
  }
  return null;
}

/**
 * Validates a single field's runtime value against its discriminated FormField config.
 * Returns an error string if invalid, or `null` if valid.
 */
export function validateField(field: FormField, rawValue: unknown): string | null {
  switch (field.type) {
    case 'text': {
      const str = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!str) {
        return field.required ? `${field.label} is required.` : null;
      }
      if (field.minLength !== undefined && str.length < field.minLength) {
        return `${field.label} must be at least ${field.minLength} characters.`;
      }
      if (field.maxLength !== undefined && str.length > field.maxLength) {
        return `${field.label} must be at most ${field.maxLength} characters.`;
      }
      return null;
    }

    case 'email': {
      const str = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!str) {
        return field.required ? `${field.label} is required.` : null;
      }
      if (!EMAIL_PATTERN.test(str)) {
        return `Please enter a valid email address.`;
      }
      if (field.allowedDomains && field.allowedDomains.length > 0) {
        const domain = str.split('@')[1]?.toLowerCase() ?? '';
        const normalizedAllowed = field.allowedDomains
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean);
        if (
          normalizedAllowed.length > 0 &&
          !normalizedAllowed.includes(domain)
        ) {
          return `Email must belong to an allowed domain (${normalizedAllowed.join(', ')}).`;
        }
      }
      return null;
    }

    case 'number':
      return validateNumericBounds(
        field.label,
        field.required,
        rawValue,
        field.min,
        field.max,
      );

    case 'select':
    case 'radio': {
      const str = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!str) {
        return field.required ? `Please select an option for ${field.label}.` : null;
      }
      const validValues = new Set(field.options.map((o) => o.value));
      if (!validValues.has(str)) {
        return `Invalid selection for ${field.label}.`;
      }
      return null;
    }

    case 'checkbox': {
      const checked = rawValue === true || rawValue === 'true';
      if (field.required && !checked) {
        return `${field.label} is required.`;
      }
      return null;
    }

    case 'date': {
      const str = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!str) {
        return field.required ? `${field.label} is required.` : null;
      }
      if (!isValidIsoCalendarDate(str)) {
        return `${field.label} must be a valid date (YYYY-MM-DD).`;
      }
      if (field.minDate && str < field.minDate) {
        return `${field.label} cannot be earlier than ${field.minDate}.`;
      }
      if (field.maxDate && str > field.maxDate) {
        return `${field.label} cannot be later than ${field.maxDate}.`;
      }
      return null;
    }

    case 'name': {
      if (typeof rawValue === 'object' && rawValue !== null) {
        const obj = rawValue as { firstName?: unknown; lastName?: unknown };
        const first = typeof obj.firstName === 'string' ? obj.firstName.trim() : '';
        const last = typeof obj.lastName === 'string' ? obj.lastName.trim() : '';
        if (field.required && (!first || !last)) {
          return `${field.label} (First and Last Name) is required.`;
        }
        return null;
      }
      const str = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (field.required && !str) {
        return `${field.label} (First and Last Name) is required.`;
      }
      return null;
    }

    case 'phone': {
      const str = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!str) {
        return field.required ? `${field.label} is required.` : null;
      }
      if (!PHONE_PATTERN.test(str)) {
        return 'Please enter a valid phone number.';
      }
      return null;
    }

    case 'address': {
      if (typeof rawValue === 'object' && rawValue !== null) {
        const obj = rawValue as { street?: unknown; city?: unknown };
        const street = typeof obj.street === 'string' ? obj.street.trim() : '';
        const city = typeof obj.city === 'string' ? obj.city.trim() : '';
        if (field.required && (!street || !city)) {
          return `${field.label} is required.`;
        }
        return null;
      }
      const str = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (field.required && !str) {
        return `${field.label} is required.`;
      }
      return null;
    }

    case 'textarea': {
      const str = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!str) {
        return field.required ? `${field.label} is required.` : null;
      }
      if (field.maxLength !== undefined && str.length > field.maxLength) {
        return `${field.label} must be at most ${field.maxLength} characters.`;
      }
      return null;
    }

    case 'website': {
      const str = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!str) {
        return field.required ? `${field.label} is required.` : null;
      }
      if (!WEBSITE_PATTERN.test(str)) {
        return 'Please enter a valid website URL.';
      }
      return null;
    }

    case 'currency':
      return validateNumericBounds(
        field.label,
        field.required,
        rawValue,
        field.min,
        field.max,
      );

    case 'section':
    case 'grid':
      return null;
  }
}

/**
 * Validates an entire FormSchema against a map of runtime values.
 */
export function validateForm(
  schema: FormSchema,
  values: FormValues,
): FormValidationResult {
  const errors: FormErrors = {};

  for (const field of schema.fields) {
    const error = validateField(field, values[field.id]);
    if (error) {
      errors[field.id] = error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates all fields belonging to a single FormSectionPage (including nested grid children).
 */
export function validateSection(
  section: FormSectionPage,
  values: FormValues,
): FormValidationResult {
  const errors: FormErrors = {};

  for (const field of section.allFields) {
    const error = validateField(field, values[field.id]);
    if (error) {
      errors[field.id] = error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Converts a field label into a clean snake_case query parameter key
 * for URL prefill links (e.g. "Work Email" -> "work_email").
 */
export function toFieldQueryKey(label: string, fallbackId: string): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallbackId;
}

function buildSearchParamLookup(
  searchParams?: URLSearchParams | Record<string, string>,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!searchParams) return map;

  if (searchParams instanceof URLSearchParams) {
    for (const [key, value] of searchParams.entries()) {
      map.set(key, value);
      const lower = key.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, value);
      }
    }
    return map;
  }

  for (const [key, value] of Object.entries(searchParams)) {
    map.set(key, value);
    const lower = key.toLowerCase();
    if (!map.has(lower)) {
      map.set(lower, value);
    }
  }
  return map;
}

/**
 * Computes initial runtime form values for a given FormSchema, optionally
 * pre-populating matching fields from URL query parameters.
 */
export function createInitialFormValues(
  schema: FormSchema,
  searchParams?: URLSearchParams | Record<string, string>,
): FormValues {
  const paramMap = buildSearchParamLookup(searchParams);
  const initial: FormValues = {};

  for (const field of schema.fields) {
    if (field.type === 'section' || field.type === 'grid') {
      continue;
    }

    const queryKey = toFieldQueryKey(field.label, field.id);
    const rawParam =
      paramMap.get(field.id) ??
      paramMap.get(field.id.toLowerCase()) ??
      paramMap.get(queryKey);
    const hasParam = rawParam !== undefined && rawParam.trim() !== '';

    if (field.type === 'checkbox') {
      if (hasParam) {
        const lower = rawParam.trim().toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') {
          initial[field.id] = true;
          continue;
        }
        if (lower === 'false' || lower === '0' || lower === 'no') {
          initial[field.id] = false;
          continue;
        }
      }
      initial[field.id] = field.defaultChecked ?? false;
    } else if (field.type === 'name') {
      const explicitFirst = paramMap.get('first_name')?.trim();
      const explicitLast = paramMap.get('last_name')?.trim();
      if (hasParam) {
        const parts = rawParam.trim().split(/\s+/);
        initial[field.id] = {
          firstName: explicitFirst ?? parts[0] ?? '',
          lastName: explicitLast ?? parts.slice(1).join(' '),
        };
      } else if (explicitFirst || explicitLast) {
        initial[field.id] = {
          firstName: explicitFirst ?? '',
          lastName: explicitLast ?? '',
        };
      } else {
        initial[field.id] = { firstName: '', lastName: '' };
      }
    } else if (field.type === 'address') {
      initial[field.id] = {
        street: paramMap.get('street')?.trim() ?? '',
        city: paramMap.get('city')?.trim() ?? '',
        state: paramMap.get('state')?.trim() ?? '',
        zip: paramMap.get('zip')?.trim() ?? '',
        country: paramMap.get('country')?.trim() || 'United States',
      };
    } else if (field.type === 'select' || field.type === 'radio') {
      if (hasParam) {
        const needle = rawParam.trim().toLowerCase();
        const matched = field.options.find(
          (opt) =>
            opt.value.toLowerCase() === needle ||
            opt.label.toLowerCase() === needle,
        );
        initial[field.id] = matched ? matched.value : rawParam.trim();
      } else {
        initial[field.id] = '';
      }
    } else {
      initial[field.id] = hasParam ? rawParam : '';
    }
  }
  return initial;
}

/**
 * Structural schema parser ("Parse, Don't Validate") for safely importing raw JSON.
 * Returns either a valid `FormSchema` or a human-readable error message.
 */
export function parseFormSchemaJson(
  jsonText: string,
  fallbackClientId = 'tenant_default',
): { ok: true; schema: FormSchema } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'Invalid JSON syntax.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'Schema root must be a JSON object.' };
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id.trim()) {
    return { ok: false, error: 'Schema is missing a valid string "id".' };
  }
  if (typeof obj.title !== 'string' || !obj.title.trim()) {
    return { ok: false, error: 'Schema is missing a valid string "title".' };
  }
  if (!Array.isArray(obj.fields)) {
    return { ok: false, error: 'Schema "fields" must be an array.' };
  }

  const validatedFields: FormField[] = [];
  for (let i = 0; i < obj.fields.length; i++) {
    const rawField = obj.fields[i];
    if (typeof rawField !== 'object' || rawField === null) {
      return { ok: false, error: `Field at index ${i} must be an object.` };
    }
    const f = rawField as Record<string, unknown>;
    if (typeof f.id !== 'string' || !f.id.trim()) {
      return { ok: false, error: `Field at index ${i} is missing a string "id".` };
    }
    if (typeof f.label !== 'string') {
      return { ok: false, error: `Field "${f.id}" is missing a string "label".` };
    }
    if (!isFieldType(f.type)) {
      return {
        ok: false,
        error: `Field "${f.id}" has unsupported type "${String(f.type)}".`,
      };
    }

    const base: Omit<BaseFieldConfig, 'type'> = {
      id: f.id,
      label: f.label,
      placeholder: typeof f.placeholder === 'string' ? f.placeholder : undefined,
      helperText: typeof f.helperText === 'string' ? f.helperText : undefined,
      required: Boolean(f.required),
      columnSpan:
        f.columnSpan === 1 || f.columnSpan === 2 || f.columnSpan === 3
          ? f.columnSpan
          : undefined,
      showDividerAbove:
        typeof f.showDividerAbove === 'boolean' ? f.showDividerAbove : undefined,
      parentGridId:
        typeof f.parentGridId === 'string' ? f.parentGridId : undefined,
      gridColumn:
        f.gridColumn === 0 || f.gridColumn === 1 || f.gridColumn === 2
          ? f.gridColumn
          : undefined,
    };

    switch (f.type) {
      case 'text':
        validatedFields.push({
          ...base,
          type: 'text',
          minLength: typeof f.minLength === 'number' ? f.minLength : undefined,
          maxLength: typeof f.maxLength === 'number' ? f.maxLength : undefined,
        });
        break;
      case 'email':
        validatedFields.push({
          ...base,
          type: 'email',
          allowedDomains: Array.isArray(f.allowedDomains)
            ? f.allowedDomains.filter((d): d is string => typeof d === 'string')
            : undefined,
          confirmEmail:
            typeof f.confirmEmail === 'boolean' ? f.confirmEmail : undefined,
        });
        break;
      case 'number':
        validatedFields.push({
          ...base,
          type: 'number',
          min: typeof f.min === 'number' ? f.min : undefined,
          max: typeof f.max === 'number' ? f.max : undefined,
          step: typeof f.step === 'number' ? f.step : undefined,
        });
        break;
      case 'select':
      case 'radio': {
        const rawOptions = Array.isArray(f.options) ? f.options : [];
        const options = rawOptions
          .filter(
            (opt): opt is Record<string, unknown> =>
              typeof opt === 'object' && opt !== null,
          )
          .map((opt, idx) => ({
            label: typeof opt.label === 'string' ? opt.label : `Option ${idx + 1}`,
            value:
              typeof opt.value === 'string' ? opt.value : `option_${idx + 1}`,
          }));
        validatedFields.push({
          ...base,
          type: f.type,
          options,
        });
        break;
      }
      case 'checkbox':
        validatedFields.push({
          ...base,
          type: 'checkbox',
          defaultChecked:
            typeof f.defaultChecked === 'boolean' ? f.defaultChecked : undefined,
        });
        break;
      case 'date':
        validatedFields.push({
          ...base,
          type: 'date',
          minDate: typeof f.minDate === 'string' ? f.minDate : undefined,
          maxDate: typeof f.maxDate === 'string' ? f.maxDate : undefined,
        });
        break;
      case 'name':
        validatedFields.push({
          ...base,
          type: 'name',
          firstNameLabel:
            typeof f.firstNameLabel === 'string' ? f.firstNameLabel : undefined,
          lastNameLabel:
            typeof f.lastNameLabel === 'string' ? f.lastNameLabel : undefined,
        });
        break;
      case 'phone':
        validatedFields.push({
          ...base,
          type: 'phone',
          defaultCountryCode:
            typeof f.defaultCountryCode === 'string'
              ? f.defaultCountryCode
              : undefined,
        });
        break;
      case 'address':
        validatedFields.push({
          ...base,
          type: 'address',
          showCountry:
            typeof f.showCountry === 'boolean' ? f.showCountry : undefined,
        });
        break;
      case 'textarea':
        validatedFields.push({
          ...base,
          type: 'textarea',
          rows: typeof f.rows === 'number' ? f.rows : undefined,
          maxLength: typeof f.maxLength === 'number' ? f.maxLength : undefined,
        });
        break;
      case 'website':
        validatedFields.push({
          ...base,
          type: 'website',
        });
        break;
      case 'currency':
        validatedFields.push({
          ...base,
          type: 'currency',
          currencyCode:
            typeof f.currencyCode === 'string' ? f.currencyCode : undefined,
          min: typeof f.min === 'number' ? f.min : undefined,
          max: typeof f.max === 'number' ? f.max : undefined,
        });
        break;
      case 'section':
        validatedFields.push({
          ...base,
          type: 'section',
          showLine: typeof f.showLine === 'boolean' ? f.showLine : undefined,
          thankYouTitle:
            typeof f.thankYouTitle === 'string' ? f.thankYouTitle : undefined,
          thankYouMessage:
            typeof f.thankYouMessage === 'string'
              ? f.thankYouMessage
              : undefined,
          redirectUrl:
            typeof f.redirectUrl === 'string' ? f.redirectUrl : undefined,
        });
        break;
      case 'grid':
        validatedFields.push({
          ...base,
          type: 'grid',
          columns:
            f.columns === 1 || f.columns === 2 || f.columns === 3
              ? f.columns
              : 2,
        });
        break;
    }
  }

  const schema: FormSchema = {
    id: obj.id,
    clientId:
      typeof obj.clientId === 'string' && obj.clientId.trim()
        ? obj.clientId
        : fallbackClientId,
    slug:
      typeof obj.slug === 'string' && obj.slug.trim()
        ? obj.slug
        : obj.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: obj.title,
    description:
      typeof obj.description === 'string' ? obj.description : undefined,
    submitButtonText:
      typeof obj.submitButtonText === 'string' ? obj.submitButtonText : 'Submit',
    thankYouTitle:
      typeof obj.thankYouTitle === 'string' ? obj.thankYouTitle : undefined,
    thankYouMessage:
      typeof obj.thankYouMessage === 'string' ? obj.thankYouMessage : undefined,
    redirectUrl:
      typeof obj.redirectUrl === 'string' ? obj.redirectUrl : undefined,
    isPublished:
      typeof obj.isPublished === 'boolean' ? obj.isPublished : true,
    fields: validatedFields,
    updatedAt:
      typeof obj.updatedAt === 'string'
        ? obj.updatedAt
        : new Date().toISOString(),
  };

  return { ok: true, schema };
}

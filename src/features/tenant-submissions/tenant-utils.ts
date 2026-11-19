import type {
  ClientTenant,
  FormField,
  FormSchema,
  SubmissionRecord,
} from '../../domain/form-schema/types.ts';
import { USERNAME_PATTERN } from '../../shared/lib/username.ts';

/** Formats an ISO timestamp string to `YYYY-MM-DD HH:mm:ss` for table cells. */
export function formatIsoTimestamp(iso: string): string {
  return iso.slice(0, 19).replace('T', ' ');
}

function resolveOptionLabel(value: string, field?: FormField): string {
  if (field && 'options' in field && Array.isArray(field.options)) {
    const matched = field.options.find((opt) => opt.value === value);
    if (matched) return matched.label;
  }
  return value;
}

function joinNonEmptyParts(parts: unknown[], separator: string): string {
  const cleaned: string[] = [];
  for (const part of parts) {
    if (part === undefined || part === null) continue;
    const text = String(part).trim();
    if (text !== '') {
      cleaned.push(text);
    }
  }
  return cleaned.length > 0 ? cleaned.join(separator) : '—';
}

/** Formats an arbitrary submission field value for human-readable table cells and drawers. */
export function formatSubmissionValue(
  value: unknown,
  field?: FormField,
): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (Array.isArray(value)) {
    const formattedItems = value
      .map((item) => {
        if (item === undefined || item === null) return '';
        const raw = String(item).trim();
        return raw === '' ? '' : resolveOptionLabel(raw, field);
      })
      .filter((text) => text !== '');
    return formattedItems.length > 0 ? formattedItems.join(', ') : '—';
  }

  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (field?.type === 'name' || 'firstName' in rec || 'lastName' in rec) {
      return joinNonEmptyParts([rec.firstName, rec.lastName], ' ');
    }
    if (
      field?.type === 'address' ||
      'street' in rec ||
      'city' in rec ||
      'zip' in rec
    ) {
      return joinNonEmptyParts(
        [rec.street, rec.city, rec.state, rec.zip, rec.country],
        ', ',
      );
    }
    return joinNonEmptyParts(Object.values(rec), ' ');
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return resolveOptionLabel(String(value), field);
  }

  return String(value);
}

/** Returns a concise human-readable preview of the first populated field in a submission. */
export function getSubmissionPreview(
  submission: SubmissionRecord,
  form?: FormSchema,
): string {
  if (form) {
    const dataFields = form.fields.filter(
      (f) => f.type !== 'section' && f.type !== 'grid',
    );
    for (const field of dataFields) {
      const formatted = formatSubmissionValue(
        submission.values[field.id],
        field,
      );
      if (formatted !== '—') {
        return formatted;
      }
    }
  }
  for (const val of Object.values(submission.values)) {
    const formatted = formatSubmissionValue(val);
    if (formatted !== '—') {
      return formatted;
    }
  }
  return 'Submitted response';
}

/** Sanitizes a tenant name or raw slug into URL-safe lowercase kebab-case. */
export function sanitizeTenantSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolves a unique tenant slug against existing tenants, appending a numeric
 * suffix (`-2`, `-3`, ...) when needed.
 */
export function ensureUniqueTenantSlug(
  rawSlug: string,
  tenants: readonly ClientTenant[],
  excludeTenantId?: string,
): string {
  const base = sanitizeTenantSlug(rawSlug) || 'tenant';
  const taken = new Set(
    tenants
      .filter((t) => t.id !== excludeTenantId)
      .map((t) => t.slug.toLowerCase()),
  );

  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

export interface ValidatedEditTenantInput {
  name: string;
  slug: string;
  status: 'active' | 'suspended';
}

export function validateEditTenantInput(
  input: {
    name: string;
    slug: string;
    status: 'active' | 'suspended';
  },
  tenants: readonly ClientTenant[],
  tenantId: string,
):
  | { ok: true; data: ValidatedEditTenantInput }
  | { ok: false; error: string } {
  const trimmedName = input.name.trim();
  if (trimmedName.length < 2) {
    return {
      ok: false,
      error: 'Tenant name must be at least 2 characters.',
    };
  }

  const normalizedSlug = sanitizeTenantSlug(input.slug);
  if (!normalizedSlug) {
    return {
      ok: false,
      error: 'Tenant slug must contain at least one letter or number.',
    };
  }

  const collision = tenants.some(
    (t) => t.id !== tenantId && t.slug.toLowerCase() === normalizedSlug,
  );
  if (collision) {
    return {
      ok: false,
      error: `Tenant slug "${normalizedSlug}" is already in use.`,
    };
  }

  return {
    ok: true,
    data: {
      name: trimmedName,
      slug: normalizedSlug,
      status: input.status,
    },
  };
}

export interface ValidatedEditTenantUserInput {
  username: string;
  displayName: string;
  role: 'tenant_admin' | 'tenant_member';
}

export function validateEditTenantUserInput(input: {
  username: string;
  displayName: string;
  role: 'tenant_admin' | 'tenant_member';
}):
  | { ok: true; data: ValidatedEditTenantUserInput }
  | { ok: false; error: string } {
  const trimmedUsername = input.username.trim();
  if (!USERNAME_PATTERN.test(trimmedUsername)) {
    return {
      ok: false,
      error:
        'Username must be 3–32 characters (letters, numbers, _, ., or -).',
    };
  }

  const trimmedDisplayName = input.displayName.trim();
  if (trimmedDisplayName.length < 2) {
    return {
      ok: false,
      error: 'Display name must be at least 2 characters.',
    };
  }

  return {
    ok: true,
    data: {
      username: trimmedUsername,
      displayName: trimmedDisplayName,
      role: input.role,
    },
  };
}

export interface NewTenantUserDraft {
  username: string;
  displayName: string;
  password: string;
  role: 'tenant_admin' | 'tenant_member';
}

/**
 * Validates a batch of new team member drafts. Returns one error message (or
 * null) per draft, in order. Usernames are checked for duplicates within the
 * batch and against `existingUsernames` (case-insensitive).
 */
export function validateNewTenantUserDrafts(
  drafts: NewTenantUserDraft[],
  existingUsernames: string[],
): (string | null)[] {
  const taken = new Set(existingUsernames.map((u) => u.toLowerCase()));
  const seen = new Set<string>();

  return drafts.map((draft) => {
    const base = validateEditTenantUserInput(draft);
    if (!base.ok) return base.error;
    if (draft.password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    const key = base.data.username.toLowerCase();
    if (taken.has(key)) {
      return `Username "${base.data.username}" is already in use.`;
    }
    if (seen.has(key)) {
      return `Username "${base.data.username}" is duplicated in this list.`;
    }
    seen.add(key);
    return null;
  });
}

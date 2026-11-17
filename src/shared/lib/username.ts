/** Pattern matching valid tenant/admin usernames (3–32 safe characters). */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

/** Pragmatic RFC-compatible email validation pattern for form and DTO checks. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_USERNAME_LENGTH = 32;
const MIN_USERNAME_LENGTH = 3;
const FALLBACK_USERNAME = 'tenant_admin';

/**
 * Derives a default `snake_case` username from an organization name
 * (e.g. `"Value One"` -> `"value_one"`, `"Stark Industries"` -> `"stark_industries"`).
 * Always returns a valid username matching `USERNAME_PATTERN`.
 */
export function toSnakeCaseUsername(organizationName: string): string {
  const normalized = organizationName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) {
    return FALLBACK_USERNAME;
  }

  let candidate = normalized.slice(0, MAX_USERNAME_LENGTH).replace(/_+$/g, '');
  if (!candidate) {
    return FALLBACK_USERNAME;
  }

  if (candidate.length < MIN_USERNAME_LENGTH) {
    candidate = `${candidate}_admin`.slice(0, MAX_USERNAME_LENGTH);
  }

  return candidate;
}

/**
 * Resolves a unique username by appending `_2`, `_3`, ... when `baseUsername`
 * is already taken, respecting the 32-character maximum length.
 */
export async function ensureUniqueUsername(
  baseUsername: string,
  isTaken: (candidate: string) => Promise<boolean> | boolean,
): Promise<string> {
  const sanitizedBase =
    baseUsername.trim().slice(0, MAX_USERNAME_LENGTH) || FALLBACK_USERNAME;

  if (!(await isTaken(sanitizedBase))) {
    return sanitizedBase;
  }

  let suffix = 2;
  while (true) {
    const suffixToken = `_${suffix}`;
    const prefixMax = MAX_USERNAME_LENGTH - suffixToken.length;
    const prefix = sanitizedBase.slice(0, prefixMax).replace(/_+$/g, '') || 'user';
    const candidate = `${prefix}${suffixToken}`;
    if (!(await isTaken(candidate))) {
      return candidate;
    }
    suffix += 1;
  }
}

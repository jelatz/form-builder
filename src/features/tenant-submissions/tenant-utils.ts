import type { ClientTenant } from '../../domain/form-schema';

/** Formats an ISO timestamp string to `YYYY-MM-DD HH:mm:ss` for table cells. */
export function formatIsoTimestamp(iso: string): string {
  return iso.slice(0, 19).replace('T', ' ');
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

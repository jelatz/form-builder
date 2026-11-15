export function slugify(raw: string, fallback = 'item'): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

export function ensureUniqueSlug(
  candidate: string,
  existingSlugs: ReadonlySet<string>,
  fallback = 'item',
): string {
  const base = slugify(candidate, fallback);
  if (!existingSlugs.has(base)) {
    return base;
  }

  let suffix = 2;
  while (existingSlugs.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

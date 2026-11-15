export interface LoginRequestDto {
  username: string;
  password: string;
  tenantSlug?: string;
}

export type DtoResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function validateLoginDto(raw: unknown): DtoResult<LoginRequestDto> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Invalid login payload.' };
  }

  const body = raw as Record<string, unknown>;
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const tenantSlug =
    typeof body.tenantSlug === 'string' && body.tenantSlug.trim()
      ? body.tenantSlug.trim().toLowerCase()
      : undefined;

  const fieldErrors: Record<string, string> = {};
  if (!username) fieldErrors.username = 'Username is required.';
  if (!password) fieldErrors.password = 'Password is required.';

  if (fieldErrors.username || fieldErrors.password) {
    return {
      ok: false,
      error: 'Please enter both username and password.',
      fieldErrors,
    };
  }

  return {
    ok: true,
    data: {
      username,
      password,
      tenantSlug,
    },
  };
}

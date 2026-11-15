/**
 * Authentication DTO contracts and deterministic client-side validators.
 */

export interface LoginRequestDto {
  username: string;
  password: string;
  tenantSlug?: string;
}

export type DtoValidationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      fieldErrors: Partial<Record<keyof T, string>>;
    };

/** Validates login credentials deterministically before sending to Fastify. */
export function validateLoginDto(
  input: LoginRequestDto,
): DtoValidationResult<LoginRequestDto> {
  const username = input.username.trim();
  const password = input.password;
  const tenantSlug = input.tenantSlug?.trim().toLowerCase() || undefined;
  const fieldErrors: Partial<Record<keyof LoginRequestDto, string>> = {};

  if (!username) {
    fieldErrors.username = 'Username is required.';
  }
  if (!password) {
    fieldErrors.password = 'Password is required.';
  }

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

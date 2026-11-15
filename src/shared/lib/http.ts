export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    status: number,
    message: string,
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export async function apiRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const hasBody = init?.body !== undefined;
  const headers = new Headers(init?.headers);
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  let payload: unknown = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const obj =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)
        : {};
    const message =
      typeof obj.error === 'string' && obj.error
        ? obj.error
        : `Request failed with status ${response.status}.`;
    const fieldErrors =
      typeof obj.fieldErrors === 'object' && obj.fieldErrors !== null
        ? (obj.fieldErrors as Record<string, string>)
        : undefined;
    throw new ApiError(response.status, message, fieldErrors);
  }

  return payload as T;
}

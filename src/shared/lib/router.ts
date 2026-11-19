/**
 * Pure URL route parsing and path construction for the Form Builder SPA.
 * Zero DOM, React, or feature imports so it can be shared and unit-tested in Node.
 */

export const WORKSPACE_MODES = [
  'dashboard',
  'tenants',
  'forms',
  'form_detail',
  'edit',
  'preview',
  'submissions',
  'integrations',
  'submissions_explorer',
  'schema',
  'guide',
] as const;

export type WorkspaceMode = (typeof WORKSPACE_MODES)[number];

export type AppRoute =
  | {
      kind: 'workspace';
      mode: WorkspaceMode;
      formId?: string;
    }
  | { kind: 'tenant_login'; tenantSlug: string }
  | { kind: 'public_form'; tenantSlug: string; formSlug: string };

export function isFormScopedMode(mode: WorkspaceMode): boolean {
  return (
    mode === 'form_detail' ||
    mode === 'edit' ||
    mode === 'preview' ||
    mode === 'submissions' ||
    mode === 'integrations' ||
    mode === 'schema'
  );
}

function safeDecodeURIComponent(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function parseAppRoute(pathname: string): AppRoute {
  const tenantLoginMatch = pathname.match(/^\/t\/([^/]+)\/login\/?$/i);
  if (tenantLoginMatch?.[1]) {
    return {
      kind: 'tenant_login',
      tenantSlug: safeDecodeURIComponent(tenantLoginMatch[1]).toLowerCase(),
    };
  }

  const publicFormMatch = pathname.match(/^\/f\/([^/]+)\/([^/]+)\/?$/i);
  if (publicFormMatch?.[1] && publicFormMatch[2]) {
    return {
      kind: 'public_form',
      tenantSlug: safeDecodeURIComponent(publicFormMatch[1]).toLowerCase(),
      formSlug: safeDecodeURIComponent(publicFormMatch[2]).toLowerCase(),
    };
  }

  if (/^\/tenants\/?$/i.test(pathname)) {
    return { kind: 'workspace', mode: 'tenants' };
  }

  if (/^\/forms\/?$/i.test(pathname)) {
    return { kind: 'workspace', mode: 'forms' };
  }

  const formActionMatch = pathname.match(
    /^\/forms\/([^/]+)\/(edit|preview|submissions|integrations|schema)\/?$/i,
  );
  if (formActionMatch?.[1] && formActionMatch[2]) {
    const formId = safeDecodeURIComponent(formActionMatch[1]);
    const action = formActionMatch[2].toLowerCase() as
      | 'edit'
      | 'preview'
      | 'submissions'
      | 'integrations'
      | 'schema';
    return {
      kind: 'workspace',
      mode: action,
      formId,
    };
  }

  const formDetailMatch = pathname.match(/^\/forms\/([^/]+)\/?$/i);
  if (formDetailMatch?.[1]) {
    return {
      kind: 'workspace',
      mode: 'form_detail',
      formId: safeDecodeURIComponent(formDetailMatch[1]),
    };
  }

  if (/^\/submissions\/?$/i.test(pathname)) {
    return { kind: 'workspace', mode: 'submissions_explorer' };
  }

  if (/^\/schema\/?$/i.test(pathname)) {
    return { kind: 'workspace', mode: 'schema' };
  }

  if (/^\/guide\/?$/i.test(pathname)) {
    return { kind: 'workspace', mode: 'guide' };
  }

  return { kind: 'workspace', mode: 'dashboard' };
}

export function buildWorkspacePath(
  mode: WorkspaceMode,
  formId?: string,
): string {
  const cleanFormId = formId?.trim();
  const encodedFormId = cleanFormId ? encodeURIComponent(cleanFormId) : '';

  switch (mode) {
    case 'dashboard':
      return '/dashboard';
    case 'tenants':
      return '/tenants';
    case 'forms':
      return '/forms';
    case 'submissions_explorer':
      return '/submissions';
    case 'schema':
      return encodedFormId ? `/forms/${encodedFormId}/schema` : '/schema';
    case 'form_detail':
      return encodedFormId ? `/forms/${encodedFormId}` : '/forms';
    case 'edit':
      return encodedFormId ? `/forms/${encodedFormId}/edit` : '/forms';
    case 'preview':
      return encodedFormId ? `/forms/${encodedFormId}/preview` : '/forms';
    case 'submissions':
      return encodedFormId ? `/forms/${encodedFormId}/submissions` : '/forms';
    case 'integrations':
      return encodedFormId ? `/forms/${encodedFormId}/integrations` : '/forms';
    case 'guide':
      return '/guide';
  }
}

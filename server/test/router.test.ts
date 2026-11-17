import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKSPACE_MODES,
  buildWorkspacePath,
  isFormScopedMode,
  parseAppRoute,
  type WorkspaceMode,
} from '../../src/shared/lib/router.ts';

test('parseAppRoute: parses public form routes with normalization and URL decoding', () => {
  assert.deepEqual(parseAppRoute('/f/acme/intake-form'), {
    kind: 'public_form',
    tenantSlug: 'acme',
    formSlug: 'intake-form',
  });

  assert.deepEqual(parseAppRoute('/f/acme/intake-form/'), {
    kind: 'public_form',
    tenantSlug: 'acme',
    formSlug: 'intake-form',
  });

  assert.deepEqual(parseAppRoute('/F/ACME-Corp/Intake%20Form%2B1'), {
    kind: 'public_form',
    tenantSlug: 'acme-corp',
    formSlug: 'intake form+1',
  });

  assert.deepEqual(parseAppRoute('/f/Org%20One/Form%20A/'), {
    kind: 'public_form',
    tenantSlug: 'org one',
    formSlug: 'form a',
  });

  // Malformed percent-encoding falls back cleanly without throwing
  assert.deepEqual(parseAppRoute('/f/ACME/%E0%A4%A'), {
    kind: 'public_form',
    tenantSlug: 'acme',
    formSlug: '%e0%a4%a',
  });
});

test('parseAppRoute: parses tenant login routes with normalization and URL decoding', () => {
  assert.deepEqual(parseAppRoute('/t/acme/login'), {
    kind: 'tenant_login',
    tenantSlug: 'acme',
  });

  assert.deepEqual(parseAppRoute('/t/acme/login/'), {
    kind: 'tenant_login',
    tenantSlug: 'acme',
  });

  assert.deepEqual(parseAppRoute('/T/Acme%20Corp/LOGIN'), {
    kind: 'tenant_login',
    tenantSlug: 'acme corp',
  });

  assert.deepEqual(parseAppRoute('/t/Tenant%2DBeta/login/'), {
    kind: 'tenant_login',
    tenantSlug: 'tenant-beta',
  });
});

test('parseAppRoute: parses top-level workspace routes and trailing slashes', () => {
  assert.deepEqual(parseAppRoute('/'), {
    kind: 'workspace',
    mode: 'dashboard',
  });

  assert.deepEqual(parseAppRoute('/dashboard'), {
    kind: 'workspace',
    mode: 'dashboard',
  });

  assert.deepEqual(parseAppRoute('/dashboard/'), {
    kind: 'workspace',
    mode: 'dashboard',
  });

  assert.deepEqual(parseAppRoute('/login'), {
    kind: 'workspace',
    mode: 'dashboard',
  });

  assert.deepEqual(parseAppRoute('/login/'), {
    kind: 'workspace',
    mode: 'dashboard',
  });

  assert.deepEqual(parseAppRoute('/tenants'), {
    kind: 'workspace',
    mode: 'tenants',
  });

  assert.deepEqual(parseAppRoute('/TENANTS/'), {
    kind: 'workspace',
    mode: 'tenants',
  });

  assert.deepEqual(parseAppRoute('/forms'), {
    kind: 'workspace',
    mode: 'forms',
  });

  assert.deepEqual(parseAppRoute('/FORMS/'), {
    kind: 'workspace',
    mode: 'forms',
  });

  assert.deepEqual(parseAppRoute('/submissions'), {
    kind: 'workspace',
    mode: 'submissions_explorer',
  });

  assert.deepEqual(parseAppRoute('/submissions/'), {
    kind: 'workspace',
    mode: 'submissions_explorer',
  });

  assert.deepEqual(parseAppRoute('/schema'), {
    kind: 'workspace',
    mode: 'schema',
  });

  assert.deepEqual(parseAppRoute('/SCHEMA/'), {
    kind: 'workspace',
    mode: 'schema',
  });
});

test('parseAppRoute: parses form-scoped routes and preserves decoded formId casing', () => {
  assert.deepEqual(parseAppRoute('/forms/form-123'), {
    kind: 'workspace',
    mode: 'form_detail',
    formId: 'form-123',
  });

  assert.deepEqual(parseAppRoute('/forms/Form%20ABC/'), {
    kind: 'workspace',
    mode: 'form_detail',
    formId: 'Form ABC',
  });

  assert.deepEqual(parseAppRoute('/forms/form-123/edit'), {
    kind: 'workspace',
    mode: 'edit',
    formId: 'form-123',
  });

  assert.deepEqual(parseAppRoute('/forms/form-123/EDIT/'), {
    kind: 'workspace',
    mode: 'edit',
    formId: 'form-123',
  });

  assert.deepEqual(parseAppRoute('/forms/form-123/preview'), {
    kind: 'workspace',
    mode: 'preview',
    formId: 'form-123',
  });

  assert.deepEqual(parseAppRoute('/forms/form-123/preview/'), {
    kind: 'workspace',
    mode: 'preview',
    formId: 'form-123',
  });

  assert.deepEqual(parseAppRoute('/forms/form-123/submissions'), {
    kind: 'workspace',
    mode: 'submissions',
    formId: 'form-123',
  });

  assert.deepEqual(parseAppRoute('/forms/form-123/submissions/'), {
    kind: 'workspace',
    mode: 'submissions',
    formId: 'form-123',
  });

  assert.deepEqual(parseAppRoute('/forms/form-123/schema'), {
    kind: 'workspace',
    mode: 'schema',
    formId: 'form-123',
  });

  assert.deepEqual(parseAppRoute('/forms/Form%2F1/schema/'), {
    kind: 'workspace',
    mode: 'schema',
    formId: 'Form/1',
  });
});

test('parseAppRoute: falls back unknown and unmatched nested paths to dashboard', () => {
  const fallbackRoutes = [
    '',
    '/unknown',
    '/unknown/nested/path',
    '/t/acme',
    '/t/acme/settings',
    '/f/acme',
    '/f/acme/intake-form/extra',
    '/forms/form-123/unknown',
    '/forms/form-123/edit/extra',
  ];

  for (const path of fallbackRoutes) {
    assert.deepEqual(
      parseAppRoute(path),
      { kind: 'workspace', mode: 'dashboard' },
      `Expected ${path} to fall back to dashboard`,
    );
  }
});

test('buildWorkspacePath: builds paths without formId across all workspace modes', () => {
  assert.equal(buildWorkspacePath('dashboard'), '/dashboard');
  assert.equal(buildWorkspacePath('tenants'), '/tenants');
  assert.equal(buildWorkspacePath('forms'), '/forms');
  assert.equal(buildWorkspacePath('submissions_explorer'), '/submissions');
  assert.equal(buildWorkspacePath('schema'), '/schema');
  assert.equal(buildWorkspacePath('form_detail'), '/forms');
  assert.equal(buildWorkspacePath('edit'), '/forms');
  assert.equal(buildWorkspacePath('preview'), '/forms');
  assert.equal(buildWorkspacePath('submissions'), '/forms');

  // Whitespace-only formId behaves like omitted formId
  assert.equal(buildWorkspacePath('edit', '   '), '/forms');
  assert.equal(buildWorkspacePath('schema', '   '), '/schema');
});

test('buildWorkspacePath: builds paths with formId including trimming and URL encoding', () => {
  assert.equal(buildWorkspacePath('dashboard', 'form-1'), '/dashboard');
  assert.equal(buildWorkspacePath('tenants', 'form-1'), '/tenants');
  assert.equal(buildWorkspacePath('forms', 'form-1'), '/forms');
  assert.equal(
    buildWorkspacePath('submissions_explorer', 'form-1'),
    '/submissions',
  );

  assert.equal(buildWorkspacePath('form_detail', 'form-1'), '/forms/form-1');
  assert.equal(buildWorkspacePath('edit', 'form-1'), '/forms/form-1/edit');
  assert.equal(buildWorkspacePath('preview', 'form-1'), '/forms/form-1/preview');
  assert.equal(
    buildWorkspacePath('submissions', 'form-1'),
    '/forms/form-1/submissions',
  );
  assert.equal(buildWorkspacePath('schema', 'form-1'), '/forms/form-1/schema');

  // Trimming and encodeURIComponent
  assert.equal(
    buildWorkspacePath('edit', '  Form A/B?x=1  '),
    '/forms/Form%20A%2FB%3Fx%3D1/edit',
  );
  assert.equal(
    buildWorkspacePath('form_detail', 'Form #2'),
    '/forms/Form%20%232',
  );
  assert.equal(
    buildWorkspacePath('schema', 'Form #2'),
    '/forms/Form%20%232/schema',
  );
});

test('buildWorkspacePath + parseAppRoute: round-trips encoded form-scoped routes', () => {
  const formScopedModes: WorkspaceMode[] = [
    'form_detail',
    'edit',
    'preview',
    'submissions',
    'schema',
  ];
  const formId = 'Tenant Form/1 #alpha';

  for (const mode of formScopedModes) {
    const path = buildWorkspacePath(mode, formId);
    assert.deepEqual(parseAppRoute(path), {
      kind: 'workspace',
      mode,
      formId,
    });
  }
});

test('isFormScopedMode: accurately classifies all 9 WorkspaceMode values', () => {
  assert.equal(WORKSPACE_MODES.length, 9);

  const expected: Record<WorkspaceMode, boolean> = {
    dashboard: false,
    tenants: false,
    forms: false,
    form_detail: true,
    edit: true,
    preview: true,
    submissions: true,
    submissions_explorer: false,
    schema: true,
  };

  for (const mode of WORKSPACE_MODES) {
    assert.equal(
      isFormScopedMode(mode),
      expected[mode],
      `Unexpected isFormScopedMode result for ${mode}`,
    );
  }
});

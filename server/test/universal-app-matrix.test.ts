import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  addField,
  duplicateField,
  markFormAsDraft,
  moveFieldToGrid,
  publishFormSchema,
  removeSection,
  updateField,
} from '../../src/domain/form-schema/operations.ts';
import {
  FIELD_TYPES,
  type AddressFieldConfig,
  type CheckboxFieldConfig,
  type CurrencyFieldConfig,
  type DateFieldConfig,
  type EmailFieldConfig,
  type FormSchema,
  type GridFieldConfig,
  type NameFieldConfig,
  type NumberFieldConfig,
  type PhoneFieldConfig,
  type RadioFieldConfig,
  type SectionFieldConfig,
  type SelectFieldConfig,
  type TextareaFieldConfig,
  type TextFieldConfig,
  type WebsiteFieldConfig,
} from '../../src/domain/form-schema/types.ts';
import {
  parseFormSchemaJson,
  validateField,
} from '../../src/domain/form-schema/validation.ts';
import {
  WORKSPACE_MODES,
  buildWorkspacePath,
  parseAppRoute,
} from '../../src/shared/lib/router.ts';
import { buildServer } from '../app.ts';
import { escapeLikePattern } from '../db/neon-store.ts';
import { seedDatabase } from '../db/seed.ts';
import { hashSessionToken } from '../lib/crypto.ts';
import type { EmailService } from '../lib/email.ts';
import { SESSION_COOKIE_NAME } from '../middleware/auth.ts';
import { seedTestDatabase } from './fixtures.ts';
import { InMemoryAppStore } from './in-memory-store.ts';

function extractCookieHeader(res: {
  cookies: Array<{ name: string; value: string }>;
}): string {
  const sessionCookie = res.cookies.find(
    (c) => c.name === SESSION_COOKIE_NAME && c.value.length > 0,
  );
  assert.ok(sessionCookie, `Expected ${SESSION_COOKIE_NAME} cookie to be set`);
  return `${sessionCookie.name}=${sessionCookie.value}`;
}

async function loginAs(
  app: Awaited<ReturnType<typeof buildServer>>,
  username: string,
  password: string,
  tenantSlug?: string,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: tenantSlug ? { username, password, tenantSlug } : { username, password },
  });
  assert.equal(res.statusCode, 200, `Login failed for ${username}`);
  return extractCookieHeader(res);
}

test('TC-01: Domain validateField handles concrete boundaries for text, textarea, and email', () => {
  const textField: TextFieldConfig = {
    id: 'f_txt',
    type: 'text',
    label: 'Full Name',
    required: true,
    minLength: 3,
    maxLength: 10,
  };
  assert.equal(validateField(textField, '   '), 'Full Name is required.');
  assert.equal(
    validateField(textField, 'ab'),
    'Full Name must be at least 3 characters.',
  );
  assert.equal(
    validateField(textField, 'abcdefghijk'),
    'Full Name must be at most 10 characters.',
  );
  assert.equal(
    validateField(textField, "Dana O'Neil"),
    'Full Name must be at most 10 characters.',
  );
  assert.equal(validateField(textField, "Dana O'N"), null);

  const textareaField: TextareaFieldConfig = {
    id: 'f_ta',
    type: 'textarea',
    label: 'Bio',
    required: false,
    maxLength: 5,
  };
  assert.equal(
    validateField(textareaField, '123456'),
    'Bio must be at most 5 characters.',
  );
  assert.equal(validateField(textareaField, '12345'), null);

  const emailField: EmailFieldConfig = {
    id: 'f_email',
    type: 'email',
    label: 'Work Email',
    required: true,
    allowedDomains: ['Acme.COM'],
  };
  assert.equal(
    validateField(emailField, 'qa@localhost'),
    'Please enter a valid email address.',
  );
  assert.equal(validateField(emailField, 'DANA@ACME.COM'), null);
  assert.equal(
    validateField(emailField, 'dana@other.com'),
    'Email must belong to an allowed domain (acme.com).',
  );
});

test('TC-02: Domain validateField rejects whitespace, non-numeric, and Infinity on number and currency', () => {
  const numberField: NumberFieldConfig = {
    id: 'f_num',
    type: 'number',
    label: 'Seats',
    required: true,
    min: 0,
    max: 100,
  };
  assert.equal(validateField(numberField, ''), 'Seats is required.');
  assert.equal(validateField(numberField, '   '), 'Seats is required.');
  assert.equal(validateField(numberField, []), 'Seats must be a valid number.');
  assert.equal(validateField(numberField, false), 'Seats must be a valid number.');
  assert.equal(
    validateField(numberField, 'Infinity'),
    'Seats must be a valid number.',
  );
  assert.equal(validateField(numberField, Infinity), 'Seats must be a valid number.');
  assert.equal(
    validateField(numberField, -Infinity),
    'Seats must be a valid number.',
  );
  assert.equal(validateField(numberField, Number.NaN), 'Seats must be a valid number.');
  assert.equal(validateField(numberField, -1), 'Seats must be at least 0.');
  assert.equal(validateField(numberField, 100.0001), 'Seats must be at most 100.');
  assert.equal(validateField(numberField, 0), null);
  assert.equal(validateField(numberField, 42.5), null);

  const currencyField: CurrencyFieldConfig = {
    id: 'f_cur',
    type: 'currency',
    label: 'Budget',
    required: true,
    min: 10,
    max: 500,
  };
  assert.equal(validateField(currencyField, '   '), 'Budget is required.');
  assert.equal(validateField(currencyField, []), 'Budget must be a valid number.');
  assert.equal(
    validateField(currencyField, 'Infinity'),
    'Budget must be a valid number.',
  );
  assert.equal(validateField(currencyField, 9.99), 'Budget must be at least 10.');
  assert.equal(validateField(currencyField, 500.01), 'Budget must be at most 500.');
  assert.equal(validateField(currencyField, '42.50'), null);
});

test('TC-03: Domain validateField rejects calendar overflow dates and enforces date range', () => {
  const dateField: DateFieldConfig = {
    id: 'f_date',
    type: 'date',
    label: 'Start Date',
    required: true,
    minDate: '2026-01-01',
    maxDate: '2026-12-31',
  };
  assert.equal(
    validateField(dateField, '2026-02-30'),
    'Start Date must be a valid date (YYYY-MM-DD).',
  );
  assert.equal(
    validateField(dateField, '2026-02-29'),
    'Start Date must be a valid date (YYYY-MM-DD).',
  );
  assert.equal(
    validateField(dateField, '2024-02-29'),
    'Start Date cannot be earlier than 2026-01-01.',
  );
  assert.equal(
    validateField(dateField, '2025-12-31'),
    'Start Date cannot be earlier than 2026-01-01.',
  );
  assert.equal(
    validateField(dateField, '2027-01-01'),
    'Start Date cannot be later than 2026-12-31.',
  );
  assert.equal(validateField(dateField, '2026-06-15'), null);
});

test('TC-04: Domain validateField covers select, radio, checkbox, name, phone, address, website, section, grid', () => {
  const selectField: SelectFieldConfig = {
    id: 'f_sel',
    type: 'select',
    label: 'Plan',
    required: true,
    options: [
      { label: 'Starter', value: 'starter' },
      { label: 'Pro', value: 'pro' },
    ],
  };
  assert.equal(validateField(selectField, 'hacked_opt'), 'Invalid selection for Plan.');
  assert.equal(validateField(selectField, 'pro'), null);

  const radioField: RadioFieldConfig = {
    id: 'f_rad',
    type: 'radio',
    label: 'Tier',
    required: true,
    options: [{ label: 'Gold', value: 'gold' }],
  };
  assert.equal(validateField(radioField, 'hacked_opt'), 'Invalid selection for Tier.');
  assert.equal(validateField(radioField, 'gold'), null);

  const checkboxField: CheckboxFieldConfig = {
    id: 'f_chk',
    type: 'checkbox',
    label: 'Accept Terms',
    required: true,
  };
  assert.equal(validateField(checkboxField, false), 'Accept Terms is required.');
  assert.equal(validateField(checkboxField, 'true'), null);
  assert.equal(validateField(checkboxField, true), null);

  const nameField: NameFieldConfig = {
    id: 'f_name',
    type: 'name',
    label: 'Contact Name',
    required: true,
  };
  assert.equal(
    validateField(nameField, { firstName: 'Dana', lastName: '   ' }),
    'Contact Name (First and Last Name) is required.',
  );
  assert.equal(
    validateField(nameField, { firstName: 'Dana', lastName: "O'Neil" }),
    null,
  );

  const phoneField: PhoneFieldConfig = {
    id: 'f_phone',
    type: 'phone',
    label: 'Phone',
    required: true,
  };
  assert.equal(validateField(phoneField, '123'), 'Please enter a valid phone number.');
  assert.equal(validateField(phoneField, '+1 (555) 234-5678'), null);

  const addressField: AddressFieldConfig = {
    id: 'f_addr',
    type: 'address',
    label: 'Mailing Address',
    required: true,
  };
  assert.equal(
    validateField(addressField, { street: '123 Main', city: '' }),
    'Mailing Address is required.',
  );
  assert.equal(
    validateField(addressField, { street: '123 Main', city: 'Austin' }),
    null,
  );

  const websiteField: WebsiteFieldConfig = {
    id: 'f_web',
    type: 'website',
    label: 'Website',
    required: true,
  };
  assert.equal(
    validateField(websiteField, 'not a url'),
    'Please enter a valid website URL.',
  );
  assert.equal(validateField(websiteField, 'https://acme.example.com/path'), null);

  const sectionField: SectionFieldConfig = {
    id: 'f_sec',
    type: 'section',
    label: 'Section 1',
    required: false,
  };
  const gridField: GridFieldConfig = {
    id: 'f_grid',
    type: 'grid',
    label: '2-Column Grid',
    required: false,
    columns: 2,
  };
  assert.equal(validateField(sectionField, 'ignored'), null);
  assert.equal(validateField(gridField, 'ignored'), null);
});

test('TC-05: Domain parseFormSchemaJson rejects invalid schemas and fills defaults safely', () => {
  const badJson = parseFormSchemaJson('{bad', 'tenant_acme');
  assert.equal(badJson.ok, false);

  const rootArray = parseFormSchemaJson('[]', 'tenant_acme');
  assert.equal(rootArray.ok, false);

  const emptyMeta = parseFormSchemaJson(
    '{"id":"","title":"   ","fields":[]}',
    'tenant_acme',
  );
  assert.equal(emptyMeta.ok, false);

  const unknownType = parseFormSchemaJson(
    JSON.stringify({
      id: 'f_1',
      title: 'Test Form',
      fields: [{ id: 'x', type: 'color', label: 'Color', required: false }],
    }),
    'tenant_acme',
  );
  assert.equal(unknownType.ok, false);

  const validImport = parseFormSchemaJson(
    JSON.stringify({
      id: 'form_imported_1',
      title: 'Imported Intake',
      fields: [
        { id: 'grid_1', type: 'grid', label: 'Layout Grid', required: false },
        { id: 'txt_1', type: 'text', label: 'Name', required: true },
      ],
    }),
    'tenant_acme',
  );
  assert.equal(validImport.ok, true);
  if (validImport.ok) {
    assert.equal(validImport.schema.clientId, 'tenant_acme');
    assert.equal(validImport.schema.isPublished, true);
    assert.equal(validImport.schema.submitButtonText, 'Submit');
    const importedGrid = validImport.schema.fields[0];
    assert.equal(importedGrid?.type, 'grid');
    if (importedGrid?.type === 'grid') {
      assert.equal(importedGrid.columns, 2);
    }
    assert.equal(validImport.schema.fields[1]?.type, 'text');
  }
});

test('TC-06: Admin DTO validation rejects invalid tenant & user creation payloads with fieldErrors', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });
  const cookie = await loginAs(app, 'superadmin', 'admin123');

  const badTenant = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    headers: { cookie },
    payload: { name: 'A', email: 'bad@localhost', adminUsername: 'ab' },
  });
  assert.equal(badTenant.statusCode, 400);
  const badTenantBody = badTenant.json<{ fieldErrors?: Record<string, string> }>();
  assert.ok(badTenantBody.fieldErrors?.name);
  assert.ok(badTenantBody.fieldErrors?.email);
  assert.ok(badTenantBody.fieldErrors?.adminUsername);

  const badUser = await app.inject({
    method: 'POST',
    url: '/api/admin/users',
    headers: { cookie },
    payload: {
      clientId: 'tenant_acme',
      username: 'valid_user',
      displayName: 'Valid User',
      password: 'short7',
      role: 'superadmin',
    },
  });
  assert.equal(badUser.statusCode, 400);
  const badUserBody = badUser.json<{ fieldErrors?: Record<string, string> }>();
  assert.ok(badUserBody.fieldErrors?.password);
  assert.ok(badUserBody.fieldErrors?.role);

  await app.close();
});

test('TC-07: Domain AST operations clamp grid columns, deep-clone grids/sections, and preserve section 1', () => {
  const baseSchema: FormSchema = {
    id: 'form_ast',
    clientId: 'tenant_acme',
    slug: 'ast-test',
    title: 'AST Test',
    fields: [
      { id: 'sec_1', type: 'section', label: 'Section 1', required: false },
      { id: 'grid_1', type: 'grid', label: 'Grid 1', required: false, columns: 3 },
      {
        id: 'txt_child',
        type: 'text',
        label: 'Child Field',
        required: false,
        parentGridId: 'grid_1',
        gridColumn: 2,
      },
      { id: 'sec_2', type: 'section', label: 'Section 2', required: false },
    ],
    updatedAt: '2026-11-19T00:00:00.000Z',
  };

  // Shrink grid from 3 columns to 1 column -> child gridColumn clamps from 2 to 0
  const shrunk = updateField(baseSchema, 'grid_1', (cur) =>
    cur.type === 'grid' ? { ...cur, columns: 1 } : cur,
  );
  assert.equal(baseSchema.fields[2]?.gridColumn, 2); // original untouched
  assert.equal(shrunk.fields[2]?.gridColumn, 0);

  // Move non-grid field into grid_1 column 1 and back out
  const withStandalone = addField(shrunk, {
    id: 'txt_solo',
    type: 'text',
    label: 'Solo',
    required: false,
  });
  const movedIntoGrid = moveFieldToGrid(withStandalone, 'txt_solo', 'grid_1', 1);
  const movedField = movedIntoGrid.fields.find((f) => f.id === 'txt_solo');
  assert.equal(movedField?.parentGridId, 'grid_1');
  assert.equal(movedField?.gridColumn, 1);

  // Duplicate grid deeply clones children with distinct IDs
  const dupedGrid = duplicateField(baseSchema, 'grid_1', 'grid_1_copy');
  const clonedChildren = dupedGrid.fields.filter(
    (f) => f.parentGridId === 'grid_1_copy',
  );
  assert.equal(clonedChildren.length, 1);
  assert.notEqual(clonedChildren[0]?.id, 'txt_child');

  // Remove section 1 promotes section 2 to index 0 and retains section 1 children
  const afterRemoveFirst = removeSection(baseSchema, 'sec_1');
  assert.equal(afterRemoveFirst.fields[0]?.id, 'sec_2');
  assert.ok(afterRemoveFirst.fields.some((f) => f.id === 'grid_1'));
});

test('TC-08: Tenant forms CRUD generates unique slugs and starter fields', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });
  const cookie = await loginAs(app, 'acme_admin', 'acme1234', 'acme-corp');

  const create1 = await app.inject({
    method: 'POST',
    url: '/api/tenants/tenant_acme/forms',
    headers: { cookie },
    payload: { title: 'Employee Intake' },
  });
  assert.equal(create1.statusCode, 201);
  const form1 = create1.json<{ form: FormSchema }>().form;
  assert.equal(form1.slug, 'employee-intake');
  assert.equal(form1.fields[0]?.type, 'section');
  assert.equal(form1.fields[1]?.type, 'text');

  const create2 = await app.inject({
    method: 'POST',
    url: '/api/tenants/tenant_acme/forms',
    headers: { cookie },
    payload: { title: 'Employee Intake' },
  });
  assert.equal(create2.statusCode, 201);
  assert.equal(create2.json<{ form: FormSchema }>().form.slug, 'employee-intake-2');

  const getRes = await app.inject({
    method: 'GET',
    url: `/api/tenants/tenant_acme/forms/${form1.id}`,
    headers: { cookie },
  });
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.json<{ form: FormSchema }>().form.id, form1.id);

  const patchRes = await app.inject({
    method: 'PATCH',
    url: `/api/tenants/tenant_acme/forms/${form1.id}`,
    headers: { cookie },
    payload: { title: 'Employee Intake v2', isPublished: false },
  });
  assert.equal(patchRes.statusCode, 200);
  const patched = patchRes.json<{ form: FormSchema }>().form;
  assert.equal(patched.title, 'Employee Intake v2');
  assert.equal(patched.isPublished, false);

  await app.close();
});

test('TC-09: Workspace submissions validate payloads, create records, and delete single or all form submissions', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });
  const cookie = await loginAs(app, 'acme_admin', 'acme1234', 'acme-corp');

  const badType = await app.inject({
    method: 'POST',
    url: '/api/tenants/tenant_acme/forms/form_onboarding_01/submissions',
    headers: { cookie },
    payload: { values: ['bad'] },
  });
  assert.equal(badType.statusCode, 400);

  const missingReq = await app.inject({
    method: 'POST',
    url: '/api/tenants/tenant_acme/forms/form_onboarding_01/submissions',
    headers: { cookie },
    payload: { values: {} },
  });
  assert.equal(missingReq.statusCode, 422);
  const errBody = missingReq.json<{ fieldErrors?: Record<string, string> }>();
  assert.ok(errBody.fieldErrors?.field_name_member);
  assert.ok(errBody.fieldErrors?.field_email_primary);

  const validPost = await app.inject({
    method: 'POST',
    url: '/api/tenants/tenant_acme/forms/form_onboarding_01/submissions',
    headers: { cookie },
    payload: {
      values: {
        field_name_member: { firstName: 'Dana', lastName: "O'Neil" },
        field_email_primary: 'dana@acme.com',
        field_email_owner: 'owner@acme.com',
      },
    },
  });
  assert.equal(validPost.statusCode, 201);
  const createdId = validPost.json<{ submission: { id: string } }>().submission.id;

  const delOne = await app.inject({
    method: 'DELETE',
    url: `/api/tenants/tenant_acme/submissions/${createdId}`,
    headers: { cookie },
  });
  assert.equal(delOne.statusCode, 200);

  const delAgain = await app.inject({
    method: 'DELETE',
    url: `/api/tenants/tenant_acme/submissions/${createdId}`,
    headers: { cookie },
  });
  assert.equal(delAgain.statusCode, 404);

  const clearAll = await app.inject({
    method: 'DELETE',
    url: '/api/tenants/tenant_acme/forms/form_onboarding_01/submissions',
    headers: { cookie },
  });
  assert.equal(clearAll.statusCode, 200);
  const cleared = clearAll.json<{ clearedCount: number }>();
  assert.ok(cleared.clearedCount >= 2);

  await app.close();
});

test('TC-10: Tenant provisioning rolls back tenant and user when welcome email fails', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);

  const failingMailer: EmailService = {
    async sendTenantWelcomeEmail() {
      throw new Error('SMTP connection timed out');
    },
  };

  const app = await buildServer({
    store,
    logger: false,
    emailService: failingMailer,
  });
  const cookie = await loginAs(app, 'superadmin', 'admin123');

  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    headers: { cookie },
    payload: {
      name: 'Rollback Corp',
      email: 'owner@rollback.test',
      adminUsername: 'rollback_admin',
    },
  });
  assert.equal(res.statusCode, 502);
  assert.equal(await store.findClientBySlug('rollback-corp'), null);
  assert.equal(await store.findUserByUsername('rollback_admin'), null);

  await app.close();
});

test('TC-11: Unauthenticated requests and invalid portal logins fail closed with 401', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });

  for (const url of [
    '/api/auth/me',
    '/api/admin/tenants',
    '/api/tenants/tenant_acme/forms',
  ]) {
    const res = await app.inject({ method: 'GET', url });
    assert.equal(res.statusCode, 401, `Expected 401 for ${url}`);
  }

  const wrongPw = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'wrong_password' },
  });
  assert.equal(wrongPw.statusCode, 401);

  const wrongTenant = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'acme_admin',
      password: 'acme1234',
      tenantSlug: 'globex-cloud',
    },
  });
  assert.equal(wrongTenant.statusCode, 401);

  await app.close();
});

test('TC-12: tenant_admin and tenant_member receive 403 on all superadmin endpoints', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });
  const superCookie = await loginAs(app, 'superadmin', 'admin123');

  const createMember = await app.inject({
    method: 'POST',
    url: '/api/admin/users',
    headers: { cookie: superCookie },
    payload: {
      clientId: 'tenant_acme',
      username: 'acme_member',
      displayName: 'Acme Member',
      password: 'member1234',
      role: 'tenant_member',
    },
  });
  assert.equal(createMember.statusCode, 201);

  const acmeAdminCookie = await loginAs(app, 'acme_admin', 'acme1234', 'acme-corp');
  const acmeMemberCookie = await loginAs(app, 'acme_member', 'member1234', 'acme-corp');

  const adminRoutes: Array<{ method: 'GET' | 'POST'; url: string; payload?: object }> = [
    { method: 'GET', url: '/api/admin/tenants' },
    {
      method: 'POST',
      url: '/api/admin/tenants',
      payload: { name: 'Rogue Tenant', email: 'rogue@example.com' },
    },
    { method: 'GET', url: '/api/admin/users' },
    { method: 'GET', url: '/api/admin/forms' },
    { method: 'GET', url: '/api/admin/submissions' },
  ];

  for (const cookie of [acmeAdminCookie, acmeMemberCookie]) {
    for (const route of adminRoutes) {
      const res = await app.inject({
        method: route.method,
        url: route.url,
        headers: { cookie },
        payload: route.payload,
      });
      assert.equal(res.statusCode, 403, `Expected 403 on ${route.method} ${route.url}`);
    }
  }

  await app.close();
});

test('TC-13: Cross-tenant horizontal IDOR attempts fail with 403 or 404 without mutating Globex data', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });
  const acmeCookie = await loginAs(app, 'acme_admin', 'acme1234', 'acme-corp');

  const crossGet = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_globex/forms/form_globex_feedback',
    headers: { cookie: acmeCookie },
  });
  assert.equal(crossGet.statusCode, 403);

  const crossPatch = await app.inject({
    method: 'PATCH',
    url: '/api/tenants/tenant_globex/forms/form_globex_feedback',
    headers: { cookie: acmeCookie },
    payload: { title: 'Hijacked Title' },
  });
  assert.equal(crossPatch.statusCode, 403);

  const crossDeleteForm = await app.inject({
    method: 'DELETE',
    url: '/api/tenants/tenant_globex/forms/form_globex_feedback',
    headers: { cookie: acmeCookie },
  });
  assert.equal(crossDeleteForm.statusCode, 403);

  const crossSubIdInOwnTenant = await app.inject({
    method: 'DELETE',
    url: '/api/tenants/tenant_acme/submissions/sub_globex_001',
    headers: { cookie: acmeCookie },
  });
  assert.equal(crossSubIdInOwnTenant.statusCode, 404);

  const globexForm = await store.findFormById('form_globex_feedback', 'tenant_globex');
  assert.equal(globexForm?.title, 'Globex Enterprise Trial Intake');
  const globexSubs = await store.listSubmissions({
    clientId: 'tenant_globex',
    limit: 50,
    offset: 0,
  });
  assert.equal(globexSubs.total, 1);

  await app.close();
});

test('TC-14: Self-delete, superadmin modification/delete lock, and last-tenant guard', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  await store.createUser({
    id: 'user_superadmin_2',
    clientId: null,
    username: 'superadmin_2',
    displayName: 'Second Superadmin',
    passwordHash: 'unused_hash',
    role: 'superadmin',
    isActive: true,
    nowIso: new Date().toISOString(),
  });

  const app = await buildServer({ store, logger: false });
  const cookie = await loginAs(app, 'superadmin', 'admin123');

  const selfDel = await app.inject({
    method: 'DELETE',
    url: '/api/admin/users/user_superadmin',
    headers: { cookie },
  });
  assert.equal(selfDel.statusCode, 400);

  const patchSuper = await app.inject({
    method: 'PATCH',
    url: '/api/admin/users/user_superadmin',
    headers: { cookie },
    payload: { displayName: 'Hacked' },
  });
  assert.equal(patchSuper.statusCode, 403);

  const resetSuper = await app.inject({
    method: 'POST',
    url: '/api/admin/users/user_superadmin/reset-credentials',
    headers: { cookie },
    payload: {},
  });
  assert.equal(resetSuper.statusCode, 403);

  const delOtherSuper = await app.inject({
    method: 'DELETE',
    url: '/api/admin/users/user_superadmin_2',
    headers: { cookie },
  });
  assert.equal(delOtherSuper.statusCode, 403);

  const delGlobex = await app.inject({
    method: 'DELETE',
    url: '/api/admin/tenants/tenant_globex',
    headers: { cookie },
  });
  assert.equal(delGlobex.statusCode, 200);

  const delLastTenant = await app.inject({
    method: 'DELETE',
    url: '/api/admin/tenants/tenant_acme',
    headers: { cookie },
  });
  assert.equal(delLastTenant.statusCode, 400);
  assert.equal(
    delLastTenant.json<{ error: string }>().error,
    'Cannot delete the last remaining tenant.',
  );

  await app.close();
});

test('TC-15: Expired session, suspended tenant, and deactivated user fail /api/auth/me with 401', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });

  // Expired session token
  const expiredRawToken = 'expired_token_value';
  await store.createSession({
    id: hashSessionToken(expiredRawToken),
    userId: 'user_acme_admin',
    clientId: 'tenant_acme',
    expiresAt: '2020-01-01T00:00:00.000Z',
    revokedAt: null,
    createdAt: '2019-12-25T00:00:00.000Z',
  });
  const expiredMe = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: `${SESSION_COOKIE_NAME}=${expiredRawToken}` },
  });
  assert.equal(expiredMe.statusCode, 401);

  // Suspend Globex -> active session becomes 401
  const superCookie = await loginAs(app, 'superadmin', 'admin123');
  const globexCookie = await loginAs(app, 'globex_admin', 'globex1234', 'globex-cloud');
  const suspendRes = await app.inject({
    method: 'PATCH',
    url: '/api/admin/tenants/tenant_globex',
    headers: { cookie: superCookie },
    payload: { status: 'suspended' },
  });
  assert.equal(suspendRes.statusCode, 200);

  const globexAfterSuspend = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: globexCookie },
  });
  assert.equal(globexAfterSuspend.statusCode, 401);

  // Deactivate Acme user -> active session becomes 401
  const acmeCookie = await loginAs(app, 'acme_admin', 'acme1234', 'acme-corp');
  const deactivateRes = await app.inject({
    method: 'PATCH',
    url: '/api/admin/users/user_acme_admin',
    headers: { cookie: superCookie },
    payload: { isActive: false },
  });
  assert.equal(deactivateRes.statusCode, 200);

  const acmeAfterDeactivate = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: acmeCookie },
  });
  assert.equal(acmeAfterDeactivate.statusCode, 401);

  await app.close();
});

test('TC-16: Deleting last tenant form provisions replacement form; deleting tenant cascades all child records', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });
  const superCookie = await loginAs(app, 'superadmin', 'admin123');
  const globexCookie = await loginAs(app, 'globex_admin', 'globex1234', 'globex-cloud');

  const delLastForm = await app.inject({
    method: 'DELETE',
    url: '/api/tenants/tenant_globex/forms/form_globex_feedback',
    headers: { cookie: globexCookie },
  });
  assert.equal(delLastForm.statusCode, 200);
  const delBody = delLastForm.json<{ deleted: boolean; replacementForm?: FormSchema }>();
  assert.equal(delBody.deleted, true);
  assert.ok(delBody.replacementForm);
  assert.equal(delBody.replacementForm.title, 'Untitled Form');
  assert.equal(
    (await store.listForms({ clientId: 'tenant_globex' })).length,
    1,
  );
  assert.equal(
    (await store.listSubmissions({ clientId: 'tenant_globex', limit: 10, offset: 0 })).total,
    0,
  );

  const delTenant = await app.inject({
    method: 'DELETE',
    url: '/api/admin/tenants/tenant_acme',
    headers: { cookie: superCookie },
  });
  assert.equal(delTenant.statusCode, 200);
  assert.equal((await store.listUsers('tenant_acme')).length, 0);
  assert.equal((await store.listForms({ clientId: 'tenant_acme' })).length, 0);
  assert.equal(
    (await store.listSubmissions({ clientId: 'tenant_acme', limit: 10, offset: 0 })).total,
    0,
  );

  await app.close();
});

test('TC-17: SPA router round-trips all 9 WorkspaceModes and public routes with encoded params', () => {
  for (const mode of WORKSPACE_MODES) {
    const built = buildWorkspacePath(mode, 'form_id with space/1');
    const parsed = parseAppRoute(built);
    assert.equal(parsed.kind, 'workspace');
    if (parsed.kind === 'workspace') {
      assert.equal(parsed.mode, mode);
    }
  }

  const tenantLogin = parseAppRoute('/t/acme%20corp/login');
  assert.deepEqual(tenantLogin, {
    kind: 'tenant_login',
    tenantSlug: 'acme corp',
  });

  const publicForm = parseAppRoute('/f/acme-corp/intake%20form');
  assert.deepEqual(publicForm, {
    kind: 'public_form',
    tenantSlug: 'acme-corp',
    formSlug: 'intake form',
  });
});

test('TC-18: Concurrent form creation preserves unique slugs and seedDatabase is idempotent', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });
  const acmeCookie = await loginAs(app, 'acme_admin', 'acme1234', 'acme-corp');

  const [resA, resB] = await Promise.all([
    app.inject({
      method: 'POST',
      url: '/api/tenants/tenant_acme/forms',
      headers: { cookie: acmeCookie },
      payload: { title: 'Parallel Form' },
    }),
    app.inject({
      method: 'POST',
      url: '/api/tenants/tenant_acme/forms',
      headers: { cookie: acmeCookie },
      payload: { title: 'Parallel Form' },
    }),
  ]);
  assert.equal(resA.statusCode, 201);
  assert.equal(resB.statusCode, 201);
  const slugs = new Set([
    resA.json<{ form: FormSchema }>().form.slug,
    resB.json<{ form: FormSchema }>().form.slug,
  ]);
  assert.equal(slugs.size, 2);

  await seedDatabase(store);
  await seedDatabase(store);
  const allUsers = await store.listUsers();
  const superadmins = allUsers.filter((u) => u.role === 'superadmin');
  assert.equal(superadmins.length, 1);

  await app.close();
});

test('TC-20: FIELD_REGISTRY registers all 15 FIELD_TYPES statically with zero suppression hacks', () => {
  assert.equal(FIELD_TYPES.length, 15);
  const registryPath = path.resolve(
    process.cwd(),
    'src/fields/registry.ts',
  );
  const registrySource = fs.readFileSync(registryPath, 'utf8');
  for (const fieldType of FIELD_TYPES) {
    assert.match(
      registrySource,
      new RegExp(`\\b${fieldType}\\s*:`),
      `Missing FIELD_REGISTRY entry for ${fieldType}`,
    );
  }
});

test('TC-21: Search escapes SQL LIKE wildcards, clamps limit/offset, and handles unmatched queries cleanly', async () => {
  assert.equal(escapeLikePattern('%_test\\'), '\\%\\_test\\\\');

  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });
  const superCookie = await loginAs(app, 'superadmin', 'admin123');

  const formsSearch = await app.inject({
    method: 'GET',
    url: '/api/admin/forms?search=%25_test%5C',
    headers: { cookie: superCookie },
  });
  assert.equal(formsSearch.statusCode, 200);
  assert.deepEqual(formsSearch.json<{ forms: FormSchema[] }>().forms, []);

  const subsSearch = await app.inject({
    method: 'GET',
    url: '/api/admin/submissions?search=%25_test%5C&limit=9999&offset=-5',
    headers: { cookie: superCookie },
  });
  assert.equal(subsSearch.statusCode, 200);
  const subsBody = subsSearch.json<{
    items: unknown[];
    total: number;
    limit: number;
    offset: number;
  }>();
  assert.deepEqual(subsBody.items, []);
  assert.equal(subsBody.total, 0);
  assert.equal(subsBody.limit, 500);
  assert.equal(subsBody.offset, 0);

  await app.close();
});

test('TC-22: Public form endpoints enforce published state and active tenant status', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });
  const superCookie = await loginAs(app, 'superadmin', 'admin123');
  const globexCookie = await loginAs(app, 'globex_admin', 'globex1234', 'globex-cloud');

  const existing = await store.findFormById('form_globex_feedback', 'tenant_globex');
  assert.ok(existing);
  const drafted = markFormAsDraft(existing);
  assert.equal(drafted.isPublished, false);

  const patchDraft = await app.inject({
    method: 'PATCH',
    url: '/api/tenants/tenant_globex/forms/form_globex_feedback',
    headers: { cookie: globexCookie },
    payload: { isPublished: false },
  });
  assert.equal(patchDraft.statusCode, 200);

  const getDraftPublic = await app.inject({
    method: 'GET',
    url: '/api/public/forms/globex-cloud/enterprise-trial-intake',
  });
  assert.equal(getDraftPublic.statusCode, 404);

  const postDraftPublic = await app.inject({
    method: 'POST',
    url: '/api/public/forms/globex-cloud/enterprise-trial-intake/submissions',
    payload: {
      values: {
        field_text_org: 'Acme',
        field_email_admin: 'admin@acme.com',
        field_select_region: 'us-east-1',
        field_num_nodes: 3,
      },
    },
  });
  assert.equal(postDraftPublic.statusCode, 404);

  const republished = publishFormSchema(drafted);
  assert.equal(republished.isPublished, true);
  await app.inject({
    method: 'PATCH',
    url: '/api/tenants/tenant_globex/forms/form_globex_feedback',
    headers: { cookie: globexCookie },
    payload: { isPublished: true },
  });

  // Suspend tenant -> public route returns 404
  await app.inject({
    method: 'PATCH',
    url: '/api/admin/tenants/tenant_globex',
    headers: { cookie: superCookie },
    payload: { status: 'suspended' },
  });
  const getSuspendedPublic = await app.inject({
    method: 'GET',
    url: '/api/public/forms/globex-cloud/enterprise-trial-intake',
  });
  assert.equal(getSuspendedPublic.statusCode, 404);

  // Reactivate tenant -> public route succeeds
  await app.inject({
    method: 'PATCH',
    url: '/api/admin/tenants/tenant_globex',
    headers: { cookie: superCookie },
    payload: { status: 'active' },
  });
  const getActivePublic = await app.inject({
    method: 'GET',
    url: '/api/public/forms/globex-cloud/enterprise-trial-intake',
  });
  assert.equal(getActivePublic.statusCode, 200);

  await app.close();
});

test('TC-23: Date field enforces inclusive minDate and maxDate boundaries', () => {
  const dateField: DateFieldConfig = {
    id: 'f_bounds',
    type: 'date',
    label: 'Event Date',
    required: true,
    minDate: '2026-03-10',
    maxDate: '2026-03-20',
  };
  assert.equal(
    validateField(dateField, '2026-03-09'),
    'Event Date cannot be earlier than 2026-03-10.',
  );
  assert.equal(validateField(dateField, '2026-03-10'), null);
  assert.equal(validateField(dateField, '2026-03-20'), null);
  assert.equal(
    validateField(dateField, '2026-03-21'),
    'Event Date cannot be later than 2026-03-20.',
  );
});

test('TC-24: Reset-credentials handles skipped email, successful email dispatch, and 502 mailer failure', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  let sentCount = 0;
  let shouldFail = false;

  const mockMailer: EmailService = {
    async sendTenantWelcomeEmail() {
      if (shouldFail) {
        throw new Error('Resend API 503');
      }
      sentCount += 1;
      return {
        status: 'sent',
        provider: 'resend',
        messageId: 'msg_test_1',
      };
    },
  };

  const app = await buildServer({
    store,
    logger: false,
    emailService: mockMailer,
  });
  const superCookie = await loginAs(app, 'superadmin', 'admin123');

  const noEmail = await app.inject({
    method: 'POST',
    url: '/api/admin/users/user_acme_admin/reset-credentials',
    headers: { cookie: superCookie },
    payload: {},
  });
  assert.equal(noEmail.statusCode, 200);
  const noEmailBody = noEmail.json<{
    generatedPassword?: string;
    emailDelivery?: unknown;
  }>();
  assert.ok(noEmailBody.generatedPassword);
  assert.equal(noEmailBody.emailDelivery, undefined);
  assert.equal(sentCount, 0);

  const withEmail = await app.inject({
    method: 'POST',
    url: '/api/admin/users/user_acme_admin/reset-credentials',
    headers: { cookie: superCookie },
    payload: { email: 'user@example.com' },
  });
  assert.equal(withEmail.statusCode, 200);
  const withEmailBody = withEmail.json<{
    emailDelivery?: { status: string; provider: string; messageId?: string };
  }>();
  assert.equal(withEmailBody.emailDelivery?.status, 'sent');
  assert.equal(withEmailBody.emailDelivery?.provider, 'resend');
  assert.equal(sentCount, 1);

  shouldFail = true;
  const failedEmail = await app.inject({
    method: 'POST',
    url: '/api/admin/users/user_acme_admin/reset-credentials',
    headers: { cookie: superCookie },
    payload: { email: 'user@example.com' },
  });
  assert.equal(failedEmail.statusCode, 502);

  await app.close();
});

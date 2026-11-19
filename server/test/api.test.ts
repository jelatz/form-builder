import assert from 'node:assert/strict';
import test from 'node:test';
import { toSnakeCaseUsername } from '../../src/shared/lib/username.ts';
import { buildServer } from '../app.ts';
import { seedDatabase } from '../db/seed.ts';
import { seedTestDatabase } from './fixtures.ts';
import {
  createResendEmailService,
  type EmailService,
  type TenantWelcomeEmailPayload,
} from '../lib/email.ts';
import { SESSION_COOKIE_NAME } from '../middleware/auth.ts';
import { InMemoryAppStore } from './in-memory-store.ts';

function extractCookieHeader(
  res: { cookies: Array<{ name: string; value: string }> },
): string {
  const sessionCookie = res.cookies.find(
    (c) => c.name === SESSION_COOKIE_NAME && c.value.length > 0,
  );
  assert.ok(sessionCookie, `Expected ${SESSION_COOKIE_NAME} cookie to be set`);
  return `${sessionCookie.name}=${sessionCookie.value}`;
}

test('health check reports ok', async () => {
  const store = new InMemoryAppStore();
  const app = await buildServer({ store, logger: false });
  const res = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(res.statusCode, 200);
  const body = res.json<{ ok: boolean }>();
  assert.equal(body.ok, true);
  await app.close();
});

test('auth: superadmin login sets HttpOnly cookie, portal login validates tenantSlug, logout revokes session', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });

  // Superadmin global login
  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'superadmin', password: 'admin123' },
  });
  assert.equal(adminLogin.statusCode, 200);
  const sessionCookieMeta = adminLogin.cookies.find(
    (c) => c.name === SESSION_COOKIE_NAME,
  );
  assert.ok(sessionCookieMeta);
  assert.equal(sessionCookieMeta.httpOnly, true);
  assert.equal(sessionCookieMeta.sameSite, 'Lax');
  const adminCookie = extractCookieHeader(adminLogin);

  const meRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: adminCookie },
  });
  assert.equal(meRes.statusCode, 200);
  assert.equal(meRes.json<{ user: { role: string } }>().user.role, 'superadmin');

  // Tenant portal login for matching tenant succeeds
  const acmePortalOk = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'acme_admin',
      password: 'acme1234',
      tenantSlug: 'acme-corp',
    },
  });
  assert.equal(acmePortalOk.statusCode, 200);

  // Tenant portal login on wrong tenant fails with 401
  const acmeWrongPortal = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'acme_admin',
      password: 'acme1234',
      tenantSlug: 'globex-cloud',
    },
  });
  assert.equal(acmeWrongPortal.statusCode, 401);

  // Logout revokes session
  const logoutRes = await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers: { cookie: adminCookie },
  });
  assert.equal(logoutRes.statusCode, 200);

  const meAfterLogout = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: adminCookie },
  });
  assert.equal(meAfterLogout.statusCode, 401);

  await app.close();
});

test('RBAC & tenant isolation: tenant user is blocked from /api/admin/* and other tenants, but can manage own forms', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });

  // Unauthenticated blocked
  const anonAdmin = await app.inject({
    method: 'GET',
    url: '/api/admin/tenants',
  });
  assert.equal(anonAdmin.statusCode, 401);

  const anonForms = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_acme/forms',
  });
  assert.equal(anonForms.statusCode, 401);

  // Login as acme_admin
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'acme1234' },
  });
  assert.equal(loginRes.statusCode, 200);
  const acmeCookie = extractCookieHeader(loginRes);

  // Blocked from superadmin routes
  for (const url of [
    '/api/admin/tenants',
    '/api/admin/users',
    '/api/admin/forms',
    '/api/admin/submissions',
  ]) {
    const res = await app.inject({
      method: 'GET',
      url,
      headers: { cookie: acmeCookie },
    });
    assert.equal(res.statusCode, 403, `Expected 403 on ${url}`);
  }

  // Blocked from Globex tenant data
  const globexForms = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_globex/forms',
    headers: { cookie: acmeCookie },
  });
  assert.equal(globexForms.statusCode, 403);

  const globexSubs = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_globex/submissions',
    headers: { cookie: acmeCookie },
  });
  assert.equal(globexSubs.statusCode, 403);

  // Allowed to list and create own Acme forms
  const acmeForms = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_acme/forms',
    headers: { cookie: acmeCookie },
  });
  assert.equal(acmeForms.statusCode, 200);
  assert.ok(
    acmeForms.json<{ forms: Array<{ clientId: string }> }>().forms.every(
      (f) => f.clientId === 'tenant_acme',
    ),
  );

  const createRes = await app.inject({
    method: 'POST',
    url: '/api/tenants/tenant_acme/forms',
    headers: { cookie: acmeCookie },
    payload: {
      title: 'Acme Security Intake',
      description: 'Tenant-created intake',
      isPublished: true,
      fields: [
        {
          id: 'f_subject',
          type: 'text',
          label: 'Subject',
          required: true,
        },
      ],
    },
  });
  assert.equal(createRes.statusCode, 201);
  const createdForm = createRes.json<{ form: { id: string; slug: string } }>()
    .form;
  assert.equal(createdForm.slug, 'acme-security-intake');

  await app.close();
});

test('superadmin provisioning: create tenant & login user, disable revokes active sessions, password reset works', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });

  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'superadmin', password: 'admin123' },
  });
  const adminCookie = extractCookieHeader(adminLogin);

  // Create tenant
  const tenantRes = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    headers: { cookie: adminCookie },
    payload: {
      name: 'Initech LLC',
      slug: 'initech-llc',
      email: 'ops@initech.example',
    },
  });
  assert.equal(tenantRes.statusCode, 201);
  const { tenant, adminUser } = tenantRes.json<{
    tenant: { id: string; slug: string };
    adminUser: { username: string; role: string };
  }>();
  assert.equal(tenant.slug, 'initech-llc');
  assert.equal(adminUser.username, 'initech_llc');
  assert.equal(adminUser.role, 'tenant_admin');

  // Provision user
  const userRes = await app.inject({
    method: 'POST',
    url: '/api/admin/users',
    headers: { cookie: adminCookie },
    payload: {
      clientId: tenant.id,
      username: 'initech_owner',
      displayName: 'Peter Gibbons',
      password: 'tpsreport99',
      role: 'tenant_admin',
    },
  });
  assert.equal(userRes.statusCode, 201);
  const createdUser = userRes.json<{ user: { id: string; username: string } }>()
    .user;

  // Provisioned user signs in
  const userLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'initech_owner',
      password: 'tpsreport99',
      tenantSlug: 'initech-llc',
    },
  });
  assert.equal(userLogin.statusCode, 200);
  const userCookie = extractCookieHeader(userLogin);

  // Superadmin disables user -> existing session immediately invalid
  const disableRes = await app.inject({
    method: 'PATCH',
    url: `/api/admin/users/${createdUser.id}`,
    headers: { cookie: adminCookie },
    payload: { isActive: false },
  });
  assert.equal(disableRes.statusCode, 200);

  const meAfterDisable = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: userCookie },
  });
  assert.equal(meAfterDisable.statusCode, 401);

  // Superadmin re-enables and resets password
  const resetRes = await app.inject({
    method: 'PATCH',
    url: `/api/admin/users/${createdUser.id}`,
    headers: { cookie: adminCookie },
    payload: { isActive: true, password: 'newpassword2026' },
  });
  assert.equal(resetRes.statusCode, 200);

  const reloginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'initech_owner', password: 'newpassword2026' },
  });
  assert.equal(reloginRes.statusCode, 200);

  // Delete tenant cascades users/forms
  const deleteTenantRes = await app.inject({
    method: 'DELETE',
    url: `/api/admin/tenants/${tenant.id}`,
    headers: { cookie: adminCookie },
  });
  assert.equal(deleteTenantRes.statusCode, 200);

  await app.close();
});

test('public form links: validates submissions server-side (422 vs 201), honors isPublished, and scopes submissions to tenant', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });

  // Tenant metadata lookup for tenant login portal
  const publicTenantRes = await app.inject({
    method: 'GET',
    url: '/api/public/tenants/acme-corp',
  });
  assert.equal(publicTenantRes.statusCode, 200);
  assert.equal(
    publicTenantRes.json<{ name: string }>().name,
    'Acme Corp',
  );

  // Fetch published seeded form
  const publicFormRes = await app.inject({
    method: 'GET',
    url: '/api/public/forms/acme-corp/member-onboarding-form',
  });
  assert.equal(publicFormRes.statusCode, 200);

  // Invalid submission missing required fields fails with 422 + fieldErrors
  const badSubmitRes = await app.inject({
    method: 'POST',
    url: '/api/public/forms/acme-corp/member-onboarding-form/submissions',
    payload: { values: {} },
  });
  assert.equal(badSubmitRes.statusCode, 422);
  const badBody = badSubmitRes.json<{
    error: string;
    fieldErrors: Record<string, string>;
  }>();
  assert.ok(badBody.fieldErrors.field_email_primary);

  // Valid submission succeeds with 201
  const goodSubmitRes = await app.inject({
    method: 'POST',
    url: '/api/public/forms/acme-corp/member-onboarding-form/submissions',
    payload: {
      values: {
        field_name_member: { firstName: 'Jane', lastName: 'Doe' },
        field_email_primary: 'jane.doe@example.com',
        field_email_owner: 'owner@example.com',
      },
    },
  });
  assert.equal(goodSubmitRes.statusCode, 201);
  const createdSubId = goodSubmitRes.json<{
    submission: { id: string };
  }>().submission.id;

  // Visible to acme_admin
  const acmeLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'acme1234' },
  });
  const acmeCookie = extractCookieHeader(acmeLogin);

  const acmeSubs = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_acme/submissions',
    headers: { cookie: acmeCookie },
  });
  assert.equal(acmeSubs.statusCode, 200);
  assert.ok(
    acmeSubs
      .json<{ items: Array<{ id: string }> }>()
      .items.some((s) => s.id === createdSubId),
  );

  // Unpublishing form hides it from public runner
  const unpublishRes = await app.inject({
    method: 'PATCH',
    url: '/api/tenants/tenant_acme/forms/form_onboarding_01',
    headers: { cookie: acmeCookie },
    payload: { isPublished: false },
  });
  assert.equal(unpublishRes.statusCode, 200);

  const unpublishedPublicRes = await app.inject({
    method: 'GET',
    url: '/api/public/forms/acme-corp/member-onboarding-form',
  });
  assert.equal(unpublishedPublicRes.statusCode, 404);

  await app.close();
});

test('toSnakeCaseUsername normalizes organization names into value_one style usernames', () => {
  assert.equal(toSnakeCaseUsername('Value One'), 'value_one');
  assert.equal(toSnakeCaseUsername('Stark Industries'), 'stark_industries');
  assert.equal(toSnakeCaseUsername('ValueOne'), 'value_one');
  assert.equal(toSnakeCaseUsername('Acme & Co.'), 'acme_co');
  assert.equal(toSnakeCaseUsername('AI'), 'ai_admin');
  assert.equal(toSnakeCaseUsername('   '), 'tenant_admin');
  assert.ok(
    toSnakeCaseUsername('Very Long Organization Name That Exceeds Thirty Two Characters')
      .length <= 32,
  );
});

test('tenant creation provisions snake_case admin, generates 16-char hex password, emails it via Resend, and rolls back on failure', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);

  const sentEmails: TenantWelcomeEmailPayload[] = [];
  let shouldFailEmail = false;
  const spyEmailService: EmailService = {
    async sendTenantWelcomeEmail(payload) {
      if (shouldFailEmail) {
        throw new Error('Resend API error (500): upstream outage');
      }
      sentEmails.push(payload);
      return { status: 'sent', provider: 'resend', messageId: 're_test_123' };
    },
  };

  const app = await buildServer({
    store,
    logger: false,
    emailService: spyEmailService,
    appOrigin: 'https://forms.example.com',
  });

  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'superadmin', password: 'admin123' },
  });
  const adminCookie = extractCookieHeader(adminLogin);

  // Missing / invalid email is rejected with 400
  const invalidEmailRes = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    headers: { cookie: adminCookie },
    payload: { name: 'Value One', email: 'not-an-email' },
  });
  assert.equal(invalidEmailRes.statusCode, 400);
  assert.ok(
    invalidEmailRes.json<{ fieldErrors?: Record<string, string> }>()
      .fieldErrors?.email,
  );

  // Valid creation derives value_one, generates 16-char hex password, and emails it
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    headers: { cookie: adminCookie },
    payload: {
      name: 'Value One',
      slug: 'value-one',
      email: 'Owner@ValueOne.com',
    },
  });
  assert.equal(createRes.statusCode, 201);
  const createdBody = createRes.json<{
    tenant: { id: string; slug: string };
    starterForm?: unknown;
    adminUser: { id: string; username: string; role: string; password?: string; passwordHash?: string };
    emailDelivery: { status: string; provider: string; messageId?: string };
  }>();

  assert.equal(createdBody.tenant.slug, 'value-one');
  assert.equal(createdBody.starterForm, undefined);
  assert.equal((await store.listForms({ clientId: createdBody.tenant.id })).length, 0);
  assert.equal(createdBody.adminUser.username, 'value_one');
  assert.equal(createdBody.adminUser.role, 'tenant_admin');
  assert.equal(createdBody.adminUser.password, undefined);
  assert.equal(createdBody.adminUser.passwordHash, undefined);
  assert.equal(createdBody.emailDelivery.status, 'sent');
  assert.equal(createdBody.emailDelivery.provider, 'resend');

  assert.equal(sentEmails.length, 1);
  const delivered = sentEmails[0]!;
  assert.equal(delivered.to, 'owner@valueone.com');
  assert.equal(delivered.username, 'value_one');
  assert.equal(delivered.loginUrl, 'https://forms.example.com/t/value-one/login');
  assert.match(delivered.password, /^[0-9a-f]{16}$/);

  // Newly provisioned tenant_admin can log in with the emailed 16-char hex password
  const tenantAdminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: delivered.username,
      password: delivered.password,
      tenantSlug: 'value-one',
    },
  });
  assert.equal(tenantAdminLogin.statusCode, 200);

  // Second tenant with same org name suffixes username cleanly (value_one_2)
  const secondRes = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    headers: { cookie: adminCookie },
    payload: {
      name: 'Value One',
      email: 'second@valueone.com',
    },
  });
  assert.equal(secondRes.statusCode, 201);
  assert.equal(
    secondRes.json<{ adminUser: { username: string } }>().adminUser.username,
    'value_one_2',
  );

  // Rollback when email delivery fails
  shouldFailEmail = true;
  const tenantsBeforeFail = await store.listClients();
  const usersBeforeFail = await store.listUsers();
  const formsBeforeFail = await store.listForms();

  const failedRes = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    headers: { cookie: adminCookie },
    payload: {
      name: 'Rollback Org',
      slug: 'rollback-org',
      email: 'fail@rollback.example',
    },
  });
  assert.equal(failedRes.statusCode, 502);

  assert.equal((await store.listClients()).length, tenantsBeforeFail.length);
  assert.equal((await store.listUsers()).length, usersBeforeFail.length);
  assert.equal((await store.listForms()).length, formsBeforeFail.length);
  assert.equal(await store.findClientBySlug('rollback-org'), null);
  assert.equal(await store.findUserByUsername('rollback_org'), null);

  await app.close();
});

test('POST /api/admin/tenants validation & RBAC: rejects invalid payloads (400), duplicate adminUsername (409), unauthenticated (401), and tenant_admin (403) with zero persistence', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });

  const initialClients = (await store.listClients()).length;
  const initialUsers = (await store.listUsers()).length;
  const initialForms = (await store.listForms()).length;

  // SEC-01: Unauthenticated POST /api/admin/tenants returns 401
  const unauthRes = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    payload: { name: 'Unauth Org', email: 'unauth@example.com' },
  });
  assert.equal(unauthRes.statusCode, 401);

  // SEC-02: Authenticated tenant_admin POST /api/admin/tenants returns 403
  const acmeLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'acme1234' },
  });
  assert.equal(acmeLogin.statusCode, 200);
  const acmeCookie = extractCookieHeader(acmeLogin);

  const tenantAdminRes = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    headers: { cookie: acmeCookie },
    payload: { name: 'Blocked Org', email: 'blocked@example.com' },
  });
  assert.equal(tenantAdminRes.statusCode, 403);

  // Superadmin login for DTO & conflict checks
  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'superadmin', password: 'admin123' },
  });
  assert.equal(adminLogin.statusCode, 200);
  const adminCookie = extractCookieHeader(adminLogin);

  // INP-01: Short name ("A") -> 400 with fieldErrors.name
  const shortNameRes = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    headers: { cookie: adminCookie },
    payload: { name: 'A', email: 'valid@example.com' },
  });
  assert.equal(shortNameRes.statusCode, 400);
  assert.ok(
    shortNameRes.json<{ fieldErrors?: Record<string, string> }>().fieldErrors
      ?.name,
  );

  // INP-01: Invalid adminUsername ("ab") -> 400 with fieldErrors.adminUsername
  const invalidUsernameRes = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    headers: { cookie: adminCookie },
    payload: {
      name: 'Valid Org',
      email: 'valid@example.com',
      adminUsername: 'ab',
    },
  });
  assert.equal(invalidUsernameRes.statusCode, 400);
  assert.ok(
    invalidUsernameRes.json<{ fieldErrors?: Record<string, string> }>()
      .fieldErrors?.adminUsername,
  );

  // INP-01: Null / invalid payload -> 400
  const nullPayloadRes = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    payload: 'null',
  });
  assert.equal(nullPayloadRes.statusCode, 400);

  const missingPayloadRes = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    headers: { cookie: adminCookie },
  });
  assert.equal(missingPayloadRes.statusCode, 400);

  // INP-02: Duplicate explicit adminUsername -> 409
  const duplicateUsernameRes = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    headers: { cookie: adminCookie },
    payload: {
      name: 'Unique Org Name',
      email: 'unique@example.com',
      adminUsername: 'acme_admin',
    },
  });
  assert.equal(duplicateUsernameRes.statusCode, 409);

  // Zero persistence across all rejected requests
  assert.equal((await store.listClients()).length, initialClients);
  assert.equal((await store.listUsers()).length, initialUsers);
  assert.equal((await store.listForms()).length, initialForms);

  await app.close();
});

test('SEC-03 & DAT-01: newly provisioned tenant_admin lists empty own forms (200), is blocked from tenant_acme (403), and tenant deletion leaves zero orphan users/forms', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);

  const initialClients = (await store.listClients()).length;
  const initialUsers = (await store.listUsers()).length;
  const initialForms = (await store.listForms()).length;

  const sentEmails: TenantWelcomeEmailPayload[] = [];
  const spyEmailService: EmailService = {
    async sendTenantWelcomeEmail(payload) {
      sentEmails.push(payload);
      return { status: 'sent', provider: 'resend', messageId: 're_sec_dat_01' };
    },
  };

  const app = await buildServer({
    store,
    logger: false,
    emailService: spyEmailService,
    appOrigin: 'https://forms.example.com',
  });

  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'superadmin', password: 'admin123' },
  });
  assert.equal(adminLogin.statusCode, 200);
  const adminCookie = extractCookieHeader(adminLogin);

  const createRes = await app.inject({
    method: 'POST',
    url: '/api/admin/tenants',
    headers: { cookie: adminCookie },
    payload: {
      name: 'Stark Labs',
      slug: 'stark-labs',
      email: 'tony@stark.example',
    },
  });
  assert.equal(createRes.statusCode, 201);
  const { tenant, adminUser } = createRes.json<{
    tenant: { id: string; slug: string };
    adminUser: { id: string; clientId: string; username: string; role: string };
  }>();
  assert.equal(adminUser.clientId, tenant.id);
  assert.equal(sentEmails.length, 1);

  // Sign in as newly provisioned tenant_admin
  const tenantAdminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: sentEmails[0]!.username,
      password: sentEmails[0]!.password,
      tenantSlug: 'stark-labs',
    },
  });
  assert.equal(tenantAdminLogin.statusCode, 200);
  const tenantAdminCookie = extractCookieHeader(tenantAdminLogin);

  // SEC-03: Own tenant forms -> 200 with { forms: [] }
  const ownFormsRes = await app.inject({
    method: 'GET',
    url: `/api/tenants/${tenant.id}/forms`,
    headers: { cookie: tenantAdminCookie },
  });
  assert.equal(ownFormsRes.statusCode, 200);
  assert.deepEqual(ownFormsRes.json<{ forms: unknown[] }>(), { forms: [] });

  // SEC-03: Foreign tenant_acme forms -> 403
  const foreignFormsRes = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_acme/forms',
    headers: { cookie: tenantAdminCookie },
  });
  assert.equal(foreignFormsRes.statusCode, 403);

  // DAT-01: Delete tenant cleans up tenant and adminUser with zero orphan forms
  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/api/admin/tenants/${tenant.id}`,
    headers: { cookie: adminCookie },
  });
  assert.equal(deleteRes.statusCode, 200);
  assert.deepEqual(deleteRes.json<{ deleted: boolean }>(), { deleted: true });

  assert.equal(await store.findClientById(tenant.id), null);
  assert.equal(await store.findUserByUsername(adminUser.username), null);
  assert.equal((await store.listUsers(tenant.id)).length, 0);
  assert.equal((await store.listForms({ clientId: tenant.id })).length, 0);
  assert.equal((await store.listClients()).length, initialClients);
  assert.equal((await store.listUsers()).length, initialUsers);
  assert.equal((await store.listForms()).length, initialForms);

  await app.close();
});

test('createResendEmailService posts to Resend REST API with expected payload', async () => {
  let capturedUrl = '';
  let capturedAuth = '';
  let capturedBody: { from?: string; to?: string[]; subject?: string; text?: string } = {};

  const service = createResendEmailService({
    apiKey: 're_live_mock_key',
    from: 'FormBuilder <no-reply@example.com>',
    isProduction: true,
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      capturedAuth = headers.Authorization ?? '';
      capturedBody = JSON.parse(String(init?.body ?? '{}')) as typeof capturedBody;
      return new Response(JSON.stringify({ id: 'email_999' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const result = await service.sendTenantWelcomeEmail({
    to: 'admin@valueone.com',
    tenantName: 'Value One',
    tenantSlug: 'value-one',
    username: 'value_one',
    password: '0123456789abcdef',
    loginUrl: 'https://app.example.com/t/value-one/login',
  });

  assert.equal(result.status, 'sent');
  assert.equal(result.provider, 'resend');
  assert.equal(result.messageId, 'email_999');
  assert.equal(capturedUrl, 'https://api.resend.com/emails');
  assert.equal(capturedAuth, 'Bearer re_live_mock_key');
  assert.deepEqual(capturedBody.to, ['admin@valueone.com']);
  assert.ok(capturedBody.text?.includes('value_one'));
  assert.ok(capturedBody.text?.includes('0123456789abcdef'));
});

test('superadmin tenant update: validates slug, rejects conflicts with 409, and suspends active sessions', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });

  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'superadmin', password: 'admin123' },
  });
  const adminCookie = extractCookieHeader(adminLogin);

  const acmeLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'acme1234' },
  });
  assert.equal(acmeLogin.statusCode, 200);
  const acmeCookie = extractCookieHeader(acmeLogin);

  // Non-superadmin cannot modify tenants
  const forbiddenRes = await app.inject({
    method: 'PATCH',
    url: '/api/admin/tenants/tenant_acme',
    headers: { cookie: acmeCookie },
    payload: { name: 'Hacked' },
  });
  assert.equal(forbiddenRes.statusCode, 403);

  // Empty payload rejected with 400
  const emptyRes = await app.inject({
    method: 'PATCH',
    url: '/api/admin/tenants/tenant_acme',
    headers: { cookie: adminCookie },
    payload: {},
  });
  assert.equal(emptyRes.statusCode, 400);

  // Unslugifiable slug rejected with 400 + fieldErrors.slug
  const badSlugRes = await app.inject({
    method: 'PATCH',
    url: '/api/admin/tenants/tenant_acme',
    headers: { cookie: adminCookie },
    payload: { slug: '!!!' },
  });
  assert.equal(badSlugRes.statusCode, 400);
  assert.ok(
    badSlugRes.json<{ fieldErrors?: Record<string, string> }>().fieldErrors
      ?.slug,
  );

  // Conflicting slug rejected with 409 instead of silently suffixing
  const conflictRes = await app.inject({
    method: 'PATCH',
    url: '/api/admin/tenants/tenant_globex',
    headers: { cookie: adminCookie },
    payload: { slug: 'acme-corp' },
  });
  assert.equal(conflictRes.statusCode, 409);

  // Valid update changes name & slug and updates public routing
  const renameRes = await app.inject({
    method: 'PATCH',
    url: '/api/admin/tenants/tenant_globex',
    headers: { cookie: adminCookie },
    payload: { name: 'Globex Labs', slug: 'globex-labs' },
  });
  assert.equal(renameRes.statusCode, 200);
  const renamed = renameRes.json<{
    tenant: { id: string; name: string; slug: string; status: string };
  }>().tenant;
  assert.equal(renamed.name, 'Globex Labs');
  assert.equal(renamed.slug, 'globex-labs');
  assert.equal(renamed.status, 'active');

  const newSlugLookup = await app.inject({
    method: 'GET',
    url: '/api/public/tenants/globex-labs',
  });
  assert.equal(newSlugLookup.statusCode, 200);

  const oldSlugLookup = await app.inject({
    method: 'GET',
    url: '/api/public/tenants/globex-cloud',
  });
  assert.equal(oldSlugLookup.statusCode, 404);

  // Suspending tenant immediately invalidates existing session, blocks login, and hides public forms
  const suspendRes = await app.inject({
    method: 'PATCH',
    url: '/api/admin/tenants/tenant_acme',
    headers: { cookie: adminCookie },
    payload: { status: 'suspended' },
  });
  assert.equal(suspendRes.statusCode, 200);
  assert.equal(
    suspendRes.json<{ tenant: { status: string } }>().tenant.status,
    'suspended',
  );

  const meWhileSuspended = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: acmeCookie },
  });
  assert.equal(meWhileSuspended.statusCode, 401);

  const loginWhileSuspended = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'acme1234' },
  });
  assert.equal(loginWhileSuspended.statusCode, 403);

  const publicFormSuspended = await app.inject({
    method: 'GET',
    url: '/api/public/forms/acme-corp/member-onboarding-form',
  });
  assert.equal(publicFormSuspended.statusCode, 404);

  // Reactivating restores login and public form access
  const reactivateRes = await app.inject({
    method: 'PATCH',
    url: '/api/admin/tenants/tenant_acme',
    headers: { cookie: adminCookie },
    payload: { status: 'active' },
  });
  assert.equal(reactivateRes.statusCode, 200);

  const reloginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'acme1234' },
  });
  assert.equal(reloginRes.statusCode, 200);

  const publicFormActive = await app.inject({
    method: 'GET',
    url: '/api/public/forms/acme-corp/member-onboarding-form',
  });
  assert.equal(publicFormActive.statusCode, 200);

  await app.close();
});

test('superadmin user update: modifies username, displayName, and role with uniqueness and RBAC guards', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });

  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'superadmin', password: 'admin123' },
  });
  const adminCookie = extractCookieHeader(adminLogin);

  const acmeLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'acme1234' },
  });
  assert.equal(acmeLogin.statusCode, 200);
  const acmeCookie = extractCookieHeader(acmeLogin);

  const usersRes = await app.inject({
    method: 'GET',
    url: '/api/admin/users',
    headers: { cookie: adminCookie },
  });
  const usersList = usersRes.json<{
    users: Array<{ id: string; username: string; role: string }>;
  }>().users;
  const superadminUser = usersList.find((u) => u.role === 'superadmin')!;
  const globexUser = usersList.find((u) => u.username === 'globex_admin')!;
  const acmeUser = usersList.find((u) => u.username === 'acme_admin')!;

  // Empty payload rejected with 400
  const emptyRes = await app.inject({
    method: 'PATCH',
    url: `/api/admin/users/${globexUser.id}`,
    headers: { cookie: adminCookie },
    payload: {},
  });
  assert.equal(emptyRes.statusCode, 400);

  // Invalid username rejected with 400 + fieldErrors.username
  const badUsernameRes = await app.inject({
    method: 'PATCH',
    url: `/api/admin/users/${globexUser.id}`,
    headers: { cookie: adminCookie },
    payload: { username: 'bad user' },
  });
  assert.equal(badUsernameRes.statusCode, 400);
  assert.ok(
    badUsernameRes.json<{ fieldErrors?: Record<string, string> }>().fieldErrors
      ?.username,
  );

  // Case-insensitive duplicate username rejected with 409
  const duplicateRes = await app.inject({
    method: 'PATCH',
    url: `/api/admin/users/${globexUser.id}`,
    headers: { cookie: adminCookie },
    payload: { username: 'ACME_ADMIN' },
  });
  assert.equal(duplicateRes.statusCode, 409);

  // Superadmin target protected with 403
  const superadminProtected = await app.inject({
    method: 'PATCH',
    url: `/api/admin/users/${superadminUser.id}`,
    headers: { cookie: adminCookie },
    payload: { displayName: 'Compromised' },
  });
  assert.equal(superadminProtected.statusCode, 403);

  // Valid update modifies username, displayName, and role, and revokes old session
  const updateRes = await app.inject({
    method: 'PATCH',
    url: `/api/admin/users/${acmeUser.id}`,
    headers: { cookie: adminCookie },
    payload: {
      username: 'acme_ops',
      displayName: 'Acme Operations',
      role: 'tenant_member',
    },
  });
  assert.equal(updateRes.statusCode, 200);
  const updated = updateRes.json<{
    user: { id: string; username: string; displayName: string; role: string };
  }>().user;
  assert.equal(updated.username, 'acme_ops');
  assert.equal(updated.displayName, 'Acme Operations');
  assert.equal(updated.role, 'tenant_member');

  // Old session invalidated when username changes
  const meAfterRename = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: acmeCookie },
  });
  assert.equal(meAfterRename.statusCode, 401);

  // Login works with new username
  const newLoginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'acme_ops',
      password: 'acme1234',
      tenantSlug: 'acme-corp',
    },
  });
  assert.equal(newLoginRes.statusCode, 200);

  await app.close();
});

test('superadmin reset-credentials: generates or sets password, revokes sessions, and emails credentials', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);

  const sentEmails: TenantWelcomeEmailPayload[] = [];
  const spyEmailService: EmailService = {
    async sendTenantWelcomeEmail(payload) {
      sentEmails.push(payload);
      return { status: 'sent', provider: 'resend', messageId: 're_reset_1' };
    },
  };

  const app = await buildServer({
    store,
    logger: false,
    emailService: spyEmailService,
    appOrigin: 'https://forms.example.com',
  });

  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'superadmin', password: 'admin123' },
  });
  const adminCookie = extractCookieHeader(adminLogin);

  const acmeLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'acme1234' },
  });
  const acmeCookie = extractCookieHeader(acmeLogin);

  const usersRes = await app.inject({
    method: 'GET',
    url: '/api/admin/users',
    headers: { cookie: adminCookie },
  });
  const usersList = usersRes.json<{
    users: Array<{ id: string; username: string; role: string }>;
  }>().users;
  const superadminUser = usersList.find((u) => u.role === 'superadmin')!;
  const acmeUser = usersList.find((u) => u.username === 'acme_admin')!;

  // Non-superadmin blocked with 403
  const nonAdminRes = await app.inject({
    method: 'POST',
    url: `/api/admin/users/${acmeUser.id}/reset-credentials`,
    headers: { cookie: acmeCookie },
    payload: {},
  });
  assert.equal(nonAdminRes.statusCode, 403);

  // Superadmin target blocked with 403
  const superadminTargetRes = await app.inject({
    method: 'POST',
    url: `/api/admin/users/${superadminUser.id}/reset-credentials`,
    headers: { cookie: adminCookie },
    payload: {},
  });
  assert.equal(superadminTargetRes.statusCode, 403);

  // Invalid short password and malformed email rejected with 400 + fieldErrors
  const badPayloadRes = await app.inject({
    method: 'POST',
    url: `/api/admin/users/${acmeUser.id}/reset-credentials`,
    headers: { cookie: adminCookie },
    payload: { password: 'short', email: 'not-email' },
  });
  assert.equal(badPayloadRes.statusCode, 400);
  const badFields = badPayloadRes.json<{
    fieldErrors?: Record<string, string>;
  }>().fieldErrors;
  assert.ok(badFields?.password);
  assert.ok(badFields?.email);

  // Auto-generate 16-char hex password and email it
  const autoResetRes = await app.inject({
    method: 'POST',
    url: `/api/admin/users/${acmeUser.id}/reset-credentials`,
    headers: { cookie: adminCookie },
    payload: { email: 'Admin@Acme.example' },
  });
  assert.equal(autoResetRes.statusCode, 200);
  const autoBody = autoResetRes.json<{
    user: { id: string; username: string };
    generatedPassword?: string;
    emailDelivery?: { status: string; provider: string; messageId?: string };
  }>();
  assert.match(autoBody.generatedPassword ?? '', /^[0-9a-f]{16}$/);
  assert.equal(autoBody.emailDelivery?.status, 'sent');
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0]!.to, 'admin@acme.example');
  assert.equal(sentEmails[0]!.username, 'acme_admin');
  assert.equal(sentEmails[0]!.password, autoBody.generatedPassword);
  assert.equal(
    sentEmails[0]!.loginUrl,
    'https://forms.example.com/t/acme-corp/login',
  );

  // Old session invalidated
  const meAfterReset = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: acmeCookie },
  });
  assert.equal(meAfterReset.statusCode, 401);

  // Login succeeds with generated password
  const loginGenerated = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'acme_admin',
      password: autoBody.generatedPassword,
      tenantSlug: 'acme-corp',
    },
  });
  assert.equal(loginGenerated.statusCode, 200);

  // Explicit custom password does not return generatedPassword
  const customResetRes = await app.inject({
    method: 'POST',
    url: `/api/admin/users/${acmeUser.id}/reset-credentials`,
    headers: { cookie: adminCookie },
    payload: { password: 'customPassword99' },
  });
  assert.equal(customResetRes.statusCode, 200);
  const customBody = customResetRes.json<{
    user: { id: string };
    generatedPassword?: string;
  }>();
  assert.equal(customBody.generatedPassword, undefined);

  const loginCustom = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'acme_admin',
      password: 'customPassword99',
      tenantSlug: 'acme-corp',
    },
  });
  assert.equal(loginCustom.statusCode, 200);

  await app.close();
});

test('seedDatabase retains only superadmin with zero seeded tenants, forms, or submissions', async () => {
  const store = new InMemoryAppStore();
  await seedDatabase(store);
  const app = await buildServer({ store, logger: false });

  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'superadmin', password: 'admin123' },
  });
  assert.equal(adminLogin.statusCode, 200);
  const adminCookie = extractCookieHeader(adminLogin);

  const [tenantsRes, formsRes, subsRes] = await Promise.all([
    app.inject({
      method: 'GET',
      url: '/api/admin/tenants',
      headers: { cookie: adminCookie },
    }),
    app.inject({
      method: 'GET',
      url: '/api/admin/forms',
      headers: { cookie: adminCookie },
    }),
    app.inject({
      method: 'GET',
      url: '/api/admin/submissions',
      headers: { cookie: adminCookie },
    }),
  ]);

  assert.equal(tenantsRes.statusCode, 200);
  assert.deepEqual(tenantsRes.json<{ tenants: unknown[] }>().tenants, []);
  assert.equal(formsRes.statusCode, 200);
  assert.deepEqual(formsRes.json<{ forms: unknown[] }>().forms, []);
  assert.equal(subsRes.statusCode, 200);
  assert.deepEqual(subsRes.json<{ items: unknown[] }>().items, []);

  await app.close();
});

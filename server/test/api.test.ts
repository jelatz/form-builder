import assert from 'node:assert/strict';
import test from 'node:test';
import { buildServer } from '../app.ts';
import { seedDatabase } from '../db/seed.ts';
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
  await seedDatabase(store);
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
  await seedDatabase(store);
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
  await seedDatabase(store);
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
    payload: { name: 'Initech LLC', slug: 'initech-llc' },
  });
  assert.equal(tenantRes.statusCode, 201);
  const { tenant } = tenantRes.json<{ tenant: { id: string; slug: string } }>();
  assert.equal(tenant.slug, 'initech-llc');

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
  await seedDatabase(store);
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

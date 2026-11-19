import assert from 'node:assert/strict';
import test from 'node:test';
import { buildServer } from '../app.ts';
import { SESSION_COOKIE_NAME } from '../middleware/auth.ts';
import type { PublicUser } from '../types.ts';
import { seedTestDatabase } from './fixtures.ts';
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

test('tenant_admin self-service team management: CRUD within own tenant, 403 cross-tenant, 404 foreign userId', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });

  const acmeLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'acme1234', tenantSlug: 'acme-corp' },
  });
  assert.equal(acmeLogin.statusCode, 200);
  const acmeAdminCookie = extractCookieHeader(acmeLogin);

  // List own tenant users
  const listRes = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_acme/users',
    headers: { cookie: acmeAdminCookie },
  });
  assert.equal(listRes.statusCode, 200);
  const initialUsers = listRes.json<{ users: PublicUser[] }>().users;
  assert.ok(initialUsers.some((u) => u.username === 'acme_admin'));

  // Cross-tenant team access rejected with 403
  const crossList = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_globex/users',
    headers: { cookie: acmeAdminCookie },
  });
  assert.equal(crossList.statusCode, 403);

  // Create a member in Acme (attempting to spoof clientId in body is overridden to tenant_acme)
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/tenants/tenant_acme/users',
    headers: { cookie: acmeAdminCookie },
    payload: {
      clientId: 'tenant_globex',
      username: 'acme_editor',
      displayName: 'Acme Editor',
      password: 'editor_pass_1',
      role: 'tenant_member',
    },
  });
  assert.equal(createRes.statusCode, 201);
  const createdMember = createRes.json<{ user: PublicUser }>().user;
  assert.equal(createdMember.clientId, 'tenant_acme');
  assert.equal(createdMember.role, 'tenant_member');

  // Update own tenant member
  const patchRes = await app.inject({
    method: 'PATCH',
    url: `/api/tenants/tenant_acme/users/${createdMember.id}`,
    headers: { cookie: acmeAdminCookie },
    payload: { displayName: 'Acme Lead Editor' },
  });
  assert.equal(patchRes.statusCode, 200);
  assert.equal(
    patchRes.json<{ user: PublicUser }>().user.displayName,
    'Acme Lead Editor',
  );

  // Reset credentials for own tenant member
  const resetRes = await app.inject({
    method: 'POST',
    url: `/api/tenants/tenant_acme/users/${createdMember.id}/reset-credentials`,
    headers: { cookie: acmeAdminCookie },
    payload: {},
  });
  assert.equal(resetRes.statusCode, 200);
  assert.ok(resetRes.json<{ generatedPassword?: string }>().generatedPassword);

  // Mutating a Globex user ID through Acme's route returns 404
  const globexAdmin = await store.findUserByUsername('globex_admin');
  assert.ok(globexAdmin);
  const foreignPatch = await app.inject({
    method: 'PATCH',
    url: `/api/tenants/tenant_acme/users/${globexAdmin.id}`,
    headers: { cookie: acmeAdminCookie },
    payload: { displayName: 'Hijacked' },
  });
  assert.equal(foreignPatch.statusCode, 404);

  const foreignDelete = await app.inject({
    method: 'DELETE',
    url: `/api/tenants/tenant_acme/users/${globexAdmin.id}`,
    headers: { cookie: acmeAdminCookie },
  });
  assert.equal(foreignDelete.statusCode, 404);

  // Delete own tenant member succeeds
  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/api/tenants/tenant_acme/users/${createdMember.id}`,
    headers: { cookie: acmeAdminCookie },
  });
  assert.equal(deleteRes.statusCode, 200);

  await app.close();
});

test('tenant_member RBAC hardening: blocks team management, form deletion, submission clear-all, and webhook mutations while permitting edits & monitoring', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });

  // Provision a webhook and a tenant_member as acme_admin
  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'acme1234' },
  });
  const adminCookie = extractCookieHeader(adminLogin);

  const hookRes = await app.inject({
    method: 'POST',
    url: '/api/tenants/tenant_acme/forms/form_onboarding_01/webhooks',
    headers: { cookie: adminCookie },
    payload: {
      name: 'Acme Hook',
      url: 'https://hooks.acme.example/events',
    },
  });
  assert.equal(hookRes.statusCode, 201);
  const hookId = hookRes.json<{ webhook: { id: string } }>().webhook.id;

  const memberCreateRes = await app.inject({
    method: 'POST',
    url: '/api/tenants/tenant_acme/users',
    headers: { cookie: adminCookie },
    payload: {
      username: 'acme_colleague',
      displayName: 'Acme Colleague',
      password: 'colleague_pass_1',
      role: 'tenant_member',
    },
  });
  assert.equal(memberCreateRes.statusCode, 201);

  const memberLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'acme_colleague',
      password: 'colleague_pass_1',
      tenantSlug: 'acme-corp',
    },
  });
  assert.equal(memberLogin.statusCode, 200);
  const memberCookie = extractCookieHeader(memberLogin);

  // Blocked (403) for tenant_member
  const blockedRequests = [
    app.inject({
      method: 'GET',
      url: '/api/tenants/tenant_acme/users',
      headers: { cookie: memberCookie },
    }),
    app.inject({
      method: 'POST',
      url: '/api/tenants/tenant_acme/users',
      headers: { cookie: memberCookie },
      payload: {
        username: 'another_user',
        displayName: 'Another',
        password: 'password123',
        role: 'tenant_member',
      },
    }),
    app.inject({
      method: 'DELETE',
      url: '/api/tenants/tenant_acme/forms/form_onboarding_01',
      headers: { cookie: memberCookie },
    }),
    app.inject({
      method: 'DELETE',
      url: '/api/tenants/tenant_acme/forms/form_onboarding_01/submissions',
      headers: { cookie: memberCookie },
    }),
    app.inject({
      method: 'POST',
      url: '/api/tenants/tenant_acme/forms/form_onboarding_01/webhooks',
      headers: { cookie: memberCookie },
      payload: { name: 'Blocked Hook', url: 'https://example.com/hook' },
    }),
    app.inject({
      method: 'PATCH',
      url: `/api/tenants/tenant_acme/forms/form_onboarding_01/webhooks/${hookId}`,
      headers: { cookie: memberCookie },
      payload: { isActive: false },
    }),
    app.inject({
      method: 'DELETE',
      url: `/api/tenants/tenant_acme/forms/form_onboarding_01/webhooks/${hookId}`,
      headers: { cookie: memberCookie },
    }),
  ];

  const blockedResponses = await Promise.all(blockedRequests);
  for (const res of blockedResponses) {
    assert.equal(
      res.statusCode,
      403,
      `Expected HTTP 403 for restricted tenant_member call, got ${res.statusCode}`,
    );
  }

  // Allowed for tenant_member: read forms, edit form, view submissions, view webhooks, delete 1 submission
  const listFormsRes = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_acme/forms',
    headers: { cookie: memberCookie },
  });
  assert.equal(listFormsRes.statusCode, 200);

  const editFormRes = await app.inject({
    method: 'PATCH',
    url: '/api/tenants/tenant_acme/forms/form_onboarding_01',
    headers: { cookie: memberCookie },
    payload: { title: 'Member Onboarding Form (Edited)' },
  });
  assert.equal(editFormRes.statusCode, 200);

  const listHooksRes = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_acme/forms/form_onboarding_01/webhooks',
    headers: { cookie: memberCookie },
  });
  assert.equal(listHooksRes.statusCode, 200);

  const listSubsRes = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_acme/submissions',
    headers: { cookie: memberCookie },
  });
  assert.equal(listSubsRes.statusCode, 200);

  const delOneSubRes = await app.inject({
    method: 'DELETE',
    url: '/api/tenants/tenant_acme/submissions/sub_acme_001',
    headers: { cookie: memberCookie },
  });
  assert.equal(delOneSubRes.statusCode, 200);

  await app.close();
});

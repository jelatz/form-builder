import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  FormWebhook,
  WebhookDelivery,
} from '../../src/domain/form-schema/types.ts';
import { buildServer } from '../app.ts';
import { signWebhookPayload } from '../lib/crypto.ts';
import { SESSION_COOKIE_NAME } from '../middleware/auth.ts';
import type { WebhookHttpTransport } from '../modules/webhooks/dispatcher.ts';
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

test('webhooks: CRUD and strict RBAC tenant isolation', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });

  const acmeLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'acme1234' },
  });
  assert.equal(acmeLogin.statusCode, 200);
  const acmeCookie = extractCookieHeader(acmeLogin);

  // Invalid URL rejected with HTTP 400
  const badUrlRes = await app.inject({
    method: 'POST',
    url: '/api/tenants/tenant_acme/forms/form_security_access/webhooks',
    headers: { cookie: acmeCookie },
    payload: { name: 'Bad Hook', url: 'ftp://invalid.local/hook' },
  });
  assert.equal(badUrlRes.statusCode, 400);

  // Create valid webhook
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/tenants/tenant_acme/forms/form_security_access/webhooks',
    headers: { cookie: acmeCookie },
    payload: {
      name: 'Acme Security Alerts',
      url: 'https://hooks.acme.example/security',
    },
  });
  assert.equal(createRes.statusCode, 201);
  const { webhook } = createRes.json<{ webhook: FormWebhook }>();
  assert.equal(webhook.name, 'Acme Security Alerts');
  assert.equal(webhook.clientId, 'tenant_acme');
  assert.equal(webhook.formId, 'form_security_access');
  assert.ok(webhook.secret.startsWith('whsec_'));
  assert.deepEqual(webhook.events, ['submission.created']);
  assert.equal(webhook.isActive, true);

  // Cross-tenant access blocked (HTTP 403)
  const crossTenantList = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_globex/forms/form_globex_feedback/webhooks',
    headers: { cookie: acmeCookie },
  });
  assert.equal(crossTenantList.statusCode, 403);

  // Toggle active & rename via PATCH
  const patchRes = await app.inject({
    method: 'PATCH',
    url: `/api/tenants/tenant_acme/forms/form_security_access/webhooks/${webhook.id}`,
    headers: { cookie: acmeCookie },
    payload: { name: 'Acme Security Feed', isActive: false },
  });
  assert.equal(patchRes.statusCode, 200);
  const patched = patchRes.json<{ webhook: FormWebhook }>().webhook;
  assert.equal(patched.name, 'Acme Security Feed');
  assert.equal(patched.isActive, false);

  // Delete webhook
  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/api/tenants/tenant_acme/forms/form_security_access/webhooks/${webhook.id}`,
    headers: { cookie: acmeCookie },
  });
  assert.equal(deleteRes.statusCode, 200);

  const listAfter = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_acme/forms/form_security_access/webhooks',
    headers: { cookie: acmeCookie },
  });
  assert.equal(listAfter.statusCode, 200);
  assert.equal(listAfter.json<{ webhooks: FormWebhook[] }>().webhooks.length, 0);

  await app.close();
});

test('webhooks: test ping sends signed HMAC-SHA256 payload and records completed delivery', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);

  const capturedRequests: Array<{
    url: string;
    headers: Record<string, string>;
    body: string;
  }> = [];

  const mockTransport: WebhookHttpTransport = async (url, init) => {
    capturedRequests.push({ url, headers: init.headers, body: init.body });
    return { status: 200, bodyText: '{"received":true}' };
  };

  const app = await buildServer({
    store,
    logger: false,
    webhookTransport: mockTransport,
  });

  const acmeLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'acme1234' },
  });
  const acmeCookie = extractCookieHeader(acmeLogin);

  const createRes = await app.inject({
    method: 'POST',
    url: '/api/tenants/tenant_acme/forms/form_security_access/webhooks',
    headers: { cookie: acmeCookie },
    payload: {
      name: 'Zapier Hook',
      url: 'https://hooks.zapier.com/hooks/catch/123/abc',
      secret: 'whsec_custom_secret_12345',
    },
  });
  assert.equal(createRes.statusCode, 201);
  const { webhook } = createRes.json<{ webhook: FormWebhook }>();

  const testRes = await app.inject({
    method: 'POST',
    url: `/api/tenants/tenant_acme/forms/form_security_access/webhooks/${webhook.id}/test`,
    headers: { cookie: acmeCookie },
  });
  assert.equal(testRes.statusCode, 200);
  const { delivery } = testRes.json<{ delivery: WebhookDelivery }>();
  assert.equal(delivery.status, 'completed');
  assert.equal(delivery.eventType, 'webhook.test');
  assert.equal(delivery.responseStatus, 200);
  assert.equal(delivery.responseBody, '{"received":true}');
  assert.equal(delivery.attemptCount, 1);

  assert.equal(capturedRequests.length, 1);
  const req = capturedRequests[0]!;
  assert.equal(req.url, 'https://hooks.zapier.com/hooks/catch/123/abc');
  assert.equal(req.headers['X-FormBuilder-Event'], 'webhook.test');
  assert.equal(req.headers['X-FormBuilder-Delivery-Id'], delivery.id);
  assert.equal(
    req.headers['X-FormBuilder-Signature'],
    signWebhookPayload('whsec_custom_secret_12345', req.body),
  );

  await app.close();
});

test('webhooks: public form submission dispatches active hooks and retry recovers failed deliveries', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);

  let nextStatus = 500;
  let nextBody = 'downstream error';

  const mockTransport: WebhookHttpTransport = async () => ({
    status: nextStatus,
    bodyText: nextBody,
  });

  const app = await buildServer({
    store,
    logger: false,
    webhookTransport: mockTransport,
  });

  const acmeLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'acme1234' },
  });
  const acmeCookie = extractCookieHeader(acmeLogin);

  // Create active and paused webhooks on form_security_access (slug: vpn-security-request)
  const activeRes = await app.inject({
    method: 'POST',
    url: '/api/tenants/tenant_acme/forms/form_security_access/webhooks',
    headers: { cookie: acmeCookie },
    payload: {
      name: 'Primary CRM Hook',
      url: 'https://crm.acme.example/ingest',
      isActive: true,
    },
  });
  assert.equal(activeRes.statusCode, 201);
  const activeHook = activeRes.json<{ webhook: FormWebhook }>().webhook;

  const pausedRes = await app.inject({
    method: 'POST',
    url: '/api/tenants/tenant_acme/forms/form_security_access/webhooks',
    headers: { cookie: acmeCookie },
    payload: {
      name: 'Paused Hook',
      url: 'https://paused.acme.example/ingest',
      isActive: false,
    },
  });
  assert.equal(pausedRes.statusCode, 201);

  // Submit public form while downstream returns 500
  const submitRes = await app.inject({
    method: 'POST',
    url: '/api/public/forms/acme-corp/vpn-security-request/submissions',
    payload: {
      values: {
        field_email_requester: 'alice@acme.com',
        field_radio_tier: 'staging_ro',
        field_num_duration: '14',
      },
    },
  });
  assert.equal(submitRes.statusCode, 201);
  const createdSubId = submitRes.json<{
    submission: { id: string };
  }>().submission.id;

  // Verify only active hook fired and recorded a failed delivery
  const logsBefore = await app.inject({
    method: 'GET',
    url: '/api/tenants/tenant_acme/forms/form_security_access/webhooks',
    headers: { cookie: acmeCookie },
  });
  assert.equal(logsBefore.statusCode, 200);
  const { deliveries } = logsBefore.json<{ deliveries: WebhookDelivery[] }>();
  assert.equal(deliveries.length, 1);
  const failedDelivery = deliveries[0]!;
  assert.equal(failedDelivery.webhookId, activeHook.id);
  assert.equal(failedDelivery.submissionId, createdSubId);
  assert.equal(failedDelivery.eventType, 'submission.created');
  assert.equal(failedDelivery.status, 'failed');
  assert.equal(failedDelivery.responseStatus, 500);
  assert.equal(failedDelivery.attemptCount, 1);

  // Downstream recovers -> retry succeeds
  nextStatus = 202;
  nextBody = 'accepted';
  const retryRes = await app.inject({
    method: 'POST',
    url: `/api/tenants/tenant_acme/webhooks/deliveries/${failedDelivery.id}/retry`,
    headers: { cookie: acmeCookie },
  });
  assert.equal(retryRes.statusCode, 200);
  const retried = retryRes.json<{ delivery: WebhookDelivery }>().delivery;
  assert.equal(retried.status, 'completed');
  assert.equal(retried.responseStatus, 202);
  assert.equal(retried.responseBody, 'accepted');
  assert.equal(retried.attemptCount, 2);
  assert.equal(retried.errorMessage, null);

  await app.close();
});

test('forms: PATCH persists post-submit thankYou settings and rejects unsafe redirectUrl protocols', async () => {
  const store = new InMemoryAppStore();
  await seedTestDatabase(store);
  const app = await buildServer({ store, logger: false });

  const acmeLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'acme_admin', password: 'acme1234' },
  });
  const acmeCookie = extractCookieHeader(acmeLogin);

  const badRedirectRes = await app.inject({
    method: 'PATCH',
    url: '/api/tenants/tenant_acme/forms/form_security_access',
    headers: { cookie: acmeCookie },
    payload: {
      redirectUrl: 'javascript:alert(1)',
    },
  });
  assert.equal(badRedirectRes.statusCode, 400);

  const validUpdateRes = await app.inject({
    method: 'PATCH',
    url: '/api/tenants/tenant_acme/forms/form_security_access',
    headers: { cookie: acmeCookie },
    payload: {
      thankYouTitle: 'Access Request Submitted',
      thankYouMessage: 'IT Security will provision your VPN key shortly.',
      redirectUrl: 'https://portal.acme.example/requests/done',
    },
  });
  assert.equal(validUpdateRes.statusCode, 200);
  const updatedForm = validUpdateRes.json<{
    form: {
      thankYouTitle?: string;
      thankYouMessage?: string;
      redirectUrl?: string;
    };
  }>().form;
  assert.equal(updatedForm.thankYouTitle, 'Access Request Submitted');
  assert.equal(
    updatedForm.thankYouMessage,
    'IT Security will provision your VPN key shortly.',
  );
  assert.equal(
    updatedForm.redirectUrl,
    'https://portal.acme.example/requests/done',
  );

  // Public GET exposes the persisted post-submit settings
  const publicRes = await app.inject({
    method: 'GET',
    url: '/api/public/forms/acme-corp/vpn-security-request',
  });
  assert.equal(publicRes.statusCode, 200);
  const publicForm = publicRes.json<{
    form: {
      thankYouTitle?: string;
      thankYouMessage?: string;
      redirectUrl?: string;
    };
  }>().form;
  assert.equal(publicForm.thankYouTitle, 'Access Request Submitted');
  assert.equal(
    publicForm.redirectUrl,
    'https://portal.acme.example/requests/done',
  );

  await app.close();
});

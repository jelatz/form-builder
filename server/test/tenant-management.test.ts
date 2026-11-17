import assert from 'node:assert/strict';
import test from 'node:test';
import type { ClientTenant } from '../../src/domain/form-schema/types.ts';
import {
  validateEditTenantInput,
  validateEditTenantUserInput,
} from '../../src/features/tenant-submissions/tenant-utils.ts';

const SAMPLE_TENANTS: ClientTenant[] = [
  {
    id: 'tenant_acme',
    name: 'Acme Corp',
    slug: 'acme-corp',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tenant_globex',
    name: 'Globex Cloud',
    slug: 'globex-cloud',
    status: 'active',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
];

test('validateEditTenantInput: validates name, slug normalization, and cross-tenant slug conflicts', () => {
  const shortName = validateEditTenantInput(
    { name: ' A ', slug: 'acme-corp', status: 'active' },
    SAMPLE_TENANTS,
    'tenant_acme',
  );
  assert.equal(shortName.ok, false);

  const emptySlug = validateEditTenantInput(
    { name: 'Acme Corp', slug: '   ', status: 'active' },
    SAMPLE_TENANTS,
    'tenant_acme',
  );
  assert.equal(emptySlug.ok, false);

  const symbolSlug = validateEditTenantInput(
    { name: 'Acme Corp', slug: '!!!', status: 'active' },
    SAMPLE_TENANTS,
    'tenant_acme',
  );
  assert.equal(symbolSlug.ok, false);

  const collision = validateEditTenantInput(
    { name: 'Acme Corp', slug: 'Globex Cloud', status: 'active' },
    SAMPLE_TENANTS,
    'tenant_acme',
  );
  assert.equal(collision.ok, false);

  const validSameSlug = validateEditTenantInput(
    { name: '  Acme Holdings  ', slug: ' acme-corp ', status: 'suspended' },
    SAMPLE_TENANTS,
    'tenant_acme',
  );
  assert.deepEqual(validSameSlug, {
    ok: true,
    data: {
      name: 'Acme Holdings',
      slug: 'acme-corp',
      status: 'suspended',
    },
  });

  const validNewSlug = validateEditTenantInput(
    { name: 'Acme Labs', slug: ' Acme Cloud ', status: 'active' },
    SAMPLE_TENANTS,
    'tenant_acme',
  );
  assert.deepEqual(validNewSlug, {
    ok: true,
    data: {
      name: 'Acme Labs',
      slug: 'acme-cloud',
      status: 'active',
    },
  });
});

test('validateEditTenantUserInput: validates username and displayName without mutating input', () => {
  const badUsernameShort = validateEditTenantUserInput({
    username: 'ab',
    displayName: 'Jane Doe',
    role: 'tenant_admin',
  });
  assert.equal(badUsernameShort.ok, false);

  const badUsernameSpace = validateEditTenantUserInput({
    username: 'bad name',
    displayName: 'Jane Doe',
    role: 'tenant_admin',
  });
  assert.equal(badUsernameSpace.ok, false);

  const badDisplayName = validateEditTenantUserInput({
    username: 'jane_doe',
    displayName: ' X ',
    role: 'tenant_member',
  });
  assert.equal(badDisplayName.ok, false);

  const input = {
    username: '  jane_ops  ',
    displayName: '  Jane Operations  ',
    role: 'tenant_admin' as const,
  };
  const valid = validateEditTenantUserInput(input);
  assert.deepEqual(valid, {
    ok: true,
    data: {
      username: 'jane_ops',
      displayName: 'Jane Operations',
      role: 'tenant_admin',
    },
  });
  assert.equal(input.username, '  jane_ops  ');
  assert.equal(input.displayName, '  Jane Operations  ');
});

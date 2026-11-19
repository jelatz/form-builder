import type {
  ClientTenant,
  FormSchema,
  SubmissionRecord,
} from '../../src/domain/form-schema/types.ts';
import { seedDatabase } from '../db/seed.ts';
import type { AppStore } from '../db/store.ts';
import { hashPassword } from '../lib/crypto.ts';

export const TEST_TENANTS: ClientTenant[] = [
  {
    id: 'tenant_acme',
    name: 'Acme Corp',
    slug: 'acme-corp',
    status: 'active',
    createdAt: '2026-11-10T09:00:00.000Z',
  },
  {
    id: 'tenant_globex',
    name: 'Globex Cloud',
    slug: 'globex-cloud',
    status: 'active',
    createdAt: '2026-11-10T10:30:00.000Z',
  },
];

export const TEST_FORMS: FormSchema[] = [
  {
    id: 'form_onboarding_01',
    clientId: 'tenant_acme',
    slug: 'member-onboarding-form',
    title: 'Member Onboarding Form',
    description: 'Page Navigation Bar : Hidden',
    submitButtonText: 'Submit',
    isPublished: true,
    updatedAt: '2026-11-11T08:00:00.000Z',
    fields: [
      {
        id: 'field_sec_contact',
        type: 'section',
        label: 'Contact Information',
        required: false,
        showLine: false,
      },
      {
        id: 'field_name_member',
        type: 'name',
        label: 'Name',
        required: true,
        firstNameLabel: 'First Name',
        lastNameLabel: 'Last Name',
      },
      {
        id: 'field_email_primary',
        type: 'email',
        label: 'Email',
        required: true,
        placeholder: '',
      },
      {
        id: 'field_phone_primary',
        type: 'phone',
        label: 'Phone',
        required: false,
        defaultCountryCode: 'US',
      },
      {
        id: 'field_email_referred_by',
        type: 'email',
        label: 'Referred By',
        required: false,
        showDividerAbove: true,
      },
      {
        id: 'field_select_relationship',
        type: 'select',
        label: 'Referral Relationship',
        placeholder: '-Select-',
        required: false,
        options: [
          { label: 'Colleague / Partner', value: 'colleague' },
          { label: 'Existing Member', value: 'existing_member' },
          { label: 'Account Executive', value: 'account_executive' },
          { label: 'Other', value: 'other' },
        ],
      },
      {
        id: 'field_email_owner',
        type: 'email',
        label: 'Relationship Owner',
        required: true,
        confirmEmail: true,
      },
    ],
  },
  {
    id: 'form_security_access',
    clientId: 'tenant_acme',
    slug: 'vpn-security-request',
    title: 'VPN & Security Access Request',
    description: 'Request production SSH or VPN credentials for Acme Corp.',
    submitButtonText: 'Request Access',
    isPublished: true,
    updatedAt: '2026-11-11T09:15:00.000Z',
    fields: [
      {
        id: 'field_email_requester',
        type: 'email',
        label: 'Requester Email',
        placeholder: 'engineer@acme.com',
        required: true,
        allowedDomains: ['acme.com'],
      },
      {
        id: 'field_radio_tier',
        type: 'radio',
        label: 'Environment Tier',
        required: true,
        options: [
          { label: 'Staging Read-Only', value: 'staging_ro' },
          { label: 'Production Read-Only', value: 'prod_ro' },
          { label: 'Production Admin', value: 'prod_admin' },
        ],
      },
      {
        id: 'field_num_duration',
        type: 'number',
        label: 'Access Duration (Days)',
        placeholder: '7',
        required: true,
        min: 1,
        max: 90,
        step: 1,
      },
    ],
  },
  {
    id: 'form_globex_feedback',
    clientId: 'tenant_globex',
    slug: 'enterprise-trial-intake',
    title: 'Globex Enterprise Trial Intake',
    description: 'Provision a dedicated multi-region cluster for your team.',
    submitButtonText: 'Request Cluster',
    isPublished: true,
    updatedAt: '2026-11-11T11:00:00.000Z',
    fields: [
      {
        id: 'field_text_org',
        type: 'text',
        label: 'Organization Name',
        placeholder: 'Globex Partner Inc.',
        required: true,
      },
      {
        id: 'field_email_admin',
        type: 'email',
        label: 'Cluster Admin Email',
        placeholder: 'admin@globex.io',
        required: true,
      },
      {
        id: 'field_select_region',
        type: 'select',
        label: 'Primary Region',
        required: true,
        options: [
          { label: 'US East (N. Virginia)', value: 'us-east-1' },
          { label: 'EU Central (Frankfurt)', value: 'eu-central-1' },
          { label: 'AP Southeast (Singapore)', value: 'ap-southeast-1' },
        ],
      },
      {
        id: 'field_num_nodes',
        type: 'number',
        label: 'Initial Node Count',
        placeholder: '3',
        required: true,
        min: 1,
        max: 64,
      },
    ],
  },
];

export const TEST_SUBMISSIONS: SubmissionRecord[] = [
  {
    id: 'sub_acme_001',
    formId: 'form_onboarding_01',
    clientId: 'tenant_acme',
    submittedAt: '2026-11-11T12:15:00.000Z',
    values: {
      field_name_member: { firstName: 'Ada', lastName: 'Lovelace' },
      field_email_primary: 'ada@acme.com',
      field_phone_primary: '+1 (555) 019-2834',
      field_select_relationship: 'existing_member',
      field_email_owner: 'grace@acme.com',
    },
  },
  {
    id: 'sub_acme_002',
    formId: 'form_onboarding_01',
    clientId: 'tenant_acme',
    submittedAt: '2026-11-11T13:40:00.000Z',
    values: {
      field_name_member: { firstName: 'Grace', lastName: 'Hopper' },
      field_email_primary: 'grace@acme.com',
      field_phone_primary: '+1 (555) 392-8172',
      field_select_relationship: 'colleague',
      field_email_owner: 'ada@acme.com',
    },
  },
  {
    id: 'sub_globex_001',
    formId: 'form_globex_feedback',
    clientId: 'tenant_globex',
    submittedAt: '2026-11-11T14:05:00.000Z',
    values: {
      field_text_org: 'Initech Systems',
      field_email_admin: 'ops@globex.io',
      field_select_region: 'eu-central-1',
      field_num_nodes: '6',
    },
  },
];

/**
 * Seeds the superadmin plus sample multi-tenant fixtures for automated API tests.
 */
export async function seedTestDatabase(
  store: AppStore,
  options?: {
    superadminUsername?: string;
    superadminPassword?: string;
  },
): Promise<void> {
  await seedDatabase(store, options);
  const nowIso = new Date().toISOString();

  for (const tenant of TEST_TENANTS) {
    const existing = await store.findClientById(tenant.id);
    if (!existing) {
      await store.createClient({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status ?? 'active',
        nowIso: tenant.createdAt,
      });
    }
  }

  const existingAcmeAdmin = await store.findUserByUsername('acme_admin');
  if (!existingAcmeAdmin) {
    await store.createUser({
      id: 'user_acme_admin',
      clientId: 'tenant_acme',
      username: 'acme_admin',
      displayName: 'Acme Admin',
      passwordHash: await hashPassword('acme1234'),
      role: 'tenant_admin',
      isActive: true,
      nowIso,
    });
  }

  const existingGlobexAdmin = await store.findUserByUsername('globex_admin');
  if (!existingGlobexAdmin) {
    await store.createUser({
      id: 'user_globex_admin',
      clientId: 'tenant_globex',
      username: 'globex_admin',
      displayName: 'Globex Admin',
      passwordHash: await hashPassword('globex1234'),
      role: 'tenant_admin',
      isActive: true,
      nowIso,
    });
  }

  for (const form of TEST_FORMS) {
    const existing = await store.findFormById(form.id, form.clientId);
    if (!existing) {
      await store.createForm({
        id: form.id,
        clientId: form.clientId,
        slug: form.slug,
        title: form.title,
        description: form.description,
        submitButtonText: form.submitButtonText,
        isPublished: form.isPublished ?? true,
        fields: form.fields,
        nowIso: form.updatedAt,
      });
    }
  }

  const existingSubs = await store.listSubmissions({ limit: 1, offset: 0 });
  if (existingSubs.total === 0) {
    for (const sub of TEST_SUBMISSIONS) {
      await store.createSubmission(sub);
    }
  }
}

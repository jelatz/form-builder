import type {
  ClientTenant,
  FormSchema,
  SubmissionRecord,
} from '../../domain/form-schema';

const STORAGE_KEYS = {
  tenants: 'form_builder_tenants_v2',
  forms: 'form_builder_forms_v2',
  submissions: 'form_builder_submissions_v2',
} as const;

export const SEED_TENANTS: ClientTenant[] = [
  {
    id: 'tenant_acme',
    name: 'Acme Corp',
    slug: 'acme-corp',
    primaryDomain: 'acme.com',
    allowedDomains: ['acme.com', 'portal.acme.com'],
    createdAt: '2026-11-10T09:00:00.000Z',
  },
  {
    id: 'tenant_globex',
    name: 'Globex Cloud',
    slug: 'globex-cloud',
    primaryDomain: 'globex.io',
    allowedDomains: ['globex.io', 'app.globex.io'],
    createdAt: '2026-11-10T10:30:00.000Z',
  },
];

export const SEED_FORMS: FormSchema[] = [
  {
    id: 'form_onboarding_01',
    clientId: 'tenant_acme',
    slug: 'member-onboarding-form',
    title: 'Member Onboarding Form',
    description: 'Page Navigation Bar : Hidden',
    submitButtonText: 'Submit',
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

export const SEED_SUBMISSIONS: SubmissionRecord[] = [
  {
    id: 'sub_acme_001',
    formId: 'form_onboarding_01',
    clientId: 'tenant_acme',
    submittedAt: '2026-11-11T12:15:00.000Z',
    sourceHost: 'portal.acme.com',
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
    sourceHost: 'acme.com',
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
    sourceHost: 'app.globex.io',
    values: {
      field_text_org: 'Initech Systems',
      field_email_admin: 'ops@globex.io',
      field_select_region: 'eu-central-1',
      field_num_nodes: '6',
    },
  },
];

function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export interface WorkspacePersistenceSnapshot {
  tenants: ClientTenant[];
  forms: FormSchema[];
  submissions: SubmissionRecord[];
}

export function loadWorkspaceSnapshot(): WorkspacePersistenceSnapshot {
  const tenants = readJsonStorage<ClientTenant[]>(
    STORAGE_KEYS.tenants,
    SEED_TENANTS,
  );
  const forms = readJsonStorage<FormSchema[]>(STORAGE_KEYS.forms, SEED_FORMS);
  const submissions = readJsonStorage<SubmissionRecord[]>(
    STORAGE_KEYS.submissions,
    SEED_SUBMISSIONS,
  );

  return {
    tenants: tenants.length > 0 ? tenants : SEED_TENANTS,
    forms: forms.length > 0 ? forms : SEED_FORMS,
    submissions,
  };
}

/**
 * Async persistence adapter simulating a D1 / edge API write so callers
 * can perform optimistic UI updates and roll back on error.
 */
export async function persistTenants(tenants: ClientTenant[]): Promise<void> {
  await Promise.resolve();
  writeJsonStorage(STORAGE_KEYS.tenants, tenants);
}

export async function persistForms(forms: FormSchema[]): Promise<void> {
  await Promise.resolve();
  writeJsonStorage(STORAGE_KEYS.forms, forms);
}

export async function persistSubmissions(
  submissions: SubmissionRecord[],
): Promise<void> {
  await Promise.resolve();
  writeJsonStorage(STORAGE_KEYS.submissions, submissions);
}

/**
 * Multi-tenant query helper: returns only forms belonging to `clientId`.
 */
export function filterFormsByTenant(
  forms: FormSchema[],
  clientId: string,
): FormSchema[] {
  return forms.filter((form) => form.clientId === clientId);
}

/**
 * Multi-tenant query helper: returns only submissions belonging to both `clientId` and `formId`.
 */
export function filterSubmissionsByTenantForm(
  submissions: SubmissionRecord[],
  clientId: string,
  formId: string,
): SubmissionRecord[] {
  return submissions.filter(
    (sub) => sub.clientId === clientId && sub.formId === formId,
  );
}

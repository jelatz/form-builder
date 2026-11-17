import type {
  ClientTenant,
  FormField,
  FormSchema,
  FormValues,
  SubmissionRecord,
} from '../../domain/form-schema';
import { apiRequest } from '../../shared/lib';

export interface ManagedTenantUser {
  id: string;
  clientId: string | null;
  username: string;
  displayName: string;
  role: 'superadmin' | 'tenant_admin' | 'tenant_member';
  isActive: boolean;
  createdAt: string;
}

export interface WorkspaceSnapshot {
  tenants: ClientTenant[];
  forms: FormSchema[];
  submissions: SubmissionRecord[];
  users: ManagedTenantUser[];
}

export async function fetchSuperadminSnapshot(): Promise<WorkspaceSnapshot> {
  const [tenantsRes, formsRes, submissionsRes, usersRes] = await Promise.all([
    apiRequest<{ tenants: ClientTenant[] }>('/api/admin/tenants'),
    apiRequest<{ forms: FormSchema[] }>('/api/admin/forms'),
    apiRequest<{ items: SubmissionRecord[] }>(
      '/api/admin/submissions?limit=500',
    ),
    apiRequest<{ users: ManagedTenantUser[] }>('/api/admin/users'),
  ]);

  return {
    tenants: tenantsRes.tenants,
    forms: formsRes.forms,
    submissions: submissionsRes.items,
    users: usersRes.users,
  };
}

export async function fetchTenantSnapshot(
  tenant: ClientTenant,
): Promise<WorkspaceSnapshot> {
  const [formsRes, submissionsRes] = await Promise.all([
    apiRequest<{ forms: FormSchema[] }>(
      `/api/tenants/${encodeURIComponent(tenant.id)}/forms`,
    ),
    apiRequest<{ items: SubmissionRecord[] }>(
      `/api/tenants/${encodeURIComponent(tenant.id)}/submissions?limit=500`,
    ),
  ]);

  return {
    tenants: [tenant],
    forms: formsRes.forms,
    submissions: submissionsRes.items,
    users: [],
  };
}

export interface EmailDeliveryResult {
  status: 'sent' | 'logged';
  provider: 'resend' | 'dev-console';
  messageId?: string;
}

export interface CreateTenantResponse {
  tenant: ClientTenant;
  starterForm: FormSchema;
  adminUser: ManagedTenantUser;
  emailDelivery: EmailDeliveryResult;
}

export interface ResetUserCredentialsResponse {
  user: ManagedTenantUser;
  generatedPassword?: string;
  emailDelivery?: EmailDeliveryResult;
}

export async function apiCreateTenant(input: {
  name: string;
  slug: string;
  adminUsername?: string;
  email: string;
}): Promise<CreateTenantResponse> {
  return apiRequest<CreateTenantResponse>('/api/admin/tenants', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiUpdateTenant(
  tenantId: string,
  input: { name?: string; slug?: string; status?: 'active' | 'suspended' },
): Promise<ClientTenant> {
  const res = await apiRequest<{ tenant: ClientTenant }>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return res.tenant;
}

export async function apiDeleteTenant(tenantId: string): Promise<void> {
  await apiRequest<{ deleted: true }>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function apiCreateTenantUser(input: {
  clientId: string;
  username: string;
  displayName: string;
  password: string;
  role: 'tenant_admin' | 'tenant_member';
}): Promise<ManagedTenantUser> {
  const res = await apiRequest<{ user: ManagedTenantUser }>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.user;
}

export async function apiUpdateTenantUser(
  userId: string,
  input: {
    username?: string;
    displayName?: string;
    role?: 'tenant_admin' | 'tenant_member';
    isActive?: boolean;
    password?: string;
  },
): Promise<ManagedTenantUser> {
  const res = await apiRequest<{ user: ManagedTenantUser }>(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return res.user;
}

export async function apiResetTenantUserCredentials(
  userId: string,
  input: {
    password?: string;
    email?: string;
  },
): Promise<ResetUserCredentialsResponse> {
  return apiRequest<ResetUserCredentialsResponse>(
    `/api/admin/users/${encodeURIComponent(userId)}/reset-credentials`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function apiDeleteTenantUser(userId: string): Promise<void> {
  await apiRequest<{ deleted: true }>(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function apiCreateForm(
  clientId: string,
  input: {
    title: string;
    slug?: string;
    description?: string;
    submitButtonText?: string;
    isPublished?: boolean;
    fields?: FormField[];
  },
): Promise<FormSchema> {
  const res = await apiRequest<{ form: FormSchema }>(
    `/api/tenants/${encodeURIComponent(clientId)}/forms`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return res.form;
}

export async function apiUpdateForm(
  clientId: string,
  formId: string,
  input: Partial<
    Pick<
      FormSchema,
      | 'title'
      | 'slug'
      | 'description'
      | 'submitButtonText'
      | 'isPublished'
      | 'fields'
    >
  >,
): Promise<FormSchema> {
  const res = await apiRequest<{ form: FormSchema }>(
    `/api/tenants/${encodeURIComponent(clientId)}/forms/${encodeURIComponent(formId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return res.form;
}

export async function apiDeleteForm(
  clientId: string,
  formId: string,
): Promise<{ deleted: true; replacementForm?: FormSchema }> {
  return apiRequest<{ deleted: true; replacementForm?: FormSchema }>(
    `/api/tenants/${encodeURIComponent(clientId)}/forms/${encodeURIComponent(formId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function apiCreateSubmission(
  clientId: string,
  formId: string,
  values: FormValues,
): Promise<SubmissionRecord> {
  const res = await apiRequest<{ submission: SubmissionRecord }>(
    `/api/tenants/${encodeURIComponent(clientId)}/forms/${encodeURIComponent(formId)}/submissions`,
    {
      method: 'POST',
      body: JSON.stringify({ values }),
    },
  );
  return res.submission;
}

export async function apiDeleteSubmission(
  clientId: string,
  submissionId: string,
): Promise<void> {
  await apiRequest<{ deleted: true }>(
    `/api/tenants/${encodeURIComponent(clientId)}/submissions/${encodeURIComponent(submissionId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function apiClearFormSubmissions(
  clientId: string,
  formId: string,
): Promise<void> {
  await apiRequest<{ clearedCount: number }>(
    `/api/tenants/${encodeURIComponent(clientId)}/forms/${encodeURIComponent(formId)}/submissions`,
    {
      method: 'DELETE',
    },
  );
}

export async function apiFetchPublicForm(
  tenantSlug: string,
  formSlug: string,
): Promise<{
  tenant: { id: string; name: string; slug: string };
  form: FormSchema;
}> {
  return apiRequest<{
    tenant: { id: string; name: string; slug: string };
    form: FormSchema;
  }>(
    `/api/public/forms/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(formSlug)}`,
  );
}

export async function apiSubmitPublicForm(
  tenantSlug: string,
  formSlug: string,
  values: FormValues,
): Promise<{ submission: { id: string; formId: string; submittedAt: string } }> {
  return apiRequest<{
    submission: { id: string; formId: string; submittedAt: string };
  }>(
    `/api/public/forms/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(formSlug)}/submissions`,
    {
      method: 'POST',
      body: JSON.stringify({ values }),
    },
  );
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

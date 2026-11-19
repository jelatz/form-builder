import type {
  ClientTenant,
  FormField,
  FormSchema,
  FormWebhook,
  SubmissionRecord,
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookEventType,
} from '../src/domain/form-schema/types.ts';

export const USER_ROLES = [
  'superadmin',
  'tenant_admin',
  'tenant_member',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface PublicUser {
  id: string;
  clientId: string | null;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface StoredUser extends PublicUser {
  passwordHash: string;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  clientId: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface AuthContext {
  sessionId: string;
  user: PublicUser;
  tenant: ClientTenant | null;
}

export interface CreateTenantInput {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  nowIso: string;
}

export interface UpdateTenantInput {
  name?: string;
  slug?: string;
  status?: 'active' | 'suspended';
  nowIso: string;
}

export interface CreateUserInput {
  id: string;
  clientId: string | null;
  username: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  nowIso: string;
}

export interface UpdateUserInput {
  username?: string;
  displayName?: string;
  role?: 'tenant_admin' | 'tenant_member';
  isActive?: boolean;
  passwordHash?: string;
  nowIso: string;
}

export interface CreateFormInput {
  id: string;
  clientId: string;
  slug: string;
  title: string;
  description?: string;
  submitButtonText?: string;
  thankYouTitle?: string;
  thankYouMessage?: string;
  redirectUrl?: string;
  isPublished: boolean;
  fields: FormField[];
  nowIso: string;
}

export interface UpdateFormInput {
  slug?: string;
  title?: string;
  description?: string;
  submitButtonText?: string;
  thankYouTitle?: string;
  thankYouMessage?: string;
  redirectUrl?: string;
  isPublished?: boolean;
  fields?: FormField[];
  nowIso: string;
}

export interface ListFormsQuery {
  clientId?: string;
  search?: string;
}

export interface ListSubmissionsQuery {
  clientId?: string;
  formId?: string;
  search?: string;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateWebhookInput {
  id: string;
  formId: string;
  clientId: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  isActive: boolean;
  nowIso: string;
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  secret?: string;
  events?: WebhookEventType[];
  isActive?: boolean;
  nowIso: string;
}

export interface CreateWebhookDeliveryInput {
  id: string;
  webhookId: string;
  formId: string;
  clientId: string;
  submissionId: string | null;
  eventType: WebhookEventType;
  status: WebhookDeliveryStatus;
  requestPayload: Record<string, unknown>;
  attemptCount?: number;
  nowIso: string;
}

export interface UpdateWebhookDeliveryInput {
  status?: WebhookDeliveryStatus;
  responseStatus?: number | null;
  responseBody?: string | null;
  errorMessage?: string | null;
  attemptCount?: number;
  completedAt?: string | null;
}

export type PersistedForm = FormSchema;
export type PersistedTenant = ClientTenant;
export type PersistedSubmission = SubmissionRecord;
export type PersistedWebhook = FormWebhook;
export type PersistedWebhookDelivery = WebhookDelivery;

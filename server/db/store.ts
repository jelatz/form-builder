import type {
  ClientTenant,
  FormSchema,
  FormWebhook,
  SubmissionRecord,
  WebhookDelivery,
} from '../../src/domain/form-schema/types.ts';
import type {
  AuthContext,
  CreateFormInput,
  CreateTenantInput,
  CreateUserInput,
  CreateWebhookDeliveryInput,
  CreateWebhookInput,
  ListFormsQuery,
  ListSubmissionsQuery,
  PaginatedResult,
  PublicUser,
  SessionRecord,
  StoredUser,
  UpdateFormInput,
  UpdateTenantInput,
  UpdateUserInput,
  UpdateWebhookDeliveryInput,
  UpdateWebhookInput,
} from '../types.ts';

export interface AppStore {
  // Tenants
  listClients(): Promise<ClientTenant[]>;
  findClientById(id: string): Promise<ClientTenant | null>;
  findClientBySlug(slug: string): Promise<ClientTenant | null>;
  createClient(input: CreateTenantInput): Promise<ClientTenant>;
  updateClient(
    id: string,
    input: UpdateTenantInput,
  ): Promise<ClientTenant | null>;
  deleteClient(id: string): Promise<boolean>;

  // Users & Sessions
  findUserByUsername(username: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  listUsers(clientId?: string): Promise<PublicUser[]>;
  createUser(input: CreateUserInput): Promise<PublicUser>;
  updateUser(id: string, input: UpdateUserInput): Promise<PublicUser | null>;
  deleteUser(id: string): Promise<boolean>;

  createSession(session: SessionRecord): Promise<void>;
  findActiveSession(
    sessionIdHash: string,
    nowIso: string,
  ): Promise<AuthContext | null>;
  revokeSession(sessionIdHash: string, nowIso: string): Promise<void>;
  revokeUserSessions(userId: string, nowIso: string): Promise<void>;
  revokeTenantSessions(clientId: string, nowIso: string): Promise<void>;

  // Forms
  listForms(query?: ListFormsQuery): Promise<FormSchema[]>;
  findFormById(formId: string, clientId: string): Promise<FormSchema | null>;
  findFormBySlug(clientId: string, slug: string): Promise<FormSchema | null>;
  findPublishedFormBySlugs(
    tenantSlug: string,
    formSlug: string,
  ): Promise<{ tenant: ClientTenant; form: FormSchema } | null>;
  createForm(input: CreateFormInput): Promise<FormSchema>;
  updateForm(
    formId: string,
    clientId: string,
    input: UpdateFormInput,
  ): Promise<FormSchema | null>;
  deleteForm(formId: string, clientId: string): Promise<boolean>;

  // Submissions
  listSubmissions(
    query: ListSubmissionsQuery,
  ): Promise<PaginatedResult<SubmissionRecord>>;
  createSubmission(input: SubmissionRecord): Promise<SubmissionRecord>;
  deleteSubmission(submissionId: string, clientId: string): Promise<boolean>;
  clearFormSubmissions(formId: string, clientId: string): Promise<number>;

  // Webhooks & Deliveries
  listFormWebhooks(formId: string, clientId: string): Promise<FormWebhook[]>;
  findWebhookById(
    webhookId: string,
    clientId: string,
  ): Promise<FormWebhook | null>;
  createFormWebhook(input: CreateWebhookInput): Promise<FormWebhook>;
  updateFormWebhook(
    webhookId: string,
    clientId: string,
    input: UpdateWebhookInput,
  ): Promise<FormWebhook | null>;
  deleteFormWebhook(webhookId: string, clientId: string): Promise<boolean>;
  listWebhookDeliveries(
    formId: string,
    clientId: string,
    limit?: number,
  ): Promise<WebhookDelivery[]>;
  findWebhookDeliveryById(
    deliveryId: string,
    clientId: string,
  ): Promise<WebhookDelivery | null>;
  createWebhookDelivery(
    input: CreateWebhookDeliveryInput,
  ): Promise<WebhookDelivery>;
  updateWebhookDelivery(
    deliveryId: string,
    clientId: string,
    input: UpdateWebhookDeliveryInput,
  ): Promise<WebhookDelivery | null>;
}

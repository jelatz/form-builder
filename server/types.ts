import type {
  ClientTenant,
  FormField,
  FormSchema,
  SubmissionRecord,
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
  isPublished: boolean;
  fields: FormField[];
  nowIso: string;
}

export interface UpdateFormInput {
  slug?: string;
  title?: string;
  description?: string;
  submitButtonText?: string;
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

export type PersistedForm = FormSchema;
export type PersistedTenant = ClientTenant;
export type PersistedSubmission = SubmissionRecord;

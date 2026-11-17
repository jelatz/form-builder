import type {
  ClientTenant,
  FormSchema,
  SubmissionRecord,
} from '../../src/domain/form-schema/types.ts';
import type { AppStore } from '../db/store.ts';
import type {
  AuthContext,
  CreateFormInput,
  CreateTenantInput,
  CreateUserInput,
  ListFormsQuery,
  ListSubmissionsQuery,
  PaginatedResult,
  PublicUser,
  SessionRecord,
  StoredUser,
  UpdateFormInput,
  UpdateTenantInput,
  UpdateUserInput,
} from '../types.ts';

function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    clientId: user.clientId,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

/**
 * In-memory AppStore implementation for fast, hermetic Fastify API tests
 * (verifying routing, cookie handling, RBAC boundaries, and domain validation).
 */
export class InMemoryAppStore implements AppStore {
  private readonly clients = new Map<string, ClientTenant>();
  private readonly users = new Map<string, StoredUser>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly forms = new Map<string, FormSchema>();
  private readonly submissions = new Map<string, SubmissionRecord>();

  async listClients(): Promise<ClientTenant[]> {
    return [...this.clients.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }

  async findClientById(id: string): Promise<ClientTenant | null> {
    return this.clients.get(id) ?? null;
  }

  async findClientBySlug(slug: string): Promise<ClientTenant | null> {
    const normalized = slug.trim().toLowerCase();
    for (const client of this.clients.values()) {
      if (client.slug.toLowerCase() === normalized) {
        return client;
      }
    }
    return null;
  }

  async createClient(input: CreateTenantInput): Promise<ClientTenant> {
    const tenant: ClientTenant = {
      id: input.id,
      name: input.name,
      slug: input.slug,
      status: input.status,
      createdAt: input.nowIso,
    };
    this.clients.set(tenant.id, tenant);
    return tenant;
  }

  async updateClient(
    id: string,
    input: UpdateTenantInput,
  ): Promise<ClientTenant | null> {
    const existing = this.clients.get(id);
    if (!existing) return null;
    const updated: ClientTenant = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };
    this.clients.set(id, updated);
    return updated;
  }

  async deleteClient(id: string): Promise<boolean> {
    const existed = this.clients.delete(id);
    if (!existed) return false;
    for (const [uid, user] of this.users.entries()) {
      if (user.clientId === id) {
        this.users.delete(uid);
      }
    }
    for (const [sid, session] of this.sessions.entries()) {
      if (session.clientId === id) {
        this.sessions.delete(sid);
      }
    }
    for (const [fid, form] of this.forms.entries()) {
      if (form.clientId === id) {
        this.forms.delete(fid);
      }
    }
    for (const [subId, sub] of this.submissions.entries()) {
      if (sub.clientId === id) {
        this.submissions.delete(subId);
      }
    }
    return true;
  }

  async findUserByUsername(username: string): Promise<StoredUser | null> {
    const normalized = username.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.username.toLowerCase() === normalized) {
        return user;
      }
    }
    return null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    return this.users.get(id) ?? null;
  }

  async listUsers(clientId?: string): Promise<PublicUser[]> {
    return [...this.users.values()]
      .filter((user) => (clientId ? user.clientId === clientId : true))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toPublicUser);
  }

  async createUser(input: CreateUserInput): Promise<PublicUser> {
    const user: StoredUser = {
      id: input.id,
      clientId: input.clientId,
      username: input.username,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      role: input.role,
      isActive: input.isActive,
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    };
    this.users.set(user.id, user);
    return toPublicUser(user);
  }

  async updateUser(
    id: string,
    input: UpdateUserInput,
  ): Promise<PublicUser | null> {
    const existing = this.users.get(id);
    if (!existing) return null;
    const updated: StoredUser = {
      ...existing,
      ...(input.displayName !== undefined
        ? { displayName: input.displayName }
        : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.passwordHash !== undefined
        ? { passwordHash: input.passwordHash }
        : {}),
      updatedAt: input.nowIso,
    };
    this.users.set(id, updated);
    return toPublicUser(updated);
  }

  async deleteUser(id: string): Promise<boolean> {
    const existed = this.users.delete(id);
    if (!existed) return false;
    for (const [sid, session] of this.sessions.entries()) {
      if (session.userId === id) {
        this.sessions.delete(sid);
      }
    }
    return true;
  }

  async createSession(session: SessionRecord): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async findActiveSession(
    sessionIdHash: string,
    nowIso: string,
  ): Promise<AuthContext | null> {
    const session = this.sessions.get(sessionIdHash);
    if (!session || session.revokedAt !== null || session.expiresAt <= nowIso) {
      return null;
    }
    const user = this.users.get(session.userId);
    if (!user || !user.isActive) {
      return null;
    }
    const tenant = user.clientId
      ? (this.clients.get(user.clientId) ?? null)
      : null;
    if (tenant && tenant.status === 'suspended') {
      return null;
    }
    return {
      sessionId: session.id,
      user: toPublicUser(user),
      tenant,
    };
  }

  async revokeSession(sessionIdHash: string, nowIso: string): Promise<void> {
    const existing = this.sessions.get(sessionIdHash);
    if (existing) {
      this.sessions.set(sessionIdHash, { ...existing, revokedAt: nowIso });
    }
  }

  async revokeUserSessions(userId: string, nowIso: string): Promise<void> {
    for (const [sid, session] of this.sessions.entries()) {
      if (session.userId === userId && session.revokedAt === null) {
        this.sessions.set(sid, { ...session, revokedAt: nowIso });
      }
    }
  }

  async revokeTenantSessions(clientId: string, nowIso: string): Promise<void> {
    for (const [sid, session] of this.sessions.entries()) {
      if (session.revokedAt !== null) continue;
      const user = this.users.get(session.userId);
      if (session.clientId === clientId || user?.clientId === clientId) {
        this.sessions.set(sid, { ...session, revokedAt: nowIso });
      }
    }
  }

  async listForms(query?: ListFormsQuery): Promise<FormSchema[]> {
    const search = query?.search?.trim().toLowerCase();
    return [...this.forms.values()]
      .filter((form) => {
        if (query?.clientId && form.clientId !== query.clientId) return false;
        if (search) {
          const match =
            form.title.toLowerCase().includes(search) ||
            form.slug.toLowerCase().includes(search);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async findFormById(
    formId: string,
    clientId: string,
  ): Promise<FormSchema | null> {
    const form = this.forms.get(formId);
    if (!form || form.clientId !== clientId) return null;
    return form;
  }

  async findFormBySlug(
    clientId: string,
    slug: string,
  ): Promise<FormSchema | null> {
    const normalized = slug.trim().toLowerCase();
    for (const form of this.forms.values()) {
      if (
        form.clientId === clientId &&
        form.slug.toLowerCase() === normalized
      ) {
        return form;
      }
    }
    return null;
  }

  async findPublishedFormBySlugs(
    tenantSlug: string,
    formSlug: string,
  ): Promise<{ tenant: ClientTenant; form: FormSchema } | null> {
    const tenant = await this.findClientBySlug(tenantSlug);
    if (!tenant || tenant.status === 'suspended') return null;
    const form = await this.findFormBySlug(tenant.id, formSlug);
    if (!form || form.isPublished === false) return null;
    return { tenant, form };
  }

  async createForm(input: CreateFormInput): Promise<FormSchema> {
    const form: FormSchema = {
      id: input.id,
      clientId: input.clientId,
      slug: input.slug,
      title: input.title,
      description: input.description,
      submitButtonText: input.submitButtonText,
      isPublished: input.isPublished,
      fields: structuredClone(input.fields),
      updatedAt: input.nowIso,
    };
    this.forms.set(form.id, form);
    return form;
  }

  async updateForm(
    formId: string,
    clientId: string,
    input: UpdateFormInput,
  ): Promise<FormSchema | null> {
    const existing = this.forms.get(formId);
    if (!existing || existing.clientId !== clientId) return null;
    const updated: FormSchema = {
      ...existing,
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.submitButtonText !== undefined
        ? { submitButtonText: input.submitButtonText }
        : {}),
      ...(input.isPublished !== undefined
        ? { isPublished: input.isPublished }
        : {}),
      ...(input.fields !== undefined
        ? { fields: structuredClone(input.fields) }
        : {}),
      updatedAt: input.nowIso,
    };
    this.forms.set(formId, updated);
    return updated;
  }

  async deleteForm(formId: string, clientId: string): Promise<boolean> {
    const existing = this.forms.get(formId);
    if (!existing || existing.clientId !== clientId) return false;
    this.forms.delete(formId);
    for (const [subId, sub] of this.submissions.entries()) {
      if (sub.formId === formId && sub.clientId === clientId) {
        this.submissions.delete(subId);
      }
    }
    return true;
  }

  async listSubmissions(
    query: ListSubmissionsQuery,
  ): Promise<PaginatedResult<SubmissionRecord>> {
    const search = query.search?.trim().toLowerCase();
    const filtered = [...this.submissions.values()]
      .filter((sub) => {
        if (query.clientId && sub.clientId !== query.clientId) return false;
        if (query.formId && sub.formId !== query.formId) return false;
        if (search) {
          const text = JSON.stringify(sub.values).toLowerCase();
          if (!text.includes(search) && !sub.id.toLowerCase().includes(search)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

    return {
      items: filtered.slice(query.offset, query.offset + query.limit),
      total: filtered.length,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createSubmission(input: SubmissionRecord): Promise<SubmissionRecord> {
    const cloned = structuredClone(input);
    this.submissions.set(cloned.id, cloned);
    return cloned;
  }

  async deleteSubmission(
    submissionId: string,
    clientId: string,
  ): Promise<boolean> {
    const existing = this.submissions.get(submissionId);
    if (!existing || existing.clientId !== clientId) return false;
    return this.submissions.delete(submissionId);
  }

  async clearFormSubmissions(
    formId: string,
    clientId: string,
  ): Promise<number> {
    let deleted = 0;
    for (const [subId, sub] of this.submissions.entries()) {
      if (sub.formId === formId && sub.clientId === clientId) {
        this.submissions.delete(subId);
        deleted += 1;
      }
    }
    return deleted;
  }
}

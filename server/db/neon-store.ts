import { and, asc, desc, eq, gt, isNull, sql, type SQL } from 'drizzle-orm';
import type {
  ClientTenant,
  FormSchema,
  SubmissionRecord,
} from '../../src/domain/form-schema/types.ts';
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
import type { NeonDb } from './client.ts';
import { clients, forms, sessions, submissions, users } from './schema.ts';
import type { AppStore } from './store.ts';

function toClientTenant(row: typeof clients.$inferSelect): ClientTenant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function toPublicUser(row: typeof users.$inferSelect): PublicUser {
  return {
    id: row.id,
    clientId: row.clientId,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

function toStoredUser(row: typeof users.$inferSelect): StoredUser {
  return {
    ...toPublicUser(row),
    passwordHash: row.passwordHash,
    updatedAt: row.updatedAt,
  };
}

function toFormSchema(row: typeof forms.$inferSelect): FormSchema {
  return {
    id: row.id,
    clientId: row.clientId,
    slug: row.slug,
    title: row.title,
    description: row.description ?? undefined,
    submitButtonText: row.submitButtonText ?? undefined,
    isPublished: row.isPublished,
    fields: row.fields,
    updatedAt: row.updatedAt,
  };
}

function toSubmissionRecord(
  row: typeof submissions.$inferSelect,
): SubmissionRecord {
  return {
    id: row.id,
    formId: row.formId,
    clientId: row.clientId,
    values: row.values,
    submittedAt: row.submittedAt,
  };
}

export class NeonDrizzleStore implements AppStore {
  private readonly db: NeonDb;

  constructor(db: NeonDb) {
    this.db = db;
  }

  async listClients(): Promise<ClientTenant[]> {
    const rows = await this.db
      .select()
      .from(clients)
      .orderBy(asc(clients.name));
    return rows.map(toClientTenant);
  }

  async findClientById(id: string): Promise<ClientTenant | null> {
    const rows = await this.db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    return rows[0] ? toClientTenant(rows[0]) : null;
  }

  async findClientBySlug(slug: string): Promise<ClientTenant | null> {
    const rows = await this.db
      .select()
      .from(clients)
      .where(eq(clients.slug, slug))
      .limit(1);
    return rows[0] ? toClientTenant(rows[0]) : null;
  }

  async createClient(input: CreateTenantInput): Promise<ClientTenant> {
    const [row] = await this.db
      .insert(clients)
      .values({
        id: input.id,
        name: input.name,
        slug: input.slug,
        status: input.status,
        createdAt: input.nowIso,
        updatedAt: input.nowIso,
      })
      .returning();
    return toClientTenant(row!);
  }

  async updateClient(
    id: string,
    input: UpdateTenantInput,
  ): Promise<ClientTenant | null> {
    const patch: Partial<typeof clients.$inferInsert> = {
      updatedAt: input.nowIso,
    };
    if (input.name !== undefined) patch.name = input.name;
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.status !== undefined) patch.status = input.status;

    const [row] = await this.db
      .update(clients)
      .set(patch)
      .where(eq(clients.id, id))
      .returning();
    return row ? toClientTenant(row) : null;
  }

  async deleteClient(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning({ id: clients.id });
    return rows.length > 0;
  }

  async findUserByUsername(username: string): Promise<StoredUser | null> {
    const normalized = username.trim().toLowerCase();
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(sql`lower(${users.username})`, normalized))
      .limit(1);
    return rows[0] ? toStoredUser(rows[0]) : null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0] ? toStoredUser(rows[0]) : null;
  }

  async listUsers(clientId?: string): Promise<PublicUser[]> {
    const rows = clientId
      ? await this.db
          .select()
          .from(users)
          .where(eq(users.clientId, clientId))
          .orderBy(asc(users.username))
      : await this.db.select().from(users).orderBy(asc(users.username));
    return rows.map(toPublicUser);
  }

  async createUser(input: CreateUserInput): Promise<PublicUser> {
    const [row] = await this.db
      .insert(users)
      .values({
        id: input.id,
        clientId: input.clientId,
        username: input.username,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        role: input.role,
        isActive: input.isActive,
        createdAt: input.nowIso,
        updatedAt: input.nowIso,
      })
      .returning();
    return toPublicUser(row!);
  }

  async updateUser(
    id: string,
    input: UpdateUserInput,
  ): Promise<PublicUser | null> {
    const patch: Partial<typeof users.$inferInsert> = {
      updatedAt: input.nowIso,
    };
    if (input.displayName !== undefined) patch.displayName = input.displayName;
    if (input.role !== undefined) patch.role = input.role;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (input.passwordHash !== undefined) {
      patch.passwordHash = input.passwordHash;
    }

    const [row] = await this.db
      .update(users)
      .set(patch)
      .where(eq(users.id, id))
      .returning();
    return row ? toPublicUser(row) : null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return rows.length > 0;
  }

  async createSession(session: SessionRecord): Promise<void> {
    await this.db.insert(sessions).values(session);
  }

  async findActiveSession(
    sessionIdHash: string,
    nowIso: string,
  ): Promise<AuthContext | null> {
    const rows = await this.db
      .select({
        sessionId: sessions.id,
        user: users,
        tenant: clients,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .leftJoin(clients, eq(users.clientId, clients.id))
      .where(
        and(
          eq(sessions.id, sessionIdHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, nowIso),
          eq(users.isActive, true),
        ),
      )
      .limit(1);

    const match = rows[0];
    if (!match) return null;

    if (match.tenant && match.tenant.status === 'suspended') {
      return null;
    }

    return {
      sessionId: match.sessionId,
      user: toPublicUser(match.user),
      tenant: match.tenant ? toClientTenant(match.tenant) : null,
    };
  }

  async revokeSession(sessionIdHash: string, nowIso: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: nowIso })
      .where(eq(sessions.id, sessionIdHash));
  }

  async revokeUserSessions(userId: string, nowIso: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: nowIso })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  async listForms(query?: ListFormsQuery): Promise<FormSchema[]> {
    const conditions: SQL[] = [];
    if (query?.clientId) {
      conditions.push(eq(forms.clientId, query.clientId));
    }
    if (query?.search?.trim()) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        sql`(${forms.title} ILIKE ${pattern} OR ${forms.slug} ILIKE ${pattern})`,
      );
    }

    const rows =
      conditions.length > 0
        ? await this.db
            .select()
            .from(forms)
            .where(and(...conditions))
            .orderBy(desc(forms.updatedAt))
        : await this.db.select().from(forms).orderBy(desc(forms.updatedAt));

    return rows.map(toFormSchema);
  }

  async findFormById(
    formId: string,
    clientId: string,
  ): Promise<FormSchema | null> {
    const rows = await this.db
      .select()
      .from(forms)
      .where(and(eq(forms.id, formId), eq(forms.clientId, clientId)))
      .limit(1);
    return rows[0] ? toFormSchema(rows[0]) : null;
  }

  async findFormBySlug(
    clientId: string,
    slug: string,
  ): Promise<FormSchema | null> {
    const rows = await this.db
      .select()
      .from(forms)
      .where(and(eq(forms.clientId, clientId), eq(forms.slug, slug)))
      .limit(1);
    return rows[0] ? toFormSchema(rows[0]) : null;
  }

  async findPublishedFormBySlugs(
    tenantSlug: string,
    formSlug: string,
  ): Promise<{ tenant: ClientTenant; form: FormSchema } | null> {
    const rows = await this.db
      .select({ tenant: clients, form: forms })
      .from(forms)
      .innerJoin(clients, eq(forms.clientId, clients.id))
      .where(
        and(
          eq(clients.slug, tenantSlug),
          eq(clients.status, 'active'),
          eq(forms.slug, formSlug),
          eq(forms.isPublished, true),
        ),
      )
      .limit(1);

    const match = rows[0];
    if (!match) return null;

    return {
      tenant: toClientTenant(match.tenant),
      form: toFormSchema(match.form),
    };
  }

  async createForm(input: CreateFormInput): Promise<FormSchema> {
    const [row] = await this.db
      .insert(forms)
      .values({
        id: input.id,
        clientId: input.clientId,
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
        submitButtonText: input.submitButtonText ?? null,
        isPublished: input.isPublished,
        fields: input.fields,
        createdAt: input.nowIso,
        updatedAt: input.nowIso,
      })
      .returning();
    return toFormSchema(row!);
  }

  async updateForm(
    formId: string,
    clientId: string,
    input: UpdateFormInput,
  ): Promise<FormSchema | null> {
    const patch: Partial<typeof forms.$inferInsert> = {
      updatedAt: input.nowIso,
    };
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.submitButtonText !== undefined) {
      patch.submitButtonText = input.submitButtonText;
    }
    if (input.isPublished !== undefined) patch.isPublished = input.isPublished;
    if (input.fields !== undefined) patch.fields = input.fields;

    const [row] = await this.db
      .update(forms)
      .set(patch)
      .where(and(eq(forms.id, formId), eq(forms.clientId, clientId)))
      .returning();
    return row ? toFormSchema(row) : null;
  }

  async deleteForm(formId: string, clientId: string): Promise<boolean> {
    const rows = await this.db
      .delete(forms)
      .where(and(eq(forms.id, formId), eq(forms.clientId, clientId)))
      .returning({ id: forms.id });
    return rows.length > 0;
  }

  async listSubmissions(
    query: ListSubmissionsQuery,
  ): Promise<PaginatedResult<SubmissionRecord>> {
    const conditions: SQL[] = [];
    if (query.clientId) {
      conditions.push(eq(submissions.clientId, query.clientId));
    }
    if (query.formId) {
      conditions.push(eq(submissions.formId, query.formId));
    }
    if (query.search?.trim()) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        sql`(${submissions.id} ILIKE ${pattern} OR ${submissions.values}::text ILIKE ${pattern})`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(submissions)
      .where(whereClause);

    const rows = await this.db
      .select()
      .from(submissions)
      .where(whereClause)
      .orderBy(desc(submissions.submittedAt))
      .limit(query.limit)
      .offset(query.offset);

    return {
      items: rows.map(toSubmissionRecord),
      total: countRow?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createSubmission(input: SubmissionRecord): Promise<SubmissionRecord> {
    const [row] = await this.db
      .insert(submissions)
      .values({
        id: input.id,
        formId: input.formId,
        clientId: input.clientId,
        values: input.values,
        submittedAt: input.submittedAt,
      })
      .returning();
    return toSubmissionRecord(row!);
  }

  async deleteSubmission(
    submissionId: string,
    clientId: string,
  ): Promise<boolean> {
    const rows = await this.db
      .delete(submissions)
      .where(
        and(
          eq(submissions.id, submissionId),
          eq(submissions.clientId, clientId),
        ),
      )
      .returning({ id: submissions.id });
    return rows.length > 0;
  }

  async clearFormSubmissions(
    formId: string,
    clientId: string,
  ): Promise<number> {
    const rows = await this.db
      .delete(submissions)
      .where(
        and(eq(submissions.formId, formId), eq(submissions.clientId, clientId)),
      )
      .returning({ id: submissions.id });
    return rows.length;
  }
}

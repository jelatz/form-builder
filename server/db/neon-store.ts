import { and, asc, desc, eq, gt, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type {
  ClientTenant,
  FormField,
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
import type { NeonDb } from './client.ts';
import {
  clients,
  formWebhooks,
  forms,
  sessions,
  submissions,
  users,
  webhookDeliveries,
} from './schema.ts';
import type { AppStore } from './store.ts';

export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}

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

function applyPostSubmitMetadataToFields(
  fields: FormField[],
  meta: {
    thankYouTitle?: string;
    thankYouMessage?: string;
    redirectUrl?: string;
  },
): FormField[] {
  const hasMetaUpdate =
    meta.thankYouTitle !== undefined ||
    meta.thankYouMessage !== undefined ||
    meta.redirectUrl !== undefined;
  if (!hasMetaUpdate) return fields;

  const sectionIndex = fields.findIndex((f) => f.type === 'section');
  if (sectionIndex === -1) return fields;

  const target = fields[sectionIndex];
  if (!target || target.type !== 'section') return fields;

  const nextSection = {
    ...target,
    ...(meta.thankYouTitle !== undefined
      ? { thankYouTitle: meta.thankYouTitle || undefined }
      : {}),
    ...(meta.thankYouMessage !== undefined
      ? { thankYouMessage: meta.thankYouMessage || undefined }
      : {}),
    ...(meta.redirectUrl !== undefined
      ? { redirectUrl: meta.redirectUrl || undefined }
      : {}),
  };

  return fields.map((f, idx) => (idx === sectionIndex ? nextSection : f));
}

function toFormSchema(row: typeof forms.$inferSelect): FormSchema {
  const carrier = row.fields.find((f) => f.type === 'section');
  return {
    id: row.id,
    clientId: row.clientId,
    slug: row.slug,
    title: row.title,
    description: row.description ?? undefined,
    submitButtonText: row.submitButtonText ?? undefined,
    thankYouTitle:
      carrier?.type === 'section' && carrier.thankYouTitle
        ? carrier.thankYouTitle
        : undefined,
    thankYouMessage:
      carrier?.type === 'section' && carrier.thankYouMessage
        ? carrier.thankYouMessage
        : undefined,
    redirectUrl:
      carrier?.type === 'section' && carrier.redirectUrl
        ? carrier.redirectUrl
        : undefined,
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

function toFormWebhook(row: typeof formWebhooks.$inferSelect): FormWebhook {
  return {
    id: row.id,
    formId: row.formId,
    clientId: row.clientId,
    name: row.name,
    url: row.url,
    secret: row.secret,
    events: row.events,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toWebhookDelivery(
  row: typeof webhookDeliveries.$inferSelect,
): WebhookDelivery {
  return {
    id: row.id,
    webhookId: row.webhookId,
    formId: row.formId,
    clientId: row.clientId,
    submissionId: row.submissionId,
    eventType: row.eventType,
    status: row.status,
    requestPayload: row.requestPayload,
    responseStatus: row.responseStatus,
    responseBody: row.responseBody,
    errorMessage: row.errorMessage,
    attemptCount: row.attemptCount,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
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
    if (input.username !== undefined) patch.username = input.username;
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

  async revokeTenantSessions(clientId: string, nowIso: string): Promise<void> {
    const tenantUsers = this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clientId, clientId));

    await this.db
      .update(sessions)
      .set({ revokedAt: nowIso })
      .where(
        and(
          isNull(sessions.revokedAt),
          or(
            eq(sessions.clientId, clientId),
            inArray(sessions.userId, tenantUsers),
          ),
        ),
      );
  }

  async listForms(query?: ListFormsQuery): Promise<FormSchema[]> {
    const conditions: SQL[] = [];
    if (query?.clientId) {
      conditions.push(eq(forms.clientId, query.clientId));
    }
    if (query?.search?.trim()) {
      const pattern = `%${escapeLikePattern(query.search.trim())}%`;
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
    const hydratedFields = applyPostSubmitMetadataToFields(input.fields, {
      thankYouTitle: input.thankYouTitle,
      thankYouMessage: input.thankYouMessage,
      redirectUrl: input.redirectUrl,
    });
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
        fields: hydratedFields,
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

    const hasPostSubmitUpdate =
      input.thankYouTitle !== undefined ||
      input.thankYouMessage !== undefined ||
      input.redirectUrl !== undefined;

    if (input.fields !== undefined) {
      patch.fields = applyPostSubmitMetadataToFields(input.fields, {
        thankYouTitle: input.thankYouTitle,
        thankYouMessage: input.thankYouMessage,
        redirectUrl: input.redirectUrl,
      });
    } else if (hasPostSubmitUpdate) {
      const existing = await this.findFormById(formId, clientId);
      if (!existing) return null;
      patch.fields = applyPostSubmitMetadataToFields(existing.fields, {
        thankYouTitle: input.thankYouTitle,
        thankYouMessage: input.thankYouMessage,
        redirectUrl: input.redirectUrl,
      });
    }

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
      const pattern = `%${escapeLikePattern(query.search.trim())}%`;
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

  async listFormWebhooks(
    formId: string,
    clientId: string,
  ): Promise<FormWebhook[]> {
    const rows = await this.db
      .select()
      .from(formWebhooks)
      .where(
        and(
          eq(formWebhooks.formId, formId),
          eq(formWebhooks.clientId, clientId),
        ),
      )
      .orderBy(desc(formWebhooks.createdAt));
    return rows.map(toFormWebhook);
  }

  async findWebhookById(
    webhookId: string,
    clientId: string,
  ): Promise<FormWebhook | null> {
    const rows = await this.db
      .select()
      .from(formWebhooks)
      .where(
        and(
          eq(formWebhooks.id, webhookId),
          eq(formWebhooks.clientId, clientId),
        ),
      )
      .limit(1);
    return rows[0] ? toFormWebhook(rows[0]) : null;
  }

  async createFormWebhook(input: CreateWebhookInput): Promise<FormWebhook> {
    const [row] = await this.db
      .insert(formWebhooks)
      .values({
        id: input.id,
        formId: input.formId,
        clientId: input.clientId,
        name: input.name,
        url: input.url,
        secret: input.secret,
        events: input.events,
        isActive: input.isActive,
        createdAt: input.nowIso,
        updatedAt: input.nowIso,
      })
      .returning();
    return toFormWebhook(row!);
  }

  async updateFormWebhook(
    webhookId: string,
    clientId: string,
    input: UpdateWebhookInput,
  ): Promise<FormWebhook | null> {
    const patch: Partial<typeof formWebhooks.$inferInsert> = {
      updatedAt: input.nowIso,
    };
    if (input.name !== undefined) patch.name = input.name;
    if (input.url !== undefined) patch.url = input.url;
    if (input.secret !== undefined) patch.secret = input.secret;
    if (input.events !== undefined) patch.events = input.events;
    if (input.isActive !== undefined) patch.isActive = input.isActive;

    const [row] = await this.db
      .update(formWebhooks)
      .set(patch)
      .where(
        and(
          eq(formWebhooks.id, webhookId),
          eq(formWebhooks.clientId, clientId),
        ),
      )
      .returning();
    return row ? toFormWebhook(row) : null;
  }

  async deleteFormWebhook(
    webhookId: string,
    clientId: string,
  ): Promise<boolean> {
    const rows = await this.db
      .delete(formWebhooks)
      .where(
        and(
          eq(formWebhooks.id, webhookId),
          eq(formWebhooks.clientId, clientId),
        ),
      )
      .returning({ id: formWebhooks.id });
    return rows.length > 0;
  }

  async listWebhookDeliveries(
    formId: string,
    clientId: string,
    limit = 50,
  ): Promise<WebhookDelivery[]> {
    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.formId, formId),
          eq(webhookDeliveries.clientId, clientId),
        ),
      )
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);
    return rows.map(toWebhookDelivery);
  }

  async findWebhookDeliveryById(
    deliveryId: string,
    clientId: string,
  ): Promise<WebhookDelivery | null> {
    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.id, deliveryId),
          eq(webhookDeliveries.clientId, clientId),
        ),
      )
      .limit(1);
    return rows[0] ? toWebhookDelivery(rows[0]) : null;
  }

  async createWebhookDelivery(
    input: CreateWebhookDeliveryInput,
  ): Promise<WebhookDelivery> {
    const [row] = await this.db
      .insert(webhookDeliveries)
      .values({
        id: input.id,
        webhookId: input.webhookId,
        formId: input.formId,
        clientId: input.clientId,
        submissionId: input.submissionId,
        eventType: input.eventType,
        status: input.status,
        requestPayload: input.requestPayload,
        attemptCount: input.attemptCount ?? 1,
        createdAt: input.nowIso,
      })
      .returning();
    return toWebhookDelivery(row!);
  }

  async updateWebhookDelivery(
    deliveryId: string,
    clientId: string,
    input: UpdateWebhookDeliveryInput,
  ): Promise<WebhookDelivery | null> {
    const patch: Partial<typeof webhookDeliveries.$inferInsert> = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.responseStatus !== undefined) {
      patch.responseStatus = input.responseStatus;
    }
    if (input.responseBody !== undefined) patch.responseBody = input.responseBody;
    if (input.errorMessage !== undefined) patch.errorMessage = input.errorMessage;
    if (input.attemptCount !== undefined) patch.attemptCount = input.attemptCount;
    if (input.completedAt !== undefined) patch.completedAt = input.completedAt;

    const [row] = await this.db
      .update(webhookDeliveries)
      .set(patch)
      .where(
        and(
          eq(webhookDeliveries.id, deliveryId),
          eq(webhookDeliveries.clientId, clientId),
        ),
      )
      .returning();
    return row ? toWebhookDelivery(row) : null;
  }
}

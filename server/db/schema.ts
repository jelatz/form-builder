import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { FormField } from '../../src/domain/form-schema/types.ts';

export const clients = pgTable('clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: text('status', { enum: ['active', 'suspended'] })
    .notNull()
    .default('active'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id').references(() => clients.id, {
      onDelete: 'cascade',
    }),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', {
      enum: ['superadmin', 'tenant_admin', 'tenant_member'],
    }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('users_username_lower_uidx').on(sql`lower(${table.username})`),
    index('users_client_id_idx').on(table.clientId),
    check(
      'users_role_client_chk',
      sql`(${table.role} = 'superadmin' AND ${table.clientId} IS NULL) OR (${table.role} IN ('tenant_admin', 'tenant_member') AND ${table.clientId} IS NOT NULL)`,
    ),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: text('client_id').references(() => clients.id, {
      onDelete: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    revokedAt: timestamp('revoked_at', {
      withTimezone: true,
      mode: 'string',
    }),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const forms = pgTable(
  'forms',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    submitButtonText: text('submit_button_text'),
    fields: jsonb('fields').$type<FormField[]>().notNull().default([]),
    isPublished: boolean('is_published').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('forms_client_slug_uidx').on(table.clientId, table.slug),
    unique('forms_id_client_uniq').on(table.id, table.clientId),
  ],
);

export const submissions = pgTable(
  'submissions',
  {
    id: text('id').primaryKey(),
    formId: text('form_id').notNull(),
    clientId: text('client_id').notNull(),
    values: jsonb('values').$type<Record<string, unknown>>().notNull(),
    submittedAt: timestamp('submitted_at', {
      withTimezone: true,
      mode: 'string',
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.formId, table.clientId],
      foreignColumns: [forms.id, forms.clientId],
      name: 'submissions_form_client_fk',
    }).onDelete('cascade'),
    index('submissions_client_form_date_idx').on(
      table.clientId,
      table.formId,
      table.submittedAt,
    ),
  ],
);

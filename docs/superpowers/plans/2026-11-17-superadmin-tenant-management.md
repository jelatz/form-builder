# Superadmin Tenant Information & Credentials Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable superadmins to modify all tenant workspace information (`name`, `slug`, `status`) and tenant user credentials/profiles (`username`, `displayName`, `role`, `isActive`, manual or generated `password`, and optional credential email delivery) across the Fastify API, Drizzle/Neon store, and React UI.

**Architecture:** Backend changes preserve `Controller -> DTO -> Action -> Store` separation in `server/modules/admin/` and add `revokeTenantSessions` to `AppStore` so suspending a tenant immediately invalidates active sessions. Frontend changes unify error-aware async mutations in `src/features/tenant-submissions/storage.ts` and `src/App.tsx`, upgrade `EditTenantModal` (`name`, `slug`, `status`, workspace URL preview, link to team credentials) and `TenantUsersModal` (inline edit for `username`/`displayName`/`role`, custom or generated 16-char hex password reset, one-time copyable credential banner, optional email dispatch), and expose tenant slug/status badges and credentials actions in both `TenantsDirectoryPanel` and `TenantDashboardPanel`.

**Tech Stack:** TypeScript 6 (`verbatimModuleSyntax`, `erasableSyntaxOnly`), Fastify 5, Drizzle ORM + Neon Postgres, Node `node:test` (`tsx --test`), React 19, Vite 8, Tailwind CSS v4.

**Spec:** User request ("ability as superadmin to modify the tenant information, credentials etc"), governed by `GEMINI.md` and `DESIGN.md`.

## Global Constraints

- **TypeScript 6 Guardrails (`GEMINI.md` §3):** `verbatimModuleSyntax: true` (always use `import type`), `erasableSyntaxOnly: true` (no `enum`, `namespace`, or parameter properties), zero `any` or `as unknown as T`, zero unused locals/parameters.
- **Layer & Dependency Direction (`GEMINI.md` §1):** `App.tsx` -> `features/*` -> `fields/*` -> `domain/*` -> `shared/*`; backend `Controller -> DTO -> Action -> Store` with `requireSuperadmin` on all `/api/admin/*` routes.
- **No Raw `<select>` (`GEMINI.md` §2 Principle 8, `DESIGN.md` §3):** Every dropdown in modals and panels must use `Select` or `FilterDropdown` from `src/shared/ui/index.tsx`.
- **Visual Tokens (`DESIGN.md`):** Neutral `zinc` palette, `h-9` / `h-8` / `h-7` controls, `rounded-md` / `rounded-lg` max radius, `font-mono text-xs uppercase` badges, no neon/purple gradients or `rounded-2xl`.
- **Verification Gate (`GEMINI.md` §4 & `package.json`):** `npm run test:api`, `npm run build`, and `npm run lint` must all exit `0`.

## Review Focus

1. **Invalid or empty `slug` on `PATCH /api/admin/tenants/:tenantId` (`"   "` or `"!!!"`)** — Must fail with HTTP `400` and `fieldErrors.slug` rather than normalizing to `"tenant"` or succeeding with an empty slug. *(Pinned in Task 1)*
2. **Explicit `slug` collision on `PATCH /api/admin/tenants/:tenantId` (updating Tenant B's slug to Tenant A's slug)** — Must fail with HTTP `409` instead of silently rewriting the slug to `"-2"` behind the superadmin's back. *(Pinned in Task 1)*
3. **Suspending an active tenant while users hold valid sessions (`status: 'suspended'`)** — Must immediately invalidate existing sessions (`GET /api/auth/me` -> `401`), block new logins (`403`), and hide public forms (`404`) in both `InMemoryAppStore` and `NeonDrizzleStore`. *(Pinned in Task 1)*
4. **Case-insensitive `username` collision or `superadmin` targeting on `PATCH /api/admin/users/:userId` and `POST /api/admin/users/:userId/reset-credentials`** — Renaming a user to an existing username differing only in case (e.g., `"ACME_ADMIN"`) must return HTTP `409`; targeting a `superadmin` account must return HTTP `403`. *(Pinned in Task 2)*
5. **Re-sending / generating credentials with invalid email or non-empty whitespace password** — `POST /api/admin/users/:userId/reset-credentials` must reject malformed `email` (`400`) and short `password` (`< 8` chars, `400`), and cleanly sanitize tenant edit payloads in shared client helpers without mutating input objects. *(Pinned in Task 2 & Task 3)*

---

### Task 1: Backend Tenant Info Update, Slug Conflict Detection & Suspension Session Revocation

**Files:**
- Modify: `server/db/store.ts:42-49`
- Modify: `server/db/neon-store.ts:283-289`
- Modify: `server/test/in-memory-store.ts:194-229`
- Modify: `server/modules/admin/dto.ts:76-119`
- Modify: `server/modules/admin/actions.ts:157-188`
- Test: `server/test/api.test.ts`

**Interfaces:**
- Consumes: `slugify` (`server/lib/slug.ts`), `requireSuperadmin` (`server/middleware/rbac.ts`), `ClientTenant` (`src/domain/form-schema/types.ts`).
- Produces:
  - `AppStore.revokeTenantSessions(clientId: string, nowIso: string): Promise<void>`
  - `validateUpdateTenantDto(raw: unknown): ValidationResult<UpdateTenantDto>` (rejects empty/unslugifiable `slug` with `fieldErrors.slug`, requires at least one updatable field)
  - `updateTenantAction(store: AppStore, tenantId: string, dto: UpdateTenantDto): Promise<ActionResult<ClientTenant>>` (returns `409` on slug conflict with another tenant; revokes tenant sessions when `status === 'suspended'`).

- [ ] **Step 1: Write the failing API tests for tenant update, slug conflict, invalid slug, and suspension**

Add a test in `server/test/api.test.ts` covering:
- `PATCH /api/admin/tenants/:tenantId` with `{ name, slug, status }`:
  - Rejects empty `{}` (`400`) and non-alphanumeric slug `"!!!"` (`400` with `fieldErrors.slug`).
  - Rejects changing `tenant_globex` slug to `'acme-corp'` (`409`).
  - Succeeds when updating `name` and `slug` of a tenant, and reflects the new slug on `GET /api/public/tenants/:newSlug` (`200`) while old slug returns `404`.
  - When updating `status: 'suspended'` on a tenant whose user (`acme_admin`) holds an active session cookie:
    - Existing session `GET /api/auth/me` immediately returns `401`.
    - Subsequent `POST /api/auth/login` for `acme_admin` returns `403`.
    - Public form `GET /api/public/forms/:tenantSlug/:formSlug` returns `404`.
  - Re-activating (`status: 'active'`) restores `POST /api/auth/login` (`200`) and public form access (`200`).
  - Non-superadmin receives `403` on `PATCH /api/admin/tenants/:tenantId`.

- [ ] **Step 2: Run the API test suite to verify the new test fails**

Run: `npm run test:api`
Expected: FAIL — `PATCH /api/admin/tenants/tenant_globex` with `slug: 'acme-corp'` returns `200` with `'acme-corp-2'` instead of `409`, empty `{}` / `'!!!'` returns `200`, and `InMemoryAppStore.findActiveSession` does not invalidate sessions when `tenant.status === 'suspended'`.

- [ ] **Step 3: Add `revokeTenantSessions` to `AppStore` and both store implementations**

- In `server/db/store.ts`, add `revokeTenantSessions(clientId: string, nowIso: string): Promise<void>;` under `// Users & Sessions`.
- In `server/db/neon-store.ts`:
  - Import `inArray` from `'drizzle-orm'` if not already imported.
  - Implement `revokeTenantSessions(clientId: string, nowIso: string)`: update `sessions` setting `revokedAt: nowIso` where `revokedAt IS NULL` and (`sessions.clientId = clientId` OR `sessions.userId IN (select id from users where clientId = clientId)`).
- In `server/test/in-memory-store.ts`:
  - Fix `findActiveSession`: after resolving `tenant`, if `tenant && tenant.status === 'suspended'`, return `null` (matching `NeonDrizzleStore`).
  - Implement `revokeTenantSessions(clientId: string, nowIso: string)`: revoke all unrevoked sessions where `session.clientId === clientId` or whose `this.users.get(session.userId)?.clientId === clientId`.

- [ ] **Step 4: Harden `validateUpdateTenantDto` and `updateTenantAction`**

- In `server/modules/admin/dto.ts`:
  - Import `slugify` from `'../../lib/slug.ts'`.
  - In `validateUpdateTenantDto`:
    - When `body.slug !== undefined`: require `typeof body.slug === 'string'`, compute `const normalized = slugify(body.slug, '')`; if `!normalized`, return `{ ok: false, error: 'Tenant slug must contain at least one letter or number.', fieldErrors: { slug: 'Tenant slug must contain at least one letter or number.' } }`; set `data.slug = normalized`.
    - After checking `name`, `slug`, and `status`, if `data.name === undefined && data.slug === undefined && data.status === undefined`, return `{ ok: false, error: 'At least one tenant field (name, slug, or status) must be provided.' }`.
- In `server/modules/admin/actions.ts`:
  - In `updateTenantAction(store, tenantId, dto)`:
    - Look up `existing = await store.findClientById(tenantId)`; return `404` if missing.
    - If `dto.slug !== undefined` and `dto.slug !== existing.slug`: check `const conflict = await store.findClientBySlug(dto.slug)`; if `conflict && conflict.id !== tenantId`, return `{ ok: false, statusCode: 409, error: \`Tenant slug "${dto.slug}" is already in use.\` }`.
    - Call `store.updateClient(tenantId, { name: dto.name, slug: dto.slug, status: dto.status, nowIso })`.
    - If `dto.status === 'suspended'`, call `await store.revokeTenantSessions(tenantId, nowIso)`.

- [ ] **Step 5: Run tests, build, and lint**

Run: `npm run test:api && npm run build && npm run lint`
Expected: All existing + new Task 1 tests PASS; `tsc -b`, `tsc -p tsconfig.server.json`, `vite build`, and `eslint .` exit `0`.

- [ ] **Step 6: Commit Task 1**

```bash
git add server/db/store.ts server/db/neon-store.ts server/test/in-memory-store.ts server/modules/admin/dto.ts server/modules/admin/actions.ts server/test/api.test.ts
git commit -m "feat(admin): enforce tenant slug uniqueness and session revocation on suspend"
```

---

### Task 2: Backend Tenant User Profile & Credentials Modification (`username`, `displayName`, `role`, `isActive`, `password`, and `reset-credentials`)

**Files:**
- Modify: `server/types.ts:72-78`
- Modify: `server/db/neon-store.ts:205-225`
- Modify: `server/test/in-memory-store.ts:157-177`
- Modify: `server/modules/admin/dto.ts:27-33,179-229`
- Modify: `server/modules/admin/actions.ts:252-290`
- Modify: `server/modules/admin/controller.ts:119-138`
- Test: `server/test/api.test.ts`

**Interfaces:**
- Consumes: `USERNAME_PATTERN`, `EMAIL_PATTERN` (`src/shared/lib/username.ts`), `generateHexPassword`, `hashPassword` (`server/lib/crypto.ts`), `EmailService`, `EmailDeliveryResult` (`server/lib/email.ts`).
- Produces:
  - `UpdateUserInput` with `username?: string`
  - `UpdateTenantUserDto` with `username?: string; displayName?: string; role?: 'tenant_admin' | 'tenant_member'; isActive?: boolean; password?: string`
  - `ResetUserCredentialsDto` (`{ password?: string; email?: string }`) & `validateResetUserCredentialsDto(raw: unknown): ValidationResult<ResetUserCredentialsDto>`
  - `ResetUserCredentialsResult` (`{ user: PublicUser; generatedPassword?: string; emailDelivery?: EmailDeliveryResult }`)
  - `POST /api/admin/users/:userId/reset-credentials` endpoint in `registerAdminRoutes`

- [ ] **Step 1: Write failing API tests for editing user `username`, `displayName`, `role`, and resetting/emailing credentials**

Add tests in `server/test/api.test.ts` covering:
- `PATCH /api/admin/users/:userId`:
  - Updates `username`, `displayName`, and `role` (`tenant_member` <-> `tenant_admin`), revoking old session when `username` changes, and allowing login with the new `username`.
  - Rejects invalid `username` (`"ab"`, `"bad user"`) with `400` and `fieldErrors.username`.
  - Rejects case-insensitive duplicate `username` (e.g., `"ACME_ADMIN"`) with `409`.
  - Rejects empty `{}` payload with `400`.
  - Rejects modifying a `superadmin` user with `403`.
- `POST /api/admin/users/:userId/reset-credentials`:
  - Without `password`: generates a 16-char hex password (`generatedPassword`), hashes & persists it, revokes prior sessions, and allows login with the generated password.
  - With `email` (and spy `EmailService`): sends welcome/credentials email containing the tenant's login URL (`/t/<slug>/login`), updated `username`, and new password, returning `emailDelivery`.
  - With explicit `password` (`>= 8` chars): persists the specified password without returning `generatedPassword` (or returns only `user` and optional `emailDelivery`), and rejects `< 8` char password or invalid `email` with `400` + `fieldErrors`.
  - Rejects targeting a `superadmin` account with `403`, and non-superadmin callers with `403`.

- [ ] **Step 2: Run the API test suite to verify the new tests fail**

Run: `npm run test:api`
Expected: FAIL — `username` is ignored by `PATCH /api/admin/users/:userId`, and `POST /api/admin/users/:userId/reset-credentials` returns `404`.

- [ ] **Step 3: Extend `UpdateUserInput`, `NeonDrizzleStore.updateUser`, and `InMemoryAppStore.updateUser` to support `username`**

- In `server/types.ts:72-78`: add `username?: string;` to `UpdateUserInput`.
- In `server/db/neon-store.ts:205-225`: add `if (input.username !== undefined) patch.username = input.username;`.
- In `server/test/in-memory-store.ts:157-177`: add `...(input.username !== undefined ? { username: input.username } : {}),`.

- [ ] **Step 4: Extend `admin/dto.ts`, `admin/actions.ts`, and `admin/controller.ts`**

- In `server/modules/admin/dto.ts`:
  - Add `username?: string` to `UpdateTenantUserDto`.
  - Update `validateUpdateTenantUserDto` to validate `username` against `USERNAME_PATTERN`, populate `fieldErrors` for `username`, `displayName`, `role`, `isActive`, and `password`, and reject empty payloads (`400` if no fields set).
  - Add `ResetUserCredentialsDto` (`{ password?: string; email?: string }`) and `validateResetUserCredentialsDto(raw: unknown): ValidationResult<ResetUserCredentialsDto>`:
    - If `raw !== undefined && (typeof raw !== 'object' || raw === null)`, return `400`.
    - Validate optional `password` (`typeof === 'string' && length >= 8`, else `fieldErrors.password`).
    - Validate optional `email` (`EMAIL_PATTERN`, trimmed & lowercased, else `fieldErrors.email`).
- In `server/modules/admin/actions.ts`:
  - Update `updateTenantUserAction(store, userId, dto)`:
    - If `dto.username !== undefined`: check `const conflict = await store.findUserByUsername(dto.username)`; if `conflict && conflict.id !== userId`, return `{ ok: false, statusCode: 409, error: \`Username "${dto.username}" is already taken.\` }`.
    - Pass `username: dto.username` to `store.updateUser`.
    - Revoke user sessions when `dto.isActive === false || dto.password !== undefined || dto.username !== undefined`.
  - Add `resetTenantUserCredentialsAction(store, userId, dto, deps: CreateTenantDependencies): Promise<ActionResult<ResetUserCredentialsResult>>`:
    - Fetch `existing = await store.findUserById(userId)`; return `404` if missing, `403` if `existing.role === 'superadmin'` or `!existing.clientId`.
    - Fetch `tenant = await store.findClientById(existing.clientId)`; return `404` if missing.
    - Determine `rawPassword = dto.password ?? generateHexPassword()` and `isGenerated = dto.password === undefined`.
    - Hash password, update user (`passwordHash`, `nowIso`), and revoke user sessions (`store.revokeUserSessions(userId, nowIso)`).
    - If `dto.email` is provided, call `deps.emailService.sendTenantWelcomeEmail({ to: dto.email, tenantName: tenant.name, tenantSlug: tenant.slug, username: updated.username, password: rawPassword, loginUrl: \`${deps.appOrigin.replace(/\/+$/, '')}/t/${tenant.slug}/login\` })`.
    - Return `{ ok: true, data: { user: updated, ...(isGenerated ? { generatedPassword: rawPassword } : {}), ...(emailDelivery ? { emailDelivery } : {}) } }`.
- In `server/modules/admin/controller.ts`:
  - Include `fieldErrors: parsed.fieldErrors` in `PATCH /api/admin/users/:userId` 400 response.
  - Register `POST /api/admin/users/:userId/reset-credentials` gated by `requireSuperadmin`, validating with `validateResetUserCredentialsDto`, calling `resetTenantUserCredentialsAction`, and returning `200` on success.

- [ ] **Step 5: Run tests, build, and lint**

Run: `npm run test:api && npm run build && npm run lint`
Expected: All tests PASS; build and lint exit `0`.

- [ ] **Step 6: Commit Task 2**

```bash
git add server/types.ts server/db/neon-store.ts server/test/in-memory-store.ts server/modules/admin/dto.ts server/modules/admin/actions.ts server/modules/admin/controller.ts server/test/api.test.ts
git commit -m "feat(admin): allow modifying tenant usernames and resetting/emailing credentials"
```

---

### Task 3: Frontend Storage Adapter, Pure Tenant Payload Helpers & `App.tsx` Mutation Wiring

**Files:**
- Modify: `src/features/tenant-submissions/tenant-utils.ts`
- Modify: `src/features/tenant-submissions/storage.ts:65-143`
- Modify: `src/App.tsx:912-1033,2156-2188`
- Create: `server/test/tenant-management.test.ts`

**Interfaces:**
- Consumes: `apiRequest` (`src/shared/lib/http.ts`), `USERNAME_PATTERN`, `EMAIL_PATTERN` (`src/shared/lib/username.ts`), `ClientTenant` (`src/domain/form-schema`).
- Produces:
  - `EmailDeliveryResult` type in `src/features/tenant-submissions/storage.ts`
  - `ResetUserCredentialsResponse` (`{ user: ManagedTenantUser; generatedPassword?: string; emailDelivery?: EmailDeliveryResult }`)
  - `apiResetTenantUserCredentials(userId: string, input: { password?: string; email?: string }): Promise<ResetUserCredentialsResponse>`
  - `apiUpdateTenantUser(userId: string, input: { username?: string; displayName?: string; role?: 'tenant_admin' | 'tenant_member'; isActive?: boolean; password?: string }): Promise<ManagedTenantUser>`
  - Pure validation/helper functions in `src/features/tenant-submissions/tenant-utils.ts`:
    - `validateEditTenantInput(input: { name: string; slug: string; status: 'active' | 'suspended' }, tenants: readonly ClientTenant[], tenantId: string): { ok: true; data: { name: string; slug: string; status: 'active' | 'suspended' } } | { ok: false; error: string }`
    - `validateEditTenantUserInput(input: { username: string; displayName: string; role: 'tenant_admin' | 'tenant_member' }): { ok: true; data: { username: string; displayName: string; role: 'tenant_admin' | 'tenant_member' } } | { ok: false; error: string }`
  - `App.tsx`: `handleUpdateTenant(tenantId, input): Promise<void>`, `handleUpdateTenantUser(userId, input): Promise<void>` (with `handleResetTenantUserCredentials` wired in Task 6)

- [ ] **Step 1: Write failing unit tests for `validateEditTenantInput` and `validateEditTenantUserInput`**

Create `server/test/tenant-management.test.ts` testing:
- `validateEditTenantInput`:
  - Rejects `name` shorter than 2 chars (`"A"`).
  - Rejects empty/unslugifiable `slug` (`"   "`, `"!!!"`).
  - Rejects `slug` colliding with another tenant (`excludeTenantId` check).
  - Allows keeping the same tenant's own `slug` and normalizes mixed case/spaces (e.g. `" Acme Cloud "` -> `"acme-cloud"`).
- `validateEditTenantUserInput`:
  - Rejects invalid `username` (`"ab"`, `"bad name"`) and short `displayName` (`"X"`).
  - Trims `username` and `displayName` cleanly without mutating the input object.

- [ ] **Step 2: Run the API/unit test suite to verify it fails**

Run: `npm run test:api`
Expected: FAIL — `validateEditTenantInput` and `validateEditTenantUserInput` are not exported from `tenant-utils.ts`.

- [ ] **Step 3: Implement pure validation helpers in `src/features/tenant-submissions/tenant-utils.ts`**

Add `validateEditTenantInput` and `validateEditTenantUserInput` using `sanitizeTenantSlug` and `USERNAME_PATTERN` from `../../shared/lib/username` (no React/DOM imports so Node `tsx --test` runs them cleanly, matching `router.test.ts`).

- [ ] **Step 4: Update `src/features/tenant-submissions/storage.ts` and `src/App.tsx`**

- In `storage.ts`:
  - Export `EmailDeliveryResult` and `ResetUserCredentialsResponse`.
  - Add `username?: string` to `apiUpdateTenantUser`.
  - Add `apiResetTenantUserCredentials(userId, input)` calling `POST /api/admin/users/${encodeURIComponent(userId)}/reset-credentials`.
- In `App.tsx`:
  - Convert `handleUpdateTenant` to `async (tenantId: string, input: { name: string; slug: string; status?: 'active' | 'suspended' }): Promise<void>`: call `await apiUpdateTenant(tenantId, input)`, update `tenants` state with the persisted `ClientTenant`, and re-throw errors so `EditTenantModal` shows inline errors instead of silently closing.
  - Extend `handleUpdateTenantUser` input type with `username?: string; displayName?: string`.
  - *(Note: `handleResetTenantUserCredentials` and panel props are wired in Task 6 once `TenantDashboardPanelProps` and `TenantsDirectoryPanelProps` are extended, keeping Task 3 free of `noUnusedLocals` TypeScript errors.)*

- [ ] **Step 5: Run tests, build, and lint**

Run: `npm run test:api && npm run build && npm run lint`
Expected: `server/test/tenant-management.test.ts` and `api.test.ts` PASS; `tsc -b`, `tsc -p tsconfig.server.json`, `vite build`, and `eslint .` exit `0`.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/features/tenant-submissions/tenant-utils.ts src/features/tenant-submissions/storage.ts src/App.tsx server/test/tenant-management.test.ts
git commit -m "feat(tenant-submissions): add tenant/user validation helpers and credential reset API client"
```

---

### Task 4: Frontend — Upgrade `EditTenantModal` (`name`, `slug`, `status`, URL Preview & Credentials Link)

**Files:**
- Modify: `src/features/tenant-submissions/tenant-modals.tsx:267-394`

**Interfaces:**
- Consumes: `validateEditTenantInput`, `sanitizeTenantSlug` (`./tenant-utils`), `Select`, `Button`, `Input`, `Label`, `Badge` (`../../shared/ui`), `ClientTenant` (`../../domain/form-schema`).
- Produces:
  - `EditTenantModalProps`:
    - `tenant: ClientTenant | null`
    - `tenants?: ClientTenant[]`
    - `idPrefix: string`
    - `onClose: () => void`
    - `onUpdateTenant: (tenantId: string, input: { name: string; slug: string; status: 'active' | 'suspended' }) => Promise<void> | void`
    - `onManageUsers?: (tenant: ClientTenant) => void`

- [ ] **Step 1: Update `EditTenantModalProps` and `EditTenantModalForm` in `src/features/tenant-submissions/tenant-modals.tsx`**

Implement:
- Controlled state initialized from `tenant`:
  - `editName` (`tenant.name`)
  - `editSlug` (`tenant.slug`)
  - `editStatus` (`tenant.status ?? 'active'`)
  - `isSubmitting`, `submitError` (`string | null`)
- `STATUS_OPTIONS: DropdownOption[]` using `Select` from `../../shared/ui` (never native `<select>`):
  - `{ value: 'active', label: 'Active', description: 'Tenant portal logins and public forms are enabled', meta: 'ACTIVE' }`
  - `{ value: 'suspended', label: 'Suspended', description: 'Revokes active sessions and blocks logins and public forms', meta: 'SUSPENDED' }`
- Live workspace URL preview box showing `/t/${sanitizeTenantSlug(editSlug) || tenant.slug}/login` and `/f/${sanitizeTenantSlug(editSlug) || tenant.slug}/<form-slug>` plus a warning banner when `editStatus === 'suspended'` explaining that active tenant sessions will be revoked immediately.
- Client-side validation using `validateEditTenantInput({ name: editName, slug: editSlug, status: editStatus }, tenants, tenant.id)` before calling `await onUpdateTenant(tenant.id, result.data)`.
- Inline `role="alert"` banner showing validation or server errors (`409` slug collision, etc.) without closing the modal; closes on success.
- Optional footer/header link `"Manage Credentials & Users"` button when `onManageUsers` is provided (closes `EditTenantModal` and opens `TenantUsersModal` for `tenant`).

- [ ] **Step 2: Verify build and lint**

Run: `npm run build && npm run lint && npm run test:api`
Expected: Zero TypeScript, Vite, ESLint, or API test errors.

- [ ] **Step 3: Commit Task 4**

```bash
git add src/features/tenant-submissions/tenant-modals.tsx
git commit -m "feat(ui): allow editing tenant name, slug, and status in EditTenantModal"
```

---

### Task 5: Frontend — Upgrade `TenantUsersModal` (Edit `username`, `displayName`, `role`, Set/Generate/Email Password)

**Files:**
- Modify: `src/features/tenant-submissions/tenant-users-modal.tsx:1-408`

**Interfaces:**
- Consumes: `validateEditTenantUserInput` (`./tenant-utils`), `EMAIL_PATTERN`, `USERNAME_PATTERN` (`../../shared/lib`), `ResetUserCredentialsResponse` (`./storage`), `Select`, `Badge`, `Button`, `Input`, `Label` (`../../shared/ui`).
- Produces:
  - Updated `TenantUsersModalProps`:
    - `onUpdateUser: (userId: string, input: { username?: string; displayName?: string; role?: 'tenant_admin' | 'tenant_member'; isActive?: boolean; password?: string }) => Promise<void>`
    - `onResetCredentials?: (userId: string, input: { password?: string; email?: string }) => Promise<ResetUserCredentialsResponse>`

- [ ] **Step 1: Add inline user profile & role editing to `TenantUsersModal`**

In `src/features/tenant-submissions/tenant-users-modal.tsx`:
- Add state for inline editing a user row (`editingUserId`, `editUsername`, `editDisplayName`, `editRole`).
- Add an `Edit` button per user row (mutually exclusive with open password reset panel for cleanliness).
- Render an inline edit form with `Username` (`Input` with `font-mono text-xs`), `Display Name` (`Input`), and `Role` (`Select` with `ROLE_OPTIONS`, never native `<select>`).
- Validate via `validateEditTenantUserInput`, call `await onUpdateUser(user.id, result.data)`, and display any `409` username collision or `400` error in the modal's `role="alert"` banner without discarding the user's draft edits.

- [ ] **Step 2: Enhance password & credentials reset panel in `TenantUsersModal`**

In `src/features/tenant-submissions/tenant-users-modal.tsx`:
- Replace the simple single-input `Reset Password` row with a compact credentials panel:
  - Optional `New Password (leave blank to auto-generate)` input (`type="password"`, min 8 chars if entered).
  - Optional `Email Credentials To (optional)` input (`type="email"`, validated with `EMAIL_PATTERN` if non-empty).
  - Submit button: `Generate & Reset` (when password blank) or `Save Password` (when password entered), calling `onResetCredentials` when available (falling back to `onUpdateUser(userId, { password })` if `onResetCredentials` is not provided).
- When `onResetCredentials` returns `generatedPassword` (or `emailDelivery`), render a dismissible emerald confirmation banner inside the modal showing the user's `username`, one-time `generatedPassword`, a `Copy` button (`navigator.clipboard.writeText`), and email delivery status (`Sent via resend` / `Logged to dev console`).

- [ ] **Step 3: Verify build, lint, and tests**

Run: `npm run build && npm run lint && npm run test:api`
Expected: Zero TypeScript, Vite, ESLint, or API test errors.

- [ ] **Step 4: Commit Task 5**

```bash
git add src/features/tenant-submissions/tenant-users-modal.tsx
git commit -m "feat(ui): support editing tenant user profiles, roles, and credential resets"
```

---

### Task 6: Frontend — Surface Tenant Slug/Status & Credentials Actions in `TenantsDirectoryPanel`, `TenantDashboardPanel`, and `App.tsx`

**Files:**
- Modify: `src/features/tenant-submissions/tenants-directory.tsx`
- Modify: `src/features/tenant-submissions/index.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `EditTenantModal`, `TenantUsersModal`, `apiResetTenantUserCredentials`, `ResetUserCredentialsResponse`.
- Produces:
  - `TenantsDirectoryPanel` & `TenantDashboardPanel` displaying tenant `slug` (`/{tenant.slug}`), status `Badge` (`ACTIVE` emerald / `SUSPENDED` danger), and a `Credentials` / `Users` action button per row alongside `Edit`.
  - Seamless transition from `EditTenantModal` (`onManageUsers`) into `TenantUsersModal` on both pages.
  - Full `App.tsx` wiring of `handleResetTenantUserCredentials` and `tenantUsers` to both `TenantDashboardPanel` and `TenantsDirectoryPanel`.

- [ ] **Step 1: Update `TenantsDirectoryPanel` (`src/features/tenant-submissions/tenants-directory.tsx`)**

- Update `onUpdateTenant` prop signature to `(tenantId: string, input: { name: string; slug: string; status: 'active' | 'suspended' }) => Promise<void>`.
- Update `onUpdateTenantUser` prop signature to include `username?: string; displayName?: string`.
- Add optional `onResetTenantUserCredentials?: (userId: string, input: { password?: string; email?: string }) => Promise<ResetUserCredentialsResponse>`.
- In the Tenant table cell: display `/{tenant.slug}` (`font-mono text-[11px] text-zinc-400`) and a status `Badge` (`variant={tenant.status === 'suspended' ? 'danger' : 'success'}` showing `SUSPENDED` or `ACTIVE`).
- In the Actions column: add a `Credentials` / `Users` icon button (`aria-label={`Manage users and credentials for ${tenant.name}`}`) that sets `managingUsersTenantId(tenant.id)`.
- Wire `onManageUsers={(t) => { setEditingTenant(null); setManagingUsersTenantId(t.id); }}` on `EditTenantModal` and `onResetCredentials={onResetTenantUserCredentials}` on `TenantUsersModal`.

- [ ] **Step 2: Update `TenantDashboardPanel` (`src/features/tenant-submissions/index.tsx`)**

- Add `users?: ManagedTenantUser[]`, `onCreateTenantUser`, `onUpdateTenantUser`, `onDeleteTenantUser`, and `onResetTenantUserCredentials` props to `TenantDashboardPanelProps`, and update `onUpdateTenant` signature to return `Promise<void>`.
- Display `/{tenant.slug}` and `ACTIVE` / `SUSPENDED` `Badge` in the dashboard All Tenants table.
- Add a `Manage users and credentials for ${tenant.name}` icon button in the dashboard tenant row Actions column (when user callbacks are provided), plus `managingUsersTenantId` state rendering `TenantUsersModal` and `onManageUsers` on `EditTenantModal`.

- [ ] **Step 3: Wire `handleResetTenantUserCredentials` and props in `src/App.tsx`**

- Import `apiResetTenantUserCredentials` and `type ResetUserCredentialsResponse` in `src/App.tsx`.
- Implement `handleResetTenantUserCredentials`: calls `apiResetTenantUserCredentials(userId, input)`, updates `tenantUsers` with `res.user`, and returns `res`.
- Pass `users={tenantUsers}`, `onCreateTenantUser={handleCreateTenantUser}`, `onUpdateTenantUser={handleUpdateTenantUser}`, `onDeleteTenantUser={handleDeleteTenantUser}`, and `onResetTenantUserCredentials={handleResetTenantUserCredentials}` to `TenantDashboardPanel` (`src/App.tsx:2157-2171`) and `onResetTenantUserCredentials={handleResetTenantUserCredentials}` to `TenantsDirectoryPanel` (`src/App.tsx:2174-2186`).

- [ ] **Step 4: Run full verification gate**

Run: `npm run test:api && npm run build && npm run lint`
Expected: All unit & API tests PASS (`exit code 0`), `tsc -b && tsc -p tsconfig.server.json && vite build` PASS (`exit code 0`), and `eslint .` PASS (`exit code 0`).

- [ ] **Step 5: Commit Task 6**

```bash
git add src/features/tenant-submissions/tenants-directory.tsx src/features/tenant-submissions/index.tsx src/App.tsx
git commit -m "feat(ui): surface tenant status, slugs, and credentials management in dashboard and directory"
```

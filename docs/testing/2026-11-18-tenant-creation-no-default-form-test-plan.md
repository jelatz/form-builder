# Test Plan: Remove Default Form on Tenant Creation

- **Date**: 2026-11-18
- **Stack**: TypeScript 6 + React 19 + Vite 8 + Tailwind CSS v4 + Fastify 5 + Drizzle/InMemoryStore
- **Scope**: `server/modules/admin/actions.ts`, `server/modules/admin/controller.ts`, `server/modules/admin/dto.ts`, `src/features/tenant-submissions/storage.ts`, `src/App.tsx`, `src/features/tenant-submissions/index.tsx`
- **Runners**: `test-runner (Model: "flash"), browser (Model: "flash" — live web UI)`

## Test Case Matrix

### 1. Input & Boundary Values
| ID | Layer | Boundary / Target | Scenario & Input | Expected Outcome | Runner | Status |
|---|---|---|---|---|---|---|
| INP-01 | DTO | `validateCreateTenantDto` | Empty/1-char `name` (`"A"`), invalid `email` (`"not-an-email"`), invalid `adminUsername` (`"ab"`), or `null` payload | `400` with `fieldErrors`, zero tenant/user/form persistence | `test-runner` | - [x] |
| INP-02 | Action | `createTenantAction` | Duplicate `adminUsername` or colliding org `name`/`slug` | Explicit duplicate username returns `409`; colliding org name suffixes `slug` & derived `adminUsername` (`_2`), still `0` forms created | `test-runner` | - [x] |

### 2. Layer & Contract Boundaries (`Controller -> DTO -> Action -> Model`)
| ID | Layer | Boundary / Target | Scenario & Input | Expected Outcome | Runner | Status |
|---|---|---|---|---|---|---|
| CON-01 | Controller/Action | `POST /api/admin/tenants` -> `createTenantAction` | Valid superadmin tenant creation payload | Returns `201` with `{ tenant, adminUser, emailDelivery }`, `starterForm` is `undefined`, and `store.listForms({ clientId: tenant.id })` is `0` | `test-runner` | - [x] |
| CON-02 | Action/Store | `createTenantAction` rollback | Email service throws during onboarding email delivery | Returns `502`, rolls back `tenant` and `adminUser`, leaves `listClients()`, `listUsers()`, and `listForms()` unchanged | `test-runner` | - [x] |
| CON-03 | Frontend Contract | `CreateTenantResponse` & `handleCreateTenant` | TypeScript compilation (`tsc -b && tsc -p tsconfig.server.json`) across `storage.ts` & `App.tsx` | Zero type errors; client no longer reads or prepends `starterForm` | `test-runner` | - [x] |

### 3. Auth, RBAC & Multi-Tenancy Gates
| ID | Layer | Boundary / Target | Scenario & Input | Expected Outcome | Runner | Status |
|---|---|---|---|---|---|---|
| SEC-01 | RBAC | `POST /api/admin/tenants` | Unauthenticated request | Returns `401`, zero tenant/form creation | `test-runner` | - [x] |
| SEC-02 | RBAC | `POST /api/admin/tenants` | Authenticated `tenant_admin` (`acme_admin`) attempts to create a tenant | Returns `403`, zero tenant/form creation | `test-runner` | - [x] |
| SEC-03 | Multi-Tenancy | `GET /api/tenants/:tenantId/forms` | Newly provisioned `tenant_admin` lists own forms and probes foreign `tenant_acme` forms | Own tenant returns `200` with `{ forms: [] }` (empty); foreign tenant returns `403` | `test-runner` | - [x] |

### 4. ID-Based Handoffs & Persistence Integrity
| ID | Layer | Boundary / Target | Scenario & Input | Expected Outcome | Runner | Status |
|---|---|---|---|---|---|---|
| DAT-01 | Store / Cascade | `createTenantAction` & `deleteTenantAction` | Provision tenant (`tenant.id`, `adminUser.clientId === tenant.id`), verify `0` forms exist, then delete tenant by `tenant.id` | User links cleanly to `tenant.id`; deletion leaves zero orphan forms or users | `test-runner` | - [x] |

### 5. System Design, Async Lifecycle & Concurrency
| ID | Layer | Boundary / Target | Scenario & Input | Expected Outcome | Runner | Status |
|---|---|---|---|---|---|---|
| SYS-01 | Provisioning Lifecycle | `createTenantAction` + `emailService` | Onboarding email failure mid-provisioning; repeated tenant creation with identical org name | Atomic rollback on failure; unique suffixing on repeated org names without partial state | `test-runner` | - [x] |

### 6. Typed AI Wrappers & Telemetry
| ID | Layer | Boundary / Target | Scenario & Input | Expected Outcome | Runner | Status |
|---|---|---|---|---|---|---|
| AI-01 | N/A | N/A | N/A — deterministic tenant provisioning and SPA workspace state with zero LLM/AI wrapper calls | N/A | `test-runner` | - [x] |

### 7. Coding Principles Hygiene & Live Web UI
| ID | Layer | Boundary / Target | Scenario & Input | Expected Outcome | Runner | Status |
|---|---|---|---|---|---|---|
| HYG-01 | Coding Hygiene | Repo Build, Lint & API Suite | `npm run build`, `npm run lint`, `npm run test:api` with zero `any`/`@ts-ignore` suppression hacks | Exit code `0` across build, ESLint, and all API tests | `test-runner` | - [x] |
| UI-01 | Web UI | Dashboard (`+ New Tenant`) | Sign in as superadmin on Dashboard, create `UAT Verify Tenant` with `delivered@resend.dev` | PASS: `POST /api/admin/tenants` returned `201`; tenant appeared with `0 forms`, total forms stayed `3`, and no `UAT Verify Tenant Intake Form` was created | `browser` | - [x] |
| UI-02 | Web UI | `CreateTenantModal` Validation | Open `+ New Tenant`, enter short name (`"A"`) or invalid email, verify disabled submit / inline error and `Escape` closes modal | PASS: submit stayed disabled, inline email validation rendered, `Escape` closed modal | `browser` | - [x] |
| UI-03 | Web UI | Empty-Form Tenant State | Filter Dashboard by `UAT Verify Tenant` (`0` forms) and navigate to `Schema JSON` | PASS: Dashboard showed `0` matching forms + `+ New Form`; `/schema` rendered `"No forms in UAT Verify Tenant yet"` + `"+ Create First Form"` with zero stale form bleed | `browser` | - [x] |
| UI-04 | Web UI | Responsive Tailwind Layout (`1280x800` & `390x844`) | Inspect Dashboard & All Tenants at `1280x800` and `390x844` (collapsed rail + overlay drawer); delete `UAT Verify Tenant` afterwards | PASS: `scrollWidth <= clientWidth` (`390px` mobile & `1280px` desktop), zero header/table/footer overlap, and test tenant cleaned up cleanly | `browser` | - [x] |
| UI-05 | Web UI | Console & Network Hygiene | Monitor browser console and network responses across login, tenant creation, empty-tenant navigation, and cleanup | PASS: `0` uncaught console errors and `0` unexpected 4xx/5xx network responses | `browser` | - [x] |

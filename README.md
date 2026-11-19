# FormBuilder — Multi-Tenant Form Builder & Submission Platform

An enterprise-grade, multi-tenant **Form Builder, Public Runner & Submission Platform** built with **React 19**, **TypeScript 6**, **Vite 8**, **Tailwind CSS v4**, **Fastify 5**, **Drizzle ORM**, and **Neon PostgreSQL**.

Visually compose multi-section forms with an Open/Closed field registry, manage isolated client tenant workspaces with role-based access control, publish and embed public forms, inspect or export submissions, and dispatch HMAC-SHA256 signed outbound webhooks with delivery logs and manual retries.

---

## Key Features

### 1. Multi-Tenant Workspaces, Auth & RBAC
- **Three-Tier Role Model**:
  - `superadmin` — Platform-wide access across all client tenants, **All Tenants** directory (`/tenants`), tenant provisioning/suspension/deletion, global forms, and global submissions.
  - `tenant_admin` — Full access within their assigned tenant, including **Manage Team** (`TenantUsersModal`), deleting forms, clearing form submissions, and creating/updating/deleting webhooks.
  - `tenant_member` — Tenant-scoped access to create/edit/publish forms, inspect submissions, trigger webhook test pings, and retry failed webhook deliveries (restricted from deleting forms, clearing all submissions, managing team users, or mutating webhook endpoints).
- **Session Authentication**: Cookie-based `fb_session` HttpOnly tokens (7-day TTL, SHA-256 hashed in PostgreSQL `sessions`). Fails closed on expired or revoked sessions, inactive users, or suspended tenants (`status: 'suspended'` revokes active tenant sessions).
- **Tenant-Branded Login & Onboarding Emails**: Dedicated login portals at `/t/:tenantSlug/login` alongside `/login`. Provisioning a tenant (`+ New Tenant`) or resetting credentials can send onboarding emails via **Resend** (`RESEND_API_KEY`) or print the welcome payload to the server console in local development.

### 2. Visual Form Builder (`/forms/:formId/edit`)
- **15 Core AST Field Types** (`src/domain/form-schema/types.ts`, registered in `src/fields/registry.ts`):
  - **Standard Inputs (7)**: `text`, `email` (supports `allowedDomains` whitelist and `confirmEmail`), `number`, `select`, `radio`, `checkbox`, `date` (inclusive `minDate` / `maxDate`).
  - **Extended Inputs (6)**: `name`, `phone`, `address`, `textarea`, `website`, `currency`.
  - **Layout & Structural Containers (2)**: `section` (multi-step wizard page breaks plus `thankYouTitle`, `thankYouMessage`, and `redirectUrl`), `grid` (1, 2, or 3-column layouts via `parentGridId` / `gridColumn`).
- **Categorized Palette**: `Form Fields` and `Smart Fields` tabs in `FieldPalette` supporting click-to-insert and drag-and-drop onto the canvas or directly into grid columns.
- **Builder Canvas & Property Inspector**:
  - Reorder fields and sections, duplicate or delete fields, and undo/redo edits (`Ctrl+Z` / `Ctrl+Y`).
  - Dockable left/right **Property Inspector** to configure field validation rules, options, and form-level settings (Title, Slug, Description, Submit Button Text, Thank You screen, Redirect URL).
  - **Draft vs. Published** tracking with a **Publish Changes** action in the top workspace bar.
- **Unified Custom Dropdowns**: All workspace selectors, filter bars, and runtime `select` fields use portaled custom `Select` and `FilterDropdown` components (`src/shared/ui/index.tsx`) with keyboard navigation instead of raw native `<select>` elements.

### 3. Live Preview, Public Forms & Embedding
- **Interactive Preview (`/forms/:formId/preview`)**: Test multi-section wizard navigation, per-section validation (`validateSection`), and submission behavior before publishing.
- **Public Form Runner (`/f/:tenantSlug/:formSlug`)**: Serves published forms for active tenants without login. Supports:
  - URL query-parameter prefill (via `toFieldQueryKey`).
  - Custom Thank You screen or post-submit `redirectUrl`.
  - Embedded mode (`?embed=1`) that emits a `formbuilder:submitted` `window.postMessage` event.
- **Embed & Share Modal**: Generate direct share links, sample prefill URLs, `<iframe>` snippets, and pop-up modal `<script>` snippets directly from **Form Overview** (`/forms/:formId`).

### 4. Submissions Management & Export
- **Per-Form Submissions (`/forms/:formId/submissions`)**: Browse tabular submission records for the active form, inspect structured answers or raw JSON payloads, delete individual records, clear all records (`superadmin` / `tenant_admin`), and export **CSV** or **JSON**.
- **Global Submissions Explorer (`/submissions`)**: Search and filter across forms (and across tenants for `superadmin`), inspect payloads, and export **CSV**.

### 5. Outbound Webhooks & Integrations (`/forms/:formId/integrations`)
FormBuilder uses a **push webhook model**: your receiving application, automation tool, or middleware provides a destination URL, and you paste that URL into FormBuilder's **Destination URL** field.

- **Connector Templates**: Quick-start presets for `Custom Webhook`, `Zapier / Make`, `Slack Webhook`, and `HubSpot / CRM` (all presets send FormBuilder's standard signed JSON payload; native Slack incoming webhooks require middleware or an automation platform to transform the JSON into Slack Block Kit/text format).
- **Triggers**:
  - `submission.created` — Fires automatically for every active matching webhook whenever an authenticated or public submission passes validation and is stored.
  - `webhook.test` — Manual **Send Test Event** ping generating sample field values (works even while a webhook is paused).
- **Security & Signing**:
  - Each endpoint stores a signing secret (`whsec_<48-hex-chars>` generated automatically if left blank, or custom `>= 8` characters).
  - Requests are sent via `POST` with a **5-second timeout** (`AbortSignal.timeout(5000)`) and the following headers:
    - `Content-Type: application/json`
    - `User-Agent: FormBuilder-Webhook/1.0`
    - `X-FormBuilder-Event`: `submission.created` | `webhook.test`
    - `X-FormBuilder-Delivery-Id`: `whd_...`
    - `X-FormBuilder-Signature`: `sha256=<hex>` (HMAC-SHA256 of the raw serialized JSON body)
- **Payload Shape** (`section` and `grid` layout fields are omitted from `submission.fields`):
  ```json
  {
    "id": "whd_...",
    "event": "submission.created",
    "createdAt": "2026-11-19T14:00:00.000Z",
    "form": {
      "id": "form_...",
      "clientId": "tenant_...",
      "slug": "intake-form",
      "title": "Client Intake Form"
    },
    "submission": {
      "id": "sub_...",
      "submittedAt": "2026-11-19T14:00:00.000Z",
      "values": { "field_id": "value" },
      "fields": [
        { "id": "field_id", "label": "Full Name", "type": "text", "value": "Jane Doe" }
      ]
    }
  }
  ```
- **Delivery Ledger & Retries**:
  - Every attempt is recorded in `webhook_deliveries` (`queued` → `running` → `completed` | `failed`) with HTTP status, response body (truncated to 1,000 characters), error message, and `attemptCount`.
  - Webhook errors are isolated per delivery so a failing endpoint never blocks saving a form submission.
  - Failed deliveries can be re-queued manually via **Retry** (`POST /api/tenants/:clientId/webhooks/deliveries/:deliveryId/retry`) against the webhook's current URL and secret.
  - *Current operational notes*: Submissions await outbound webhooks inline sequentially (no background retry scheduler yet), and URL validation checks `http://` / `https://` protocol without a private-IP SSRF blocklist.

### 6. Schema JSON I/O, In-App User Guide & Shell UX
- **Schema JSON (`/schema` and `/forms/:formId/schema`)**: View live `FormSchema` JSON, copy to clipboard, download `.json`, and import structurally validated JSON schemas (`parseFormSchemaJson`).
- **In-App User Guide (`/guide`)**: Built-in documentation view accessible from the left navigation rail covering tenant provisioning, team management, form creation, the visual builder, submissions, webhooks, and troubleshooting.
- **Persistent Minimizable Left Rail & Themes**: Collapse the left navigation rail between expanded (`w-60`) and icon-only (`w-16`) modes from the top header bar, and switch between `light`, `dark`, and `system` themes.

---

## Architecture & Directory Layout

```text
form-builder/
├── src/
│   ├── domain/form-schema/    # Pure TS AST types, operations, sections, validation (zero React/DOM)
│   ├── fields/                # Open/Closed Field Registry (registry.ts) & field plugin modules
│   ├── features/
│   │   ├── auth/              # Sign-in UI, session helpers, DTOs
│   │   ├── builder-canvas/    # Drag-and-drop canvas, grids, sections
│   │   ├── field-palette/     # Form Fields & Smart Fields palette
│   │   ├── form-renderer/     # Interactive multi-section runtime & public runner
│   │   ├── property-inspector/# Field validation/config & form metadata inspector
│   │   ├── schema-io/         # JSON export/import workbench
│   │   ├── tenant-submissions/# Dashboard, Tenants Directory, Forms, Submissions, Integrations, Embed
│   │   └── user-guide/        # In-app interactive User Guide (/guide)
│   ├── shared/
│   │   ├── lib/               # Router (router.ts), theme persistence, username/class helpers
│   │   └── ui/                # Zinc UI primitives (Button, Input, Select, FilterDropdown, Tooltip, etc.)
│   └── App.tsx                # Top-level shell, navigation rail, auth/data orchestration
├── server/
│   ├── db/
│   │   ├── schema.ts          # Drizzle PostgreSQL schema (7 tables)
│   │   ├── migrations/        # SQL migrations (drizzle-kit)
│   │   ├── neon-store.ts      # NeonDrizzleStore (@neondatabase/serverless)
│   │   ├── store.ts           # AppStore interface contract
│   │   └── seed.ts            # Idempotent superadmin seed script
│   ├── lib/                   # Crypto (scrypt, HMAC-SHA256, tokens), slugify, Resend email client
│   ├── middleware/            # Cookie auth hook & RBAC scope guards
│   ├── modules/               # Capability modules (auth, admin, forms, submissions, webhooks)
│   │                          # strictly layered as controller -> dto -> actions -> AppStore
│   ├── test/                  # Node test runner suite & InMemoryAppStore
│   ├── app.ts                 # Fastify app factory (buildServer)
│   └── index.ts               # Server entrypoint
├── DESIGN.md                  # Monochrome zinc visual tokens & layout conventions
├── GEMINI.md                  # Architecture rules, TypeScript 6 guardrails, and product spec
└── drizzle.config.ts          # Drizzle Kit configuration
```

### Dependency & Coding Rules
- **Unidirectional Frontend Flow**: `App.tsx` → `features/*` → `fields/*` → `domain/*` → `shared/*`.
  - `src/domain/**` has zero React/DOM/UI imports and all schemas remain 100% JSON-serializable.
  - `src/features/<slice-a>` never imports internal files from `src/features/<slice-b>`.
  - `src/fields/registry.ts` enforces the Open/Closed Principle across all 15 `FieldType` variants.
- **TypeScript 6 Guardrails**: `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`, strict zero-`any` policy, `noUnusedLocals`, and `noUnusedParameters`.

---

## Routes & API Reference

### SPA Routes (`src/shared/lib/router.ts`)
| Route | Mode | Access |
| :--- | :--- | :--- |
| `/dashboard` (or `/`) | `dashboard` | Authenticated workspace users |
| `/tenants` | `tenants` | `superadmin` only |
| `/forms` | `forms` | Authenticated workspace users |
| `/forms/:formId` | `form_detail` | Tenant-scoped form overview |
| `/forms/:formId/edit` | `edit` | Visual form builder |
| `/forms/:formId/preview` | `preview` | Live interactive preview |
| `/forms/:formId/submissions` | `submissions` | Form submissions ledger & export |
| `/forms/:formId/integrations` | `integrations` | Outbound webhooks & delivery logs |
| `/forms/:formId/schema` or `/schema` | `schema` | Schema JSON import/export |
| `/submissions` | `submissions_explorer` | Global / tenant submissions browser |
| `/guide` | `guide` | Built-in User Guide |
| `/t/:tenantSlug/login` | `tenant_login` | Tenant-branded login portal |
| `/f/:tenantSlug/:formSlug` | `public_form` | Public form runner (`?embed=1` supported) |

### Backend API Groups (`server/modules/*`)
- **Health**: `GET /api/health`
- **Auth**: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/public/tenants/:tenantSlug`
- **Superadmin (`/api/admin/*`)**:
  - Tenants: `GET|POST /api/admin/tenants`, `PATCH|DELETE /api/admin/tenants/:tenantId`
  - Users: `GET|POST /api/admin/users`, `PATCH|DELETE /api/admin/users/:userId`, `POST /api/admin/users/:userId/reset-credentials`
  - Global Browsers: `GET /api/admin/forms`, `GET /api/admin/submissions`
- **Tenant Team (`/api/tenants/:clientId/users*`)**: `GET|POST|PATCH|DELETE` and `POST .../reset-credentials` (`superadmin` or `tenant_admin`)
- **Forms**: `GET|POST /api/tenants/:clientId/forms`, `GET|PATCH|DELETE /api/tenants/:clientId/forms/:formId` (`DELETE` requires `tenant_admin` / `superadmin`)
- **Submissions**: `GET /api/tenants/:clientId/submissions`, `POST /api/tenants/:clientId/forms/:formId/submissions`, `DELETE /api/tenants/:clientId/submissions/:submissionId`, `DELETE /api/tenants/:clientId/forms/:formId/submissions` (`tenant_admin` / `superadmin`)
- **Public Forms**: `GET /api/public/forms/:tenantSlug/:formSlug`, `POST /api/public/forms/:tenantSlug/:formSlug/submissions`
- **Webhooks**: `GET|POST /api/tenants/:clientId/forms/:formId/webhooks`, `PATCH|DELETE /api/tenants/:clientId/forms/:formId/webhooks/:webhookId` (`tenant_admin` / `superadmin`), `POST .../webhooks/:webhookId/test`, `POST /api/tenants/:clientId/webhooks/deliveries/:deliveryId/retry`

### PostgreSQL Schema (`server/db/schema.ts`)
1. `clients` — Tenant organizations (`id`, `name`, `slug`, `status`, timestamps)
2. `users` — Accounts (`superadmin`, `tenant_admin`, `tenant_member`) with case-insensitive unique usernames and role/tenant check constraints
3. `sessions` — SHA-256 hashed session tokens with expiry and revocation timestamps
4. `forms` — Form schemas (`fields` JSONB, `is_published`, unique `(client_id, slug)`)
5. `submissions` — Captured responses (`values` JSONB) with composite FK `(form_id, client_id)`
6. `form_webhooks` — Outbound webhook configurations (`url`, `secret`, `events` JSONB, `is_active`)
7. `webhook_deliveries` — Delivery execution audit log (`event_type`, `status`, `request_payload`, HTTP response, `attempt_count`)

---

## Local Setup & Scripts

### Prerequisites
- Node.js 20+ and npm
- A Neon PostgreSQL connection string (`DATABASE_URL`)

### Environment Variables (`.env.example`)
Copy `.env.example` to `.env` and fill in your values:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | Neon PostgreSQL connection string (required for DB/migrations/API) | — |
| `PORT` | Fastify API server port | `3001` |
| `NODE_ENV` | `development` or `production` | `development` |
| `SEED_SUPERADMIN_USERNAME` | Initial superadmin username for `npm run db:seed` | `superadmin` |
| `SEED_SUPERADMIN_PASSWORD` | Initial superadmin password for `npm run db:seed` | `admin123` |
| `RESEND_API_KEY` | Optional Resend API key for tenant onboarding emails (logs to console if blank in dev) | — |
| `EMAIL_FROM` | Sender header for Resend emails | `FormBuilder <onboarding@resend.dev>` |
| `APP_ORIGIN` | Public frontend origin used inside tenant login links | `http://localhost:5173` |

### Quickstart
```bash
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

In development, Vite runs on `http://localhost:5173` and proxies `/api/*` requests to Fastify at `http://localhost:3001` (`vite.config.ts`). Sign in with the seeded superadmin credentials (`superadmin` / `admin123` unless overridden in `.env`).

### Available Scripts (`package.json`)
| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `concurrently ... "npm:dev:api" "npm:dev:web"` | Run Fastify API watcher and Vite dev server together |
| `npm run dev:web` | `vite` | Start Vite frontend dev server only |
| `npm run dev:api` | `tsx watch server/index.ts` | Start Fastify backend with file watching |
| `npm run start:api` | `tsx server/index.ts` | Start Fastify backend once |
| `npm run build` | `tsc -b && tsc -p tsconfig.server.json && vite build` | Type-check client/server and build production frontend |
| `npm run lint` | `eslint .` | Run ESLint across client and server |
| `npm run test:api` | `tsx --test server/test/*.test.ts` | Run backend, RBAC, router, and webhook test suites |
| `npm run db:generate` | `drizzle-kit generate` | Generate Drizzle SQL migrations from `server/db/schema.ts` |
| `npm run db:migrate` | `drizzle-kit migrate` | Apply migrations to PostgreSQL |
| `npm run db:push` | `drizzle-kit push` | Push Drizzle schema directly |
| `npm run db:seed` | `tsx server/db/seed.ts` | Idempotently create the initial `superadmin` user |
| `npm run preview` | `vite preview` | Preview the built frontend bundle |

### Test Suite (`server/test/`)
Tests run against `InMemoryAppStore` using Node's native test runner (`npm run test:api`):
- `api.test.ts` — Auth, forms CRUD, and submission flows
- `router.test.ts` — SPA route parsing, URL encoding, and `isFormScopedMode` invariants
- `sections.test.ts` — Multi-section partitioning and section-level validation
- `submission-formatting.test.ts` — CSV/display formatting for complex field values
- `tenant-management.test.ts` — Tenant creation, slug uniqueness, edits, session revocation on suspend, and credentials resets
- `tenant-rbac.test.ts` — Cross-tenant isolation and `superadmin` / `tenant_admin` / `tenant_member` gates
- `universal-app-matrix.test.ts` — End-to-end matrix covering field registry, validation, forms, and routing
- `webhooks.test.ts` — Webhook CRUD, RBAC, HMAC-SHA256 signing, public submission dispatch, and delivery retry

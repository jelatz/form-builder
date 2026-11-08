# Form Builder — Architecture & Hardcore Engineering Rules

This repository implements an enterprise-grade, extensible, drag-and-drop Form Builder web application in React 19, TypeScript 6, and Tailwind CSS. All contributors (human or AI agent) must strictly follow the architectural principles, unidirectional dependency rules, TypeScript standards, and UI/UX design specifications detailed below and in [`DESIGN.md`](/DESIGN.md).

---

## 1. Core Architectural Paradigm (Feature-Based + Domain-Driven Hybrid)

The codebase follows a hybrid **Domain-Driven Design (DDD)** and **Feature-Sliced / Vertical Slice** architecture. Code is partitioned by responsibility, ownership, and stability under `src/`:

```
src/
├── domain/                  # Pure TypeScript domain model & business logic
│   └── form-schema/         # Form AST, discriminated unions, validation, pure operations
├── fields/                  # Open/Closed Field Registry & self-contained field implementations
│   ├── registry.ts          # Central registry mapping FieldType -> FieldDefinition
│   ├── text-field.tsx       # Text field definition, renderer & inspector
│   ├── select-field.tsx     # Select dropdown definition, renderer & inspector
│   ├── checkbox-field.tsx   # Checkbox definition, renderer & inspector
│   └── date-field.tsx       # Date picker definition, renderer & inspector
├── features/                # High-level product feature modules (slices)
│   ├── field-palette/       # Draggable/clickable palette to add fields
│   ├── builder-canvas/      # Canvas showing drop targets, field items, selection & reordering
│   ├── property-inspector/  # Right sidebar inspecting & modifying the active field's config
│   ├── form-renderer/       # Live preview & standalone runtime form runner with validation
│   └── schema-io/           # Import/export/reset of FormSchema JSON
├── shared/                  # Domain-agnostic primitives & universal utilities
│   ├── ui/                  # Reusable low-level UI elements (button, input, modal, tabs, etc.)
│   └── lib/                 # Generic utilities (uuid/nanoid, cn classnames helper, assertions)
└── App.tsx                  # Top-level application shell composing features & state
```

### Directory Responsibilities

- **`src/domain/form-schema/`**: Pure TypeScript AST models, discriminated unions (`FormField`), immutable schema operations (`operations.ts`), and pure runtime validation (`validation.ts`). **Zero React or DOM imports allowed.** This layer has zero dependencies on UI frameworks.
- **`src/fields/`**: The pluggable field ecosystem. Contains `registry.ts` and self-contained field modules (`text-field.tsx`, etc.). Each field module encapsulates:
  1. Default factory function (`createDefaultConfig()`).
  2. Runtime renderer component (`render()`).
  3. Property inspector editor component (`renderInspector()`).
- **`src/features/`**: Self-contained product capabilities (`field-palette`, `builder-canvas`, `property-inspector`, `form-renderer`, `schema-io`). Features communicate via props, callbacks, or shared domain types.
- **`src/shared/`**: Domain-agnostic UI primitives (`ui/`) and pure utilities (`lib/`). Never aware of form builder concepts. All UI primitives must adhere to the design tokens and component specifications defined in [`DESIGN.md`](/DESIGN.md).
- **`src/App.tsx`**: Top-level composition layer coordinating editor state, schema state, active modes (builder vs. live preview), and layout.

---

## 2. Strict Unidirectional Dependency Guardrails (HARDCORE RULE)

Dependencies must strictly flow inward from consumer to domain/shared:

```
App  ──▶  features/*  ──▶  fields/*  ──▶  domain/*  ──▶  shared/*
```

```
┌────────────────────────────────────────────────────────┐
│                        App.tsx                         │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   features/<feature>                   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                        fields/                         │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 domain/form-schema/                    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                        shared/                         │
└────────────────────────────────────────────────────────┘
```

### Forbidden Imports (Zero Tolerance)

| Layer | Forbidden Imports | Enforcement Rationale |
| :--- | :--- | :--- |
| `src/domain/**` | `react`, `react-dom`, `src/fields/**`, `src/features/**`, `src/shared/ui/**` | Domain logic must be 100% headless, testable in Node, and decoupled from any UI framework or view components. |
| `src/shared/**` | `src/domain/**`, `src/fields/**`, `src/features/**` | Primitives and utilities must remain strictly domain-agnostic and reusable across any project or layer. |
| `src/fields/**` | `src/features/**` | Field definitions are plugins consumed by features; circular coupling to features breaks modularity. |
| `src/features/<feature-a>` | `src/features/<feature-b>/**` (internal cross-feature imports) | Features must be isolated slices. Cross-feature coordination occurs via `App.tsx` or shared domain contracts. |

> [!CAUTION]
> Any import violating this unidirectional flow will cause immediate code review rejection and must be refactored before merging.

---

## 3. Non-Negotiable Coding Principles

### Principle 1: Open/Closed Principle (OCP) via the Field Registry
- **NEVER** write `switch (field.type)` or `if (field.type === ...)` chains inside `features/builder-canvas`, `features/property-inspector`, or `features/form-renderer`.
- All field-specific rendering, default instantiation, and inspector UI **MUST** be resolved dynamically via the field registry:
  ```typescript
  import { getFieldDefinition } from '../../fields/registry.ts';

  const definition = getFieldDefinition(field.type);
  return definition.render({ field, value, onChange, error });
  ```
- Adding a new field type must **never** require altering existing feature components.

### Principle 2: Data-Oriented Design & Immutable Pure Domain Core
- The `FormSchema` AST is the single source of truth.
- **100% JSON-Serializable**: No functions, callbacks, symbol keys, class instances, or DOM node references inside `FormSchema` or `FormField`.
- All schema operations must be pure, immutable functions located in `src/domain/form-schema/operations.ts`:
  - `addField(schema, field, targetIndex?)`
  - `removeField(schema, fieldId)`
  - `updateField(schema, fieldId, updates)`
  - `moveField(schema, sourceIndex, targetIndex)`
  - `duplicateField(schema, fieldId, newIdGenerator)`
- Every operation must return a new schema reference without mutating the original.

### Principle 3: Parse, Don't Validate (Discriminated Unions)
- Every form field is modeled as a variant of the `FormField` discriminated union using the discriminant `type: FieldType`:
  ```typescript
  export type FormField =
    | TextFieldConfig
    | SelectFieldConfig
    | CheckboxFieldConfig
    | DateFieldConfig;
  ```
- Make illegal states unrepresentable: for example, options lists (`options: SelectOption[]`) belong exclusively to `SelectFieldConfig`, min/max length belong to `TextFieldConfig`, etc.

### Principle 4: Strict Separation of Editor State vs. Runtime State
- **Editor (Meta) State**: Belongs exclusively to the builder workspace:
  - `selectedFieldId: string | null`
  - `activeSidebarTab: 'palette' | 'inspector' | 'schema'`
  - `previewMode: 'edit' | 'preview'`
  - AST undo/redo stacks
- **Runtime Form State**: Belongs exclusively to the running form execution:
  - `FormValues`: `Record<string, unknown>`
  - `FormErrors`: `Record<string, string>`
  - `touchedFields`: `Record<string, boolean>`
  - `isSubmitting`: `boolean`
- Editor state must never be stored in or mixed with `FormSchema` or runtime state.

### Principle 5: Optimistic UI Updates, Snapshot Rollback & Skeleton Loading
- **Optimistic UI (`0ms` Perceived Latency)**: All user-initiated mutations (adding, editing, reordering, or deleting fields, creating tenants or forms, toggling integrations, retrying deliveries, or clearing submissions) must update local UI state immediately before the asynchronous backend (`fetch`) request completes.
- **Snapshot & Automatic Rollback**: Every optimistic mutation that synchronizes with the Cloudflare Worker / D1 backend must capture the previous state snapshot prior to mutation. If the background `fetch` request throws or returns a non-2xx status, the state must automatically roll back to the snapshot and display a clear, dismissible error notification.
- **Structural Skeleton Loaders on Initial Load**: Whenever a page, workspace view, or async section is bootstrapping or loading initial data without cached state, render structural skeleton placeholders (`animate-pulse`) matching the target layout geometry to prevent Cumulative Layout Shift (CLS). Reserve spinners strictly for inline button actions.

### Principle 6: Visual Craft & Strict Adherence to DESIGN.md
- **Mandatory Compliance Prerequisite**: Whenever building, styling, modifying, or refactoring any UI/UX feature, page, view, modal, canvas element, inspector panel, or component, developers and AI agents **MUST** check and strictly adhere to [`DESIGN.md`](/DESIGN.md). Consulting `DESIGN.md` is an absolute prerequisite for any UI/UX work in this repository.
- **Strict Prohibition of "AI-Generated" Clichés**: Reject low-effort, generic "AI-generated" visual clichés and aesthetic slop:
  - 🚫 **Banned Gradients**: No purple/indigo/violet multi-stop gradient hero backgrounds, gradient text fills, or gradient borders.
  - 🚫 **Banned Containers & Radii**: No bubbly, cartoonish `rounded-2xl` or `rounded-3xl` cards, inputs, buttons, or modal containers (maximum border radius is standard `rounded-lg` / 8px).
  - 🚫 **Banned Blobs & Blur**: No floating blurred neon background blobs (`blur-3xl opacity-20`) or excessive, illegible frosted glass (`backdrop-blur-md bg-white/10`).
  - 🚫 **Banned Layout Monotony**: No rigid 3-column card monotony with Lucide icons trapped inside pastel rounded boxes.
  - 🚫 **Banned Fluff**: No cliché sparkle emojis (✨), `Sparkles` icons on non-AI buttons, or fluffy marketing copy.
- **Enforcement of `shadcn/ui` Design Conventions**:
  - **Neutral `zinc` Token Palette**: All components must use the neutral `zinc` token system (pure monochrome foundation with high-contrast text: `zinc-950` / `zinc-100`, subtle neutral surfaces: `zinc-50` / `zinc-900`, and crisp hairline borders: `zinc-200` / `zinc-800`).
  - **Hairline 1px Borders**: High structural definition using 1px borders (`border border-zinc-200 dark:border-zinc-800`) instead of heavy, muddy drop-shadows.
  - **Compact Enterprise Density**: Standardized 36px control heights (`h-9`), compact 32px toolbars (`h-8`), and dense padding suited for enterprise-grade productivity software.
  - **Technical Typography & Monospace Badges**: Clean sans-serif UI typography paired with uppercase monospace (`font-mono text-xs tracking-wider uppercase`) for technical metadata, IDs, slugs, badges, keyboard shortcuts, and status indicators.
  - **Tactile Micro-Interactions**: Precise, intentional hover and active transitions (`transition-colors duration-150`, subtle active scale `active:scale-[0.98]`).

---

## 4. TypeScript 6 & Compiler Guardrails

The project enforces modern, strict TypeScript (TS 6.x) with strict compiler settings in `tsconfig.app.json`:

### 1. `verbatimModuleSyntax: true`
- You **MUST** use `import type { ... }` whenever importing types or interfaces.
- Never mix value and type imports in a non-type declaration:
  ```typescript
  // Correct
  import type { FormField, FormSchema } from '../../domain/form-schema/types.ts';
  import { addField } from '../../domain/form-schema/operations.ts';

  // Forbidden - causes TS build error with verbatimModuleSyntax
  import { FormField, addField } from '../../domain/form-schema/operations.ts';
  ```

### 2. `erasableSyntaxOnly: true`
- Node and modern bundlers strip types without a full transformer.
- **NEVER** use TypeScript `enum` — use string literal unions and `as const` objects:
  ```typescript
  // Correct
  export const FIELD_TYPES = ['text', 'select', 'checkbox', 'date'] as const;
  export type FieldType = (typeof FIELD_TYPES)[number];

  // Forbidden
  export enum FieldType { Text = 'text', Select = 'select' }
  ```
- **NEVER** use TypeScript `namespace`.
- **NEVER** use constructor parameter properties (`constructor(private readonly x: string)`).

### 3. Zero `any` Policy
- Never use explicit `any` or `as unknown as SomeType` casts.
- Use type guards, narrowing, or generic lookup helpers (`FieldDefinition<Extract<FormField, { type: T }>>`) to ensure end-to-end type safety.

### 4. Zero Unused Variables
- `noUnusedLocals: true` and `noUnusedParameters: true` are enabled.
- All unused imports, variables, and parameters must be pruned before completing tasks.

---

## 5. Step-by-Step Checklist for Adding a New Field Type

To introduce a new field type (e.g., `number`, `radio`, `textarea`), follow this 4-step checklist:

1. **Update Domain Schema Types (`src/domain/form-schema/types.ts`)**
   - Add the type literal to `FieldType` (e.g., `'number'`).
   - Define the field configuration interface (e.g., `NumberFieldConfig extends BaseFieldConfig { type: 'number'; min?: number; max?: number; step?: number; }`).
   - Add `NumberFieldConfig` to the `FormField` discriminated union.

2. **Add Domain Validation Rules (`src/domain/form-schema/validation.ts`)**
   - Implement field-specific runtime validation logic (e.g., verifying `min`, `max`, and numeric values).

3. **Create Field Module (`src/fields/<name>-field.tsx`)**
   - Create `src/fields/<name>-field.tsx` implementing `FieldDefinition<SpecificFieldConfig>`.
   - Implement `createDefaultConfig(id: string)`: returns a valid default config.
   - Implement `render({ field, value, onChange, error })`: the public/runtime form control styled strictly according to [`DESIGN.md`](/DESIGN.md).
   - Implement `renderInspector({ field, onUpdate })`: the properties editor form for builder mode styled strictly according to [`DESIGN.md`](/DESIGN.md).

4. **Register in Field Registry (`src/fields/registry.ts`)**
   - Import the field definition and register it in `fieldRegistry`:
     ```typescript
     registerField(numberFieldDefinition);
     ```

> [!NOTE]
> **No feature components (`builder-canvas`, `property-inspector`, `form-renderer`, `field-palette`) require any changes.** The new field automatically appears in the palette, renders on the canvas, inspects in the sidebar, and validates at runtime.

---

## 6. Pre-Completion Verification Gate

Before submitting any code change, running pull requests, or declaring a task complete, verify that the project compiles and lints cleanly and conforms to all design guidelines:

1. **Design & Visual Verification**: If any UI/UX component, view, modal, palette item, canvas element, or inspector style was created or modified, verify full compliance against [`DESIGN.md`](/DESIGN.md) (strictly neutral `zinc` token palette, 1px hairline borders, compact 36px inputs, monospace badges, zero banned gradients/blobs/bubbly radii).
2. **Automated Verification Commands**:
```bash
# 1. Typecheck and build
npm run build

# 2. Lint and format checks
npm run lint
```

Both commands must exit with code `0` and zero warnings/errors.

---

## 7. Multi-Tenant Client Isolation, Domain Routing & Cloudflare D1 Rules

To support white-labeled SaaS multi-tenancy on Cloudflare Free Tier (Workers + D1 + Assets), all backend interactions and domain models must enforce strict client isolation:

### 1. Mandatory Multi-Tenant Client Scoping
- Every `FormSchema` and `SubmissionRecord` **MUST** include an explicit, non-empty `clientId` corresponding to a valid `ClientTenant` row in Cloudflare D1 (`clients.id`).
- Form lookup and URL routing must always resolve through tenant boundaries (`UNIQUE(client_id, slug)`).
- Never allow cross-client schema mutations or cross-client submission access. Every D1 query touching submissions or forms must include or join on `client_id`.

### 2. Custom Domain & Allowed Origin Validation
- Each client owns a `primary_domain` and an array of `allowed_domains` stored as `allowed_domains_json` in D1.
- Public runtime endpoints (`/api/public/resolve` and `/api/public/submit`) enforce domain origin verification:
  - The request host (`X-Forwarded-Host`, `Host`, or query `host`) must match the form's `custom_domain`, the client's `primary_domain`, or be present in `allowed_domains_json`.
  - Submissions from unauthorized origins or mismatched client-domain bindings are rejected with HTTP 403.

### 3. Store-and-Forward Submission Pattern in Cloudflare D1
- Ingestion is guaranteed via a **Store-and-Forward** architecture:
  1. **Stage 1 (Store)**: The raw submission values and URL parameters are immediately committed to the D1 `submissions` table.
  2. **Stage 2 (Forward)**: Enabled integrations (GoHighLevel, Close, Zoho, Airtable, Webhooks) are formatted with provider-specific payloads and dispatched via `fetch`.
  3. **Stage 3 (Audit & Retry)**: Each delivery outcome (status, HTTP code, payload preview, response message) is recorded in `submission_deliveries`.
  4. Failed deliveries can be retried on-demand via `POST /api/submissions/:id/retry` without re-submitting form data.

---

## 8. Authentication, Session Management & Credential Security Rules

To ensure hardened authentication, session security, and defense against credential harvesting and session hijacking across multi-tenant environments, all authentication features and backend endpoints must enforce the following rules:

### 1. Mandatory Multi-Tenant User Scoping
- All user accounts, credentials, and session records in Cloudflare D1 **MUST** be strictly scoped by `client_id` (`clients.id`).
- All queries touching authentication, credentials, or sessions must enforce `WHERE client_id = ?` to prevent cross-tenant credential leaks and unauthorized access.

### 2. Session Architecture & Cookie Guardrails
- **Zero LocalStorage Policy**: Zero storage of authentication tokens or session identifiers in browser `localStorage` or `sessionStorage` to eliminate client-side token exfiltration via XSS.
- **Cryptographically Secure Session IDs**: Sessions must use high-entropy IDs generated via CSPRNG (`crypto.randomUUID()` or `crypto.getRandomValues()`), stored in D1 alongside an explicit `expires_at` timestamp.
- **Strict Cookie Attributes**: Session cookies must be transmitted via `Set-Cookie` with mandatory security attributes:
  ```http
  Set-Cookie: session_id=<id>; HttpOnly; Secure; SameSite=Lax; Path=/
  ```

### 3. User Enumeration Prevention & Constant-Time Responses
- Registration, login, and password reset endpoints must **never** reveal whether a user account or email address exists in the system.
- Login failures must consistently return a generic error message (e.g., `"Invalid email or password"`), regardless of whether the email was not found or the password was incorrect.
- Forgot Password requests must always respond with the identical HTTP status code (`200 OK`) and uniform response body regardless of account existence:
  ```json
  { "message": "If an account matching that email exists, password reset instructions have been sent." }
  ```
- Use constant-time comparison functions for hash or token verification to eliminate timing side-channel attacks.

### 4. Password Reset Token Lifecycle
- **CSPRNG Generation**: Password reset tokens must be generated using high-entropy CSPRNG (`crypto.getRandomValues()`).
- **Hash-at-Rest**: Store only the cryptographic hash (SHA-256) of the reset token in the Cloudflare D1 database; never persist plaintext tokens in storage or logs.
- **Short Expiration (TTL)**: Reset tokens must enforce a strict maximum time-to-live (TTL) of 15 minutes.
- **Single-Use Enforcement**: Tokens must be consumed and invalidated immediately upon first use or superseded when a subsequent reset request is initiated for the same account.
- **Global Session Revocation**: Any successful password reset or password change must immediately revoke and delete all existing active sessions for that user across all devices.

### 5. Form UX, Accessibility & Password Manager Autocomplete
- All authentication and credential views, dialogs, and components must adhere to the design conventions in [`DESIGN.md`](/DESIGN.md) (neutral `zinc` token palette, 1px hairline borders, compact `h-9` inputs, and crisp contrast).
- All authentication and credential forms located in `src/features/auth/` must provide explicit, standard HTML `autoComplete` attributes to support password managers and secure autofill:
  - **Login**: `autoComplete="username"` (or `"email"`), `autoComplete="current-password"`
  - **Registration**: `autoComplete="username"` (or `"email"`), `autoComplete="new-password"`
  - **Forgot Password**: `autoComplete="email"`
  - **Reset Password**: `autoComplete="new-password"`
  - **MFA / OTP**: `autoComplete="one-time-code"`
- **Accessible Validation & States**: Use `aria-invalid` on inputs with validation errors, linked to error message containers via `aria-describedby` matching the error element `id`.
- **Password Visibility Toggles**: Provide accessible password reveal buttons (`type="text"` / `type="password"`) with dynamic, screen-reader accessible `aria-label` triggers (e.g., `"Show password"` / `"Hide password"`).



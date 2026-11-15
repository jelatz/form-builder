# Public Form Runner — Architecture, Origin Security & Ingestion Governance

This document defines the architectural boundaries, security controls, runtime lifecycle rules, and embed protocols for the Public Form Runner feature (`src/features/public-runner/`).

---

## 1. Feature Scope & Architectural Boundary

The Public Form Runner is the public-facing entry point and execution wrapper responsible for rendering published forms, resolving tenant/form slugs, pre-populating fields from URL query parameters, handling embed modes, and submitting form payloads to Cloudflare Worker ingestion endpoints:

```
src/features/public-runner/
├── PublicFormRunner.tsx    # Primary runtime runner supporting standalone and embed views
└── index.ts                # Public feature export barrel
```

### Unidirectional Dependency Hierarchy
Dependencies strictly flow inward:
```
App.tsx (or Standalone Route)  ──▶  src/features/public-runner/  ──▶  src/fields/  ──▶  src/domain/form-schema/  ──▶  src/shared/
```

### Strict Boundary Invariants
- **Zero Coupling to Builder Editors**: The public runner must never import or depend on editor features (`builder-canvas`, `property-inspector`, `field-palette`, `schema-io`). It is designed to run in production without builder state.
- **Client and Schema Contracts**: Consumes immutable domain models (`ClientTenant`, `FormSchema`, `FormValues`, `SubmissionRecord`) and pure operations (`createDefaultFormValues`, `isFieldVisible`, `validateFormValues`, `validateFieldValue`).
- **Dynamic Field Resolution**: Input rendering is strictly dispatched through the field registry (`renderFieldInput` or `getFieldDefinition(field.type)`). Hardcoded `switch (field.type)` statements are forbidden.

---

## 2. Tenant Slug Resolution & Isolation

Public forms are hosted on the application's own URL structure and resolve forms strictly by tenant and form slug:

### 1. Tenant Slug Isolation
- Public URL paths follow the tenant pattern: `/<client-slug>/<form-slug>` (or `/p/<client-slug>/<form-slug>`).
- The database enforces a unique tenant slug (`UNIQUE(clients.slug)`) and composite form unique constraint (`UNIQUE(client_id, slug)`), ensuring form slugs are scoped strictly within the owning tenant.
- Backend endpoints (`/api/public/resolve` and `/api/public/submit`) verify that the resolved `formId` belongs to the target `clientId` before returning schema metadata or accepting submissions.

---

## 3. URL Query Parameter Injection & Hidden Field Binding

Marketing campaigns, paid media, and CRM workflows require tracking parameters and contextual data to be seamlessly captured and attributed to submissions.

### 1. Parameter Extraction Lifecycle
1. On component initialization, `parseBrowserQueryParams()` inspects `window.location.search`.
2. All query keys and values are sanitized and decoded via `URLSearchParams` into a normalized `Record<string, string>`.
3. If no search parameters are present during builder preview testing, safe sample UTM campaign parameters (`utm_source=google-cpc`, `utm_medium=cpc`, `utm_campaign=direct_intake_q4`, `utm_content=hero_landing`) may be populated to facilitate testing.

### 2. Automatic Field Prefill & Hidden Field Binding
- **Prefill Matching**: Query parameters whose keys match existing `FormField.id` or field name attributes are automatically assigned as initial values in `FormValues`.
- **Hidden Field Capture (`type: 'hidden'`)**:
  - Hidden fields (used for ad tracking, campaign IDs, click IDs, affiliate tags) are populated with matching URL parameters (e.g. `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `fbclid`, `ref`).
  - Hidden fields are completely excluded from the visual DOM layout (`field.type !== 'hidden'`), but their values are retained in `FormValues` and submitted with the final payload.

### 3. Redirect Parameter Propagation
When post-submission actions specify `actionType: 'redirect'` and `appendParamsToRedirect: true`:
- The runner computes the target URL via `computeRedirectUrl(...)`.
- All captured URL query parameters and non-empty form values are appended as encoded query parameters to the destination URL, enabling seamless multi-step funnel tracking.

---

## 4. Dual Display Modes: Standalone vs. Embed Mode

The public runner supports two operational display modes:

### 1. Standalone Full-Page Mode (`embedMode = false`)
- **Use Case**: Direct link visits, landing page forms, full-screen customer intake portals.
- **Layout Characteristics**:
  - Centered responsive container (`max-w-3xl mx-auto`).
  - Subtle page background (`bg-zinc-100/70 dark:bg-zinc-950`).
  - Elevated form card with 1px hairline border (`border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 shadow-xs`).
  - Customer preview header bar (in builder preview mode) with exit navigation, mode toggle, and live theme switcher.

### 2. Embed Mode (`embedMode = true` or `?embed=1`)
- **Use Case**: Embedding inside third-party websites, CMS pages (WordPress, Webflow, Shopify), client portals, or marketing landing pages via `<iframe>`.
- **Layout Characteristics**:
  - Borderless, neutral or transparent background (`bg-transparent border-0 p-0 shadow-none`).
  - Top header bars and outer padding are suppressed to allow native integration with the host page.
  - Zero margin collapse.
- **Auto-Resizing Iframe Protocol (`postMessage`)**:
  - To prevent nested iframe scrollbars, the runner measures document scroll height (`ResizeObserver` or content height calculations).
  - Emits postMessage events to the host window:
    ```typescript
    window.parent.postMessage(
      { type: 'form_builder:resize', height: document.documentElement.scrollHeight, formId: schema.id },
      '*'
    );
    ```
  - Upon successful submission, dispatches a completion event:
    ```typescript
    window.parent.postMessage(
      { type: 'form_builder:submitted', formId: schema.id, submissionId: record.id },
      '*'
    );
    ```
- **Embed Snippet Generation**:
  - The feature provides a pre-formatted HTML snippet for clients to copy:
    ```html
    <iframe
      src="https://yourapp.com/acme-corp/intake?embed=1"
      width="100%"
      height="700"
      frameborder="0"
      style="border:none;max-width:100%;"
    ></iframe>
    ```

---

## 5. Ingestion Protocol & Store-and-Forward Submission

Form submission adheres to the system's store-and-forward reliability standard:

### 1. Client-Side Validation Pre-Flight
- When the user triggers submission (`handleSubmit`), the runner executes `validateFormValues(schema, values)`.
- If invalid:
  - Updates `FormErrors` with all failed field rules.
  - Aborts network dispatch.
  - Focuses the first invalid visible input with accessible error messages.
- If valid:
  - Sets `isSubmitting = true`.
  - Clears stale errors.

### 2. Public Submission Ingestion (`/api/public/submit`)
- Submits form values and metadata to the Cloudflare Worker runtime endpoint:
  ```http
  POST /api/public/submit
  Content-Type: application/json

  {
    "formId": "form_123",
    "clientId": "client_abc",
    "values": { "name": "Jane Doe", "email": "jane@example.com" },
    "urlParams": { "utm_source": "google", "utm_campaign": "q4_leads" }
  }
  ```
- **Multi-Tenant Client Tagging**:
  - The worker verifies that `clientId` matches the owning client for `formId`.
  - Submissions are committed immediately to the D1 `submissions` table before triggering any downstream CRM or webhook integrations.

### 3. Submission Confirmation & Post-Submit Actions
- **Message Action (`actionType: 'message'`)**:
  - Displays a clean, accessible confirmation screen with `successTitle` and `successMessage`.
  - Provides a reset button ("Submit another response") to restart the form.
- **Redirect Action (`actionType: 'redirect'`)**:
  - Safely navigates the browser or parent frame to `targetRedirectUrl`.

---

## 6. UI/UX & Accessibility Guardrails

All elements within `src/features/public-runner/` must strictly conform to [`DESIGN.md`](/DESIGN.md):

- **Neutral Zinc Token Palette**: Pure monochrome foundation (`zinc-950` text on light, `zinc-100` on dark, `zinc-200`/`zinc-800` borders). Zero banned purple/neon gradients.
- **WCAG 2.1 AA Compliance**:
  - High-contrast text labels (minimum 4.5:1 ratio).
  - Visible focus indicators (`focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 focus-visible:ring-offset-2`).
  - Error messages linked to inputs via `aria-describedby` matching the error element ID.
  - `aria-invalid="true"` applied to fields failing validation.
- **5-State Completeness**: Every interactive button and input supports idle, hover, active (`active:scale-[0.98]`), focus, and disabled states.
- **Enterprise Density**: Standard 36px control heights (`h-9`), clean 1px hairline borders, and `rounded-lg` maximum border radius.

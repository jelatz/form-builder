# Submissions Ledger — Architecture, Audit Trail & Delivery Governance

This document establishes the architectural standards, data integrity invariants, export protocols, and delivery audit rules for the Submissions Ledger feature (`src/features/submissions-ledger/`).

---

## 1. Feature Scope & Architectural Boundary

The Submissions Ledger provides historical submission inspection, tenant-scoped audit logging, delivery outcome tracking, export generation (CSV/JSON), and manual delivery retry orchestration:

```
src/features/submissions-ledger/
├── SubmissionsLedger.tsx   # Ledger table, filter controls, audit drawer, and export handlers
└── index.ts                # Public feature export barrel
```

### Unidirectional Dependency Hierarchy
Dependencies strictly flow inward:
```
App.tsx  ──▶  src/features/submissions-ledger/  ──▶  src/domain/form-schema/  ──▶  src/shared/
```

### Strict Boundary Invariants
- **Zero Cross-Feature Imports**: The ledger must never import from sibling feature modules (`builder-canvas`, `property-inspector`, `field-palette`, `public-runner`, `integrations-hub`).
- **Domain Decoupling**: Communicates with the top-level application shell (`App.tsx`) via props and domain contracts (`ClientTenant`, `FormSchema`, `SubmissionRecord`, `IntegrationDeliveryLog`).
- **No Schema AST Mutations**: The ledger inspects form schemas solely to extract human-readable field labels and column headers. It never mutates schemas or field configurations.

---

## 2. Multi-Tenant Client Isolation & Scoping

Data confidentiality across multi-tenant boundaries is absolute. Cross-tenant submission leakage is an unrecoverable security violation:

### 1. Mandatory Tenant Filtering (`clientId`)
- Every submission query and in-memory list must be explicitly filtered by `client.id`:
  ```sql
  SELECT * FROM submissions WHERE client_id = ? ORDER BY submitted_at DESC
  ```
- Submissions from Client A must **NEVER** be visible, accessible, or exported within the workspace of Client B.

### 2. Form-Level Sub-Filtering
- Within an authenticated client's workspace, the ledger provides optional filtering by `formId`:
  - `All Forms`: Aggregates all incoming submissions across all client intake funnels.
  - Specific Form: Scopes the table view and dynamic columns strictly to the selected form's field structure.

### 3. Database Foreign Key Scoping
- In Cloudflare D1, every record in `submissions` maintains a foreign key constraint to `clients(id)` and `forms(id)`:
  ```sql
  CREATE TABLE submissions (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES forms(id),
    client_id TEXT NOT NULL REFERENCES clients(id),
    domain TEXT NOT NULL,
    values_json TEXT NOT NULL,
    url_params_json TEXT NOT NULL DEFAULT '{}',
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ```

---

## 3. Append-Only Immutability & Audit Integrity

Form submissions represent legal, financial, and operational intake records:

### 1. Append-Only Invariant
- Submissions are strictly **append-only**.
- **PROHIBITION**: Form submission responses, field values, and captured URL parameters must **never** be edited, updated, or overwritten after initial insertion.
- The Cloudflare Worker API exposes zero `PUT` or `PATCH` endpoints for `/api/submissions/:id` payload data.

### 2. Deletion Guardrails
- Individual submission row editing is prohibited.
- Bulk purge operations (`onClearSubmissions` / `DELETE /api/submissions`) require elevated administrative permissions (`agency_admin`) and explicit user confirmation to prevent accidental loss of lead data.
- Clearing submissions is constrained strictly to the active `clientId`.

### 3. Standardized Timestamps
- All submission timestamps (`submittedAt`, `createdAt`) are stored and transmitted as UTC ISO-8601 strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- Timestamps render in the UI with both relative time ("2 hours ago") and precise UTC monospace tooltips.

---

## 4. Delivery Log & Third-Party Audit Inspection

When a submission is ingested, the system dispatches payloads to configured integrations (GoHighLevel, Close, Zoho, Airtable, Webhooks) and logs every outcome:

### 1. Delivery Status States
Each integration dispatch logs an `IntegrationDeliveryLog` entry with one of three terminal states:

| Status | Visual Indicator | Definition & Criteria |
| :--- | :--- | :--- |
| `delivered` | Emerald Badge (`bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400`) | External service responded with HTTP 2xx. Delivery confirmed. |
| `pending` | Neutral Zinc Badge (`bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`) | Enqueued in store-and-forward queue awaiting worker dispatch. |
| `failed` | Rose Badge (`bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400`) | External HTTP 4xx/5xx status, request timeout, DNS failure, or rate limit. |

### 2. Deep Delivery Inspection Drawer
Clicking a submission or delivery log opens an inspection drawer detailing:
- **Integration Name & Provider**: Monospace badge indicating the connector (`GHL`, `CLOSE`, `ZOHO`, `AIR`, `HOOK`).
- **Endpoint Target**: Destination webhook or API URL.
- **HTTP Response Code**: Exact status returned by the third-party endpoint (e.g. `200 OK`, `401 Unauthorized`, `429 Too Many Requests`).
- **Payload Preview**: Exact JSON payload dispatched to the remote service.
- **Diagnostics & Error Response**: Remote server response body or error message to diagnose misconfigured field keys or expired API tokens.
- **Friendly Non-Technical Translations**: Customer-facing status summaries explaining that responses are safely stored and awaiting retry.

---

## 5. Export Capabilities & CSV Sanitization

The ledger provides instant, client-side data export in both CSV and JSON formats:

### 1. Dynamic Column Resolution
- Rather than rendering raw field IDs (`field_18a9x`), the export generator inspects the form's `FormSchema.fields` to extract human-readable `label` values for column headers.
- Campaign parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `fbclid`) are automatically unpacked into dedicated, readable columns.

### 2. CSV Formula Injection Defense (CSV / Spreadsheet Injection)
- **SECURITY RISK**: Unsanitized user inputs opened in Microsoft Excel or Google Sheets that begin with formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) can execute arbitrary code or exfiltrate data.
- **SANITIZATION RULE**: Every field value exported to CSV must be checked. If a value begins with `=`, `+`, `-`, `@`, `\t`, or `\r`, it **MUST** be escaped by prepending a single quote (`'`) to neutralize formula execution:
  ```typescript
  function sanitizeCsvCell(value: unknown): string {
    if (value === null || value === undefined) return '""';
    const stringValue = String(value);
    const sanitized = /^[=+\-@\t\r]/.test(stringValue)
      ? `'${stringValue}`
      : stringValue;
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  ```

### 3. File Download Protocol
- Exports generate valid Blobs (`text/csv;charset=utf-8;` or `application/json;charset=utf-8;`).
- Standardized file naming convention:
  - CSV: `submissions-<form-slug>-<timestamp>.csv`
  - JSON: `submissions-<form-slug>-<timestamp>.json`
- Temporary Blob URLs are cleaned up immediately via `URL.revokeObjectURL(url)`.

---

## 6. Resubmission & Retry Orchestration

When an external CRM, webhook, or API endpoint is temporarily unavailable, the system guarantees zero data loss through manual and automated retries:

### 1. Non-Duplicating Retry Protocol
- Triggered via `onRetrySubmission(submissionId)` calling `POST /api/submissions/:id/retry`.
- **CRITICAL INVARIANT**: Retrying a delivery **re-dispatches the existing submission** to failed integrations. It **MUST NEVER** duplicate the submission record in `submissions` or generate a new `submission.id`.
- Delivery logs in `submission_deliveries` are updated or appended with the new attempt count and fresh response status.

### 2. Optimistic UI Updates & Snapshot Rollback
- On retry click, the ledger updates the submission's delivery status optimistically to `pending`.
- If the retry request fails due to network outage, state immediately rolls back to the previous snapshot and displays a dismissible error notification.

---

## 7. UI/UX & Accessibility Guardrails

All ledger views must adhere strictly to the [`DESIGN.md`](/DESIGN.md) specification:

- **Neutral Zinc Token Palette**: Tables styled with `border-zinc-200 dark:border-zinc-800` hairline dividers and subtle hover rows (`hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60`).
- **Compact Enterprise Density**: Dense table rows with `py-2.5 px-3`, compact badges (`h-5 text-[10px] font-mono uppercase tracking-wider`), and compact action buttons (`h-8`).
- **Monospace Technical Metadata**: Monospace styling (`font-mono text-xs`) for submission IDs, status codes, dates, and query parameters.
- **WCAG 2.1 AA Compliance**: Full keyboard accessibility (`tabIndex={0}`, enter/space row expansion), visible focus indicators, and semantic `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>` markup.

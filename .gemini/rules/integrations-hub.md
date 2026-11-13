# Integrations Hub — Architecture, Store-and-Forward & Connector Governance

This document defines the architectural standards, store-and-forward delivery patterns, field mapping protocols, and credential security rules for the Integrations Hub feature (`src/features/integrations-hub/`).

---

## 1. Feature Scope & Architectural Boundary

The Integrations Hub manages third-party CRM connectors, webhook automation endpoints, custom field mappings, and integration delivery dispatching:

```
src/features/integrations-hub/
├── IntegrationsHub.tsx     # Provider catalog, configuration drawers, field mapping matrix
└── index.ts                # Public feature export barrel
```

### Unidirectional Dependency Hierarchy
Dependencies strictly flow inward:
```
App.tsx  ──▶  src/features/integrations-hub/  ──▶  src/domain/form-schema/  ──▶  src/shared/
```

### Strict Boundary Invariants
- **Zero Cross-Feature Imports**: The integrations hub must never import from sibling features (`builder-canvas`, `field-palette`, `property-inspector`, `public-runner`, `submissions-ledger`).
- **Domain Contract Enforcement**: Consumes and updates domain models (`FormIntegrationConfig`, `FieldMapping`, `IntegrationProvider`, `FormSchema`, `ClientTenant`) via callbacks (`onUpsertIntegration`, `onRemoveIntegration`, `onUpdateSchemaMeta`).
- **No Direct Network Dispatches from UI**: The UI manages configuration only. Runtime dispatching occurs on the server (Cloudflare Worker) to prevent exposing webhook secrets or CORS restrictions.

---

## 2. Store-and-Forward Architecture & Ingestion Guarantee

External third-party APIs (CRMs, webhooks, databases) are prone to rate limits, cold starts, outages, and breaking schema changes. The Form Builder protects inbound data through an ironclad **Store-and-Forward** architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Public Ingestion Request                        │
│                       (POST /api/public/submit)                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Stage 1: Local Store (Guaranteed)                    │
│    - Commit raw values & URL parameters to Cloudflare D1 `submissions` │
│    - Return HTTP 200 OK to the submitting customer immediately        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Stage 2: Forward (Asynchronous Dispatch)               │
│    - Query enabled integrations for form_id                            │
│    - Transform field values according to `fieldMappings`               │
│    - Dispatch HTTP POST requests to third-party provider endpoints     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Stage 3: Audit & Delivery Logging                      │
│    - Record dispatch outcome in `submission_deliveries`                │
│    - Persist HTTP status code, request payload preview, response body  │
│    - Flag as 'delivered' (HTTP 2xx) or 'failed' for on-demand retry    │
└────────────────────────────────────────────────────────────────────────┘
```

### Non-Negotiable Reliability Invariants
1. **Zero Data Loss Guarantee**: A network failure, timeout, or invalid field key from an external CRM provider **MUST NEVER** fail the customer's form submission or prevent the submission from being saved.
2. **Asynchronous Decoupling**: If an external provider takes 5 seconds to respond, the customer must not experience a 5-second spinner; the submission is committed immediately in Stage 1.
3. **Resilience Through Retries**: Any failed delivery can be inspected in the Submissions Ledger and retried on-demand without re-entering form data.

---

## 3. Supported Native Providers & Connector Specs

The Integrations Hub provides first-class support for 5 native automation and CRM providers:

| Provider | Key | Default Name | Protocol & Endpoint Pattern | Primary Scoping Target |
| :--- | :--- | :--- | :--- | :--- |
| **GoHighLevel** | `ghl` | GoHighLevel Lead Connector | HTTP POST to LeadConnector Webhook / API v2 | `Location ID` (e.g. `loc_live_8912x`) |
| **Close CRM** | `close` | Close CRM Lead & Contact | HTTP POST / REST API v1 (`/api/v1/lead/`) | `Lead Status` (e.g. `Potential Lead`) |
| **Zoho CRM** | `zoho` | Zoho CRM Module Upsert | HTTP POST to Zoho CRM API v3 (`/crm/v3/Leads`) | `Target Module` (e.g. `Leads` or `Contacts`) |
| **Airtable** | `airtable` | Airtable Base Sync | HTTP POST to Airtable Web API (`/v0/appXXXX/tblYYYY`) | `Table Name / ID` (e.g. `Submissions`) |
| **Custom Webhook** | `webhook` | Custom Webhook (Make / Zapier / n8n) | Raw HTTP POST JSON Payload | `Trigger Event` (e.g. `lead_inbound`) |

### Provider Configurations (`FormIntegrationConfig`)
```typescript
export interface FormIntegrationConfig {
  id: string;
  provider: IntegrationProvider;
  name: string;
  enabled: boolean;
  endpointUrl: string;
  targetResource?: string;
  apiKeyMasked?: string;
  fieldMappings: FieldMapping[];
}
```

---

## 4. Explicit Field Mapping Engine

To ensure payloads seamlessly match target CRM schemas without manual transformation scripts, integrations enforce explicit key-value field mapping:

### 1. Mapping Structure
```typescript
export interface FieldMapping {
  formFieldId: string;    // Form Field ID (e.g. "field_email_1", "utm_source")
  remoteFieldKey: string; // Destination CRM key (e.g. "email", "custom.cf_campaign")
}
```

### 2. CRM Field Presets
The hub surfaces standardized presets for rapid mapping:
- Full Name (`full_name`)
- First Name (`first_name`)
- Last Name (`last_name`)
- Email Address (`email`)
- Phone Number (`phone`)
- Company Name (`company`)
- Company Size (`custom.cf_company_size`)
- Service / Interest (`service_type`)

### 3. Dynamic Custom Mappings & Query Parameters
- Form fields (text, select, radio, date, etc.) can be mapped to any arbitrary CRM field key.
- Hidden fields and captured URL query parameters (`utm_source`, `utm_medium`, `gclid`) can be mapped directly into CRM attribution fields.
- Form fields omitted from `fieldMappings` are excluded from the transformed remote payload or packaged under a fallback `raw_data` object depending on provider settings.

---

## 5. Delivery Audit Trail & State Transitions

Every dispatch attempt is recorded in the Cloudflare D1 `submission_deliveries` table:

```sql
CREATE TABLE submission_deliveries (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  integration_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'delivered', 'failed')),
  http_status INTEGER,
  request_payload_json TEXT NOT NULL,
  response_body TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Audit Invariants
- **Audit Logging**: Every outgoing `fetch` records HTTP status, timestamp, masked endpoint URL, dispatch payload, and remote response headers/body.
- **Retry History**: Retrying a delivery updates the existing delivery record or appends an audit event while tracking `attempt_count`.

---

## 6. Credential Security, Masking & Redaction

API keys, OAuth tokens, and webhook secrets grant direct access to external accounts and must be handled with extreme care:

### 1. Masked Storage & Client Redaction
- In the frontend UI and client-facing API responses, API keys and secrets must **ALWAYS** be masked (e.g., `ghl_live_••••••••7c4a`, `api_key_••••••••1b82`, `pat_live_••••••••811d`).
- Plaintext API tokens must never be logged in console outputs, error traces, or client state.

### 2. Zero Secret Leaks in Public Schema
- The public runner endpoint (`/api/public/resolve`) resolves form schemas for public viewers.
- **SECURITY MANDATE**: Public schema responses **MUST STRIP** the entire `integrations` array or redact all endpoint URLs and API keys. Unauthenticated public visitors must never discover third-party webhook URLs or API credentials.

### 3. RBAC Scoping
- Only users with verified role `agency_admin` or authorized `client_editor` may view integration configurations and update endpoint URLs.

---

## 7. UI/UX & Accessibility Guardrails

All elements within `src/features/integrations-hub/` must conform to [`DESIGN.md`](/DESIGN.md):

- **Neutral Zinc Palette**: Neutral cards (`border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900`), subtle toggle switches, and neutral hover accents.
- **Compact Enterprise Layout**: 36px inputs (`h-9`), compact 32px buttons (`h-8`), and clean 2-column key-value mapping rows.
- **Technical Provider Badges**: Monospace uppercase badge tags (`font-mono text-[10px] tracking-wider uppercase`).
- **WCAG 2.1 AA Compliance**:
  - Accessible toggle switches (`role="switch"`, `aria-checked`).
  - Labeled inputs with `aria-label` or `<label>` wrappers.
  - Visible keyboard focus rings (`focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300`).

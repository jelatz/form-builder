# Schema I/O — Architecture, Serialization & AST Integrity Governance

This document establishes the architectural standards, AST serialization invariants, schema validation rules, and export protocols for the Schema I/O feature (`src/features/schema-io/`).

---

## 1. Feature Scope & Architectural Boundary

Schema I/O provides bidirectional AST serialization, schema import validation, local JSON backups, template reset safeguards, and a real-time AST inspector:

```
src/features/schema-io/
├── SchemaInspector.tsx     # AST viewer, JSON tree inspector, file import/export handlers, reset confirmation
└── index.ts                # Public feature export barrel
```

### Unidirectional Dependency Hierarchy
Dependencies strictly flow inward:
```
App.tsx  ──▶  src/features/schema-io/  ──▶  src/domain/form-schema/  ──▶  src/shared/
```

### Strict Boundary Invariants
- **No Coupling to Feature Internals**: Schema I/O does not import from `builder-canvas`, `property-inspector`, `field-palette`, or `public-runner`.
- **Pure AST Handlers**: Interacts with the parent application shell strictly through typed contracts (`FormSchema`, `FormField`, `FormIntegrationConfig`) and callbacks (`onReplaceSchema`, `onResetSchema`).
- **Headless Domain Logic**: All structural validation rules rely purely on domain schemas; zero React or DOM logic is permitted within schema validation utilities.

---

## 2. 100% JSON Serializability & AST Purity

The `FormSchema` AST is the single source of truth for the entire application lifecycle (builder state, D1 database storage, Cloudflare Workers runtime, and export/import).

### 1. Hardcore Serialization Invariants
- **Zero Function References**: No callbacks, handlers, or methods may be placed on `FormSchema` or `FormField` objects.
- **Zero DOM / React Nodes**: No `JSX.Element`, `HTMLElement`, `ReactNode`, or browser references inside schema definitions.
- **Zero Class Instances**: All AST nodes must be plain JavaScript objects (`Record<string, unknown>`) matching TypeScript interfaces.
- **Zero Circular References**: The AST must be a strictly acyclic tree hierarchy.
- **Lossless Serialization**: Any valid `FormSchema` object must produce an identical, losslessly parsed schema when executed through:
  ```typescript
  const serialized = JSON.stringify(schema);
  const deserialized = JSON.parse(serialized) as FormSchema;
  ```

### 2. Separation of Editor State vs. Persisted Schema
Editor transient states must **NEVER** leak into `FormSchema`:
- `selectedFieldId`
- `activeSidebarTab`
- Drag ghost coordinates and drop indicators
- Form runtime values (`FormValues`) and validation error maps (`FormErrors`)

---

## 3. Schema Import Validation & Safety Checks

Allowing users to upload external JSON files introduces risks of application crashes, data corruption, or malformed AST states. Schema I/O enforces strict structural verification:

### 1. Deep Structural Validation (`parseAndValidateSchema`)
Before replacing active application state via `onReplaceSchema`, the uploaded JSON must pass rigorous multi-step inspection:

1. **Object Primitive Check**: Must be a non-null JavaScript object (`typeof data === 'object' && data !== null`).
2. **Mandatory Schema Properties**:
   - `id`: Non-empty string.
   - `title`: Non-empty string.
   - `fields`: Must be a valid JavaScript Array.
3. **Field-Level Discriminated Union Verification (`isValidFormField`)**:
   - Every entry in `fields` must contain valid `id` (string), `type` (valid `FieldType`), `label` (string), and `required` (boolean).
   - Known field types: `'text'`, `'email'`, `'phone'`, `'number'`, `'textarea'`, `'select'`, `'radio'`, `'checkbox'`, `'date'`, `'section'`, `'hidden'`.
   - Field-specific structure: If type is `'select'` or `'radio'`, `options` must be an array of `{ label: string, value: string }`.
4. **Metadata Sanitization**:
   - Preserve or safely default optional metadata: `description`, `slug`, `customDomain`, `status`, `settings`, and `integrations`.
   - Tenant Scoping: If the imported schema lacks a valid `clientId`, the current active workspace `clientId` is injected to prevent orphan records.

### 2. Error Trapping & Graceful Recovery
- If parsing or validation fails, throw an explicit, human-readable error (e.g., `"Missing or invalid 'fields' array in backup data"`).
- The existing active schema is preserved untouched.
- An alert/error message is displayed to the user with actionable instructions.

---

## 4. Safe Template Reset Flow

Resetting a form to its default initial template is a destructive action that wipes field configurations and custom mappings.

### 1. Accidental Data Loss Prevention
- **PROHIBITION**: A reset operation must **NEVER** occur on a single accidental click.
- **Confirmation Requirement**:
  - The UI must require explicit user confirmation via a confirmation dialog, modal, or two-step button ("Are you sure you want to reset? This will restore the default template.").
  - Provide a clear warning that any unsaved modifications will be permanently discarded.

### 2. State Rollback Snapshot
- Before executing `onResetSchema()`, capture the current schema in the undo stack or local memory, allowing users to undo an accidental reset.

---

## 5. Standardized Backup & Export Standard

Schema exports enable offline backups, version archiving, and cross-client template cloning:

### 1. Standardized Filename Convention
Exported backup files must follow a predictable, clean naming format:
```
form-backup-<slug>.json
```
- If `schema.slug` is empty or undefined, fall back to `form-backup-<id>.json` or `form-backup-form.json`.
- Slugs must be sanitized to lowercase alphanumeric characters with hyphens (no spaces or special characters).

### 2. Indentation & Formatting Standard
- Exported JSON must be formatted with **2-space indentation** for human readability and git diff inspection:
  ```typescript
  const dataStr = JSON.stringify(schema, null, 2);
  ```

### 3. Clean Client-Side Download Lifecycle
```typescript
const blob = new Blob([dataStr], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `form-backup-${schema.slug || 'form'}.json`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
```
- Temporary Blob URLs are immediately revoked to prevent memory leaks.

---

## 6. Live JSON Tree Inspector & Clipboard Protocol

The Schema Inspector includes a live, read-only representation of the current `FormSchema` AST:

### 1. Real-Time Synchronization
- Reactively re-renders as fields are added, modified, reordered, or removed on the builder canvas.
- Operates with zero layout lag and zero background polling.

### 2. Ergonomics & Styling
- Rendered in a high-density, scrollable code container (`max-h-96 overflow-y-auto`).
- Monospace font styling (`font-mono text-xs leading-relaxed`).
- Neutral dark/light surface tokens (`bg-zinc-950 text-zinc-100 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg p-3`).

### 3. Clipboard Protocol
- "Copy JSON" button triggers modern asynchronous clipboard write:
  ```typescript
  navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
  ```
- **Visual Feedback**: The button temporarily transitions to a confirmed state ("Copied!") and automatically reverts to default after 2,000ms.
- Fallback gracefully if clipboard access is denied or unavailable.

---

## 7. UI/UX & Accessibility Guardrails

All elements within `src/features/schema-io/` must adhere strictly to [`DESIGN.md`](/DESIGN.md):

- **Neutral Zinc Token Palette**: Pure monochrome foundation with high-contrast text and 1px hairline borders (`border-zinc-200 dark:border-zinc-800`).
- **Accessible File Upload Trigger**:
  - The hidden file input (`type="file" accept=".json,application/json" className="sr-only"`) must be triggered via an accessible, keyboard-operable button (`<Button onClick={() => fileInputRef.current?.click()}>`).
- **WCAG 2.1 AA Compliance**:
  - Focus indicators on all buttons and interactive controls (`focus-visible:ring-2`).
  - Screen-reader accessible feedback for copy and reset events (`aria-live="polite"`).
  - High contrast on monospace code blocks.
- **Compact Enterprise Density**: Standard 36px buttons (`h-9`), compact 32px toolbars (`h-8`), and uppercase monospace badge metadata (`font-mono text-xs uppercase`).

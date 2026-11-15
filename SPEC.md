# Form Builder — Product Specification (`SPEC.md`)

## 1. Product Vision & Scope

An enterprise-grade, drag-and-drop **Multi-Tenant Form Builder & Submission Platform** built with React 19, TypeScript 6, and Tailwind CSS v4.

Users can visually compose forms from a rich field palette, configure field validation and properties in a live inspector, test forms in an interactive runtime preview, import/export portable JSON schemas, and manage multi-tenant form publishing and submission storage.

---

## 2. Core Data Models (Domain AST Contract)

All schemas and records are strictly typed, 100% JSON-serializable, and scoped by tenant (`clientId`).

### 2.1 Field Types (`FieldType`)

The builder supports 7 core field types out of the box:

```typescript
export const FIELD_TYPES = [
  'text',
  'number',
  'select',
  'checkbox',
  'radio',
  'date',
  'email',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];
```

### 2.2 Discriminated Union (`FormField`)

Every field shares `BaseFieldConfig` and extends it with type-specific properties:

```typescript
export interface BaseFieldConfig {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helperText?: string;
  required: boolean;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface TextFieldConfig extends BaseFieldConfig {
  type: 'text';
  minLength?: number;
  maxLength?: number;
}

export interface EmailFieldConfig extends BaseFieldConfig {
  type: 'email';
  allowedDomains?: string[]; // Optional domain whitelist (e.g. ["company.com"])
}

export interface NumberFieldConfig extends BaseFieldConfig {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
}

export interface SelectFieldConfig extends BaseFieldConfig {
  type: 'select';
  options: SelectOption[];
}

export interface RadioFieldConfig extends BaseFieldConfig {
  type: 'radio';
  options: SelectOption[];
}

export interface CheckboxFieldConfig extends BaseFieldConfig {
  type: 'checkbox';
  defaultChecked?: boolean;
}

export interface DateFieldConfig extends BaseFieldConfig {
  type: 'date';
  minDate?: string; // ISO YYYY-MM-DD
  maxDate?: string; // ISO YYYY-MM-DD
}

export type FormField =
  | TextFieldConfig
  | EmailFieldConfig
  | NumberFieldConfig
  | SelectFieldConfig
  | RadioFieldConfig
  | CheckboxFieldConfig
  | DateFieldConfig;
```

### 2.3 Form Schema & Multi-Tenant Entities

```typescript
export interface ClientTenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface FormSchema {
  id: string;
  clientId: string;
  slug: string;
  title: string;
  description?: string;
  submitButtonText?: string;
  fields: FormField[];
  updatedAt: string;
}

export interface SubmissionRecord {
  id: string;
  formId: string;
  clientId: string;
  values: Record<string, unknown>;
  submittedAt: string;
}
```

---

## 3. Field Behavior & Validation Matrix

| Field Type | Runtime Input Control | Inspector Properties | Validation Rules |
| :--- | :--- | :--- | :--- |
| **`text`** | `<input type="text">` | Label, Placeholder, Helper Text, Required, Min/Max Length | Non-empty if required; string length within `[minLength, maxLength]`. |
| **`email`** | `<input type="email">` | Label, Placeholder, Helper Text, Required, Allowed Domains | Non-empty if required; valid RFC email format; optional domain match. |
| **`number`** | `<input type="number">` | Label, Placeholder, Helper Text, Required, Min, Max, Step | Valid numeric value if provided/required; within `[min, max]`. |
| **`select`** | `<select>` dropdown | Label, Placeholder, Helper Text, Required, Options (`label`/`value` list) | Must match a valid option value if required. |
| **`radio`** | Radio group (`<input type="radio">`) | Label, Helper Text, Required, Options (`label`/`value` list) | Must select one option value if required. |
| **`checkbox`** | Checkbox (`<input type="checkbox">`) | Label, Helper Text, Required, Default Checked | Must be `true` if `required: true` (e.g., terms acceptance). |
| **`date`** | `<input type="date">` | Label, Helper Text, Required, Min Date, Max Date | Valid `YYYY-MM-DD`; within `[minDate, maxDate]` bounds. |

---

## 4. User Interface & Workspace Layout

The application enforces a **persistent left-hand side navigation rail** (`<aside aria-label="Workspace Navigation">`) within a horizontal flex-row app shell (`flex flex-row`). Primary workspace mode navigation (`All Forms`, `Edit Builder`, `Live Preview`, `Submissions`, `Schema JSON`) and tenant/form switching are **strictly housed on the left side rail and must never be moved to a horizontal top navigation bar**.

The right-hand workspace column contains a top navigation bar (`<header>`) that sits above the workspace viewports. This header ALWAYS includes an option (button) to **minimize / expand the left side navigation**:
- **Expanded (`w-60`)**: The left rail displays the full brand header, vertical `TenantSwitcherBar` (stacked tenant/form selects and `+ Tenant` / `+ Form` action buttons), 5 workspace mode navigation buttons with SVG icons, text labels, and count badges, and the active tenant/form scope footer.
- **Minimized (`w-16`)**: The left rail collapses into an **icon-only rail** displaying ONLY icons for the brand mark, tenant & form switchers (`collapsed={true}`), workspace mode buttons (`All Forms`, `Edit Builder`, `Live Preview`, `Submissions`, `Schema JSON` with accessible tooltips), and a compact footer indicator.

```
┌──────────────────┬──────────────────────────────────────────────────────────────────────────┐
│ Left Nav Rail    │ Top Nav Bar: [«] Toggle │ Active Form Title [Acme] │ [Undo][Redo] [Access]   │
│ (w-60 or w-16)   ├──────────────────┬───────────────────────────────────┬───────────────────┤
│                  │ Field Palette    │ Center Workspace                  │ Right Sidebar     │
│ (Tenant / Mode)  │ (Edit Mode Only) │ (Builder Canvas / Live Preview)   │ (Inspector / IO)  │
├──────────────────┼──────────────────┼───────────────────────────────────┼───────────────────┤
│ • FormBuilder    │ + Text           │  ┌─────────────────────────────┐  │ Field Label       │
│                  │ + Email          │  │ [1] Full Name        [Copy] │  │ [Full Name      ] │
│ Tenant   [+Ten]  │ + Number         │  │ [_________________________] │  │                   │
│ [Acme Corp    v] │ + Select         │  └─────────────────────────────┘  │ Required      [x] │
│                  │ + Radio          │  ┌─────────────────────────────┐  │ Min Length    [2] │
│ Form    [+Form]  │ + Checkbox       │  │ [2] Work Email        [Del] │  │ Max Length  [100] │
│ [Intake Form  v] │ + Date           │  │ [_________________________] │  │                   │
│                  │                  │  └─────────────────────────────┘  │                   │
│ WORKSPACE        │                  │                                   │                   │
│ [All Forms    3] │                  │                                   │                   │
│ [Edit Builder  ] │                  │                                   │                   │
│ [Live Preview  ] │                  │                                   │                   │
│ [Submissions  2] │                  │                                   │                   │
│ [Schema JSON   ] │                  │                                   │                   │
│ ──────────────── │                  │                                   │                   │
│ (When Minimized) │                  │                                   │                   │
│ [•] Brand Icon   │                  │                                   │                   │
│ [🏢] Tenant Icon  │                  │                                   │                   │
│ [📝] Form Icon    │                  │                                   │                   │
│ [📁] All Forms    │                  │                                   │                   │
│ [✏️] Edit Builder │                  │                                   │                   │
│ [👁️] Live Preview │                  │                                   │                   │
│ [📥] Submissions │                  │                                   │                   │
│ [⚡] Schema JSON  │                  │                                   │                   │
└──────────────────┴──────────────────┴───────────────────────────────────┴───────────────────┘
```

---

## 5. Phased Implementation Milestones

When vibe-coding, implement and verify one milestone at a time:

### Milestone 1: Pure Domain Core (`src/domain/form-schema/`)
- [x] Define `types.ts` with `ClientTenant`, `FormSchema`, `SubmissionRecord`, and the 7 `FormField` variants (`text`, `email`, `number`, `select`, `radio`, `checkbox`, `date`).
- [x] Implement pure, immutable AST operations in `operations.ts`: `addField`, `removeField`, `updateField`, `moveField`, `duplicateField`.
- [x] Implement runtime field & form validation in `validation.ts` (`validateField`, `validateForm`).

### Milestone 2: Shared UI Primitives & Open/Closed Field Registry (`src/shared/` & `src/fields/`)
- [x] Create clean `zinc` UI primitives in `src/shared/ui/` (Button, Input, Label, Switch/Checkbox, Badge).
- [x] Create `src/fields/registry.ts` mapping each `FieldType` to its `FieldDefinition` (`createDefaultConfig`, `render`, `renderInspector`).
- [x] Implement all 7 field modules (`text-field.tsx`, `email-field.tsx`, `number-field.tsx`, `select-field.tsx`, `radio-field.tsx`, `checkbox-field.tsx`, `date-field.tsx`).

### Milestone 3: Core Builder Workbench (`src/features/`)
- [x] **`field-palette`**: Click or drag any of the 7 registered fields to insert into the active form.
- [x] **`builder-canvas`**: Render form title/description editor and ordered field cards with selection, up/down/drag reordering, duplication, and deletion, plus Undo/Redo history.
- [x] **`property-inspector`**: Inspect and edit the currently selected field using `definition.renderInspector()`, or edit form-level metadata when no field is selected.

### Milestone 4: Live Form Runner & Schema JSON I/O (`src/features/`)
- [x] **`form-renderer`**: Interactive runtime form execution with live validation, field-level error messages, and submission handling.
- [x] **`schema-io`**: View, copy, download, and import raw `FormSchema` JSON with structural validation.

### Milestone 5: Multi-Tenant Management & Submission Storage
- [x] **Tenant & Form Switcher**: Create/switch between `ClientTenant` workspaces (scoped by unique `slug`) and manage multiple forms per tenant (`UNIQUE(clientId, slug)`).
- [x] **Submission Storage & Viewer**: Store form submissions (`SubmissionRecord`) scoped to `clientId` and `formId` (persisted via storage service / Cloudflare D1 API adapter with optimistic UI updates), inspect submitted payloads in a tabular `Submissions` tab, export CSV/JSON, and clear/retry records.

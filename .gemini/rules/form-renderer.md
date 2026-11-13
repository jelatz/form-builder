# Form Renderer — Runtime State, Execution Protocol & Governance

This document establishes the architectural standards, runtime lifecycle rules, and execution governance for the Form Renderer feature (`src/features/form-renderer/`).

---

## 1. Architectural Scope & Unidirectional Boundary

The Form Renderer is the execution engine responsible for rendering interactive forms, managing runtime state, evaluating conditional visibility, performing client-side validation, capturing URL parameters, and orchestrating form submissions. It operates under the repository's unidirectional architecture:

```
App.tsx / PublicRunner  ──▶  src/features/form-renderer/  ──▶  src/fields/  ──▶  src/domain/  ──▶  src/shared/
```

### Strict Boundary Rules
- **Pure Runtime State Isolation**: Runtime form state must remain strictly segregated from editor state (`selectedFieldId`, `previewMode`) and `FormSchema`. The schema is treated as an immutable AST definition.
- **Zero Editor Coupling**: The renderer must not import from editor features (`builder-canvas`, `property-inspector`, `field-palette`). It can run both embedded inside the builder's preview tab and as a standalone runtime runner (`public-runner`).
- **Open/Closed Field Rendering**: Individual field controls are rendered exclusively via `renderFieldInput` or `getFieldDefinition(field.type).render(...)`. No `switch (field.type)` logic is permitted inside the renderer layout components.

---

## 2. Pure Runtime State Management

The Form Renderer maintains runtime execution state completely separated from schema definition:

### State Primitives
- **`FormValues` (`Record<string, unknown>`)**: Current runtime values mapped by field ID. Initialized via `createDefaultFormValues(schema.fields)`.
- **`FormErrors` (`Record<string, string>`)**: Active validation error messages mapped by field ID.
- **`touchedFields` (`Record<string, boolean>`)**: Map of field IDs that have received user interaction (focus blur), preventing premature validation error displays.
- **`isSubmitting` (`boolean`)**: Flag indicating an ongoing submission network request to disable double-submits and display loading indicators.
- **`submitStatus` (`'idle' | 'success' | 'error'`)**: Terminal submission lifecycle state.

---

## 3. Dynamic Conditional Visibility Engine

Form fields can declare conditional display rules (`conditions`). The renderer dynamically evaluates visibility before rendering and submission:

### Visibility Evaluation
- Visbility is computed reactively on each value change via `isFieldVisible(field, values)` from `src/domain/form-schema/validation.ts`.
- If a field evaluates to hidden (`isFieldVisible === false`):
  1. The field and its container are omitted from the DOM layout.
  2. Any existing validation errors for the hidden field are cleared from `FormErrors`.
  3. On form submission, values for hidden fields are stripped from the submission payload, ensuring clean backend records.

---

## 4. Multi-Stage Validation Lifecycle

Validation occurs in two distinct, coordinated stages:

### Stage 1: Real-Time On-Blur Validation
- When a user blurs (`onBlur`) an input field, the field is marked as touched in `touchedFields`.
- The renderer runs `validateFieldValue(field, values[field.id], values)`.
- If invalid, `FormErrors` is updated with the field's error message; if valid, any previous error for that field is cleared.
- Error messages are rendered directly below the input with `aria-live="polite"` and linked via `aria-describedby`.

### Stage 2: Full-Form Pre-Submission Validation
- When the user submits the form (`onSubmit`), all fields are marked as touched.
- The renderer runs `validateFormValues(schema, values)`.
- If any visible field fails validation:
  1. `FormErrors` is populated with all active errors.
  2. The form submission is aborted.
  3. The first invalid field receives focus automatically to guide the user.
- If all visible fields pass, the submission proceeds to delivery.

---

## 5. Responsive 12-Column Grid Layout

The renderer aligns form fields into a 12-column responsive layout matching the builder canvas:

```typescript
const COL_SPAN_CLASSES: Record<FieldColSpan, string> = {
  12: 'col-span-1 md:col-span-12',
  8: 'col-span-1 md:col-span-8',
  6: 'col-span-1 md:col-span-6',
  4: 'col-span-1 md:col-span-4',
};
```
- **Mobile-First Responsiveness**: All fields collapse to single-column (`col-span-1`) on mobile viewports (< 768px). On medium viewports and above, fields expand to their configured span (`md:col-span-X`).
- **Section Dividers**: `section` fields render full-width dividers with accessible headings (`<h2>`/`<h3>`) and clear structural separation.
- **Hidden Fields**: `hidden` fields are excluded from visual grid rendering entirely.

---

## 6. URL Parameter Capture, Store-and-Forward & Redirects

The runtime runner supports comprehensive campaign tracking, pre-filling, and post-submission redirection:

### URL Parameter Capture
- Query string parameters from the current URL are extracted via `parseQueryString(window.location.search)`.
- If a hidden field matches a query parameter key (or if default form values are populated), its value is automatically assigned in `FormValues`.
- Captured URL parameters are stored alongside submission values for attribution and CRM sync.

### Post-Submission Routing & Redirection
- When submission settings specify a redirect URL:
  - The URL is formatted using `computeRedirectUrl(...)`.
  - If `appendParams` is enabled, all form values and URL tracking parameters are appended as query strings to the destination URL.
- If no redirect URL is set, the renderer transitions to the configured thank-you confirmation view.

---

## 7. Visual Design Tokens & Accessibility (WCAG 2.1 AA)

The renderer strictly complies with [`DESIGN.md`](/DESIGN.md):
- **Neutral Zinc Palette**: High-contrast inputs with neutral surfaces (`bg-white dark:bg-zinc-900`), subtle borders (`border-zinc-300 dark:border-zinc-700`), and dark text.
- **Compact Enterprise Sizing**: Standardized 36px control heights (`h-9`), clean label typography (`text-xs font-medium text-zinc-700 dark:text-zinc-300`).
- **Visible Focus Rings**: High-visibility 2px focus outlines (`focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-100`).
- **Semantic Form Elements**: Accessible `<form>`, `<label htmlFor={field.id}>`, `aria-required`, `aria-invalid`, and error messages with matching `id` attributes for screen readers.
- **Zero Slop**: No rainbow button gradients, no cartoonish rounded corners (maximum radius is `rounded-lg`), and no non-standard visual gimmicks.

# Business Rules & Architecture: Forms Lifecycle & Management

This document defines the architectural boundaries, lifecycle states, business invariants, deletion/duplication mechanics, and UX specifications for `src/features/forms-manager/`.

---

## 1. Feature Scope & Component Inventory

The `forms-manager` feature provides the dashboard catalog and administrative hub where users browse, search, filter, sort, create, duplicate, configure metadata for, and delete forms within an active tenant:

```
src/features/forms-manager/
├── FormsManager.tsx       # Main catalog dashboard with Grid/Table views, search bar, filters & sort controls
├── EditFormModal.tsx      # Modal dialog for updating title, description, slug, custom domain & publish status
├── DeleteFormModal.tsx    # Accessible confirmation modal safeguarding against accidental form destruction
└── index.ts               # Public feature export barrel
```

### Boundary & Dependency Guardrails
- **Unidirectional Flow**: `src/features/forms-manager/` imports domain entities (`FormSchema`, `ClientTenant`, `SubmissionRecord`) from `src/domain/form-schema/` and UI primitives from `src/shared/`.
- **Zero Cross-Feature Imports**: Never import directly from `src/features/builder-canvas/` or `src/features/form-renderer/`. Transitions to the editor or preview modes are triggered via callbacks passed by `App.tsx` (`onEditForm(id)`, `onPreviewForm(id)`).
- **Separation of Presentation vs Storage**: The catalog does not mutate AST field nodes directly; it operates solely on top-level form metadata (`title`, `slug`, `status`, `customDomain`, `description`).

---

## 2. Multi-Tenant Form Scoping & Unique Slug Constraints

Forms exist strictly within the boundary of an assigned client tenant:

1. **Mandatory Tenant Scoping**:
   - Every `FormSchema` must possess a non-empty `clientId` corresponding to a valid `ClientTenant` row in Cloudflare D1.
   - Cross-client querying or modification is strictly prohibited.
2. **Compound Unique Slug Constraint**:
   - The D1 database enforces `UNIQUE(client_id, slug)`.
   - Different clients may use the same slug (e.g. `client-a` and `client-b` can both have `contact-us`), but within the same client, slugs must be unique.
3. **URL-Safe Kebab-Case Formatting**:
   - Slugs must match the regular expression `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`.
   - Input fields for slugs must automatically normalize inputs (lowercase, replace spaces/special characters with hyphens, strip consecutive hyphens).

---

## 3. Form Lifecycle & Publishing Semantics

A form transitions between two canonical lifecycle states:

```
┌──────────────┐     Publish Action      ┌─────────────────┐
│    Draft     │ ──────────────────────▶ │    Published    │
│  (Internal)  │ ◀────────────────────── │ (Public Runner) │
└──────────────┘    Unpublish Action     └─────────────────┘
```

### State Behaviors
- **`draft`**:
  - The form is under active construction.
  - The public runner (`/api/public/resolve` and public web runner) rejects resolution with `HTTP 404 Form Not Found` or `HTTP 403 Form Not Published`.
  - Displayed with a neutral zinc draft badge (`font-mono text-xs uppercase`).
- **`published`**:
  - The form is live and accessible on its public URL and custom domain.
  - Endpoints allow submission ingestion and integration dispatching.
  - Displayed with an active status badge.
- **Immediate Revocation**: Unpublishing a form immediately revokes public accessibility with zero delay; subsequent public requests are blocked.

---

## 4. Deep Duplication Rules

When a form is duplicated via `onDuplicateForm`:

1. **Deep Schema Clone**: The entire `FormSchema` AST must be cloned without shallow reference sharing.
2. **New Identifiers**:
   - A new unique form ID is generated (`crypto.randomUUID()`).
   - Every field inside `schema.fields` **MUST** receive a freshly generated unique field ID to prevent ID collision across forms.
3. **Title & Slug Modification**:
   - Append `(Copy)` to the title: `"${original.title} (Copy)"`.
   - Append `-copy` to the slug: `"${original.slug}-copy"`. If a slug collision occurs, append numerical suffixes (e.g., `-copy-2`).
4. **Lifecycle Reset**: The duplicated form resets to `status: 'draft'`, preventing accidental immediate public exposure.
5. **Timestamp Update**: `createdAt` and `updatedAt` are initialized to the current UTC ISO-8601 timestamp.

---

## 5. Deletion Safeguards & Submission Integrity

Form deletion is an irreversible action requiring strict verification:

1. **Confirmation Modal Required (`DeleteFormModal.tsx`)**:
   - Deletion can never occur via a simple single-click action.
   - A modal dialog must present the form title, submission count, and clear warning text.
   - For forms with existing submissions, require the user to explicitly confirm understanding of submission impact.
2. **Data Integrity Enforcement**:
   - If a form has associated submissions in the `submissions` table:
     - Policy 1: Prevent deletion until submissions are exported/cleared, OR
     - Policy 2: Cascade deletion to submissions and delivery logs within an atomic D1 transaction.
3. **Optimistic Deletion with Snapshot Rollback**:
   - The form is removed from the local view immediately.
   - If the backend D1 deletion fails, the form is immediately restored to the catalog and an error toast is surfaced.

---

## 6. Pure In-Memory View Filtering, Search & Sorting

The dashboard catalog supports reactive search, status filtering, view toggles, and sorting as pure derived states (via `useMemo`):

### 1. View Modes
- **Grid View**: Responsive card grid (1 col mobile, 2 col tablet, 3 col desktop) with hairline borders, field count, submission count, and quick action menus.
- **Table View**: Compact enterprise table with tabular numbers, monospace IDs/slugs, status badges, and action columns.

### 2. Search & Status Filtering
- Search matches case-insensitively across `form.title`, `form.description`, and `form.slug`.
- Status filter options: `all`, `published`, `draft`.

### 3. Sorting Options
- `recent`: Order by `updatedAt` descending.
- `title`: Order alphabetically by `title` ascending.
- `questions`: Order by `fields.length` descending.
- `submissions`: Order by associated submission count descending.

---

## 7. Design Standards Compliance (DESIGN.md)

1. **Neutral Zinc Palette**: Strictly adhere to monochrome `zinc` shades (`border-zinc-200 dark:border-zinc-800`, `bg-zinc-50 dark:bg-zinc-900`).
2. **Hairline 1px Geometry**: All cards, modals, tables, and search controls use 1px borders instead of drop-shadows.
3. **Compact Enterprise Density**: Standardized 36px (`h-9`) inputs, buttons, and select dropdowns; 8px (`rounded-lg`) maximum radius.
4. **Technical Monospace Typography**: Monospace uppercase badges (`font-mono text-xs uppercase tracking-wider`) for slugs, status pills, and question/submission counters.
5. **No Visual Slop**: Zero purple/violet gradients, zero pastel blob cards, and zero bubbly `rounded-2xl` containers.

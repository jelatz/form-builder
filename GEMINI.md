# Form Builder — Architecture & Engineering Rules (`GEMINI.md`)

This repository implements an enterprise-grade, multi-tenant Form Builder web application in **React 19**, **TypeScript 6**, **Vite 8**, and **Tailwind CSS v4**.
For visual tokens and styling rules, consult [`DESIGN.md`](./DESIGN.md).

## Mandatory Context (`SPEC.md` Inline)
@[SPEC.md](./SPEC.md)

---

## 1. Architecture & Unidirectional Dependency Flow

Code under `src/` is partitioned by responsibility and stability:

```
src/
├── domain/form-schema/      # Pure TS AST types, validation, immutable operations (NO React/DOM)
├── fields/                  # Open/Closed Field Registry & self-contained field plugins
├── features/                # Product slices: field-palette, builder-canvas, property-inspector,
│                            # form-renderer, schema-io, tenant-submissions
├── shared/                  # Domain-agnostic UI primitives (shared/ui) & utilities (shared/lib)
└── App.tsx                  # Top-level shell composing features & workspace state
```

### Strict Dependency Direction (Zero Tolerance)
Dependencies must strictly flow inward:
`App.tsx` ──▶ `features/*` ──▶ `fields/*` ──▶ `domain/*` ──▶ `shared/*`

- **`src/domain/**`** MUST NOT import `react`, `react-dom`, `src/fields/**`, `src/features/**`, or `src/shared/ui/**`.
- **`src/shared/**`** MUST NOT import `src/domain/**`, `src/fields/**`, or `src/features/**`.
- **`src/fields/**`** MUST NOT import `src/features/**`.
- **`src/features/<slice-a>`** MUST NOT import internal files from `src/features/<slice-b>`.

---

## 2. Core Coding Principles

### Principle 1: Open/Closed Principle (OCP) via the Field Registry
- **NEVER** write `switch (field.type)` or `if (field.type === ...)` chains inside `features/builder-canvas`, `features/property-inspector`, or `features/form-renderer`.
- All field defaults, runtime inputs, and property inspectors MUST be resolved dynamically through `src/fields/registry.ts`:
  - Supported initial field types: `text`, `number`, `select`, `checkbox`, `radio`, `date`, `email`.

### Principle 2: Pure & Immutable Domain Core
- `FormSchema` and `FormField` must remain **100% JSON-serializable** (no functions, class instances, or DOM refs).
- All schema mutations (`addField`, `removeField`, `updateField`, `moveField`, `duplicateField`) must be pure functions in `src/domain/form-schema/operations.ts` returning a new schema reference.

### Principle 3: Discriminated Unions ("Parse, Don't Validate")
- Model every field as a member of the `FormField` discriminated union narrowed by `type: FieldType`. Keep type-specific config properties (e.g., `options` on `select`/`radio`, `min`/`max` on `number`) strictly on their respective interfaces.

### Principle 4: Editor State vs. Runtime State Separation
- **Editor State** (`selectedFieldId`, `activeMode`, undo/redo history) belongs only to the builder UI and must never be persisted inside `FormSchema`.
- **Runtime State** (`values`, `errors`, `touched`, `isSubmitting`) belongs only to the form runner (`form-renderer`).

### Principle 5: Multi-Tenant Scoping & Optimistic Updates
- Every `FormSchema` and `SubmissionRecord` MUST carry a valid `clientId` (`ClientTenant.id`).
- Never leak forms or submissions across tenants. Queries and filters must always scope by `clientId`.
- User mutations (editing schemas, saving submissions, deleting records) should update UI state optimistically and roll back to a snapshot if an async persistence call fails.

### Principle 6: Visual Craft (`DESIGN.md`)
- Strictly follow [`DESIGN.md`](./DESIGN.md): neutral `zinc` palette, 1px hairline borders (`border-zinc-800`), compact `h-9` (`36px`) controls, `rounded-md` / `rounded-lg` max radius, and `font-mono text-xs uppercase` badges.
- Zero purple/neon gradients, zero `rounded-2xl` bubbly cards, zero blurred background blobs.

### Principle 7: Persistent Left-Hand Navigation & Minimizable Icon Rail
- Primary workspace mode navigation (`Dashboard`, `All Forms`, `Schema JSON`) MUST always reside in the persistent left-hand side navigation rail (`<aside aria-label="Workspace Navigation">`). Form-level views (`Edit Builder`, `Live Preview`, `Submissions`) are opened directly from `All Forms` or `Dashboard`. Workspace navigation must never be moved to a horizontal top navigation bar.
- The top navigation bar (`<header>`) at the top of the right-hand workspace column MUST always include a toggle button (`isSidebarMinimized`) to minimize/collapse the left side navigation into an icon-only rail (`w-16` showing only icons) and expand it back (`w-60`).
- When expanded (`w-60`), the left rail presents the brand header, workspace mode navigation items (`Dashboard`, `All Forms`, `Schema JSON`) with SVG icons, text labels, and count badges, and the active scope footer.
- When minimized (`w-16`), the left rail collapses to an icon-only strip showing ONLY icons for brand and the workspace modes (`Dashboard`, `All Forms`, `Schema JSON`) with accessible titles/aria-labels.

### Principle 8: Unified Custom Dropdown & Select UI
- **NEVER** render raw native `<select>` elements anywhere in pages, modals, inspectors, or field plugins.
- Every dropdown selector, filter menu, and runtime select field MUST use `Select` or `FilterDropdown` from `src/shared/ui/index.tsx` (passing `DropdownOption[]` with `value`, `label`, and optional `description` / `meta` / `menuHeading`).
- All dropdowns share the portaled `role="listbox"` popover UI (`rounded-lg border border-zinc-200 bg-white shadow-lg`), uppercase mono heading, emerald selected highlight (`bg-emerald-50/80 text-emerald-950`) with checkmark icon, bordered `meta` pill, outside-click dismissal, and keyboard navigation (`ArrowUp`, `ArrowDown`, `Home`, `End`, `Escape`).

---

## 3. TypeScript 6 & Compiler Guardrails

1. **`verbatimModuleSyntax: true`**: Always use explicit `import type { ... }` for types and interfaces.
2. **`erasableSyntaxOnly: true`**: Never use TypeScript `enum`, `namespace`, or constructor parameter properties. Use `as const` arrays and derived string literal unions.
3. **Zero `any` Policy**: Never use explicit `any` or unsafe `as unknown as T` casts.
4. **Zero Unused Locals/Params**: `noUnusedLocals` and `noUnusedParameters` are enforced; remove all unused variables before finishing.

---

## 4. Pre-Completion Verification Gate

Before completing any coding task or milestone, always run and pass both verification checks with zero errors:

```bash
npm run build
npm run lint
```

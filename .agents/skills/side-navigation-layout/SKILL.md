---
name: side-navigation-layout
description: >-
  Use this skill when implementing, customizing, or maintaining the persistent
  vertical left-hand side navigation layout and minimizable icon-only rail
  (with top navigation minimize toggle button) for the multi-tenant Form Builder workspace.
---

# Side Navigation Layout & Minimizable Rail Skill

Follow this runbook to maintain and enforce the Form Builder workspace shell (`src/App.tsx` and `src/features/tenant-submissions/index.tsx`) using a **persistent vertical left-hand side navigation rail** with a **minimizable icon-only state** toggled from the top navigation bar.

## 1. Architectural & Layout Invariants

Before editing or reviewing any files, verify these non-negotiable invariants:

- **Navigation is ALWAYS on the Left**: Primary workspace mode navigation (`All Forms`, `Edit Builder`, `Live Preview`, `Submissions`, `Schema JSON`) and tenant/form switching must ALWAYS reside in the left-hand side navigation rail (`<aside aria-label="Workspace Navigation">`). Workspace mode navigation and tenant/form switchers must **never** be placed horizontally in the top navigation bar.
- **Minimizable Icon-Only Rail via Top Nav Toggle**:
  - The top navigation bar (`<header>`) at the top of the right-hand workspace column **always** includes a toggle button (`isSidebarMinimized`) on the far left to minimize or expand the left rail.
  - **Expanded (`w-60`)**: Shows the full brand header, vertical `TenantSwitcherBar` (stacked tenant/form selects and `+ Tenant` / `+ Form` action buttons), 5 workspace mode navigation items with SVG icons, text labels, and count badges, and the active scope footer.
  - **Minimized (`w-16`)**: Collapses to an icon-only rail displaying ONLY icons: brand mark, compact tenant and form switcher buttons (`collapsed={true}`), centered workspace mode buttons (`All Forms`, `Edit Builder`, `Live Preview`, `Submissions`, `Schema JSON` with `title` and `aria-label` attributes), and compact footer indicator.
- **Dependency Direction (`GEMINI.md`)**: `src/App.tsx` composes `src/features/*`. Feature slices remain decoupled and never import from sibling slices.
- **Surface & Border Tokens (`DESIGN.md`)**:
  - App shell root: `h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 flex flex-row selection:bg-zinc-800` (flex row ensures the left rail spans the full viewport height).
  - Left navigation rail: `shrink-0 border-r border-zinc-800 bg-zinc-900/80 flex flex-col justify-between transition-all duration-200`, with width `w-60` (expanded) or `w-16` (minimized).
  - Top navigation bar: `h-12 px-4 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between shrink-0`.

## 2. Implementation & Maintenance Runbook

### Step 1: `TenantSwitcherBar` Support for Minimized / Collapsed Mode

In [`src/features/tenant-submissions/index.tsx`](../../src/features/tenant-submissions/index.tsx):

1. Ensure `TenantBarProps` supports:
   - `orientation?: 'horizontal' | 'vertical'` (default `'vertical'`).
   - `collapsed?: boolean` (default `false`).
   - `onExpandSidebar?: () => void`.
2. **Expanded Mode (`collapsed={false}`)**:
   - Stack the **Tenant** selector block and **Form** selector block vertically (`flex flex-col gap-3`).
   - Each block displays a compact header row (`flex items-center justify-between`) with the section label and `+ Tenant` / `+ Form` action button, followed by a full-width `<Select className="h-8 w-full text-xs py-0 px-2">`.
3. **Minimized Mode (`collapsed={true}`)**:
   - Render compact icon-only buttons for Tenant and Form (e.g., building/tenant icon and document/form icon) with accessible `title` and `aria-label` tooltips (e.g. `title={`Tenant: ${activeTenant.name}`}`).
   - Clicking either icon opens modal creation or triggers `onExpandSidebar?.()`.
4. Keep tenant and form creation modal overlays (`fixed inset-0 z-50`) intact and functional in both modes.

### Step 2: Left Side Rail (`<aside>`) in `src/App.tsx`

In [`src/App.tsx`](../../src/App.tsx):

1. Manage sidebar minimization state:
   ```typescript
   const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
   ```
2. Outer layout container MUST be `flex flex-row`:
   ```tsx
   <div className="h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 flex flex-row selection:bg-zinc-800">
   ```
3. Left navigation rail (`<aside aria-label="Workspace Navigation">`):
   - Dynamic width: `isSidebarMinimized ? 'w-16' : 'w-60'`.
   - **Brand Header** (`h-12 border-b border-zinc-800 flex items-center`):
     - When expanded (`w-60`): Displays emerald status dot, mono `FormBuilder` title, and subtle version or tag.
     - When minimized (`w-16`): Displays centered emerald status dot or brand icon (`justify-center`).
   - **Tenant & Form Switcher Section** (`border-b border-zinc-800`):
     - Renders `<TenantSwitcherBar orientation="vertical" collapsed={isSidebarMinimized} onExpandSidebar={() => setIsSidebarMinimized(false)} ... />`.
   - **Workspace Mode Navigation (`<nav aria-label="Workspace Mode">`)**:
     - 5 workspace modes: `All Forms`, `Edit Builder`, `Live Preview`, `Submissions`, `Schema JSON`.
     - Each navigation item includes a dedicated SVG icon (e.g., folder for Forms, pencil for Edit, eye for Preview, inbox for Submissions, code brackets for Schema).
     - **When Expanded (`w-60`)**: Full-width left-aligned buttons (`w-full justify-start text-left`) rendering SVG icon + mode label + right-aligned count badges (`ml-auto` for `All Forms` count and `Submissions` count).
     - **When Minimized (`w-16`)**: Centered icon-only buttons (`justify-center p-2`) with text labels and count badges hidden, providing accessible `title` and `aria-label` attributes for tooltips and screen readers.
   - **Active Scope Footer** (`p-3 border-t border-zinc-800 bg-zinc-950/40`):
     - When expanded: Displays `activeTenant.primaryDomain` and `/${activeForm.slug}` in `font-mono text-xs text-zinc-500 truncate`.
     - When minimized: Displays compact status icon or tooltip indicator.

### Step 3: Top Navigation Bar (`<header>`) in the Workspace Column

In [`src/App.tsx`](../../src/App.tsx):

1. Wrap the right-hand workspace area in `<div className="flex-1 flex flex-col min-w-0 min-h-0">`.
2. The top bar (`<header className="h-12 px-4 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between shrink-0">`) sits at the top of this workspace column:
   - **Left Section**:
     - **Sidebar Minimize/Expand Toggle Button**: Icon button (`[«]` when expanded, `[»]` when minimized, or panel toggle icon) with `onClick={() => setIsSidebarMinimized((prev) => !prev)}` and `aria-label={isSidebarMinimized ? "Expand sidebar" : "Collapse sidebar"}`.
     - **Active Form Title & Tenant Badge**: Displays active form title and tenant badge next to the toggle button.
   - **Right Section**:
     - Undo / Redo history buttons (`canUndo`, `canRedo`).
     - Live Preview toggle or "Access Form" CTA.
3. Below the header:
   - Render `syncError` alert banner if present.
   - Render the active workspace view (`FormsDirectoryPanel`, 3-pane builder workbench in `edit` mode, `FormRenderer` preview, `SubmissionsPanel`, or `SchemaIoPanel`).

### Step 4: Verification & Consistency Gate

Run both verification checks and ensure zero errors:

```bash
npm run build
npm run lint
```

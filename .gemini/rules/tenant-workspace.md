# Business Rules & Architecture: Tenant Management & Client Workspace

This document defines the architectural boundaries, business invariants, security controls, navigation semantics, and optimistic state synchronization rules for tenant management and workspace navigation within `src/features/tenant-workspace/`.

---

## 1. Feature Scope & Component Inventory

The `tenant-workspace` feature coordinates active client tenant context, top-level navigation, responsive application shells, and tenant switching controls:

```
src/features/tenant-workspace/
├── SideNav.tsx             # Desktop collapsible sidebar with navigation links, branding & collapse state
├── MobileNavDrawer.tsx     # Responsive mobile drawer navigation with sheet overlay, touch triggers & backdrop
├── TenantSwitcherBar.tsx   # Top-level workspace bar displaying active client, role switcher, form picker & modals
└── index.ts                # Public feature export barrel
```

### Boundary & Dependency Guardrails
- **Unidirectional Architecture**: `src/features/tenant-workspace/` may import types and models from `src/domain/form-schema/` and UI primitives from `src/shared/`.
- **Zero Feature-to-Feature Cross-Imports**: Must not import directly from `src/features/forms-manager/`, `src/features/builder-canvas/`, etc. Coordination across features happens via state lifted to `App.tsx`.
- **Pure AST & Data Contracts**: Client tenant metadata (`ClientTenant`) must remain 100% JSON-serializable.

---

## 2. Multi-Tenant Client Switching & Active Workspace Scoping

All application state displayed in the Form Builder workspace must be strictly partitioned by the active tenant:

1. **Active Client Scoping**: The application maintains an `activeClientId` representing the currently selected tenant. All subsequent queries, state derivations, forms, submissions, and integration queues are computed against this `activeClientId`.
2. **Context Switching Behavior**:
   - Switching `activeClientId` immediately switches the active client context.
   - The active form selection defaults to the first available form for that client or `null` if no forms exist.
   - Submissions ledger and integration settings update to reflect the newly selected client.
3. **Empty Tenant States**:
   - If a client tenant has zero forms, the workspace displays a high-contrast neutral empty state guiding the user to create their first form.
   - Zero-layout-shift skeleton loaders (`animate-pulse`) must be rendered while asynchronous tenant data fetches are in flight.

---

## 3. Role-Based Permissions & Access Control

Access to client switching and tenant management is strictly governed by the user's role:

| Capability | `agency_admin` | `client_editor` |
| :--- | :--- | :--- |
| **View Client Tenants** | Can view and switch between all registered clients. | Restricted strictly to their designated client tenant. |
| **Create New Client Tenant** | Allowed via "Create Client" modal dialog. | Forbidden. Creation controls are hidden / disabled. |
| **Switch Active Client** | Full dropdown selection across all tenants in D1. | Locked. Dropdown is disabled or rendered as static badge. |
| **Edit Tenant Slug & Settings** | Allowed (name, unique workspace slug). | Read-only access or restricted to form-level editing. |
| **Delete Client Tenant** | Allowed with safeguard checks (see below). | Forbidden. |

### Security Invariants
- If a user with `role === 'client_editor'` attempts an API request targeting a client ID different from their own assigned `user.clientId`, the backend immediately rejects the request with `HTTP 403 Forbidden`.
- Client-side UI must hide privileged creation and configuration controls when the authenticated user is not an `agency_admin`.

---

## 4. Slug-Based Tenant Routing & Isolation

Each `ClientTenant` represents an isolated organization identified by a unique URL-safe `slug`:

```typescript
export interface ClientTenant {
  id: string;
  name: string;
  slug: string;
  industry?: string;
  status: 'active' | 'suspended';
  createdAt: string;
}
```

### Slug Routing Rules
1. **App-Hosted URLs**: Forms are served on the application's own origin under `/<tenant-slug>/<form-slug>`.
2. **Slug Uniqueness**: Tenant slugs must be globally unique across `clients` and form slugs must satisfy `UNIQUE(client_id, slug)`.

---

## 5. Responsive Navigation Architecture & Modal Semantics

The navigation layer ensures seamless productivity across mobile, tablet, and ultra-wide desktop displays:

### 1. Desktop SideNav (`SideNav.tsx`)
- Standardized width (240px expanded, 64px compact/collapsed).
- Smooth transitions with hairline 1px border (`border-r border-zinc-200 dark:border-zinc-800`).
- Clear visual hierarchy with active tab highlighting (`bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50`).
- Technical monospace badges for counts (e.g., submission count, draft count).

### 2. MobileNavDrawer (`MobileNavDrawer.tsx`)
- Renders as an accessible off-canvas sheet/drawer triggered by a compact hamburger button.
- **Accessibility & Focus Trapping**:
  - Backdrop overlay with blur/scrim (`bg-black/50`).
  - Escape key (`keydown` listener on `Escape`) immediately closes the drawer.
  - Focus is trapped within the active drawer while open; clicking outside the drawer closes it.
  - `aria-modal="true"` and appropriate ARIA roles (`role="dialog"`).

### 3. Top Navigation & Tenant Switcher (`TenantSwitcherBar.tsx`)
- Fixed 48px to 56px height header with 1px bottom border.
- Houses the tenant switcher dropdown, current user badge, role toggle (for simulation/demo), and inline actions (`Create Form`, `New Client`).

---

## 6. Optimistic UI Mutations & Snapshot Rollback

Client mutations must provide instantaneous feedback while ensuring rock-solid data integrity:

1. **Optimistic Execution (0ms Perceived Latency)**:
   - When creating or editing a client tenant, local UI state is updated immediately before the `fetch` call to the Cloudflare Worker completes.
2. **Snapshot Capture**:
   - Before applying the optimistic update, capture a deep snapshot of the previous state:
     ```typescript
     const previousClients = [...clients];
     ```
3. **Automatic Rollback**:
   - If the backend request fails or returns a non-2xx status code:
     1. Revert `clients` state to `previousClients`.
     2. Restore the previous `activeClientId` if applicable.
     3. Display an accessible dismissible toast/alert notifying the user of the synchronization failure.

---

## 7. Invariants & Edge Cases

1. **Client Deletion Safeguard**: A client tenant cannot be deleted if it contains active forms or submission records. Deletion requires explicit confirmation and either zero existing assets or explicit cascade approval.
2. **Slug Formatting**: Client slugs must be URL-safe kebab-case (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`), automatically sanitized upon creation.
3. **UTC ISO-8601 Timestamps**: `createdAt` and `updatedAt` must always be stored in UTC ISO-8601 string format (e.g., `"2026-11-09T14:00:00.000Z"`).
4. **Visual Aesthetics**: Strict conformance to `DESIGN.md`:
   - Neutral `zinc` token palette only.
   - Compact 36px (`h-9`) inputs and buttons.
   - 1px hairline structural borders (`border-zinc-200 dark:border-zinc-800`).
   - Monospace typography for tenant IDs and slugs.

# Design System & UI Conventions (`DESIGN.md`)

A concise visual specification following the **`shadcn/ui` / Linear / Vercel** aesthetic: neutral monochrome `zinc` surfaces, crisp 1px hairline borders, compact enterprise density, and zero "AI slop" clichés.

---

## 1. Banned Visual Clichés (Strict Prohibition)

- **No Neon/Purple Gradients**: Never use purple/indigo/pink gradients (`from-indigo-500 via-purple-500...`) on backgrounds, buttons, or text.
- **No Bubbly Radii**: Never use `rounded-2xl` or `rounded-3xl` on functional UI cards, inputs, or modals. Max radius is `rounded-lg` (`8px`).
- **No Floating Blur Orbs**: Never place decorative blurred background blobs (`blur-3xl opacity-20`) behind UI panels.
- **No Sparkle Fluff**: Never use `✨` emojis or decorative `Sparkles` icons on standard CRUD/builder buttons.

---

## 2. Color & Surface Tokens (Tailwind `zinc`)

Use the `zinc` scale exclusively for layout structure, text hierarchy, and borders:

| Element | Dark Mode (Default) | Light Mode |
| :--- | :--- | :--- |
| **App Canvas** | `bg-zinc-950 text-zinc-100` | `bg-white text-zinc-950` |
| **Sidebar / Sub-surface** | `bg-zinc-900/60` | `bg-zinc-50` |
| **Card / Field Item** | `bg-zinc-900 border-zinc-800` | `bg-white border-zinc-200` |
| **Hairline Border** | `border-zinc-800` | `border-zinc-200` |
| **Primary Text** | `text-zinc-100` | `text-zinc-950` |
| **Secondary Text** | `text-zinc-400` | `text-zinc-500` |
| **Muted / Technical Text** | `text-zinc-500` | `text-zinc-400` |

### Semantic Status Colors
- **Primary CTA**: `bg-zinc-100 text-zinc-950 hover:bg-zinc-200` (Dark) / `bg-zinc-900 text-white hover:bg-zinc-800` (Light)
- **Danger / Error**: `text-rose-400 border-rose-900/60 bg-rose-950/30`
- **Success / Valid**: `text-emerald-400 border-emerald-900/60 bg-emerald-950/30`
- **Warning**: `text-amber-400 border-amber-900/60 bg-amber-950/30`

---

## 3. Component Sizing, Spacing & Typography

- **Control Heights**:
  - Standard inputs, selects, and primary buttons: `h-9` (`36px`), `px-3`, `text-sm`, `rounded-md`.
  - Compact toolbar buttons and icon actions: `h-8` (`32px`) or `h-7` (`28px`), `px-2.5`, `text-xs`, `rounded-md`.
- **Borders & Focus Rings**:
  - Structure is defined via `border border-zinc-800` (or `border-zinc-200`).
  - Inputs and buttons must show clear focus states: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400`.
- **Typography**:
  - Section headers & labels: `text-xs font-medium text-zinc-300` or `text-sm font-medium text-zinc-200`.
  - Technical metadata (field IDs, type badges, tenant slugs, timestamps): `font-mono text-xs uppercase tracking-wider text-zinc-400`.
- **Micro-Interactions**:
  - Subtle transitions (`transition-colors duration-150`) and tactile press feedback (`active:scale-[0.98]`).

---

## 4. Workspace Shell & Left Navigation Invariants

- **Root App Shell**:
  - `h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 flex flex-row selection:bg-zinc-800`
  - Horizontal flex layout ensures the left navigation rail spans the full viewport height.

- **Left Navigation Rail (`<aside aria-label="Workspace Navigation">`)**:
  - **Always on the left**: Primary workspace mode navigation (`All Forms`, `Edit Builder`, `Live Preview`, `Submissions`, `Schema JSON`) and tenant/form switching are strictly housed on the left side rail and must never be placed horizontally in a top navigation bar.
  - **Expanded Width (`w-60`)**: Full sidebar (`w-60 shrink-0 border-r border-zinc-800 bg-zinc-900/80 flex flex-col justify-between transition-all duration-200`) displaying:
    - Brand header with status indicator and title.
    - Vertical `TenantSwitcherBar` with stacked selects and creation buttons.
    - Full-width mode navigation items with SVG icons, readable text labels, and right-aligned count badges (`ml-auto`).
    - Scope footer with tenant domain and active form slug.
  - **Minimized Icon-Only Width (`w-16`)**: Collapsed rail (`w-16 shrink-0 border-r border-zinc-800 bg-zinc-900/80 flex flex-col justify-between transition-all duration-200`) displaying:
    - Brand mark icon centered.
    - Compact tenant and form switcher icon buttons (`collapsed={true}`) with descriptive `title` tooltips.
    - Centered icon-only workspace mode buttons (`justify-center p-2`) with text labels and count badges hidden, using `title` and `aria-label` for accessibility.
    - Compact footer indicator.

- **Top Navigation Bar (`<header>`)**:
  - Sits at the top of the right-hand workspace column: `h-12 px-4 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between shrink-0`.
  - **Far Left Action**: Sidebar minimize/expand toggle button (`[«]` / `[»]`, `aria-label="Toggle sidebar"`) to switch the left rail between `w-60` and `w-16`.
  - **Left Section**: Form title display and active tenant domain badge.
  - **Right Section**: Editor canvas action controls (Undo, Redo, Preview toggle, Access Form CTA).

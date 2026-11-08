# Design System & Anti-AI-Slop Visual Guidelines

This document governs the visual architecture, typography, token palette, interactive micro-interactions, and interface conventions for the Form Builder application. Every UI surface must feel intentionally handcrafted by senior product designers at companies like **Linear**, **Vercel**, **Supabase**, and **Stripe**.

---

## 1. Core Philosophy: Human-Crafted & `shadcn/ui` Standard

Automated code generation often defaults to generic, uninspired, or cartoonish aesthetics ("AI Slop"): oversaturated purple gradients, bubbly rounded corners, floaty cards with fuzzy drop shadows, and sparkle emojis. 

This repository adheres to the **`shadcn/ui` aesthetic standard**:
- **Radix-style headless accessibility**: Built on semantic HTML, full keyboard navigation, strict ARIA compliance, and visible focus indicators.
- **Neutral Zinc foundation**: Pure, crisp greys that yield high contrast without visual fatigue.
- **Hairline 1px geometry**: Borders define structure; surfaces are layered with millimeter precision rather than blurred drop shadows.
- **Enterprise density**: Compact inputs, refined typography, and purposeful data density optimized for professional tooling.
- **Tactile micro-interactions**: Subtly responsive states (`active:scale-[0.99]`), tactile inset highlights, and instantaneous visual feedback.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Design System Pillars                           │
├─────────────────────┬─────────────────────┬────────────────────────────┤
│   1. Strict Form    │   2. Tactile Depth  │   3. High Information      │
│      & Restraint    │      & Precision    │      Density & Rhythm      │
│  Zinc tokens only,  │  Hairline borders,  │  Compact 36px controls,    │
│  no neon gradients, │  inset highlights,  │  tight letter spacing,     │
│  no bubbly corners  │  subtle transitions │  monospace metadata badges │
└─────────────────────┴─────────────────────┴────────────────────────────┘
```

---

## 2. Strict Negative Constraints (Banned AI Clichés)

All pull requests and agent implementations must strictly avoid these banned tropes:

### 🚫 Forbidden vs. Permitted Matrix

| Category | 🚫 Forbidden (AI Cliché) | ✅ Permitted (Handcrafted Standard) |
| :--- | :--- | :--- |
| **Gradients** | `bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500`, violet-to-fuchsia headers, neon mesh gradients | Flat solid fills (`bg-zinc-900`, `bg-white`) or extremely subtle directional washes (`bg-gradient-to-b from-zinc-50/50 to-zinc-100/50 dark:from-zinc-900/50 dark:to-zinc-950/50`) |
| **Atmospheric Effects** | Floating blurred colored orbs (`blur-3xl opacity-25 bg-purple-500`), gratuitous frosted glass (`backdrop-blur-md bg-white/10`) | Solid canvas with crisp hairline dividers (`border-zinc-200 dark:border-zinc-800`), subtle micro-grid or dot matrix canvas texture |
| **Corner Radii** | Bubbly `rounded-2xl` or `rounded-3xl` cards, inputs, pills, or dialog windows | Crisp `rounded-md` (6px) for form controls/buttons, `rounded-lg` (8px) for cards/panels, `rounded-sm` (4px) for tags/badges |
| **Shadows** | Muddy, diffuse drop shadows (`shadow-2xl shadow-indigo-500/20`, `shadow-lg`) | Tactile inset highlights (`shadow-sm`, `shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]` in dark mode or `shadow-[inset_0_1px_0_0_rgba(0,0,0,0.04)]` in light mode) |
| **Layouts** | Monotonous 3-column card grids with icons trapped inside pastel rounded boxes | Asymmetric master-detail viewports, collapsible toolbars, split workbenches, Bento layouts with varying visual rhythm |
| **Copy & Icons** | Sparkle emojis (✨), `Sparkles` or `Wand` icons on non-generative action buttons, promotional buzzwords ("Supercharge your forms!") | Purposeful, concise action verbs ("Add Field", "Publish", "Export JSON"), semantic Lucide icons directly linked to function |

> [!CAUTION]
> PRs introducing purple/indigo gradients, bubbly `rounded-2xl` borders on functional controls, or decorative neon blur circles will be rejected outright.

---

## 3. Color Palette & Semantic Token Architecture

We use **Tailwind Zinc** as the universal neutral scale. No warm yellows, cool blues, or muddy greys mixed into the core scaffolding.

### 3.1 Primary Neutral Palette

```
Light Mode:
  Canvas (Base)       : #ffffff (bg-white)
  Canvas Sub-surface  : #fafafa (bg-zinc-50)
  Cards / Containers  : #ffffff or #fafafa (border border-zinc-200)
  Hairline Borders    : #e4e4e7 (border-zinc-200)
  Text Primary        : #09090b (text-zinc-950)
  Text Secondary      : #71717a (text-zinc-500)
  Text Muted          : #a1a1aa (text-zinc-400)

Dark Mode:
  Canvas (Base)       : #09090b (dark:bg-zinc-950)
  Canvas Sub-surface  : #121215 (dark:bg-zinc-900/60)
  Cards / Containers  : #18181b (dark:bg-zinc-900)
  Hairline Borders    : #27272a (dark:border-zinc-800)
  Text Primary        : #fafafa (dark:text-zinc-100)
  Text Secondary      : #a1a1aa (dark:text-zinc-400)
  Text Muted          : #52525b (dark:text-zinc-600)
```

### 3.2 Accent & Semantic Status Tokens

Accents are applied with strict restraint. They communicate state, action, and feedback, never decorative clutter.

| Token | Light Tailwind | Dark Tailwind | Usage |
| :--- | :--- | :--- | :--- |
| **Primary Action** | `bg-zinc-900 text-white hover:bg-zinc-800` | `dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200` | High-contrast signature actions (Save, Submit, Primary CTA) |
| **Success / Valid** | `text-emerald-700 bg-emerald-50 border-emerald-200` | `dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-800` | Form validation success, published state, active webhooks |
| **Warning** | `text-amber-700 bg-amber-50 border-amber-200` | `dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800` | Unsaved schema changes, rate-limit warnings, degraded delivery |
| **Destructive / Error** | `text-rose-700 bg-rose-50 border-rose-200` | `dark:text-rose-400 dark:bg-rose-950/40 dark:border-rose-800` | Delete field, failed submission delivery, validation errors |
| **Info / Links** | `text-sky-700 bg-sky-50 border-sky-200` | `dark:text-sky-400 dark:bg-sky-950/40 dark:border-sky-800` | Metadata notes, external links, documentation tips |

---

## 4. Depth, Geometry & Surface Lighting

### 4.1 Corner Radii Hierarchy

| Size | Class | Application |
| :--- | :--- | :--- |
| **Small (4px)** | `rounded-sm` | Monospace tags, keyboard shortcut badges (`<kbd>`), status pills |
| **Medium (6px)** | `rounded-md` | Buttons, text inputs, selects, dropdown menus, context items |
| **Large (8px)** | `rounded-lg` | Cards, canvas panels, property inspector sections, modal dialogs |
| **Banned (>8px)** | `rounded-xl`, `rounded-2xl`, `rounded-full` | Strictly prohibited except for circular avatars or single-character icon badges |

### 4.2 Tactile Inset Depth (Instead of Muddy Shadows)

Rather than muddy ambient drop shadows, craft depth using **directional light simulation** (a 1px translucent top highlight that mimics bevelled hardware tooling):

- **Light Mode Subtle Elevation**:
  ```css
  shadow-sm border border-zinc-200 bg-white
  /* Optional top inset shine */
  shadow-[0_1px_2px_0_rgba(0,0,0,0.05),inset_0_1px_0_0_rgba(255,255,255,1)]
  ```
- **Dark Mode Tactile Surface**:
  ```css
  border border-zinc-800 bg-zinc-900 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]
  ```
- **Active Selection Glow (Canvas / Field focus)**:
  ```css
  ring-1 ring-zinc-950 dark:ring-zinc-200 border-zinc-950 dark:border-zinc-200
  ```

---

## 5. Typography & Enterprise Information Density

### 5.1 Typeface & Tracking Scale

The interface uses standard system typography (`font-sans`) with tight letter spacing for headings and crisp monospace styling for system identifiers.

```
Headings:
  H1 / Page Titles    : text-xl sm:text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100
  H2 / Section Headers : text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100
  H3 / Sidebar Headers : text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400

Body & Controls:
  Standard Body Text   : text-sm font-normal text-zinc-700 dark:text-zinc-300 leading-relaxed
  Small / Help Text    : text-xs font-normal text-zinc-500 dark:text-zinc-400
  Micro Captions       : text-[11px] font-medium text-zinc-400 dark:text-zinc-500

Technical / Monospace:
  Field Keys / Slugs   : font-mono text-[11px] text-zinc-600 dark:text-zinc-400 tracking-tight
  Keyboard Shortcuts   : font-mono text-[10px] uppercase font-medium
```

### 5.2 Enterprise Density Metrics

- **Interactive Controls (Buttons, Inputs, Selects)**: Fixed height of `h-9` (36px), horizontal padding `px-3`, font size `text-sm`.
- **Compact Table & List Rows**: Row heights between `36px` and `44px` with `py-2 px-3`.
- **Inspector Form Gap**: Compact vertical rhythm using `space-y-3.5` or `gap-3`.

---

## 6. Layout Rhythm & Asymmetric Composition

The Form Builder avoids cookie-cutter, symmetrical card grids. Instead, it utilizes an **IDE-style asymmetric 3-pane workbench**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Top Bar: Title, Tenant Selector, Undo/Redo, Mode Switch, Save/Export (h-14) │
├───────────────┬──────────────────────────────────────────────┬───────────────┤
│ Field Palette │               Builder Canvas                 │   Property    │
│ (240px-280px) │              (Flexible Center)               │   Inspector   │
│               │                                              │ (300px-340px) │
│ • Drag handles│ • Dot-matrix or subtle grid canvas bg        │ • Form fields │
│ • Field tiles │ • Selected field hairline highlight          │ • Tabbed meta │
│ • Monospace   │ • Drop target indicators (emerald/blue bar)  │ • Validation  │
│   type tag    │ • Live interactive preview mode              │   rules       │
└───────────────┴──────────────────────────────────────────────┴───────────────┘
```

- **Canvas Background**: In builder mode, the canvas has a clean, subtle dot pattern or subdued neutral background (`bg-zinc-100/60 dark:bg-zinc-950`) to clearly distinguish the live preview card from the editing environment.
- **Visual Weight**: Dense, high-information toolbars and sidebars contrast against an airy, focused center stage.

---

## 7. Interactive States & Micro-Interactions

Every single interactive element (buttons, tabs, inputs, dropdown items, canvas field rows) must implement **all 6 interactive states**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        6 Mandatory States Matrix                       │
├───────────────────┬────────────────────────────────────────────────────┤
│ 1. Default        │ Clean hairline border, crisp text, subtle inset    │
├───────────────────┼────────────────────────────────────────────────────┤
│ 2. Hover          │ Light surface shift (bg-zinc-100 / bg-zinc-800/80) │
├───────────────────┼────────────────────────────────────────────────────┤
│ 3. Focus-Visible  │ Visible ring with offset (ring-1 ring-offset-1)    │
├───────────────────┼────────────────────────────────────────────────────┤
│ 4. Active (Press) │ Tactile micro-compression: active:scale-[0.99]     │
├───────────────────┼────────────────────────────────────────────────────┤
│ 5. Disabled       │ opacity-50 cursor-not-allowed pointer-events-none  │
├───────────────────┼────────────────────────────────────────────────────┤
│ 6. Selected       │ High-contrast fill or border highlight             │
└───────────────────┴────────────────────────────────────────────────────┘
```

### 7.1 Keyboard Shortcuts & Badges

Display keyboard hints inside buttons, tooltips, and menus using the `<kbd>` badge standard:

```tsx
<kbd className="inline-flex items-center justify-center font-mono text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.1)]">
  ⌘K
</kbd>
```

### 7.2 Zero Cumulative Layout Shift (CLS) Loading States

- **Structural Skeletons (`animate-pulse`)**: Render skeletons that mirror exact final component geometry during initial load.
- **Spinners**: Reserved exclusively for inline actions (e.g. inside a "Submitting..." button). Never blank out an entire screen with a giant centering spinner.

---

## 8. Component Reference Recipes (Copy-Paste Standard)

Use these exact utility patterns when authoring or reviewing UI components.

### 8.1 Primary Button (High-Contrast Tactile)
```tsx
<button
  type="button"
  className="inline-flex items-center justify-center gap-2 h-9 px-3.5 text-sm font-medium rounded-md text-white bg-zinc-900 hover:bg-zinc-800 active:scale-[0.99] dark:text-zinc-950 dark:bg-zinc-100 dark:hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 focus-visible:ring-offset-1 shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
>
  Save Changes
</button>
```

### 8.2 Secondary / Outline Button
```tsx
<button
  type="button"
  className="inline-flex items-center justify-center gap-2 h-9 px-3 text-sm font-medium rounded-md text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
>
  Cancel
</button>
```

### 8.3 Text Input
```tsx
<input
  type="text"
  className="h-9 w-full px-3 text-sm rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors disabled:opacity-50 disabled:bg-zinc-50 dark:disabled:bg-zinc-950"
  placeholder="Enter field label..."
/>
```

### 8.4 Inspector Property Group Header
```tsx
<div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
    Validation Rules
  </span>
  <span className="font-mono text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
    AST.rules
  </span>
</div>
```

### 8.5 Canvas Field Item (Selected & Idle States)
```tsx
<div
  className={cn(
    "group relative p-4 rounded-lg border transition-all duration-150 bg-white dark:bg-zinc-900",
    isSelected
      ? "border-zinc-950 dark:border-zinc-100 ring-1 ring-zinc-950 dark:ring-zinc-100 shadow-md"
      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm"
  )}
>
  {/* Content */}
</div>
```

---

## 9. Pre-Commit Design Audit Checklist

Before declaring any feature complete or submitting a pull request, run through this design checklist:

- [ ] **No Banned Colors**: Zero indigo/violet/purple-to-pink gradients used for background fills or CTA buttons.
- [ ] **No Banned Effects**: No `blur-3xl opacity-20` neon orbs or aggressive frosted glass.
- [ ] **Corner Radii Checked**: All inputs, buttons, and menus use `rounded-md` (6px); all cards/panels use `rounded-lg` (8px). Zero `rounded-2xl` or `rounded-3xl`.
- [ ] **Hairline Borders Verified**: All panel dividers, cards, and dropdowns use 1px borders with `border-zinc-200 dark:border-zinc-800`.
- [ ] **Tactile Depth Present**: Inset highlights or crisp shadows (`shadow-sm`) are utilized instead of muddy blurred shadows.
- [ ] **All 6 Interactive States Handled**: Buttons and interactive controls have styles for default, hover, focus-visible, active (`active:scale-[0.99]`), disabled, and selected.
- [ ] **Typography Tightness**: Display titles use `tracking-tight`; technical keys and slugs use `font-mono text-[11px]`.
- [ ] **No Fluff**: Zero sparkle emojis (✨) or fluffy marketing labels on functional UI controls.
- [ ] **Accessible Focus Rings**: `focus-visible:ring-1` present and visible when navigating via keyboard.
- [ ] **Mobile-First Responsive Verified**: Fully functional and polished on 375px+ viewports with zero horizontal overflow (`overflow-x-hidden`).
- [ ] **Multi-Pane Studio Adaptation**: 3-pane desktop layouts convert to segmented view switchers or sheets on mobile, preventing vertical column sprawl.
- [ ] **Touch Target Integrity**: Minimum 44x44px touch targets (`p-2` on 36px controls with `touch-manipulation`), zero mouse-only hover locks.

---

## 10. Mandatory Mobile-Ready Standard (Mobile-First Responsiveness & Studio Adaptability)

Every interface in this application must be engineered with a **mobile-first mindset**. Building complex desktop-class SaaS software does not excuse poor mobile ergonomics. A user must be able to inspect schemas, build forms, manage submissions, and adjust properties directly on a smartphone without friction, horizontal layout breakage, or microscopic touch targets.

### 10.1 Non-Negotiable Mobile-Ready Principles

1. **Non-Negotiable Rule: 100% Mobile Functionality (375px+ Viewports)**:
   - Every UI surface, studio tool, and runtime view must be 100% functional, touch-optimized, and aesthetically polished on standard mobile viewports starting at `375px` (iPhone SE/Mini) up to `430px` (iPhone Pro Max) and tablets (`768px+`).
   - No features may be disabled or hidden on mobile unless an equivalent, touch-optimized workflow is provided.

2. **Multi-Pane Studio Adaptation on Mobile (< lg)**:
   - **The Anti-Pattern (Desktop Sprawl)**: Never vertically stack 3 dense desktop columns (Palette -> Canvas -> Inspector) into a mile-long scrollable monolith. Stacking creates infinite scrolling fatigue, loss of context, and disorientation.
   - **The Standard (Dedicated Segmented View Switcher or Sheets)**:
     - On screens smaller than `lg` (`< 1024px`), multi-pane studios must transform into a dedicated segmented mobile view switcher (e.g., `[ Palette ] [ Canvas ] [ Inspector ]`) or slide-over drawer sheets.
     - Users focus on **one functional surface at a time**: selecting a field from the Palette can switch into Canvas focus; tapping a field on the Canvas reveals the Inspector sheet or tab seamlessly.
     - The active mode must be visually prominent with smooth transitions, allowing focused work on one pane at a time without horizontal or vertical sprawl.

3. **Touch Target Integrity (44x44px Minimum)**:
   - All interactive controls (buttons, icon triggers, tabs, accordion headers, form inputs, checkboxes, dismiss buttons) must provide a minimum touch bounding box of **`44x44px`** (or `p-2` on 36px controls with `touch-manipulation`).
   - All interactive elements must apply `touch-manipulation` to disable the mobile browser 300ms double-tap delay.
   - Adequate spacing must surround touch targets to prevent accidental mis-taps.

4. **Mobile Touch State Affordances (No Hover-Only Dependency)**:
   - **The Anti-Pattern**: Hiding contextual actions (e.g., field actions on canvas like duplicate, delete, reorder, column-span triggers) behind mouse-only `:hover` (`group-hover:opacity-100`) leaves touch users stranded because hover states do not exist on touchscreens.
   - **The Standard**:
     - Action affordances must be **directly visible and accessible without hovering** when an item is selected or on mobile/touch viewports (`isSelected ? "opacity-100" : "opacity-0 sm:group-hover:opacity-100"`).
     - Alternatively, provide a dedicated touch-friendly action trigger (e.g., `···` action menu) or mobile action sheet.
     - Never make critical functionality dependent on mouse cursor hovering.

5. **Horizontal Overflow Zero Tolerance**:
   - The primary viewport and root layout containers must enforce strict `overflow-x-hidden`. Unintentional horizontal scrolling or page wobble on mobile viewports is a critical defect.
   - Tables, code viewers, and raw AST JSON viewers must be wrapped in designated horizontal scroll containers with smooth momentum scrolling:
     ```css
     overflow-x-auto -webkit-overflow-scrolling-touch
     ```
   - Provide visual indicators or subtle edge fades so mobile users immediately recognize horizontally scrollable content.

6. **Mobile Header Ergonomics**:
   - Headers and toolbars must prevent multi-line wrapping sprawl on narrow screens.
   - Prioritize active context: clearly display the Form title/status and the primary CTA (e.g., "Save" or "Publish").
   - Collapse secondary buttons (Undo, Redo, Mode Switch, Reset, Export) into icon-only triggers with accessible `aria-label`, or group them inside an accessible "More" dropdown/sheet.
   - Respect mobile safe area insets (`env(safe-area-inset-top)`).

### 10.2 Mobile Component Pattern Specifications

#### A. Mobile Segmented Studio Switcher (`< lg`)
```tsx
{/* Mobile View Switcher Toolbar */}
<div className="flex lg:hidden items-center justify-around border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 p-1.5 sticky top-14 z-20">
  <button
    type="button"
    onClick={() => setActivePane('palette')}
    className={cn(
      "flex-1 py-2 text-xs font-medium rounded-md transition-all touch-manipulation text-center",
      activePane === 'palette'
        ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-700"
        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
    )}
  >
    Palette
  </button>
  <button
    type="button"
    onClick={() => setActivePane('canvas')}
    className={cn(
      "flex-1 py-2 text-xs font-medium rounded-md transition-all touch-manipulation text-center",
      activePane === 'canvas'
        ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-700"
        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
    )}
  >
    Canvas ({fieldsCount})
  </button>
  <button
    type="button"
    onClick={() => setActivePane('inspector')}
    className={cn(
      "flex-1 py-2 text-xs font-medium rounded-md transition-all touch-manipulation text-center",
      activePane === 'inspector'
        ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-700"
        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
    )}
  >
    Inspector
  </button>
</div>
```

#### B. Touch-Safe Action Affordance (Selected State Fallback)
```tsx
{/* Action triggers visible on mobile when selected or on desktop hover */}
<div
  className={cn(
    "flex items-center gap-1 transition-opacity duration-150",
    isSelected
      ? "opacity-100" // Directly visible on touch when field is active/selected
      : "opacity-0 sm:group-hover:opacity-100" // Desktop hover fallback
  )}
>
  <button
    type="button"
    onClick={onDuplicate}
    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 touch-manipulation"
    aria-label="Duplicate field"
  >
    <Copy className="h-4 w-4" />
  </button>
  <button
    type="button"
    onClick={onDelete}
    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 touch-manipulation"
    aria-label="Delete field"
  >
    <Trash2 className="h-4 w-4" />
  </button>
</div>
```

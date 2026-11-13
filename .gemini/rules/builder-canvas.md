# Builder Canvas — Architecture, Interaction Protocol & Governance

This document establishes the architectural standards, interaction protocols, and strict governance rules for the Builder Canvas feature (`src/features/builder-canvas/`).

---

## 1. Architectural Scope & Unidirectional Boundary

The Builder Canvas is the central editing workspace where users visually assemble, reorder, configure, and layout form fields. It operates as a feature slice subject to the repository's unidirectional architecture:

```
App.tsx  ──▶  src/features/builder-canvas/  ──▶  src/fields/  ──▶  src/domain/  ──▶  src/shared/
```

### Strict Boundary Rules
- **No Direct Mutation of Schema**: The canvas never mutates `FormSchema` or `FormField` objects in place. All changes must be dispatched via immutable callback handlers (`onAddField`, `onUpdateField`, `onReorderField`, `onMoveField`, `onDuplicateField`, `onRemoveField`, `onInsertFieldAtTarget`).
- **Editor State vs. Domain State Isolation**:
  - **Editor (Transient) State**: `selectedFieldId`, active drag session, drop indicator position (`targetFieldId`, `dropPosition`), hover states, and preview device mode belong strictly to local/editor React state.
  - **Domain AST**: Only valid, persisted field configuration lives in `FormSchema`. Editor transient state must **never** leak into or be serialized within `FormSchema`.
- **No Direct Feature-to-Feature Coupling**: The canvas must not import from sibling features like `property-inspector`, `field-palette`, `form-renderer`, or `integrations-hub`. Cross-feature coordination is handled exclusively via `App.tsx` state and props.

---

## 2. Visual Drag-and-Drop & Pointer Protocol

To guarantee smooth, reliable drag operations without bloated, fragile third-party drag-and-drop libraries, the canvas implements a lightweight pointer-based subscription model powered by `src/shared/lib/pointer-drag.ts`.

### Pointer Drag Lifecycle
1. **Initiation**:
   - Field reordering: Canvas drag handles trigger `beginPointerDrag({ type: 'reorder', fieldId })`.
   - New field drop: Field palette items trigger `beginPointerDrag({ type: 'new_field', fieldType })`.
2. **Subscription & Tracking**:
   - The canvas subscribes to global pointer events via `subscribePointerDrag(onDragMove, onDragEnd)`.
   - As the pointer moves across the canvas, active drop zones compute the hover target and relative insertion point.
3. **Drop Registration & Execution**:
   - Canvas drop zones register with `registerPointerDropHandler(handler)`.
   - On pointer release, the active drop handler resolves whether the operation is a new field insertion (`onInsertFieldAtTarget`) or a reorder (`onReorderField`).
   - Cleanup: Drag ghost elements and active indicator lines are cleared immediately.

### Drop Target Semantics & Geometric Computation
Drop zones compute insertion targets dynamically based on cursor coordinates relative to bounding client rectangles:
- **`before`**: Cursor in top 30% of target field container.
- **`after`**: Cursor in bottom 30% of target field container.
- **`row-left`**: Cursor in left 35% of a multi-column row target.
- **`row-right`**: Cursor in right 35% of a multi-column row target.

Drop indicators must render as 2px high-contrast hairline lines or bounding outlines (`border-zinc-900 dark:border-zinc-100`) without altering DOM layout geometry or causing layout shifts.

---

## 3. Grid Layout & Row Grouping System

The canvas layout engine models forms as a responsive 12-column grid system governed by domain primitives (`MAX_ROW_COLUMNS = 12`).

### Column Span Allocations
Every `FormField` specifies an explicit `colSpan`:
- **12 columns (`colSpan: 12`)**: Full width (1 field per row).
- **8 columns (`colSpan: 8`)**: Two-thirds width (pairs with a 4-column field).
- **6 columns (`colSpan: 6`)**: Half width (2 fields per row).
- **4 columns (`colSpan: 4`)**: One-third width (3 fields per row).

### Responsive Grid Classes
The canvas maps `FieldColSpan` to mobile-first responsive utility classes:
```typescript
const COL_SPAN_CLASSES: Record<FieldColSpan, string> = {
  12: 'col-span-1 md:col-span-12',
  8: 'col-span-1 md:col-span-8',
  6: 'col-span-1 md:col-span-6',
  4: 'col-span-1 md:col-span-6 xl:col-span-4',
};
```
On small mobile viewports (`< 768px`), all multi-column fields gracefully collapse to single-column full-width layouts (`col-span-1`) to preserve touch accessibility and avoid cramped inputs.

### Row Grouping Engine
Fields are grouped using pure domain logic (`groupFieldsIntoRows(schema.fields)`):
- Contiguous fields whose cumulative `colSpan` sums to `<= 12` are grouped into a single visual row container (`grid grid-cols-1 md:grid-cols-12 gap-4`).
- Section dividers (`section`) always break rows and force a new layout container.

---

## 4. Open/Closed Principle (OCP) via Field Registry

The canvas must strictly adhere to the Open/Closed Principle:
- **Strict Prohibition**: **NEVER** write `switch (field.type)` or `if (field.type === ...)` chains within `src/features/builder-canvas/`.
- **Dynamic Field Dispatch**: Field input preview rendering must delegate to `renderFieldInput` or `getFieldDefinition(field.type)` from `src/fields/index.ts`.
- **Extensibility Guarantee**: Adding a new field type in `src/fields/` must immediately function on the canvas without modifying any canvas component code.

---

## 5. Selection, Action Bar & Canvas Ergonomics

Each canvas field card operates with distinct visual states and contextual controls:

### Visual States
- **Idle**: 1px subtle hairline border (`border-zinc-200 dark:border-zinc-800`), neutral surface (`bg-white dark:bg-zinc-900`), and smooth transitions.
- **Hover**: Subtle border contrast increase (`hover:border-zinc-400 dark:hover:border-zinc-700`).
- **Selected**: 2px active ring (`ring-2 ring-zinc-950 dark:ring-zinc-100`), elevated card depth, and active field toolbar.
- **Dragging / Drop Ghost**: Semi-transparent opacity (`opacity-40 scale-[0.99]`) and dashed outline.

### Contextual Action Bar
When a field is selected or hovered, a floating compact action bar exposes:
1. **Drag Grip**: Tactile vertical grip handle for pointer drag reordering.
2. **Width Selector**: Quick toggle between 12 (Full), 6 (Half), and 4 (Third) columns.
3. **Move Up / Down**: Incremental reordering triggers.
4. **Duplicate**: Duplicates the field configuration with a newly generated ID.
5. **Delete**: Removes the field, with safeguards for conditional dependencies.

---

## 6. Keyboard Navigation & Accessibility (WCAG 2.1 AA)

- **Keyboard Focus**: Field cards must be focusable via `Tab` with visible focus rings (`focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-100`).
- **Keyboard Reordering**:
  - `Alt + ArrowUp`: Move selected field up one position.
  - `Alt + ArrowDown`: Move selected field down one position.
- **Deletion**: `Delete` or `Backspace` triggers removal when a field card is focused and not editing an inline input.
- **Aria Live Announcements**: Reordering and field insertion actions must announce status updates to screen readers via an `aria-live="polite"` status region (e.g., `"Field Email moved to position 2 of 6"`).

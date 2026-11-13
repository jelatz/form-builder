# Field Palette — Architecture, Catalog Resolution & Interaction Governance

This document establishes the architectural standards, dynamic catalog resolution rules, and interaction protocols for the Field Palette feature (`src/features/field-palette/`).

---

## 1. Architectural Scope & Unidirectional Boundary

The Field Palette provides users with a searchable, categorized library of available form field types. It operates strictly within the repository's unidirectional architecture:

```
App.tsx  ──▶  src/features/field-palette/  ──▶  src/fields/  ──▶  src/domain/  ──▶  src/shared/
```

### Strict Boundary Rules
- **No Direct Schema Manipulation**: The palette does not mutate `FormSchema` directly. It communicates user intent by emitting field types via `onAddField(type: FieldType)` or by initiating drag sessions.
- **Isolation from Canvas & Inspector**: The palette must not import internal components from `builder-canvas`, `property-inspector`, or `form-renderer`.
- **Dynamic Field Catalog**: Field types and metadata must be queried dynamically from `src/fields/registry.ts` via `getFieldCatalog()`, never hardcoded as static lists in the UI layer.

---

## 2. Dynamic Catalog Resolution & Extensibility (OCP)

The palette dynamically discovers available field types through the Open/Closed Field Registry:
- **`getFieldCatalog()`**: Resolves the complete list of registered `FieldCatalogItem` definitions (`type`, `label`, `description`, `icon`, `category`).
- **Zero-Touch Expansion**: When a developer adds a new field definition in `src/fields/` and registers it via `registerField(...)`, that field automatically appears in the Field Palette with zero modifications required inside `src/features/field-palette/`.

---

## 3. Categorization & Visual Hierarchy

Fields are partitioned into distinct functional groups to optimize discovery and usability:

### 1. Input Controls
Interactive inputs that capture end-user data:
- **`text`**: Single-line text input.
- **`email`**: Email address with email format validation.
- **`phone`**: Telephone number with tel protocol support.
- **`number`**: Numeric input with min/max bounds and step controls.
- **`textarea`**: Multi-line longform text input.
- **`select`**: Single-select dropdown menu with searchable options.
- **`radio`**: Single-choice radio button group.
- **`checkbox`**: Single boolean toggle or consent agreement.
- **`date`**: Date picker with ISO 8601 formatting.

### 2. Structural & Layout Elements
Non-input or meta controls used for structure and tracking:
- **`section`**: Visual divider with header, separator line, and optional description text to partition form sections.
- **`hidden`**: Hidden query parameter / UTM tracking field capturing URL parameters or preset values without runtime visual rendering.

---

## 4. Drag Source Integration & Pointer Drag Protocol

The palette acts as a primary drag source for the pointer-based drag-and-drop system:

### Drag Initiation
- On `pointerdown` on any palette field button, the component initiates a pointer drag session:
  ```typescript
  beginPointerDrag({
    type: 'new_field',
    fieldType: item.type,
  });
  ```
- A drag preview ghost element is rendered, tracking the cursor position without blocking pointer events on underlying canvas drop targets.

### Drop Handling Coordination
- When dropped onto a canvas drop zone, the canvas drop handler reads the `new_field` payload and executes `onInsertFieldAtTarget(fieldType, targetFieldId, position)`.
- If the pointer is released outside a valid canvas drop zone, the drag session cancels cleanly with zero side effects.

---

## 5. Click-to-Append Semantics

In addition to drag-and-drop, every palette item supports immediate click-to-append:
- **Action**: Clicking or pressing `Enter`/`Space` on a palette item invokes `onAddField(item.type)`.
- **Default Instantiation**: The coordinator instantiates the field using `createDefaultConfig(newFieldId)` from the field definition in `src/fields/registry.ts`.
- **Default Placement**: Newly appended fields are added to the end of `schema.fields` with full width (`colSpan: 12`).
- **Canvas Focus**: Appending a new field automatically selects it (`selectedFieldId = newField.id`) and scrolls it into view on the canvas.

---

## 6. Visual Design, Tokens & Micro-Interactions

The palette strictly complies with [`DESIGN.md`](/DESIGN.md):
- **Monochrome Neutral Zinc Tokens**: Pure neutral palette (`border-zinc-200 dark:border-zinc-800`, `bg-white dark:bg-zinc-900`, text `zinc-900 dark:zinc-100`).
- **Tactile Feedback**: Clean hover state (`hover:border-zinc-400 dark:hover:border-zinc-700`, `hover:bg-zinc-50 dark:hover:bg-zinc-800/60`) and subtle active scale (`active:scale-[0.98] transition-all duration-150`).
- **Crisp SVG Glyphs**: 16x16px (`h-4 w-4`) stroke icons with `aria-hidden="true"` providing immediate visual recognition for each field type.
- **Prohibited Slop**: No rainbow gradients, no pastel card backgrounds, and no cartoonish border radii (maximum radius is `rounded-lg`).

---

## 7. Accessibility & Keyboard Navigation (WCAG 2.1 AA)

- **Semantic Elements**: Palette items must be rendered as semantic `<button>` elements with clear `type="button"`.
- **Keyboard Operability**: Fully navigable via `Tab`. Pressing `Enter` or `Space` appends the field to the canvas.
- **Accessible Descriptions**: Each item includes an accessible label and optional tooltip description explaining the field's purpose.
- **Visible Focus Rings**: Distinct 2px focus indicators (`focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-100 focus-visible:outline-none`).

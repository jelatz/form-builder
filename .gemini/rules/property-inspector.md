# Property Inspector — Architecture, Configuration Protocol & Governance

This document establishes the architectural standards, configuration protocols, and governance rules for the Property Inspector feature (`src/features/property-inspector/`).

---

## 1. Architectural Scope & Unidirectional Boundary

The Property Inspector is the contextual configuration sidebar that enables editing field properties, metadata, layout width, validation constraints, and conditional visibility logic. It conforms strictly to the repository's unidirectional architecture:

```
App.tsx  ──▶  src/features/property-inspector/  ──▶  src/fields/  ──▶  src/domain/  ──▶  src/shared/
```

### Strict Boundary Rules
- **No Direct Schema Mutation**: The inspector never modifies `FormField` objects directly. All updates must be dispatched via immutable callbacks (`onUpdateField`, `onRemoveField`).
- **Isolation from Sibling Features**: The inspector must not directly import or depend on `builder-canvas`, `field-palette`, or `form-renderer`. All interactions are mediated through `App.tsx`.
- **Stateless Selection Binding**: The inspector reflects the currently active `field` passed as a prop from the parent. It manages only local draft input states (if applicable) and does not maintain independent field identity state.

---

## 2. Selection Reactivity & Empty State Ergonomics

### Null Selection Handling
When `field` is `null` (no field currently selected on the canvas):
- Render a dedicated, neutral empty state placeholder adhering to [`DESIGN.md`](/DESIGN.md).
- Display a dashed border container (`border-dashed border-zinc-200 dark:border-zinc-800`), neutral surface, clean glyph icon, and clear instruction (`"No question selected"` / `"Click any question on the canvas to configure its properties"`).
- Maintain consistent panel width and height geometry without causing container collapse or layout shift.

### Reactive Field Synchronization
When the user selects a different field on the canvas:
- The inspector immediately updates to display the newly selected field's properties.
- Any unsaved local input drafts are committed or reset cleanly without polluting the previous field's attributes.

---

## 3. Immutable Updates Protocol

All updates dispatched through `onUpdateField(updatedField: FormField)` must be pure and immutable:
- **Never Mutate Existing References**:
  ```typescript
  // Forbidden - direct in-place mutation
  field.label = newLabel;
  onUpdateField(field);

  // Mandatory - immutable clone with shallow copy
  onUpdateField({
    ...field,
    label: newLabel,
  });
  ```
- **Nested Objects & Arrays**: Arrays such as `options` for select/radio or nested validation objects must be shallow-copied (`options: [...field.options, newOption]`) to preserve object reference integrity across React render cycles.

---

## 4. Open/Closed Principle (OCP) via Field Registry Delegation

The Property Inspector separates universal field settings from field-specific configuration using the Field Registry:

### Universal Properties (Handled Directly in Inspector)
- **Identification & Labels**: Field label, description/help text, and technical identifier (`id`).
- **Layout & Column Span**: Width allocation (`colSpan`: 12, 8, 6, 4).
- **Universal Validation**: Required toggle, custom required error message.
- **Conditional Visibility**: Visibility logic engine (see Section 5).

### Field-Specific Properties (Delegated via Registry)
- **Strict Prohibition**: **NEVER** write `switch (field.type)` or `if (field.type === ...)` chains in the inspector component for field-specific configuration panels.
- **Registry Delegation**: Field-specific options (e.g., choice items for select/radio, min/max for numbers, placeholder text for inputs, date ranges for datepickers) must be rendered via `renderFieldInspector` or `getFieldDefinition(field.type).renderInspector({ field, onUpdate: onUpdateField })`.

---

## 5. Conditional Visibility Logic & Cyclic Dependency Prevention

The Property Inspector provides a visual rules engine to configure conditional display rules (`ConditionRule`):

### Supported Comparison Operators
- `equals`: Target field value strictly equals criteria.
- `not_equals`: Target field value does not equal criteria.
- `contains`: Target field value contains string substring or array item.
- `not_empty`: Target field value is not blank/null/undefined.
- `is_empty`: Target field value is blank/null/undefined.

### Strict Cyclic Dependency Prevention
- **Rule of Precedence**: A field can **ONLY** depend on fields that appear **prior** to it in the form schema sequence (`allFields.slice(0, currentFieldIndex)`).
- **Prohibitions**:
  - A field must **never** depend on itself.
  - A field must **never** depend on a field positioned below/after it in the schema.
  - Circular dependency graphs (Field A depends on Field B, which depends on Field A) are strictly prevented by restricting target candidates in the field selector dropdown to prior fields only.

---

## 6. Validation Rules Configuration

The inspector exposes validation parameters with real-time feedback:
- **Required Constraint**: Boolean toggle + optional custom error message.
- **Length Constraints**: `minLength` and `maxLength` inputs (for text, email, phone, textarea) with non-negative integer enforcement.
- **Value Constraints**: `min` and `max` numeric bounds (for number fields) and step intervals.
- **Format Validation**: Optional regex pattern string with user-friendly syntax verification.

---

## 7. Destructive Actions & Dependency Safeguards

When deleting a field via `onRemoveField(field.id)`:
- **Dependency Audit**: The inspector or parent coordinator must check if subsequent fields contain conditional visibility rules referencing the field to be removed.
- **Orphan Cleanup**: If a deleted field was referenced by downstream conditional rules, those rules must be safely stripped or flagged to prevent broken runtime states.

---

## 8. Role-Based Permissions & Enterprise Boundaries

The Property Inspector honors user tenancy and role tiers (`userRole: 'agency_admin' | 'client_editor'`):
- **Agency Admin**: Full access to all properties, custom domain bindings, tracking webhooks, and raw identifier settings.
- **Client Editor**: Restricted access to cosmetic copy (labels, help text, placeholders, choices), with technical identifiers and global submission webhooks locked in read-only mode to prevent system misconfiguration.

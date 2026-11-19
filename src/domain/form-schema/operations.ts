import type { FormField, FormSchema } from './types';
import { createSectionField } from './sections';

function nowIso(): string {
  return new Date().toISOString();
}

function generateFieldId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `field_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `field_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Clones a FormField deeply enough to preserve 100% JSON serializability
 * and prevent shared nested array/object references (such as `options` or `allowedDomains`).
 */
function cloneField(field: FormField, newId: string, newLabel: string): FormField {
  switch (field.type) {
    case 'select':
    case 'radio':
      return {
        ...field,
        id: newId,
        label: newLabel,
        options: field.options.map((opt) => ({ ...opt })),
      };
    case 'email':
      return {
        ...field,
        id: newId,
        label: newLabel,
        allowedDomains: field.allowedDomains ? [...field.allowedDomains] : undefined,
      };
    case 'text':
    case 'number':
    case 'checkbox':
    case 'date':
    case 'name':
    case 'phone':
    case 'address':
    case 'textarea':
    case 'website':
    case 'currency':
    case 'section':
    case 'grid':
      return {
        ...field,
        id: newId,
        label: newLabel,
      };
  }
}

/**
 * Pure operation: Inserts a new field into the schema at `index` (or appends to the end).
 */
export function addField(
  schema: FormSchema,
  field: FormField,
  index?: number,
): FormSchema {
  const nextFields = [...schema.fields];
  if (index === undefined || index < 0 || index >= nextFields.length) {
    nextFields.push(field);
  } else {
    nextFields.splice(index, 0, field);
  }

  return {
    ...schema,
    fields: nextFields,
    updatedAt: nowIso(),
  };
}

/**
 * Pure operation: Removes a field by its `fieldId` and any child fields contained within it.
 * If `fieldId` refers to a `section` field, delegates to `removeSection` so at least one section remains.
 * Returns the original schema reference if `fieldId` does not exist.
 */
export function removeField(schema: FormSchema, fieldId: string): FormSchema {
  const target = schema.fields.find((f) => f.id === fieldId);
  if (!target) {
    return schema;
  }
  if (target.type === 'section') {
    return removeSection(schema, fieldId);
  }

  const nextFields = schema.fields.filter(
    (f) => f.id !== fieldId && f.parentGridId !== fieldId,
  );
  if (nextFields.length === schema.fields.length) {
    return schema;
  }

  return {
    ...schema,
    fields: nextFields,
    updatedAt: nowIso(),
  };
}

/**
 * Pure operation: Replaces or updates a field matching `fieldId`.
 * If updating a grid container, clamps any child fields exceeding the new column count.
 */
export function updateField(
  schema: FormSchema,
  fieldId: string,
  updater: FormField | ((current: FormField) => FormField),
): FormSchema {
  let changed = false;
  let gridColumns: (1 | 2 | 3) | undefined;

  const mappedFields = schema.fields.map((field) => {
    if (field.id !== fieldId) {
      return field;
    }
    const updated = typeof updater === 'function' ? updater(field) : updater;
    if (updated !== field) {
      changed = true;
    }
    if (updated.type === 'grid') {
      gridColumns = updated.columns;
    }
    return updated;
  });

  if (!changed) {
    return schema;
  }

  let nextFields = mappedFields;
  if (gridColumns !== undefined) {
    const maxColIndex = (gridColumns - 1) as 0 | 1 | 2;
    nextFields = mappedFields.map((f) => {
      if (f.parentGridId === fieldId && (f.gridColumn ?? 0) >= gridColumns!) {
        return {
          ...f,
          gridColumn: maxColIndex,
        };
      }
      return f;
    });
  }

  return {
    ...schema,
    fields: nextFields,
    updatedAt: nowIso(),
  };
}

/**
 * Pure operation: Moves a field from `fromIndex` to `toIndex`.
 * Preserves a leading `section` field at index 0 so non-section fields cannot precede Section 1.
 */
export function moveField(
  schema: FormSchema,
  fromIndex: number,
  toIndex: number,
): FormSchema {
  const count = schema.fields.length;
  if (
    fromIndex < 0 ||
    fromIndex >= count ||
    toIndex < 0 ||
    toIndex >= count ||
    fromIndex === toIndex
  ) {
    return schema;
  }

  const moved = schema.fields[fromIndex];
  if (!moved) {
    return schema;
  }

  const hasLeadingSection = schema.fields[0]?.type === 'section';
  let clampedToIndex = toIndex;
  if (hasLeadingSection) {
    if (fromIndex === 0 && moved.type === 'section') {
      return schema;
    }
    if (moved.type !== 'section' && clampedToIndex === 0) {
      clampedToIndex = 1;
    }
  }

  if (fromIndex === clampedToIndex) {
    return schema;
  }

  const nextFields = [...schema.fields];
  nextFields.splice(fromIndex, 1);
  nextFields.splice(clampedToIndex, 0, moved);

  return {
    ...schema,
    fields: nextFields,
    updatedAt: nowIso(),
  };
}

/**
 * Pure operation: Duplicates the field with `fieldId` and inserts the copy right after it.
 * If duplicating a grid container, deeply clones all of its nested children as well.
 * If duplicating a section, places the duplicated section after the original section's fields.
 */
export function duplicateField(
  schema: FormSchema,
  fieldId: string,
  customNewId?: string,
): FormSchema {
  const sourceIndex = schema.fields.findIndex((f) => f.id === fieldId);
  if (sourceIndex === -1) {
    return schema;
  }

  const sourceField = schema.fields[sourceIndex];
  if (!sourceField) {
    return schema;
  }

  const newId = customNewId ?? generateFieldId();
  const copy = cloneField(sourceField, newId, `${sourceField.label} (Copy)`);

  const nextFields = [...schema.fields];
  if (sourceField.type === 'section') {
    let insertAt = schema.fields.length;
    for (let i = sourceIndex + 1; i < schema.fields.length; i++) {
      const candidate = schema.fields[i];
      if (candidate && !candidate.parentGridId && candidate.type === 'section') {
        insertAt = i;
        break;
      }
    }
    nextFields.splice(insertAt, 0, copy);
  } else if (sourceField.type === 'grid') {
    const children = schema.fields.filter((f) => f.parentGridId === fieldId);
    const clonedChildren = children.map((child) => {
      const childNewId = generateFieldId();
      const clonedChild = cloneField(child, childNewId, child.label);
      return {
        ...clonedChild,
        parentGridId: newId,
      };
    });
    nextFields.splice(sourceIndex + 1, 0, copy, ...clonedChildren);
  } else {
    nextFields.splice(sourceIndex + 1, 0, copy);
  }

  return {
    ...schema,
    fields: nextFields,
    updatedAt: nowIso(),
  };
}

/**
 * Pure operation: Moves a field into a target grid column or detaches it back to top level.
 */
export function moveFieldToGrid(
  schema: FormSchema,
  fieldId: string,
  parentGridId: string | undefined,
  gridColumn?: 0 | 1 | 2,
): FormSchema {
  const fieldIndex = schema.fields.findIndex((f) => f.id === fieldId);
  if (fieldIndex === -1) {
    return schema;
  }

  if (fieldId === parentGridId) {
    return schema;
  }

  const targetField = schema.fields[fieldIndex];
  if (!targetField) {
    return schema;
  }

  if (
    parentGridId !== undefined &&
    (targetField.type === 'grid' || targetField.type === 'section')
  ) {
    return schema;
  }

  const updatedField: FormField = {
    ...targetField,
    parentGridId: parentGridId !== undefined ? parentGridId : undefined,
    gridColumn: parentGridId !== undefined ? (gridColumn ?? 0) : undefined,
  };

  const nextFields = schema.fields.filter((f) => f.id !== fieldId);
  nextFields.push(updatedField);

  return {
    ...schema,
    fields: nextFields,
    updatedAt: nowIso(),
  };
}

/**
 * Pure operation: Appends a new titled Section to the end of the form,
 * or inserts right after `afterSectionId` if provided.
 */
export function addSection(
  schema: FormSchema,
  title?: string,
  customId?: string,
  afterSectionId?: string,
): FormSchema {
  const sectionCount = schema.fields.filter((f) => f.type === 'section').length;
  const resolvedTitle = title?.trim() || `Section ${sectionCount + 1}`;
  const newSection = createSectionField(resolvedTitle, customId);

  if (!afterSectionId) {
    return {
      ...schema,
      fields: [...schema.fields, newSection],
      updatedAt: nowIso(),
    };
  }

  const afterIdx = schema.fields.findIndex(
    (f) => f.id === afterSectionId && f.type === 'section',
  );
  if (afterIdx === -1) {
    return {
      ...schema,
      fields: [...schema.fields, newSection],
      updatedAt: nowIso(),
    };
  }

  let insertAt = schema.fields.length;
  for (let i = afterIdx + 1; i < schema.fields.length; i++) {
    const candidate = schema.fields[i];
    if (candidate && !candidate.parentGridId && candidate.type === 'section') {
      insertAt = i;
      break;
    }
  }

  const nextFields = [...schema.fields];
  nextFields.splice(insertAt, 0, newSection);
  return {
    ...schema,
    fields: nextFields,
    updatedAt: nowIso(),
  };
}

/**
 * Pure operation: Inserts a non-section field at the end of the specified section.
 */
export function addFieldToSection(
  schema: FormSchema,
  field: FormField,
  sectionId?: string,
): FormSchema {
  if (!sectionId || field.type === 'section') {
    return addField(schema, field);
  }

  const sectionIndex = schema.fields.findIndex(
    (f) => f.id === sectionId && f.type === 'section',
  );
  if (sectionIndex === -1) {
    return addField(schema, field);
  }

  let insertAt = schema.fields.length;
  for (let i = sectionIndex + 1; i < schema.fields.length; i++) {
    const candidate = schema.fields[i];
    if (candidate && !candidate.parentGridId && candidate.type === 'section') {
      insertAt = i;
      break;
    }
  }

  return addField(schema, field, insertAt);
}

/**
 * Pure operation: Moves an entire section (header + its top-level fields) up or down.
 * Grid child fields remain attached to their parent grids.
 */
export function moveSection(
  schema: FormSchema,
  sectionId: string,
  direction: 'up' | 'down',
): FormSchema {
  const topLevel = schema.fields.filter((f) => !f.parentGridId);
  const gridChildren = schema.fields.filter((f) => Boolean(f.parentGridId));

  const blocks: FormField[][] = [];
  let currentBlock: FormField[] | null = null;

  for (const field of topLevel) {
    if (field.type === 'section') {
      currentBlock = [field];
      blocks.push(currentBlock);
    } else {
      if (!currentBlock) {
        currentBlock = [];
        blocks.push(currentBlock);
      }
      currentBlock.push(field);
    }
  }

  const currentIdx = blocks.findIndex((b) => b[0]?.id === sectionId);
  if (currentIdx === -1) {
    return schema;
  }

  const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
  if (targetIdx < 0 || targetIdx >= blocks.length) {
    return schema;
  }

  // Prevent moving a section ahead of an implicit non-section block if one exists
  if (targetIdx === 0 && blocks[0]?.[0]?.type !== 'section') {
    return schema;
  }

  const reordered = [...blocks];
  const [movedBlock] = reordered.splice(currentIdx, 1);
  if (!movedBlock) {
    return schema;
  }
  reordered.splice(targetIdx, 0, movedBlock);

  return {
    ...schema,
    fields: [...reordered.flat(), ...gridChildren],
    updatedAt: nowIso(),
  };
}

/**
 * Pure operation: Removes a section by ID while preserving at least one section
 * in the form and keeping its fields inside the adjacent section so data is not lost.
 */
export function removeSection(
  schema: FormSchema,
  sectionId: string,
): FormSchema {
  const sectionFields = schema.fields.filter(
    (f) => !f.parentGridId && f.type === 'section',
  );
  if (sectionFields.length <= 1) {
    return schema;
  }

  const topLevel = schema.fields.filter((f) => !f.parentGridId);
  const gridChildren = schema.fields.filter((f) => Boolean(f.parentGridId));
  const targetTopIdx = topLevel.findIndex(
    (f) => f.id === sectionId && f.type === 'section',
  );
  if (targetTopIdx === -1) {
    return schema;
  }

  // If removing the very first section, promote the second section to index 0
  // and keep the first section's fields inside it so no fields precede Section 1.
  if (targetTopIdx === 0) {
    const secondSectionIdx = topLevel.findIndex(
      (f, idx) => idx > 0 && f.type === 'section',
    );
    if (secondSectionIdx === -1) {
      return schema;
    }
    const firstSectionChildren = topLevel.slice(1, secondSectionIdx);
    const secondSection = topLevel[secondSectionIdx];
    const remainingAfterSecond = topLevel.slice(secondSectionIdx + 1);
    if (!secondSection) {
      return schema;
    }
    return {
      ...schema,
      fields: [
        secondSection,
        ...firstSectionChildren,
        ...remainingAfterSecond,
        ...gridChildren,
      ],
      updatedAt: nowIso(),
    };
  }

  const nextTopLevel = topLevel.filter((f) => f.id !== sectionId);
  return {
    ...schema,
    fields: [...nextTopLevel, ...gridChildren],
    updatedAt: nowIso(),
  };
}

/**
 * Pure operation: Updates top-level form metadata (`title`, `description`, `slug`, `submitButtonText`, post-submit settings).
 */
export function updateFormMetadata(
  schema: FormSchema,
  patch: Partial<
    Pick<
      FormSchema,
      | 'title'
      | 'description'
      | 'slug'
      | 'submitButtonText'
      | 'thankYouTitle'
      | 'thankYouMessage'
      | 'redirectUrl'
      | 'isPublished'
    >
  >,
): FormSchema {
  return {
    ...schema,
    ...patch,
    updatedAt: nowIso(),
  };
}

/**
 * Pure operation: Marks a FormSchema as a draft (`isPublished: false`) after a builder edit.
 */
export function markFormAsDraft(schema: FormSchema): FormSchema {
  if (schema.isPublished === false) {
    return schema;
  }
  return {
    ...schema,
    isPublished: false,
    updatedAt: nowIso(),
  };
}

/**
 * Pure operation: Marks a FormSchema as published (`isPublished: true`).
 */
export function publishFormSchema(schema: FormSchema): FormSchema {
  return updateFormMetadata(schema, { isPublished: true });
}

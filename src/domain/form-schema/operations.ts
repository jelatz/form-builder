import type { FormField, FormSchema } from './types';

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
 * Returns the original schema reference if `fieldId` does not exist.
 */
export function removeField(schema: FormSchema, fieldId: string): FormSchema {
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

  const nextFields = [...schema.fields];
  const [moved] = nextFields.splice(fromIndex, 1);
  if (!moved) {
    return schema;
  }
  nextFields.splice(toIndex, 0, moved);

  return {
    ...schema,
    fields: nextFields,
    updatedAt: nowIso(),
  };
}

/**
 * Pure operation: Duplicates the field with `fieldId` and inserts the copy right after it.
 * If duplicating a grid container, deeply clones all of its nested children as well.
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
  if (sourceField.type === 'grid') {
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
 * Pure operation: Updates top-level form metadata (`title`, `description`, `slug`, `submitButtonText`).
 */
export function updateFormMetadata(
  schema: FormSchema,
  patch: Partial<
    Pick<
      FormSchema,
      'title' | 'description' | 'slug' | 'submitButtonText' | 'isPublished'
    >
  >,
): FormSchema {
  return {
    ...schema,
    ...patch,
    updatedAt: nowIso(),
  };
}

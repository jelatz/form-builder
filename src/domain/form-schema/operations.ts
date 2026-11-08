import type {
  FieldColSpan,
  FormField,
  FormIntegrationConfig,
  FormSchema,
  FormValues,
  SubmissionSettings,
} from './types.ts';
import { generateId } from '../../shared/lib/id.ts';

export const MAX_ROW_COLUMNS = 3 as const;

export type FieldDropPosition = 'before' | 'after' | 'left' | 'right';

export interface FieldRow {
  rowIndex: number;
  fields: FormField[];
  totalSpan: number;
}

export function getAutoColSpan(columnCount: number): FieldColSpan {
  if (columnCount <= 1) {
    return 12;
  }
  if (columnCount === 2) {
    return 6;
  }
  return 4;
}

export function autoAdjustRowFields(rowFields: FormField[]): FormField[] {
  if (rowFields.length === 0) {
    return [];
  }
  const span = getAutoColSpan(rowFields.length);
  return rowFields.map((field) => ({
    ...field,
    colSpan: span,
  }));
}

export function groupFieldsIntoRows(fields: FormField[]): FieldRow[] {
  const rows: FieldRow[] = [];
  let currentRowFields: FormField[] = [];
  let currentSpan = 0;

  const flushCurrentRow = () => {
    if (currentRowFields.length > 0) {
      rows.push({
        rowIndex: rows.length,
        fields: currentRowFields,
        totalSpan: currentSpan,
      });
      currentRowFields = [];
      currentSpan = 0;
    }
  };

  for (const field of fields) {
    if (field.type === 'section') {
      flushCurrentRow();
      const sectionField =
        field.colSpan === 12 ? field : { ...field, colSpan: 12 as FieldColSpan };
      rows.push({
        rowIndex: rows.length,
        fields: [sectionField],
        totalSpan: 12,
      });
      continue;
    }

    const span = field.colSpan ?? 12;
    if (
      currentRowFields.length > 0 &&
      currentRowFields[0]?.type !== 'section' &&
      currentRowFields.length < MAX_ROW_COLUMNS &&
      currentSpan + span <= 12
    ) {
      currentRowFields.push(field);
      currentSpan += span;
    } else {
      flushCurrentRow();
      currentRowFields = [field];
      currentSpan = span;
    }
  }

  flushCurrentRow();
  return rows;
}

export function createInitialSchema(
  clientId = 'client_acme',
  customDomain = 'forms.acmelogistics.com',
): FormSchema {
  return {
    id: generateId('form'),
    clientId,
    slug: 'lead-intake',
    customDomain,
    status: 'published',
    title: 'Customer Feedback Form',
    description: 'Collect structured responses from your users.',
    fields: [],
    settings: {
      submitButtonText: 'Submit Request',
      actionType: 'message',
      successTitle: 'Thank you!',
      successMessage: 'Your response has been recorded and routed to our team.',
    },
    integrations: [],
  };
}

export function addField(schema: FormSchema, field: FormField, index?: number): FormSchema {
  const fields = [...schema.fields];
  if (typeof index === 'number' && index >= 0 && index <= fields.length) {
    fields.splice(index, 0, field);
  } else {
    fields.push(field);
  }
  return {
    ...schema,
    fields,
  };
}

export function insertFieldAtTarget(
  schema: FormSchema,
  field: FormField,
  targetFieldId: string,
  position: FieldDropPosition,
): FormSchema {
  const rows = groupFieldsIntoRows(schema.fields).map((r) => ({
    ...r,
    fields: [...r.fields],
  }));

  const targetRowIndex = rows.findIndex((r) => r.fields.some((f) => f.id === targetFieldId));
  if (targetRowIndex === -1) {
    return addField(schema, { ...field, colSpan: 12 });
  }

  const targetRow = rows[targetRowIndex]!;
  const targetInRowIndex = targetRow.fields.findIndex((f) => f.id === targetFieldId);
  const targetField = targetRow.fields[targetInRowIndex]!;

  if (
    (position === 'left' || position === 'right') &&
    field.type !== 'section' &&
    targetField.type !== 'section'
  ) {
    if (targetRow.fields.length < MAX_ROW_COLUMNS) {
      const insertIdx = position === 'left' ? targetInRowIndex : targetInRowIndex + 1;
      targetRow.fields.splice(insertIdx, 0, field);
      targetRow.fields = autoAdjustRowFields(targetRow.fields);
    } else {
      targetRow.fields = autoAdjustRowFields(targetRow.fields);
      const newRowFields: FormField[] = [{ ...field, colSpan: 12 }];
      const insertRowIdx = position === 'left' ? targetRowIndex : targetRowIndex + 1;
      rows.splice(insertRowIdx, 0, {
        rowIndex: 0,
        fields: newRowFields,
        totalSpan: 12,
      });
    }
  } else {
    const newRowFields: FormField[] = [{ ...field, colSpan: 12 }];
    const insertRowIdx =
      position === 'before' || position === 'left' ? targetRowIndex : targetRowIndex + 1;
    rows.splice(insertRowIdx, 0, {
      rowIndex: 0,
      fields: newRowFields,
      totalSpan: 12,
    });
  }

  const newFields = rows.filter((r) => r.fields.length > 0).flatMap((r) => r.fields);
  return {
    ...schema,
    fields: newFields,
  };
}

export function removeField(schema: FormSchema, fieldId: string): FormSchema {
  const rows = groupFieldsIntoRows(schema.fields).map((r) => ({
    ...r,
    fields: [...r.fields],
  }));

  const targetRow = rows.find((r) => r.fields.some((f) => f.id === fieldId));
  if (!targetRow) {
    return schema;
  }

  targetRow.fields = targetRow.fields.filter((f) => f.id !== fieldId);
  if (targetRow.fields.length > 0 && targetRow.fields[0]?.type !== 'section') {
    targetRow.fields = autoAdjustRowFields(targetRow.fields);
  }

  const fields = rows.filter((r) => r.fields.length > 0).flatMap((r) => r.fields);
  return {
    ...schema,
    fields,
  };
}

export function updateField(
  schema: FormSchema,
  fieldId: string,
  updater: (field: FormField) => FormField,
): FormSchema {
  return {
    ...schema,
    fields: schema.fields.map((field) => (field.id === fieldId ? updater(field) : field)),
  };
}

export function moveField(
  schema: FormSchema,
  fieldId: string,
  direction: 'up' | 'down',
): FormSchema {
  const index = schema.fields.findIndex((field) => field.id === fieldId);
  if (index === -1) {
    return schema;
  }

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= schema.fields.length) {
    return schema;
  }

  const fields = [...schema.fields];
  const current = fields[index];
  const target = fields[targetIndex];

  if (!current || !target) {
    return schema;
  }

  fields[index] = target;
  fields[targetIndex] = current;

  return {
    ...schema,
    fields,
  };
}

export function reorderField(
  schema: FormSchema,
  sourceFieldId: string,
  targetFieldId: string,
  position: FieldDropPosition = 'before',
): FormSchema {
  if (sourceFieldId === targetFieldId) {
    return schema;
  }

  const rows = groupFieldsIntoRows(schema.fields).map((r) => ({
    ...r,
    fields: [...r.fields],
  }));

  const sourceRowIndex = rows.findIndex((r) => r.fields.some((f) => f.id === sourceFieldId));
  const targetRowIndex = rows.findIndex((r) => r.fields.some((f) => f.id === targetFieldId));

  if (sourceRowIndex === -1 || targetRowIndex === -1) {
    return schema;
  }

  const sourceRow = rows[sourceRowIndex]!;
  const targetRow = rows[targetRowIndex]!;
  const sourceField = sourceRow.fields.find((f) => f.id === sourceFieldId);
  const targetField = targetRow.fields.find((f) => f.id === targetFieldId);

  if (!sourceField || !targetField) {
    return schema;
  }

  if (sourceRowIndex === targetRowIndex) {
    if (position === 'left' || position === 'right') {
      const currentSourceIdx = sourceRow.fields.findIndex((f) => f.id === sourceFieldId);
      sourceRow.fields.splice(currentSourceIdx, 1);
      const newTargetInRowIndex = sourceRow.fields.findIndex((f) => f.id === targetFieldId);
      const insertIndex = position === 'left' ? newTargetInRowIndex : newTargetInRowIndex + 1;
      sourceRow.fields.splice(insertIndex, 0, sourceField);
      sourceRow.fields = autoAdjustRowFields(sourceRow.fields);
    } else {
      if (sourceRow.fields.length === 1) {
        return schema;
      }
      const currentSourceIdx = sourceRow.fields.findIndex((f) => f.id === sourceFieldId);
      sourceRow.fields.splice(currentSourceIdx, 1);
      sourceRow.fields = autoAdjustRowFields(sourceRow.fields);

      const targetIdx = rows.indexOf(sourceRow);
      const insertRowIdx = position === 'before' ? targetIdx : targetIdx + 1;
      rows.splice(insertRowIdx, 0, {
        rowIndex: 0,
        fields: [{ ...sourceField, colSpan: 12 }],
        totalSpan: 12,
      });
    }

    const newFields = rows.filter((r) => r.fields.length > 0).flatMap((r) => r.fields);
    return {
      ...schema,
      fields: newFields,
    };
  }

  const sourceIdxInRow = sourceRow.fields.findIndex((f) => f.id === sourceFieldId);
  sourceRow.fields.splice(sourceIdxInRow, 1);
  if (sourceRow.fields.length > 0) {
    sourceRow.fields = autoAdjustRowFields(sourceRow.fields);
  }

  if (
    (position === 'left' || position === 'right') &&
    sourceField.type !== 'section' &&
    targetField.type !== 'section'
  ) {
    if (targetRow.fields.length < MAX_ROW_COLUMNS) {
      const targetInRowIdx = targetRow.fields.findIndex((f) => f.id === targetFieldId);
      const insertIdx = position === 'left' ? targetInRowIdx : targetInRowIdx + 1;
      targetRow.fields.splice(insertIdx, 0, sourceField);
      targetRow.fields = autoAdjustRowFields(targetRow.fields);
    } else {
      targetRow.fields = autoAdjustRowFields(targetRow.fields);
      const targetIdx = rows.indexOf(targetRow);
      const insertRowIdx = position === 'left' ? targetIdx : targetIdx + 1;
      rows.splice(insertRowIdx, 0, {
        rowIndex: 0,
        fields: [{ ...sourceField, colSpan: 12 }],
        totalSpan: 12,
      });
    }
  } else {
    const targetIdx = rows.indexOf(targetRow);
    const insertRowIdx =
      position === 'before' || position === 'left' ? targetIdx : targetIdx + 1;
    rows.splice(insertRowIdx, 0, {
      rowIndex: 0,
      fields: [{ ...sourceField, colSpan: 12 }],
      totalSpan: 12,
    });
  }

  const newFields = rows.filter((r) => r.fields.length > 0).flatMap((r) => r.fields);
  return {
    ...schema,
    fields: newFields,
  };
}

export function duplicateField(
  schema: FormSchema,
  fieldId: string,
): { schema: FormSchema; newFieldId: string | null } {
  const rows = groupFieldsIntoRows(schema.fields).map((r) => ({
    ...r,
    fields: [...r.fields],
  }));

  const rowIndex = rows.findIndex((r) => r.fields.some((f) => f.id === fieldId));
  if (rowIndex === -1) {
    return { schema, newFieldId: null };
  }

  const row = rows[rowIndex]!;
  const originalIndexInRow = row.fields.findIndex((f) => f.id === fieldId);
  const originalField = row.fields[originalIndexInRow]!;

  const newFieldId = generateId(originalField.type);

  let clonedField: FormField;
  if (originalField.type === 'select' || originalField.type === 'radio') {
    clonedField = {
      ...originalField,
      id: newFieldId,
      label: `${originalField.label} (Copy)`,
      options: originalField.options.map((opt) => ({ ...opt })),
    };
  } else {
    clonedField = {
      ...originalField,
      id: newFieldId,
      label: `${originalField.label} (Copy)`,
    };
  }

  if (
    originalField.type !== 'section' &&
    row.fields.length < MAX_ROW_COLUMNS &&
    (originalField.colSpan ?? 12) < 12
  ) {
    row.fields.splice(originalIndexInRow + 1, 0, clonedField);
    row.fields = autoAdjustRowFields(row.fields);
  } else {
    const newRowFields: FormField[] = [{ ...clonedField, colSpan: 12 }];
    rows.splice(rowIndex + 1, 0, {
      rowIndex: 0,
      fields: newRowFields,
      totalSpan: 12,
    });
  }

  const fields = rows.filter((r) => r.fields.length > 0).flatMap((r) => r.fields);

  return {
    schema: {
      ...schema,
      fields,
    },
    newFieldId,
  };
}

export function updateSchemaMeta(
  schema: FormSchema,
  patch: Partial<
    Pick<FormSchema, 'title' | 'description' | 'slug' | 'customDomain' | 'status' | 'clientId'>
  >,
): FormSchema {
  return {
    ...schema,
    ...patch,
  };
}

export function updateSubmissionSettings(
  schema: FormSchema,
  patch: Partial<SubmissionSettings>,
): FormSchema {
  return {
    ...schema,
    settings: {
      ...schema.settings,
      ...patch,
    },
  };
}

export function upsertIntegration(
  schema: FormSchema,
  integration: FormIntegrationConfig,
): FormSchema {
  const exists = schema.integrations.some((i) => i.id === integration.id);
  const integrations = exists
    ? schema.integrations.map((i) => (i.id === integration.id ? integration : i))
    : [...schema.integrations, integration];

  return {
    ...schema,
    integrations,
  };
}

export function removeIntegration(schema: FormSchema, integrationId: string): FormSchema {
  return {
    ...schema,
    integrations: schema.integrations.filter((i) => i.id !== integrationId),
  };
}

export function buildCrmPayload(
  schema: FormSchema,
  integration: FormIntegrationConfig,
  values: FormValues,
  urlParams: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  const mappingByFieldId = new Map<string, string>();
  for (const mapping of integration.fieldMappings) {
    if (mapping.formFieldId && mapping.remoteFieldKey) {
      mappingByFieldId.set(mapping.formFieldId, mapping.remoteFieldKey);
    }
  }

  for (const field of schema.fields) {
    if (field.type === 'section') {
      continue;
    }
    const mappedKey = mappingByFieldId.get(field.id) || field.crmFieldKey || field.id;
    payload[mappedKey] = values[field.id];
  }

  for (const mapping of integration.fieldMappings) {
    if (mapping.remoteFieldKey && !(mapping.remoteFieldKey in payload)) {
      payload[mapping.remoteFieldKey] = values[mapping.formFieldId];
    }
  }

  payload._meta = {
    clientId: schema.clientId,
    formId: schema.id,
    formSlug: schema.slug,
    domain: schema.customDomain,
    provider: integration.provider,
    urlParams,
  };

  return payload;
}

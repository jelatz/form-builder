import type { ReactNode } from 'react';
import type { FormField } from '../domain/form-schema/index.ts';

export interface FieldRenderProps<TField extends FormField = FormField> {
  field: TField;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
  error?: string;
  disabled?: boolean;
}

export interface FieldInspectorProps<TField extends FormField = FormField> {
  field: TField;
  onChange: (updatedField: TField) => void;
}

export interface FieldDefinition<TField extends FormField = FormField> {
  type: TField['type'];
  paletteLabel: string;
  description: string;
  badge: string;
  createDefault: () => TField;
  renderInput: (props: FieldRenderProps<TField>) => ReactNode;
  renderInspector: (props: FieldInspectorProps<TField>) => ReactNode;
}

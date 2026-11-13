import type { ReactNode } from 'react';
import type {
  FieldConfigByType,
  FieldType,
  FormField,
} from '../domain/form-schema';

export interface FieldRenderProps<T extends FieldType = FieldType> {
  field: FieldConfigByType<T>;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

export interface FieldInspectorProps<T extends FieldType = FieldType> {
  field: FieldConfigByType<T>;
  onChange: (updated: FieldConfigByType<T>) => void;
}

export interface FieldDefinition<T extends FieldType = FieldType> {
  type: T;
  label: string;
  description: string;
  badge: string;
  createDefaultConfig: (id: string) => FieldConfigByType<T>;
  render: (props: FieldRenderProps<T>) => ReactNode;
  renderInspector: (props: FieldInspectorProps<T>) => ReactNode;
}

export type AnyFieldDefinition = {
  [K in FieldType]: FieldDefinition<K>;
}[FieldType];

export type FieldRegistryMap = {
  [K in FieldType]: FieldDefinition<K>;
};

export interface BoundFieldModule {
  definition: AnyFieldDefinition;
  renderRuntime: (props: {
    value: unknown;
    onChange: (value: unknown) => void;
    error?: string;
    disabled?: boolean;
  }) => ReactNode;
  renderInspector: (props: {
    onChange: (updated: FormField) => void;
  }) => ReactNode;
}

export type ZohoPaletteTab = 'form_fields' | 'smart_fields';

export interface ZohoPaletteTile {
  id: string;
  label: string;
  type: FieldType;
  tab: ZohoPaletteTab;
  category: string;
  iconType: string;
  accentColor: 'amber' | 'emerald' | 'blue' | 'violet' | 'cyan' | 'rose';
  isNew?: boolean;
  presetPatch?: Partial<FormField>;
}

export interface ZohoPaletteCategoryGroup {
  category: string;
  tab: ZohoPaletteTab;
  tiles: ZohoPaletteTile[];
}

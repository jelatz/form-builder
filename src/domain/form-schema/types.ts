/**
 * Pure Domain Types for the Multi-Tenant Form Builder AST.
 * Zero React/DOM dependencies; 100% JSON-serializable.
 */

export const FIELD_TYPES = [
  'text',
  'number',
  'select',
  'checkbox',
  'radio',
  'date',
  'email',
  'name',
  'phone',
  'address',
  'textarea',
  'website',
  'currency',
  'section',
  'grid',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export interface SelectOption {
  label: string;
  value: string;
}

export interface BaseFieldConfig {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helperText?: string;
  required: boolean;
  columnSpan?: 1 | 2 | 3;
  showDividerAbove?: boolean;
  parentGridId?: string;
  gridColumn?: 0 | 1 | 2;
}

export interface TextFieldConfig extends BaseFieldConfig {
  type: 'text';
  minLength?: number;
  maxLength?: number;
}

export interface EmailFieldConfig extends BaseFieldConfig {
  type: 'email';
  allowedDomains?: string[];
  confirmEmail?: boolean;
}

export interface NumberFieldConfig extends BaseFieldConfig {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
}

export interface SelectFieldConfig extends BaseFieldConfig {
  type: 'select';
  options: SelectOption[];
}

export interface RadioFieldConfig extends BaseFieldConfig {
  type: 'radio';
  options: SelectOption[];
}

export interface CheckboxFieldConfig extends BaseFieldConfig {
  type: 'checkbox';
  defaultChecked?: boolean;
}

export interface DateFieldConfig extends BaseFieldConfig {
  type: 'date';
  minDate?: string; // ISO YYYY-MM-DD
  maxDate?: string; // ISO YYYY-MM-DD
}

export interface NameFieldConfig extends BaseFieldConfig {
  type: 'name';
  firstNameLabel?: string;
  lastNameLabel?: string;
}

export interface PhoneFieldConfig extends BaseFieldConfig {
  type: 'phone';
  defaultCountryCode?: string;
}

export interface AddressFieldConfig extends BaseFieldConfig {
  type: 'address';
  showCountry?: boolean;
}

export interface TextareaFieldConfig extends BaseFieldConfig {
  type: 'textarea';
  rows?: number;
  maxLength?: number;
}

export interface WebsiteFieldConfig extends BaseFieldConfig {
  type: 'website';
}

export interface CurrencyFieldConfig extends BaseFieldConfig {
  type: 'currency';
  currencyCode?: string;
  min?: number;
  max?: number;
}

export interface SectionFieldConfig extends BaseFieldConfig {
  type: 'section';
  showLine?: boolean;
}

export interface GridFieldConfig extends BaseFieldConfig {
  type: 'grid';
  columns: 1 | 2 | 3;
}

export type FormField =
  | TextFieldConfig
  | EmailFieldConfig
  | NumberFieldConfig
  | SelectFieldConfig
  | RadioFieldConfig
  | CheckboxFieldConfig
  | DateFieldConfig
  | NameFieldConfig
  | PhoneFieldConfig
  | AddressFieldConfig
  | TextareaFieldConfig
  | WebsiteFieldConfig
  | CurrencyFieldConfig
  | SectionFieldConfig
  | GridFieldConfig;

/**
 * Extracts the exact FormField union member for a given FieldType.
 */
export type FieldConfigByType<T extends FieldType> = Extract<
  FormField,
  { type: T }
>;

export interface ClientTenant {
  id: string;
  name: string;
  slug: string;
  status?: 'active' | 'suspended';
  createdAt: string;
}

export interface FormSchema {
  id: string;
  clientId: string;
  slug: string;
  title: string;
  description?: string;
  submitButtonText?: string;
  isPublished?: boolean;
  fields: FormField[];
  updatedAt: string;
}

export interface SubmissionRecord {
  id: string;
  formId: string;
  clientId: string;
  values: Record<string, unknown>;
  submittedAt: string;
}

/**
 * Type guard verifying if an unknown string is a supported FieldType.
 */
export function isFieldType(value: unknown): value is FieldType {
  return (
    typeof value === 'string' &&
    (FIELD_TYPES as readonly string[]).includes(value)
  );
}

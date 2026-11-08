export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'hidden'
  | 'section';

export type FieldColSpan = 12 | 8 | 6 | 4;

export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_empty';

export interface FieldCondition {
  sourceFieldId: string;
  operator: ConditionOperator;
  value: string;
}

export interface BaseField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  helperText?: string;
  crmFieldKey?: string;
  condition?: FieldCondition;
  colSpan?: FieldColSpan;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface TextFieldConfig extends BaseField {
  type: 'text';
  placeholder?: string;
  maxLength?: number;
  defaultValue?: string;
}

export interface EmailFieldConfig extends BaseField {
  type: 'email';
  placeholder?: string;
  defaultValue?: string;
}

export interface PhoneFieldConfig extends BaseField {
  type: 'phone';
  placeholder?: string;
  defaultValue?: string;
}

export interface NumberFieldConfig extends BaseField {
  type: 'number';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: string;
}

export interface TextareaFieldConfig extends BaseField {
  type: 'textarea';
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  defaultValue?: string;
}

export interface SelectFieldConfig extends BaseField {
  type: 'select';
  placeholder?: string;
  options: SelectOption[];
  defaultValue?: string;
}

export interface RadioFieldConfig extends BaseField {
  type: 'radio';
  options: SelectOption[];
  defaultValue?: string;
}

export interface CheckboxFieldConfig extends BaseField {
  type: 'checkbox';
  checkboxLabel: string;
  defaultChecked: boolean;
}

export interface DateFieldConfig extends BaseField {
  type: 'date';
  minDate?: string;
  maxDate?: string;
  defaultValue?: string;
}

export interface HiddenFieldConfig extends BaseField {
  type: 'hidden';
  urlParamKey: string;
  defaultValue?: string;
}

export interface SectionFieldConfig extends BaseField {
  type: 'section';
  subtitle?: string;
  showDivider: boolean;
}

export type FormField =
  | TextFieldConfig
  | EmailFieldConfig
  | PhoneFieldConfig
  | NumberFieldConfig
  | TextareaFieldConfig
  | SelectFieldConfig
  | RadioFieldConfig
  | CheckboxFieldConfig
  | DateFieldConfig
  | HiddenFieldConfig
  | SectionFieldConfig;

export type ExtractField<T extends FieldType> = Extract<FormField, { type: T }>;

export type IntegrationProvider = 'ghl' | 'close' | 'zoho' | 'airtable' | 'webhook';

export interface FieldMapping {
  formFieldId: string;
  remoteFieldKey: string;
}

export interface FormIntegrationConfig {
  id: string;
  provider: IntegrationProvider;
  name: string;
  enabled: boolean;
  endpointUrl: string;
  targetResource?: string;
  apiKeyMasked?: string;
  fieldMappings: FieldMapping[];
}

export interface SubmissionSettings {
  submitButtonText: string;
  actionType: 'message' | 'redirect';
  successTitle: string;
  successMessage: string;
  redirectUrl?: string;
  appendParamsToRedirect?: boolean;
}

export interface ClientTenant {
  id: string;
  name: string;
  slug: string;
  primaryDomain: string;
  allowedDomains: string[];
  industry?: string;
  status: 'active' | 'paused';
}

export interface FormSchema {
  id: string;
  clientId: string;
  slug: string;
  customDomain: string;
  status: 'draft' | 'published';
  title: string;
  description: string;
  fields: FormField[];
  settings: SubmissionSettings;
  integrations: FormIntegrationConfig[];
}

export interface IntegrationDeliveryLog {
  integrationId: string;
  provider: IntegrationProvider;
  integrationName: string;
  status: 'delivered' | 'failed';
  statusCode: number;
  payloadPreview: string;
  responseMessage: string;
  timestamp: string;
}

export interface SubmissionRecord {
  id: string;
  formId: string;
  formTitle: string;
  clientId: string;
  domain: string;
  submittedAt: string;
  values: FormValues;
  capturedUrlParams: Record<string, string>;
  deliveryLogs: IntegrationDeliveryLog[];
}

export type FormValues = Record<string, string | boolean | undefined>;

export type FormErrors = Record<string, string>;

export type UserRole = 'agency_admin' | 'client_editor';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clientId?: string | null;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  expiresAt?: number;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  clientName?: string;
  clientId?: string;
  primaryDomain?: string;
}


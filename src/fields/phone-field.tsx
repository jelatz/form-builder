import type { ReactNode } from 'react';
import type { PhoneFieldConfig } from '../domain/form-schema/index.ts';
import type { FieldDefinition, FieldInspectorProps, FieldRenderProps } from './types.ts';
import { cn, generateId } from '../shared/lib/index.ts';

function renderPhoneInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldRenderProps<PhoneFieldConfig>): ReactNode {
  const textValue = typeof value === 'string' ? value : '';

  return (
    <div className="relative w-full">
      <input
        id={field.id}
        name={field.id}
        type="tel"
        value={textValue}
        placeholder={field.placeholder}
        disabled={disabled}
        autoComplete="tel"
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 w-full rounded-md border px-3 text-sm bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-zinc-50 dark:disabled:bg-zinc-950',
          error
            ? 'border-rose-500 text-rose-600 dark:border-rose-400 dark:text-rose-400 focus-visible:ring-rose-500 dark:focus-visible:ring-rose-400'
            : 'border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300',
        )}
      />
    </div>
  );
}

function renderPhoneInspector({
  field,
  onChange,
}: FieldInspectorProps<PhoneFieldConfig>): ReactNode {
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Phone Properties
        </span>
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-sm">
          Phone
        </span>
      </div>

      <div>
        <label
          htmlFor={`${field.id}_placeholder`}
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
        >
          Placeholder
        </label>
        <input
          id={`${field.id}_placeholder`}
          type="text"
          value={field.placeholder ?? ''}
          onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
          placeholder="e.g. +1 (555) 000-0000"
          className="h-8 w-full text-xs px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
        />
      </div>

      <div>
        <label
          htmlFor={`${field.id}_defaultValue`}
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
        >
          Default Value
        </label>
        <input
          id={`${field.id}_defaultValue`}
          type="tel"
          value={field.defaultValue ?? ''}
          onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
          placeholder="Optional prefilled phone"
          className="h-8 w-full text-xs px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
        />
      </div>
    </div>
  );
}

export const phoneFieldDefinition: FieldDefinition<PhoneFieldConfig> = {
  type: 'phone',
  paletteLabel: 'Phone Number',
  description: 'International/local phone input for SMS & call automations',
  badge: '☎',
  createDefault: (): PhoneFieldConfig => ({
    id: generateId('phone'),
    type: 'phone',
    label: 'Phone Number',
    required: false,
    placeholder: '+1 (555) 000-0000',
    crmFieldKey: 'phone',
    defaultValue: '',
    helperText: '',
  }),
  renderInput: renderPhoneInput,
  renderInspector: renderPhoneInspector,
};

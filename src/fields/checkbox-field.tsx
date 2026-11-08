import type { ReactNode } from 'react';
import type { CheckboxFieldConfig } from '../domain/form-schema/index.ts';
import type { FieldDefinition, FieldInspectorProps, FieldRenderProps } from './types.ts';
import { cn, generateId } from '../shared/lib/index.ts';

function renderCheckboxInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldRenderProps<CheckboxFieldConfig>): ReactNode {
  const isChecked = typeof value === 'boolean' ? value : field.defaultChecked;

  return (
    <div className="w-full">
      <label
        className={cn(
          'flex items-start gap-2.5 cursor-pointer select-none text-sm leading-snug',
          disabled && 'cursor-not-allowed opacity-50 pointer-events-none',
        )}
      >
        <input
          id={field.id}
          name={field.id}
          type="checkbox"
          checked={isChecked}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(e.target.checked)}
          className={cn(
            'mt-0.5 h-4 w-4 rounded-sm border transition-colors accent-zinc-950 dark:accent-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1',
            error
              ? 'border-rose-500 text-rose-600 dark:border-rose-400 dark:text-rose-400 focus-visible:ring-rose-500 dark:focus-visible:ring-rose-400'
              : 'border-zinc-300 dark:border-zinc-700 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300',
          )}
        />
        <span className="text-sm font-normal text-zinc-700 dark:text-zinc-300">
          {field.checkboxLabel || 'Checkbox label'}
        </span>
      </label>
    </div>
  );
}

function renderCheckboxInspector({
  field,
  onChange,
}: FieldInspectorProps<CheckboxFieldConfig>): ReactNode {
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Checkbox Properties
        </span>
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-sm">
          Checkbox
        </span>
      </div>

      <div>
        <label
          htmlFor={`${field.id}_checkboxLabel`}
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
        >
          Checkbox Label
        </label>
        <input
          id={`${field.id}_checkboxLabel`}
          type="text"
          value={field.checkboxLabel}
          onChange={(e) => onChange({ ...field, checkboxLabel: e.target.value })}
          placeholder="Text displayed next to toggle"
          className="h-8 w-full text-xs px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
        />
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          The explanatory text or agreement prompt placed next to the checkbox.
        </p>
      </div>

      <div className="pt-1">
        <label
          htmlFor={`${field.id}_defaultChecked`}
          className="flex items-center gap-2.5 cursor-pointer select-none"
        >
          <input
            id={`${field.id}_defaultChecked`}
            type="checkbox"
            checked={field.defaultChecked}
            onChange={(e) => onChange({ ...field, defaultChecked: e.target.checked })}
            className="h-4 w-4 rounded-sm border-zinc-300 dark:border-zinc-700 accent-zinc-950 dark:accent-zinc-100 focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 focus-visible:ring-offset-1"
          />
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Checked by default
          </span>
        </label>
      </div>
    </div>
  );
}

export const checkboxFieldDefinition: FieldDefinition<CheckboxFieldConfig> = {
  type: 'checkbox',
  paletteLabel: 'Checkbox',
  description: 'Boolean toggle for agreements, opt-ins, or confirmations',
  badge: '☑',
  createDefault: (): CheckboxFieldConfig => ({
    id: generateId('checkbox'),
    type: 'checkbox',
    label: 'Terms & Consent',
    checkboxLabel: 'I agree to the terms and privacy policy',
    required: false,
    defaultChecked: false,
    crmFieldKey: 'consent_opt_in',
    helperText: '',
  }),
  renderInput: renderCheckboxInput,
  renderInspector: renderCheckboxInspector,
};

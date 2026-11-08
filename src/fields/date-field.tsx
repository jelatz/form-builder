import type { ReactNode } from 'react';
import type { DateFieldConfig } from '../domain/form-schema/index.ts';
import type { FieldDefinition, FieldInspectorProps, FieldRenderProps } from './types.ts';
import { cn, generateId } from '../shared/lib/index.ts';

function renderDateInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldRenderProps<DateFieldConfig>): ReactNode {
  const dateValue = typeof value === 'string' ? value : '';

  return (
    <div className="relative w-full">
      <input
        id={field.id}
        name={field.id}
        type="date"
        value={dateValue}
        min={field.minDate || undefined}
        max={field.maxDate || undefined}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 w-full rounded-md border bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-950 dark:text-zinc-100 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-zinc-50 dark:disabled:bg-zinc-950',
          error
            ? 'border-rose-500 text-rose-600 dark:border-rose-400 dark:text-rose-400 focus-visible:ring-rose-500 dark:focus-visible:ring-rose-400'
            : 'border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300',
        )}
      />
    </div>
  );
}

function renderDateInspector({
  field,
  onChange,
}: FieldInspectorProps<DateFieldConfig>): ReactNode {
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Date Picker Properties
        </span>
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-sm">
          Date
        </span>
      </div>

      <div>
        <label
          htmlFor={`${field.id}_defaultValue`}
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
        >
          Default Date
        </label>
        <input
          id={`${field.id}_defaultValue`}
          type="date"
          value={field.defaultValue ?? ''}
          onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
          className="h-8 w-full text-xs px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label
            htmlFor={`${field.id}_minDate`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Earliest (Min)
          </label>
          <input
            id={`${field.id}_minDate`}
            type="date"
            value={field.minDate ?? ''}
            onChange={(e) => onChange({ ...field, minDate: e.target.value })}
            className="h-8 w-full text-xs px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor={`${field.id}_maxDate`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Latest (Max)
          </label>
          <input
            id={`${field.id}_maxDate`}
            type="date"
            value={field.maxDate ?? ''}
            onChange={(e) => onChange({ ...field, maxDate: e.target.value })}
            className="h-8 w-full text-xs px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
          />
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        Leave empty to allow selecting any calendar date.
      </p>
    </div>
  );
}

export const dateFieldDefinition: FieldDefinition<DateFieldConfig> = {
  type: 'date',
  paletteLabel: 'Date Picker',
  description: 'Calendar date selection with optional min/max bounds',
  badge: '📅',
  createDefault: (): DateFieldConfig => ({
    id: generateId('date'),
    type: 'date',
    label: 'Preferred Date',
    required: false,
    minDate: '',
    maxDate: '',
    defaultValue: '',
    crmFieldKey: 'preferred_date',
    helperText: '',
  }),
  renderInput: renderDateInput,
  renderInspector: renderDateInspector,
};

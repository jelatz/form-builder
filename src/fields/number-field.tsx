import type { ReactNode } from 'react';
import type { NumberFieldConfig } from '../domain/form-schema/index.ts';
import type { FieldDefinition, FieldInspectorProps, FieldRenderProps } from './types.ts';
import { cn, generateId } from '../shared/lib/index.ts';

function renderNumberInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldRenderProps<NumberFieldConfig>): ReactNode {
  const textValue =
    typeof value === 'string'
      ? value
      : typeof value === 'number'
        ? String(value)
        : '';

  return (
    <div className="relative w-full">
      <input
        id={field.id}
        name={field.id}
        type="number"
        value={textValue}
        min={field.min}
        max={field.max}
        step={field.step}
        placeholder={field.placeholder}
        disabled={disabled}
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

function renderNumberInspector({
  field,
  onChange,
}: FieldInspectorProps<NumberFieldConfig>): ReactNode {
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Number Properties
        </span>
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-sm">
          Number
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
          placeholder="e.g. 0 or 1000"
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
          type="number"
          value={field.defaultValue ?? ''}
          onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
          placeholder="Optional prefilled number"
          className="h-8 w-full text-xs px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label
            htmlFor={`${field.id}_min`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Min
          </label>
          <input
            id={`${field.id}_min`}
            type="number"
            value={field.min ?? ''}
            onChange={(e) => {
              const val = e.target.value.trim();
              if (val === '') {
                onChange({ ...field, min: undefined });
              } else {
                const parsed = parseFloat(val);
                onChange({ ...field, min: Number.isNaN(parsed) ? undefined : parsed });
              }
            }}
            placeholder="Min"
            className="h-8 w-full text-xs px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor={`${field.id}_max`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Max
          </label>
          <input
            id={`${field.id}_max`}
            type="number"
            value={field.max ?? ''}
            onChange={(e) => {
              const val = e.target.value.trim();
              if (val === '') {
                onChange({ ...field, max: undefined });
              } else {
                const parsed = parseFloat(val);
                onChange({ ...field, max: Number.isNaN(parsed) ? undefined : parsed });
              }
            }}
            placeholder="Max"
            className="h-8 w-full text-xs px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor={`${field.id}_step`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Step
          </label>
          <input
            id={`${field.id}_step`}
            type="number"
            value={field.step ?? ''}
            onChange={(e) => {
              const val = e.target.value.trim();
              if (val === '') {
                onChange({ ...field, step: undefined });
              } else {
                const parsed = parseFloat(val);
                onChange({ ...field, step: Number.isNaN(parsed) ? undefined : parsed });
              }
            }}
            placeholder="Step"
            className="h-8 w-full text-xs px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
          />
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        Specify optional minimum, maximum, and step increments.
      </p>
    </div>
  );
}

export const numberFieldDefinition: FieldDefinition<NumberFieldConfig> = {
  type: 'number',
  paletteLabel: 'Number Input',
  description: 'Numeric inputs with bounds, step sizes, and calculations',
  badge: '#',
  createDefault: (): NumberFieldConfig => ({
    id: generateId('number'),
    type: 'number',
    label: 'Annual Revenue ($)',
    required: false,
    placeholder: '100000',
    min: 0,
    crmFieldKey: 'annual_revenue',
    defaultValue: '',
    helperText: '',
  }),
  renderInput: renderNumberInput,
  renderInspector: renderNumberInspector,
};

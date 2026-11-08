import type { ReactNode } from 'react';
import type { TextareaFieldConfig } from '../domain/form-schema/index.ts';
import type { FieldDefinition, FieldInspectorProps, FieldRenderProps } from './types.ts';
import { cn, generateId } from '../shared/lib/index.ts';

function renderTextareaInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldRenderProps<TextareaFieldConfig>): ReactNode {
  const textValue = typeof value === 'string' ? value : '';

  return (
    <div className="relative w-full">
      <textarea
        id={field.id}
        name={field.id}
        rows={field.rows ?? 4}
        maxLength={field.maxLength}
        value={textValue}
        placeholder={field.placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-zinc-50 dark:disabled:bg-zinc-950',
          error
            ? 'border-rose-500 text-rose-600 dark:border-rose-400 dark:text-rose-400 focus-visible:ring-rose-500 dark:focus-visible:ring-rose-400'
            : 'border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300',
        )}
      />
      {typeof field.maxLength === 'number' && field.maxLength > 0 && (
        <div className="mt-1 flex justify-end">
          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
            {textValue.length} / {field.maxLength}
          </span>
        </div>
      )}
    </div>
  );
}

function renderTextareaInspector({
  field,
  onChange,
}: FieldInspectorProps<TextareaFieldConfig>): ReactNode {
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Textarea Properties
        </span>
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-sm">
          Long Text
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
          placeholder="e.g. Tell us about your workflow..."
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
        <textarea
          id={`${field.id}_defaultValue`}
          rows={3}
          value={field.defaultValue ?? ''}
          onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
          placeholder="Optional prefilled text"
          className="w-full text-xs px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label
            htmlFor={`${field.id}_rows`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Rows (2–12)
          </label>
          <input
            id={`${field.id}_rows`}
            type="number"
            min={2}
            max={12}
            value={field.rows ?? 4}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              onChange({
                ...field,
                rows: Number.isNaN(parsed) ? 4 : Math.min(12, Math.max(2, parsed)),
              });
            }}
            className="h-8 w-full text-xs px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor={`${field.id}_maxLength`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Max Length
          </label>
          <input
            id={`${field.id}_maxLength`}
            type="number"
            min={0}
            value={field.maxLength ?? ''}
            onChange={(e) => {
              const rawVal = e.target.value.trim();
              if (rawVal === '') {
                onChange({ ...field, maxLength: undefined });
              } else {
                const parsed = parseInt(rawVal, 10);
                onChange({
                  ...field,
                  maxLength: Number.isNaN(parsed) || parsed < 0 ? undefined : parsed,
                });
              }
            }}
            placeholder="No limit"
            className="h-8 w-full text-xs px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
          />
        </div>
      </div>
    </div>
  );
}

export const textareaFieldDefinition: FieldDefinition<TextareaFieldConfig> = {
  type: 'textarea',
  paletteLabel: 'Long Text / Notes',
  description: 'Multi-line text area for detailed project requirements',
  badge: '¶',
  createDefault: (): TextareaFieldConfig => ({
    id: generateId('textarea'),
    type: 'textarea',
    label: 'Project Details',
    required: false,
    placeholder: 'Tell us about your workflow goals...',
    rows: 4,
    crmFieldKey: 'notes',
    defaultValue: '',
    helperText: '',
  }),
  renderInput: renderTextareaInput,
  renderInspector: renderTextareaInspector,
};

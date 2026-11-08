import type { ReactNode } from 'react';
import type { SelectFieldConfig, SelectOption } from '../domain/form-schema/index.ts';
import type { FieldDefinition, FieldInspectorProps, FieldRenderProps } from './types.ts';
import { cn, generateId } from '../shared/lib/index.ts';

function renderSelectInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldRenderProps<SelectFieldConfig>): ReactNode {
  const selectedValue = typeof value === 'string' ? value : '';

  return (
    <div className="relative w-full">
      <select
        id={field.id}
        name={field.id}
        value={selectedValue}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 w-full appearance-none rounded-md border bg-white dark:bg-zinc-900 px-3 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-zinc-50 dark:disabled:bg-zinc-950',
          error
            ? 'border-rose-500 text-rose-600 dark:border-rose-400 dark:text-rose-400 focus-visible:ring-rose-500 dark:focus-visible:ring-rose-400'
            : 'border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300',
          !selectedValue ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-950 dark:text-zinc-100',
        )}
      >
        <option value="" disabled={field.required} className="text-zinc-400 dark:text-zinc-500">
          {field.placeholder || 'Select an option...'}
        </option>
        {field.options.map((opt, idx) => (
          <option key={`${opt.value}-${idx}`} value={opt.value} className="text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900">
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400 dark:text-zinc-500">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

function renderSelectInspector({
  field,
  onChange,
}: FieldInspectorProps<SelectFieldConfig>): ReactNode {
  const handleOptionLabelChange = (index: number, newLabel: string) => {
    const oldOpt = field.options[index];
    if (!oldOpt) return;
    const shouldSyncValue =
      oldOpt.value === oldOpt.label ||
      oldOpt.value.startsWith('option_') ||
      !oldOpt.value;
    const newValue = shouldSyncValue ? newLabel : oldOpt.value;

    const updatedOptions = field.options.map((opt, idx) => {
      if (idx !== index) return opt;
      return { ...opt, label: newLabel, value: newValue };
    });

    let nextDefault = field.defaultValue;
    if (field.defaultValue === oldOpt.value) {
      nextDefault = newValue;
    }

    onChange({
      ...field,
      options: updatedOptions,
      defaultValue: nextDefault,
    });
  };

  const handleOptionValueChange = (index: number, newValue: string) => {
    const oldOpt = field.options[index];
    if (!oldOpt) return;

    const updatedOptions = field.options.map((opt, idx) => {
      if (idx !== index) return opt;
      return { ...opt, value: newValue };
    });

    let nextDefault = field.defaultValue;
    if (field.defaultValue === oldOpt.value) {
      nextDefault = newValue;
    }

    onChange({
      ...field,
      options: updatedOptions,
      defaultValue: nextDefault,
    });
  };

  const handleAddOption = () => {
    const count = field.options.length + 1;
    const newOption: SelectOption = {
      label: `Option ${count}`,
      value: `Option ${count}`,
    };
    onChange({
      ...field,
      options: [...field.options, newOption],
    });
  };

  const handleMoveOption = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= field.options.length) return;

    const newOptions = [...field.options];
    const temp = newOptions[index];
    newOptions[index] = newOptions[targetIndex];
    newOptions[targetIndex] = temp;

    onChange({
      ...field,
      options: newOptions,
    });
  };

  const handleRemoveOption = (index: number) => {
    if (field.options.length <= 1) return;
    const removedValue = field.options[index]?.value;
    const nextOptions = field.options.filter((_, idx) => idx !== index);
    const nextDefault = field.defaultValue === removedValue ? '' : field.defaultValue;

    onChange({
      ...field,
      options: nextOptions,
      defaultValue: nextDefault,
    });
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Dropdown Properties
        </span>
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-sm">
          Choices
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
          placeholder="e.g. Select an option..."
          className="h-8 w-full text-xs px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
        />
      </div>

      <div>
        <label
          htmlFor={`${field.id}_defaultValue`}
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
        >
          Default Selection
        </label>
        <div className="relative">
          <select
            id={`${field.id}_defaultValue`}
            value={field.defaultValue ?? ''}
            onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
            className="h-8 w-full appearance-none text-xs px-2.5 pr-7 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
          >
            <option value="">(No default selected)</option>
            {field.options.map((opt, idx) => (
              <option key={`default-${opt.value}-${idx}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-zinc-400 dark:text-zinc-500">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <div className="pt-1">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Choices ({field.options.length})
          </label>
          <button
            type="button"
            onClick={handleAddOption}
            className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium rounded-md text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-[0.99] transition-all shadow-xs"
          >
            <span className="text-xs font-bold leading-none">+</span> Add Choice
          </button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {field.options.map((opt, index) => (
            <div
              key={`opt-row-${index}`}
              className="flex items-center gap-2 p-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-xs"
            >
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  value={opt.label}
                  onChange={(e) => handleOptionLabelChange(index, e.target.value)}
                  placeholder={`Choice ${index + 1}`}
                  aria-label={`Choice ${index + 1} text`}
                  className="h-7 w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300"
                />
                <details className="text-[10px] text-zinc-500">
                  <summary className="cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-300">
                    Custom export value
                  </summary>
                  <div className="mt-1">
                    <input
                      type="text"
                      value={opt.value}
                      onChange={(e) => handleOptionValueChange(index, e.target.value)}
                      placeholder="Export value"
                      aria-label={`Choice ${index + 1} export value`}
                      className="h-6 w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300"
                    />
                  </div>
                </details>
              </div>

              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => handleMoveOption(index, 'up')}
                  disabled={index === 0}
                  title="Move up"
                  aria-label={`Move option ${index + 1} up`}
                  className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveOption(index, 'down')}
                  disabled={index === field.options.length - 1}
                  title="Move down"
                  aria-label={`Move option ${index + 1} down`}
                  className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveOption(index)}
                disabled={field.options.length <= 1}
                title={
                  field.options.length <= 1
                    ? 'At least one choice is required'
                    : 'Remove choice'
                }
                aria-label={`Remove option ${index + 1}`}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-[0.99] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const selectFieldDefinition: FieldDefinition<SelectFieldConfig> = {
  type: 'select',
  paletteLabel: 'Select Dropdown',
  description: 'Single choice from a customizable list of options',
  badge: '▾',
  createDefault: (): SelectFieldConfig => ({
    id: generateId('select'),
    type: 'select',
    label: 'Department',
    required: false,
    placeholder: 'Select an option...',
    crmFieldKey: 'department',
    options: [
      { label: 'Engineering', value: 'engineering' },
      { label: 'Product Design', value: 'design' },
      { label: 'Marketing', value: 'marketing' },
    ],
    defaultValue: '',
    helperText: '',
  }),
  renderInput: renderSelectInput,
  renderInspector: renderSelectInspector,
};

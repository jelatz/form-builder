import type { ReactNode } from 'react';
import type { HiddenFieldConfig } from '../domain/form-schema/index.ts';
import type { FieldDefinition, FieldInspectorProps, FieldRenderProps } from './types.ts';
import { generateId } from '../shared/lib/index.ts';

function renderHiddenInput({
  field,
  value,
  disabled,
}: FieldRenderProps<HiddenFieldConfig>): ReactNode {
  const displayVal = typeof value === 'string' ? value : field.defaultValue || '';

  // Builder canvas mode: render clean dashed technical preview badge
  if (disabled) {
    return (
      <div className="flex items-center gap-2.5 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
        <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">#</span>
        <div className="flex-1 truncate">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">URL Param: </span>
          <span className="font-mono text-zinc-600 dark:text-zinc-400">?{field.urlParamKey}=...</span>
          <span className="ml-2 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
            (fallback: &quot;{field.defaultValue || 'none'}&quot;)
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700">
          Hidden in Production
        </span>
      </div>
    );
  }

  // Live preview mode: render compact verification pill + real hidden input
  return (
    <div className="w-full">
      <input
        type="hidden"
        id={field.id}
        name={field.id}
        value={typeof value === 'string' ? value : ''}
      />
      <div className="flex items-center justify-between rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="text-zinc-400 dark:text-zinc-500">Captured ?{field.urlParamKey} =</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">&quot;{displayVal}&quot;</span>
        </span>
        <span className="font-mono text-[10px] uppercase font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700">
          Auto-Captured
        </span>
      </div>
    </div>
  );
}

function renderHiddenInspector({
  field,
  onChange,
}: FieldInspectorProps<HiddenFieldConfig>): ReactNode {
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Hidden Param Properties
        </span>
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-sm">
          URL Tracking
        </span>
      </div>

      <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 text-xs text-zinc-600 dark:text-zinc-400">
        Captures marketing links (like ?utm_source=google) invisibly without showing a box to customers.
      </div>

      <div>
        <label
          htmlFor={`${field.id}_urlParamKey`}
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
        >
          URL Query Parameter
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
            <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">?</span>
          </div>
          <input
            id={`${field.id}_urlParamKey`}
            type="text"
            value={field.urlParamKey}
            onChange={(e) => onChange({ ...field, urlParamKey: e.target.value })}
            placeholder="utm_source, gclid, ref"
            className="h-8 w-full text-xs font-mono pl-6 pr-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
          />
        </div>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          The query string key read from the URL (e.g. ?utm_source=google).
        </p>
      </div>

      <div>
        <label
          htmlFor={`${field.id}_defaultValue`}
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
        >
          Fallback Default Value
        </label>
        <input
          id={`${field.id}_defaultValue`}
          type="text"
          value={field.defaultValue ?? ''}
          onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
          placeholder="e.g. direct, organic"
          className="h-8 w-full text-xs px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
        />
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          Value to use when the URL parameter is omitted or empty.
        </p>
      </div>
    </div>
  );
}

export const hiddenFieldDefinition: FieldDefinition<HiddenFieldConfig> = {
  type: 'hidden',
  paletteLabel: 'Hidden UTM / Param',
  description: 'Captures marketing links (like ?utm_source=google) invisibly without showing a box to customers.',
  badge: '🔗',
  createDefault: (): HiddenFieldConfig => ({
    id: generateId('hidden'),
    type: 'hidden',
    label: 'UTM Source',
    required: false,
    urlParamKey: 'utm_source',
    crmFieldKey: 'utm_source',
    defaultValue: 'direct',
    helperText: '',
  }),
  renderInput: renderHiddenInput,
  renderInspector: renderHiddenInspector,
};

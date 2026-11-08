import type { ReactNode } from 'react';
import type { SectionFieldConfig } from '../domain/form-schema/index.ts';
import type { FieldDefinition, FieldInspectorProps, FieldRenderProps } from './types.ts';
import { cn, generateId } from '../shared/lib/index.ts';

function renderSectionInput({
  field,
}: FieldRenderProps<SectionFieldConfig>): ReactNode {
  return (
    <div className="w-full pt-2 pb-1">
      <div className={cn(field.showDivider && 'pb-3 border-b border-zinc-200 dark:border-zinc-800')}>
        <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {field.label || 'Section Title'}
        </h3>
        {field.subtitle && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {field.subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function renderSectionInspector({
  field,
  onChange,
}: FieldInspectorProps<SectionFieldConfig>): ReactNode {
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Section Properties
        </span>
        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-sm">
          Heading
        </span>
      </div>

      <div>
        <label
          htmlFor={`${field.id}_subtitle`}
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
        >
          Subtitle
        </label>
        <input
          id={`${field.id}_subtitle`}
          type="text"
          value={field.subtitle ?? ''}
          onChange={(e) => onChange({ ...field, subtitle: e.target.value })}
          placeholder="e.g. Provide the details below."
          className="h-8 w-full text-xs px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 shadow-sm transition-colors"
        />
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          Secondary descriptive text displayed directly below the heading.
        </p>
      </div>

      <div className="pt-1">
        <label
          htmlFor={`${field.id}_showDivider`}
          className="flex items-center gap-2.5 cursor-pointer select-none"
        >
          <input
            id={`${field.id}_showDivider`}
            type="checkbox"
            checked={field.showDivider}
            onChange={(e) => onChange({ ...field, showDivider: e.target.checked })}
            className="h-4 w-4 rounded-sm border-zinc-300 dark:border-zinc-700 accent-zinc-950 dark:accent-zinc-100 focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 focus-visible:ring-offset-1"
          />
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Show horizontal divider line
          </span>
        </label>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 ml-6.5">
          Draws a subtle hairline divider rule beneath this section heading.
        </p>
      </div>
    </div>
  );
}

export const sectionFieldDefinition: FieldDefinition<SectionFieldConfig> = {
  type: 'section',
  paletteLabel: 'Section Header',
  description: 'Structural heading & divider to group multi-column form sections',
  badge: '§',
  createDefault: (): SectionFieldConfig => ({
    id: generateId('section'),
    type: 'section',
    label: 'Section Title',
    subtitle: 'Provide the details below.',
    required: false,
    colSpan: 12,
    showDivider: true,
  }),
  renderInput: renderSectionInput,
  renderInspector: renderSectionInspector,
};

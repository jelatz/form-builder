import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type {
  FieldColSpan,
  FieldDropPosition,
  FieldType,
  FormField,
  FormSchema,
  SubmissionSettings,
} from '../../domain/form-schema/index.ts';
import {
  MAX_ROW_COLUMNS,
  createDefaultFormValues,
  groupFieldsIntoRows,
} from '../../domain/form-schema/index.ts';
import { FIELD_TYPES, getFieldDefinition, renderFieldInput } from '../../fields/index.ts';
import { cn } from '../../shared/lib/cn.ts';
import {
  beginPointerDrag,
  registerPointerDropHandler,
  subscribePointerDrag,
} from '../../shared/lib/pointer-drag.ts';
import type { PointerDragState } from '../../shared/lib/pointer-drag.ts';

export interface BuilderCanvasProps {
  schema: FormSchema;
  clientName?: string;
  allowedDomains?: string[];
  selectedFieldId: string | null;
  onSelectField: (fieldId: string | null) => void;
  onInspectField?: (fieldId: string) => void;
  onAddField: (type: FieldType, index?: number, colSpan?: FieldColSpan) => void;
  onInsertFieldAtTarget?: (type: FieldType, targetFieldId: string, position: FieldDropPosition) => void;
  onUpdateField?: (updatedField: FormField) => void;
  onReorderField?: (
    sourceFieldId: string,
    targetFieldId: string,
    position?: FieldDropPosition,
  ) => void;
  onAddRowPreset?: (preset: '2-col' | '3-col' | 'section') => void;
  onMoveField: (fieldId: string, direction: 'up' | 'down') => void;
  onDuplicateField: (fieldId: string) => void;
  onRemoveField: (fieldId: string) => void;
  onUpdateSchemaMeta: (
    patch: Partial<Pick<FormSchema, 'title' | 'description' | 'slug' | 'customDomain' | 'status'>>,
  ) => void;
  onUpdateSubmissionSettings?: (patch: Partial<SubmissionSettings>) => void;
}

const COL_SPAN_CLASSES: Record<FieldColSpan, string> = {
  12: 'col-span-1 md:col-span-12',
  8: 'col-span-1 md:col-span-8',
  6: 'col-span-1 md:col-span-6',
  4: 'col-span-1 md:col-span-6 xl:col-span-4',
};

const COL_SPAN_OPTIONS: ReadonlyArray<{ span: FieldColSpan; label: string; title: string }> = [
  { span: 12, label: 'Full', title: 'Full width (1 per row)' },
  { span: 6, label: 'Half', title: 'Half width (2 per row)' },
  { span: 4, label: 'Third', title: 'One-third width (3 per row)' },
];

export function BuilderCanvas({
  schema,
  clientName,
  allowedDomains,
  selectedFieldId,
  onSelectField,
  onInspectField,
  onAddField,
  onInsertFieldAtTarget,
  onUpdateField,
  onReorderField,
  onAddRowPreset,
  onMoveField,
  onDuplicateField,
  onRemoveField,
  onUpdateSchemaMeta,
  onUpdateSubmissionSettings,
}: BuilderCanvasProps): ReactElement {
  const [dragState, setDragState] = useState<PointerDragState | null>(null);
  const defaultValues = createDefaultFormValues(schema);

  const rows = groupFieldsIntoRows(schema.fields);
  const fieldRowMeta = new Map<string, { rowIndex: number; rowCount: number; colIndex: number }>();
  for (const row of rows) {
    row.fields.forEach((field, colIndex) => {
      fieldRowMeta.set(field.id, {
        rowIndex: row.rowIndex,
        rowCount: row.fields.length,
        colIndex,
      });
    });
  }

  useEffect(() => {
    const unsubDrag = subscribePointerDrag(setDragState);
    const unsubDrop = registerPointerDropHandler((result) => {
      if (result.kind === 'canvas') {
        const sourceFieldId = result.id;
        if (result.overTargetId && result.overTargetId !== sourceFieldId) {
          onReorderField?.(sourceFieldId, result.overTargetId, result.dropPosition);
        } else if (result.overContainer && schema.fields.length > 1) {
          const lastField = schema.fields[schema.fields.length - 1];
          if (lastField && lastField.id !== sourceFieldId) {
            onReorderField?.(sourceFieldId, lastField.id, 'after');
          }
        }
      } else if (result.kind === 'palette') {
        const droppedType = result.id as FieldType;
        if ((FIELD_TYPES as readonly string[]).includes(droppedType)) {
          if (result.overTargetId) {
            if (onInsertFieldAtTarget) {
              onInsertFieldAtTarget(droppedType, result.overTargetId, result.dropPosition);
            } else {
              const targetIndex = schema.fields.findIndex((f) => f.id === result.overTargetId);
              const targetField = schema.fields[targetIndex];
              if (targetIndex !== -1 && targetField) {
                const insertIndex =
                  result.dropPosition === 'after' || result.dropPosition === 'right'
                    ? targetIndex + 1
                    : targetIndex;
                onAddField(droppedType, insertIndex, targetField.colSpan ?? 12);
              }
            }
          } else if (result.overContainer) {
            onAddField(droppedType);
          }
        }
      }
    });

    return () => {
      unsubDrag();
      unsubDrop();
    };
  }, [schema, onAddField, onInsertFieldAtTarget, onReorderField]);

  const handleAddPreset = (preset: '2-col' | '3-col' | 'section'): void => {
    if (onAddRowPreset) {
      onAddRowPreset(preset);
    } else if (preset === '2-col') {
      onAddField('text', undefined, 6);
    } else if (preset === '3-col') {
      onAddField('text', undefined, 4);
    } else if (preset === 'section') {
      onAddField('section', undefined, 12);
    }
  };

  const settings: SubmissionSettings = schema.settings ?? {
    submitButtonText: 'Submit Request',
    actionType: 'message',
    successTitle: 'Thank you!',
    successMessage: 'Your response has been recorded and routed to our team.',
  };

  return (
    <div className="flex-1 w-full max-w-full min-w-0 overflow-hidden space-y-4">
      {/* Form Meta Header Card */}
      <div className="w-full max-w-full min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-6 lg:p-8 shadow-sm">
        {/* Client Domain & Route Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Tenant Badge */}
            <div className="flex items-center gap-1.5 rounded-sm bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80">
              <svg
                className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.75}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
                />
              </svg>
              <span>{clientName || schema.clientId || 'Client Tenant'}</span>
            </div>

            {/* Custom Domain & Slug Pill */}
            <div className="flex flex-wrap sm:flex-nowrap items-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-2 sm:px-2.5 py-1 text-xs font-mono text-zinc-700 dark:text-zinc-300 shadow-sm min-w-0 max-w-full overflow-hidden">
              <span className="text-zinc-400 dark:text-zinc-500 select-none mr-0.5 shrink-0">https://</span>
              {allowedDomains && allowedDomains.length > 0 ? (
                <select
                  id="canvas-domain-select"
                  value={schema.customDomain}
                  onChange={(e) => onUpdateSchemaMeta({ customDomain: e.target.value })}
                  className="bg-transparent font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer touch-manipulation min-w-0 max-w-[150px] xs:max-w-[200px] sm:max-w-[240px] truncate"
                >
                  {!allowedDomains.includes(schema.customDomain) && schema.customDomain && (
                    <option value={schema.customDomain}>{schema.customDomain}</option>
                  )}
                  {allowedDomains.map((dom) => (
                    <option key={dom} value={dom} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                      {dom}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="canvas-domain-input"
                  type="text"
                  value={schema.customDomain}
                  onChange={(e) => onUpdateSchemaMeta({ customDomain: e.target.value })}
                  placeholder="forms.example.com"
                  className="w-24 sm:w-36 min-w-0 max-w-[150px] xs:max-w-[200px] sm:max-w-[240px] bg-transparent font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none placeholder:text-zinc-400 touch-manipulation truncate"
                />
              )}
              <span className="text-zinc-400 dark:text-zinc-500 select-none mx-1 shrink-0">/</span>
              <input
                id="canvas-slug-input"
                type="text"
                value={schema.slug}
                onChange={(e) =>
                  onUpdateSchemaMeta({
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
                  })
                }
                placeholder="form-slug"
                className="min-w-0 w-20 sm:w-28 bg-transparent font-mono font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none placeholder:text-zinc-400 touch-manipulation"
              />
            </div>
          </div>

          {/* Status Toggle Pill */}
          <div>
            <button
              type="button"
              onClick={() =>
                onUpdateSchemaMeta({
                  status: schema.status === 'published' ? 'draft' : 'published',
                })
              }
              className={cn(
                'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-mono font-medium transition-colors border shadow-xs touch-manipulation min-h-[28px] sm:min-h-0',
                schema.status === 'published'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50'
              )}
              title={`Click to switch to ${schema.status === 'published' ? 'Draft' : 'Published'}`}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  schema.status === 'published' ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'
                )}
              />
              <span className="capitalize">{schema.status}</span>
            </button>
          </div>
        </div>

        {/* Title and Description */}
        <div className="space-y-3">
          <div>
            <label
              htmlFor="schema-title-input"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1"
            >
              Form Title
            </label>
            <input
              id="schema-title-input"
              type="text"
              value={schema.title}
              onChange={(e) => onUpdateSchemaMeta({ title: e.target.value })}
              placeholder="Enter form title..."
              className="w-full rounded-md border border-transparent px-3 py-1.5 text-lg sm:text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-100 transition-colors hover:border-zinc-200 dark:hover:border-zinc-800 focus:border-zinc-300 dark:focus:border-zinc-700 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300 touch-manipulation"
            />
          </div>
          <div>
            <label
              htmlFor="schema-description-input"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1"
            >
              Form Description
            </label>
            <input
              id="schema-description-input"
              type="text"
              value={schema.description}
              onChange={(e) => onUpdateSchemaMeta({ description: e.target.value })}
              placeholder="Enter form description..."
              className="w-full rounded-md border border-transparent px-3 py-1.5 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 transition-colors hover:border-zinc-200 dark:hover:border-zinc-800 focus:border-zinc-300 dark:focus:border-zinc-700 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300 touch-manipulation"
            />
          </div>
        </div>
      </div>

      {/* Quick Row & Layout Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 sm:px-4 sm:py-2.5 shadow-sm w-full max-w-full min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.75}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Form Layout
            </span>
            <span className="hidden sm:inline text-[11px] text-zinc-400 dark:text-zinc-500 ml-2">
              Drag questions side-by-side to place them on the same row (up to 3 across)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mr-1 hidden md:inline">
            Quick Add:
          </span>
          <button
            type="button"
            onClick={() => handleAddPreset('2-col')}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-2.5 py-1.5 sm:py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 active:scale-[0.99] transition-all touch-manipulation min-h-[32px] sm:min-h-0"
            title="Add two questions side-by-side"
          >
            <span className="flex h-3.5 w-6 items-center gap-0.5 rounded-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-0.5">
              <span className="h-full flex-1 rounded-[1px] bg-zinc-600 dark:bg-zinc-400" />
              <span className="h-full flex-1 rounded-[1px] bg-zinc-600 dark:bg-zinc-400" />
            </span>
            <span>+ Side-by-Side</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddPreset('3-col')}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-2.5 py-1.5 sm:py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 active:scale-[0.99] transition-all touch-manipulation min-h-[32px] sm:min-h-0"
            title="Add three questions side-by-side"
          >
            <span className="flex h-3.5 w-6 items-center gap-0.5 rounded-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-0.5">
              <span className="h-full flex-1 rounded-[1px] bg-zinc-600 dark:bg-zinc-400" />
              <span className="h-full flex-1 rounded-[1px] bg-zinc-600 dark:bg-zinc-400" />
              <span className="h-full flex-1 rounded-[1px] bg-zinc-600 dark:bg-zinc-400" />
            </span>
            <span>+ 3 Across</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddPreset('section')}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-2.5 py-1.5 sm:py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 active:scale-[0.99] transition-all touch-manipulation min-h-[32px] sm:min-h-0"
            title="Add a full-width section heading divider"
          >
            <span className="flex h-3.5 w-4 items-center justify-center font-mono text-[10px] text-zinc-600 dark:text-zinc-400 font-bold">
              §
            </span>
            <span>+ Section Heading</span>
          </button>
        </div>
      </div>

      {/* Drop Target & Field Cards Container */}
      <div
        data-drag-dropzone="true"
        className={cn(
          'w-full max-w-full min-w-0 rounded-lg border-2 border-dashed p-3.5 sm:p-6 lg:p-8 transition-colors min-h-[380px]',
          dragState?.isDragging && dragState.overContainer && !dragState.overTargetId
            ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100/50 dark:bg-zinc-900/50'
            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40'
        )}
      >
        {schema.fields.length === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center text-center p-8 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg w-full max-w-full min-w-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </div>
            <h3 className="mt-3 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Your form is empty
            </h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
              Drag and drop questions from the left palette, or click below to add your first question.
            </p>
            <button
              type="button"
              onClick={() => onAddField('text')}
              className="mt-4 inline-flex items-center justify-center gap-2 h-9 px-3.5 text-xs font-medium rounded-md text-white bg-zinc-900 hover:bg-zinc-800 active:scale-[0.99] dark:text-zinc-950 dark:bg-zinc-100 dark:hover:bg-zinc-200 shadow-sm transition-all"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add First Question
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full max-w-full min-w-0">
            {schema.fields.map((field, index) => {
              const definition = getFieldDefinition(field.type);
              const isSelected = field.id === selectedFieldId;
              const isFirst = index === 0;
              const isLast = index === schema.fields.length - 1;
              const isBeingDragged =
                Boolean(dragState?.isDragging && dragState.kind === 'canvas' && dragState.id === field.id);
              const isDropTarget =
                Boolean(dragState?.isDragging && dragState.overTargetId === field.id && !isBeingDragged);
              const currentColSpan: FieldColSpan = field.colSpan ?? 12;

              const rowMeta = fieldRowMeta.get(field.id) ?? { rowIndex: index, rowCount: 1, colIndex: 0 };
              const activeDropPosition: FieldDropPosition = dragState?.dropPosition ?? 'before';
              const draggedRowMeta = dragState?.kind === 'canvas' ? fieldRowMeta.get(dragState.id) : undefined;
              const isSameRow = Boolean(draggedRowMeta && draggedRowMeta.rowIndex === rowMeta.rowIndex);
              const isSideDrop = activeDropPosition === 'left' || activeDropPosition === 'right';
              const isRowMaxedOut = isSideDrop && rowMeta.rowCount >= MAX_ROW_COLUMNS && !isSameRow;

              return (
                <div
                  key={field.id}
                  data-drag-card-id={field.id}
                  data-drag-multicol={String(currentColSpan < 12)}
                  data-drag-can-beside={String(field.type !== 'section')}
                  data-drag-row-index={String(rowMeta.rowIndex)}
                  data-drag-row-count={String(rowMeta.rowCount)}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    const target = e.target as HTMLElement;
                    if (target.closest('button, input, select, textarea, a, label')) {
                      return;
                    }
                    if (e.pointerType !== 'mouse' && !target.closest('[data-drag-handle="true"]')) {
                      return;
                    }
                    beginPointerDrag({
                      kind: 'canvas',
                      id: field.id,
                      label: field.label || definition.paletteLabel,
                      badge: definition.badge,
                      startX: e.clientX,
                      startY: e.clientY,
                    });
                  }}
                  onClick={() => onSelectField(field.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelectField(field.id);
                    }
                  }}
                  className={cn(
                    'group relative p-3.5 sm:p-4 rounded-lg border transition-all duration-150 bg-white dark:bg-zinc-900 select-none col-span-1 text-left min-w-0 max-w-full',
                    COL_SPAN_CLASSES[currentColSpan],
                    isBeingDragged && 'opacity-40 border-dashed border-zinc-400 bg-zinc-50 dark:bg-zinc-800 cursor-grabbing',
                    isDropTarget && (
                      isRowMaxedOut
                        ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/20 dark:bg-amber-950/20 cursor-grab'
                        : 'ring-2 ring-zinc-950 dark:ring-zinc-100 border-zinc-950 dark:border-zinc-100 bg-zinc-100/40 dark:bg-zinc-800/40 cursor-grab'
                    ),
                    !isBeingDragged && !isDropTarget && (
                      isSelected
                        ? 'border-zinc-950 dark:border-zinc-100 ring-1 ring-zinc-950 dark:ring-zinc-100 shadow-md cursor-grab'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm cursor-grab'
                    )
                  )}
                >
                  {/* Drop Insertion Indicator */}
                  {isDropTarget && (
                    <>
                      {isSideDrop && !isRowMaxedOut ? (
                        <>
                          <div
                            className={cn(
                              'pointer-events-none absolute inset-y-2 z-20 w-1.5 rounded-full bg-zinc-950 dark:bg-zinc-100 shadow-sm',
                              activeDropPosition === 'left' ? '-left-1' : '-right-1'
                            )}
                          />
                          <div
                            className={cn(
                              'pointer-events-none absolute z-20',
                              activeDropPosition === 'left'
                                ? 'left-2 top-1/2 -translate-y-1/2'
                                : 'right-2 top-1/2 -translate-y-1/2'
                            )}
                          >
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-3 py-1 text-[11px] font-mono font-bold shadow-md ring-1 ring-white dark:ring-zinc-900">
                              {activeDropPosition === 'left' ? (
                                <>
                                  <span>←</span>
                                  <span>
                                    {isSameRow
                                      ? 'Swap Left'
                                      : rowMeta.rowCount === 1
                                        ? 'Side-by-Side'
                                        : '3 Across (Max)'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span>
                                    {isSameRow
                                      ? 'Swap Right'
                                      : rowMeta.rowCount === 1
                                        ? 'Side-by-Side'
                                        : '3 Across (Max)'}
                                  </span>
                                  <span>→</span>
                                </>
                              )}
                            </span>
                          </div>
                        </>
                      ) : isSideDrop && isRowMaxedOut ? (
                        <>
                          <div
                            className={cn(
                              'pointer-events-none absolute inset-y-2 z-20 w-1.5 rounded-full bg-amber-500 shadow-sm',
                              activeDropPosition === 'left' ? '-left-1' : '-right-1'
                            )}
                          />
                          <div
                            className={cn(
                              'pointer-events-none absolute z-20',
                              activeDropPosition === 'left'
                                ? 'left-2 top-1/2 -translate-y-1/2'
                                : 'right-2 top-1/2 -translate-y-1/2'
                            )}
                          >
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-[11px] font-mono font-bold text-white shadow-md ring-2 ring-white">
                              <span>⚠️</span>
                              <span>Max 3 Across • Wraps to New Row</span>
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            className={cn(
                              'pointer-events-none absolute inset-x-3 z-20 h-1 rounded-full bg-zinc-950 dark:bg-zinc-100 shadow-sm',
                              activeDropPosition === 'before' ? '-top-1' : '-bottom-1'
                            )}
                          />
                          <div
                            className={cn(
                              'pointer-events-none absolute inset-x-0 z-20 flex justify-center',
                              activeDropPosition === 'before' ? '-top-3' : '-bottom-3'
                            )}
                          >
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-3 py-1 text-[11px] font-mono font-bold shadow-md ring-1 ring-white dark:ring-zinc-900">
                              {activeDropPosition === 'before' ? (
                                <>
                                  <span>↑</span>
                                  <span>Insert Row Above</span>
                                </>
                              ) : (
                                <>
                                  <span>↓</span>
                                  <span>Insert Row Below</span>
                                </>
                              )}
                            </span>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* Top Bar: Field Badge & Actions */}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      {/* Drag Handle */}
                      <div
                        data-drag-handle="true"
                        className="flex h-7 w-6 sm:h-5 sm:w-4 cursor-grab items-center justify-center rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:cursor-grabbing select-none touch-none shrink-0"
                        title="Drag to reorder in 12-column grid"
                        aria-label="Drag handle"
                      >
                        <svg className="h-4 w-3" viewBox="0 0 10 16" fill="currentColor">
                          <circle cx="2" cy="2" r="1.5" />
                          <circle cx="8" cy="2" r="1.5" />
                          <circle cx="2" cy="8" r="1.5" />
                          <circle cx="8" cy="8" r="1.5" />
                          <circle cx="2" cy="14" r="1.5" />
                          <circle cx="8" cy="14" r="1.5" />
                        </svg>
                      </div>

                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-zinc-100 dark:bg-zinc-800 font-mono text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                        {definition.badge}
                      </span>
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                        {definition.paletteLabel}
                      </span>
                      {rowMeta.rowCount > 1 && (
                        <span className="rounded-sm bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 shrink-0">
                          Col {rowMeta.colIndex + 1}/{rowMeta.rowCount}
                        </span>
                      )}
                      {field.condition?.sourceFieldId && (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 font-mono text-[10px] text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
                          <span>⚡</span> Conditional
                        </span>
                      )}
                      {isSelected && (
                        <span className="rounded-sm bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-1.5 py-0.5 font-mono text-[10px] font-medium shrink-0">
                          Selected
                        </span>
                      )}
                    </div>

                    {/* Action Toolbar */}
                    <div
                      className={cn(
                        'flex items-center justify-end gap-1 transition-opacity flex-wrap shrink-0 max-w-full',
                        isSelected
                          ? 'opacity-100 pointer-events-auto'
                          : 'opacity-0 pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto'
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {onInspectField && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectField(field.id);
                          }}
                          className="lg:hidden inline-flex h-7 items-center gap-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-900 dark:bg-zinc-100 px-2 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-50 dark:text-zinc-900 transition-colors touch-manipulation"
                          title="Edit Question Settings"
                        >
                          Edit
                        </button>
                      )}

                      {/* Direct Width Segmented Pills */}
                      <div
                        className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 text-[10px] border border-zinc-200/60 dark:border-zinc-700/60"
                        title="Adjust question width"
                      >
                        {COL_SPAN_OPTIONS.map((opt) => {
                          const isActive = currentColSpan === opt.span;
                          return (
                            <button
                              key={opt.span}
                              type="button"
                              title={opt.title}
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateField?.({ ...field, colSpan: opt.span });
                              }}
                              className={cn(
                                'rounded-sm px-1.5 py-0.5 font-mono font-medium transition-colors touch-manipulation min-h-[26px] sm:min-h-0 flex items-center justify-center',
                                isActive
                                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs'
                                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                              )}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveField(field.id, 'up');
                        }}
                        title={currentColSpan < 12 ? 'Move Left / Up (←)' : 'Move Up (↑)'}
                        aria-label={currentColSpan < 12 ? 'Move Left or Up' : 'Move Up'}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 disabled:pointer-events-none transition-colors touch-manipulation p-1 shrink-0"
                      >
                        {currentColSpan < 12 ? (
                          <span className="text-xs font-bold">←</span>
                        ) : (
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5" />
                          </svg>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={isLast}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveField(field.id, 'down');
                        }}
                        title={currentColSpan < 12 ? 'Move Right / Down (→)' : 'Move Down (↓)'}
                        aria-label={currentColSpan < 12 ? 'Move Right or Down' : 'Move Down'}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 disabled:pointer-events-none transition-colors touch-manipulation p-1 shrink-0"
                      >
                        {currentColSpan < 12 ? (
                          <span className="text-xs font-bold">→</span>
                        ) : (
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateField(field.id);
                        }}
                        title="Duplicate Question"
                        aria-label="Duplicate Question"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors touch-manipulation p-1 shrink-0"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
                          />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveField(field.id);
                        }}
                        title="Delete Question"
                        aria-label="Delete Question"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800 transition-colors touch-manipulation p-1 shrink-0"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Field Label and Description */}
                  {isSelected && onUpdateField ? (
                    <div className="mb-2 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => onUpdateField({ ...field, label: e.target.value })}
                          placeholder="Type question label..."
                          className={cn(
                            'w-full rounded px-2 py-1 text-xs font-semibold text-zinc-950 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300 shadow-xs touch-manipulation',
                            field.type === 'section' && 'text-sm font-bold'
                          )}
                          title="Edit question text inline"
                          aria-label="Edit question label"
                        />
                        {field.required && (
                          <span className="text-rose-600 dark:text-rose-400 font-bold text-xs shrink-0" title="Required">
                            *
                          </span>
                        )}
                      </div>
                      {field.helperText && (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 break-words">{field.helperText}</p>
                      )}
                    </div>
                  ) : (
                    <div className="mb-2 min-w-0">
                      <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {field.label || 'Untitled Question'}
                        {field.required && (
                          <span className="ml-1 text-rose-600 dark:text-rose-400 font-bold" title="Required">
                            *
                          </span>
                        )}
                      </label>
                      {field.helperText && (
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 break-words">{field.helperText}</p>
                      )}
                    </div>
                  )}

                  {/* Field Input Preview (Disabled) */}
                  <div className="pointer-events-none select-none mt-2 opacity-90 min-w-0 max-w-full">
                    {renderFieldInput({
                      field,
                      value: defaultValues[field.id],
                      onChange: () => {},
                      disabled: true,
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Post-Submit & Redirect Settings Card */}
      <div className="w-full max-w-full min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-6 lg:p-8 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-xs border border-emerald-200 dark:border-emerald-800">
              ✓
            </span>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                What happens after a customer submits?
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Choose what the customer sees right after submitting their answers
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="settings-submit-text"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1"
            >
              Submit Button Text
            </label>
            <input
              id="settings-submit-text"
              type="text"
              value={settings.submitButtonText}
              onChange={(e) =>
                onUpdateSubmissionSettings?.({ submitButtonText: e.target.value })
              }
              placeholder="Submit Response"
              className="h-9 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300 shadow-sm transition-colors touch-manipulation"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              After Submission
            </span>
            <div className="flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200/80 dark:border-zinc-700/80">
              <button
                type="button"
                onClick={() =>
                  onUpdateSubmissionSettings?.({ actionType: 'message' })
                }
                className={cn(
                  'flex-1 rounded-sm py-1.5 text-xs font-medium transition-colors touch-manipulation min-h-[32px] sm:min-h-0',
                  settings.actionType === 'message'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                )}
              >
                Show Thank-You Message
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateSubmissionSettings?.({ actionType: 'redirect' })
                }
                className={cn(
                  'flex-1 rounded-sm py-1.5 text-xs font-medium transition-colors touch-manipulation min-h-[32px] sm:min-h-0',
                  settings.actionType === 'redirect'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                )}
              >
                Send to Another Webpage (Redirect URL)
              </button>
            </div>
          </div>
        </div>

        {settings.actionType === 'message' ? (
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 space-y-3">
            <div>
              <label
                htmlFor="settings-success-title"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Success Screen Title
              </label>
              <input
                id="settings-success-title"
                type="text"
                value={settings.successTitle}
                onChange={(e) =>
                  onUpdateSubmissionSettings?.({ successTitle: e.target.value })
                }
                placeholder="Thank you!"
                className="h-9 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300 shadow-sm transition-colors touch-manipulation"
              />
            </div>
            <div>
              <label
                htmlFor="settings-success-message"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Success Screen Subtext / Instructions
              </label>
              <textarea
                id="settings-success-message"
                rows={2}
                value={settings.successMessage}
                onChange={(e) =>
                  onUpdateSubmissionSettings?.({ successMessage: e.target.value })
                }
                placeholder="Your response has been received. Our team will follow up within 24 hours."
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300 shadow-sm transition-colors resize-none touch-manipulation"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 space-y-3">
            <div>
              <label
                htmlFor="settings-redirect-url"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Destination Webpage (Redirect URL)
              </label>
              <input
                id="settings-redirect-url"
                type="url"
                value={settings.redirectUrl ?? ''}
                onChange={(e) =>
                  onUpdateSubmissionSettings?.({ redirectUrl: e.target.value })
                }
                placeholder="https://client.com/onboarding-complete"
                className="h-9 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 font-mono text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300 shadow-sm transition-colors touch-manipulation"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                id="settings-append-params"
                type="checkbox"
                checked={Boolean(settings.appendParamsToRedirect)}
                onChange={(e) =>
                  onUpdateSubmissionSettings?.({
                    appendParamsToRedirect: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-zinc-950 dark:focus:ring-zinc-300 cursor-pointer accent-zinc-900 dark:accent-zinc-100 touch-manipulation"
              />
              <label
                htmlFor="settings-append-params"
                className="text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                Forward customer answers in the link (URL query string)
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

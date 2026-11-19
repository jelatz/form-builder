import { useState, type DragEvent } from 'react';
import {
  isFieldType,
  partitionFieldsIntoSections,
  type FieldType,
  type FormField,
  type FormSchema,
} from '../../domain/form-schema';
import { bindFieldModule, FieldLayoutProvider } from '../../fields/registry';
import { cn } from '../../shared/lib';
import { Button, Tooltip } from '../../shared/ui';

const REORDER_DRAG_MIME = 'application/x-form-builder-field-index';
const PALETTE_DRAG_MIME = 'application/x-form-builder-field-type';
const PALETTE_PRESET_MIME = 'application/x-form-builder-field-preset';

export interface BuilderCanvasProps {
  schema: FormSchema;
  selectedFieldId: string | null;
  onSelectField: (fieldId: string | null) => void;
  onAddFieldAt: (
    type: FieldType,
    index?: number,
    presetPatch?: Partial<FormField>,
  ) => void;
  onUpdateField?: (updated: FormField) => void;
  onAddSection?: (afterSectionId?: string) => void;
  onMoveSection?: (sectionId: string, direction: 'up' | 'down') => void;
  onRemoveSection?: (sectionId: string) => void;
  onMoveField: (fromIndex: number, toIndex: number) => void;
  onMoveFieldToGrid?: (
    fieldId: string,
    parentGridId: string | undefined,
    gridColumn?: 0 | 1 | 2,
  ) => void;
  onDuplicateField: (fieldId: string) => void;
  onRemoveField: (fieldId: string) => void;
  onUpdateMetadata: (
    patch: Partial<
      Pick<
        FormSchema,
        'title' | 'description' | 'slug' | 'submitButtonText' | 'isPublished'
      >
    >,
  ) => void;
}

function parsePresetPatch(
  event: DragEvent<HTMLElement>,
): Partial<FormField> | undefined {
  const raw = event.dataTransfer.getData(PALETTE_PRESET_MIME);
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Partial<FormField>;
    }
  } catch {
    // Ignore invalid JSON preset
  }
  return undefined;
}

function getCardInsertionIndex(
  event: DragEvent<HTMLDivElement>,
  index: number,
): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const isBottomHalf = event.clientY >= rect.top + rect.height / 2;
  return isBottomHalf ? index + 1 : index;
}

export function BuilderCanvas({
  schema,
  selectedFieldId,
  onSelectField,
  onAddFieldAt,
  onUpdateField,
  onAddSection,
  onMoveSection,
  onRemoveSection,
  onMoveField,
  onMoveFieldToGrid,
  onDuplicateField,
  onRemoveField,
  onUpdateMetadata,
}: BuilderCanvasProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverGridCol, setDragOverGridCol] = useState<{
    gridId: string;
    colIdx: 0 | 1 | 2;
  } | null>(null);
  const [isCanvasDropActive, setIsCanvasDropActive] = useState(false);

  const sections = partitionFieldsIntoSections(schema.fields);
  const dataFieldCount = schema.fields.filter(
    (f) => f.type !== 'section',
  ).length;

  const getSectionEndSchemaIndex = (sectionIdx: number): number => {
    const nextSection = sections[sectionIdx + 1]?.sectionField;
    if (!nextSection) {
      return schema.fields.length;
    }
    const nextIdx = schema.fields.findIndex((f) => f.id === nextSection.id);
    return nextIdx === -1 ? schema.fields.length : nextIdx;
  };

  const handleCardDragStart = (
    event: DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    event.dataTransfer.setData(REORDER_DRAG_MIME, String(index));
    event.dataTransfer.effectAllowed = 'move';
  };

  const executeDropAt = (
    event: DragEvent<HTMLElement>,
    insertionIndex: number,
  ) => {
    setDragOverIndex(null);
    setDragOverGridCol(null);
    setIsCanvasDropActive(false);

    const reorderIndexRaw = event.dataTransfer.getData(REORDER_DRAG_MIME);
    if (reorderIndexRaw !== '') {
      const fromIndex = Number(reorderIndexRaw);
      const draggedField = schema.fields[fromIndex];
      if (draggedField?.parentGridId) {
        onMoveFieldToGrid?.(draggedField.id, undefined, undefined);
        return;
      }
      if (!Number.isNaN(fromIndex) && schema.fields.length > 1) {
        const minTarget = schema.fields[0]?.type === 'section' ? 1 : 0;
        const rawToIndex =
          fromIndex < insertionIndex
            ? Math.min(schema.fields.length - 1, insertionIndex - 1)
            : Math.min(schema.fields.length - 1, insertionIndex);
        const toIndex = Math.max(minTarget, rawToIndex);
        if (fromIndex !== toIndex) {
          onMoveField(fromIndex, toIndex);
        }
      }
      return;
    }

    const paletteType =
      event.dataTransfer.getData(PALETTE_DRAG_MIME) ||
      event.dataTransfer.getData('text/plain');
    if (isFieldType(paletteType)) {
      const presetPatch = parsePresetPatch(event);
      if (paletteType === 'section') {
        const sectionTitle =
          typeof presetPatch?.label === 'string' && presetPatch.label.trim()
            ? presetPatch.label
            : `Section ${sections.length + 1}`;
        onAddFieldAt('section', undefined, {
          showLine: true,
          ...presetPatch,
          label: sectionTitle,
        });
        return;
      }
      const clampedInsertion =
        schema.fields[0]?.type === 'section'
          ? Math.max(1, insertionIndex)
          : insertionIndex;
      onAddFieldAt(paletteType, clampedInsertion, presetPatch);
    }
  };

  const handleCardDragOver = (
    event: DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const nextInsertionIndex = getCardInsertionIndex(event, index);
    if (dragOverIndex !== nextInsertionIndex) {
      setDragOverIndex(nextInsertionIndex);
    }
  };

  const handleCardDrop = (
    event: DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const insertionIndex = getCardInsertionIndex(event, index);
    executeDropAt(event, insertionIndex);
  };

  const handleGridColDragOver = (
    event: DragEvent<HTMLDivElement>,
    gridId: string,
    colIdx: 0 | 1 | 2,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverIndex(null);
    setDragOverGridCol({ gridId, colIdx });
  };

  const handleGridColDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setDragOverGridCol(null);
  };

  const handleGridColDrop = (
    event: DragEvent<HTMLDivElement>,
    gridId: string,
    colIdx: 0 | 1 | 2,
    gridSchemaIndex: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverGridCol(null);
    setDragOverIndex(null);
    setIsCanvasDropActive(false);

    const reorderIndexRaw = event.dataTransfer.getData(REORDER_DRAG_MIME);
    if (reorderIndexRaw !== '') {
      const fromIndex = Number(reorderIndexRaw);
      const draggedField = schema.fields[fromIndex];
      if (
        draggedField &&
        draggedField.id !== gridId &&
        draggedField.type !== 'grid' &&
        draggedField.type !== 'section'
      ) {
        onMoveFieldToGrid?.(draggedField.id, gridId, colIdx);
      }
      return;
    }

    const paletteType =
      event.dataTransfer.getData(PALETTE_DRAG_MIME) ||
      event.dataTransfer.getData('text/plain');
    if (isFieldType(paletteType)) {
      const presetPatch = parsePresetPatch(event);
      if (paletteType === 'grid' || paletteType === 'section') {
        onAddFieldAt(paletteType, gridSchemaIndex + 1, presetPatch);
      } else {
        onAddFieldAt(paletteType, undefined, {
          ...presetPatch,
          parentGridId: gridId,
          gridColumn: colIdx,
        });
      }
    }
  };

  const handleCanvasDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!isCanvasDropActive) {
      setIsCanvasDropActive(true);
    }
    if (event.target === event.currentTarget) {
      if (dragOverIndex !== schema.fields.length) {
        setDragOverIndex(schema.fields.length);
      }
    }
  };

  const handleCanvasDragLeave = (event: DragEvent<HTMLElement>) => {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setIsCanvasDropActive(false);
    setDragOverIndex(null);
    setDragOverGridCol(null);
  };

  const handleCanvasDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    executeDropAt(event, dragOverIndex ?? schema.fields.length);
  };

  const topLevelAll = schema.fields.filter((f) => !f.parentGridId);

  return (
    <main
      aria-label="Builder Canvas"
      onDragOver={handleCanvasDragOver}
      onDragLeave={handleCanvasDragLeave}
      onDrop={handleCanvasDrop}
      onClick={() => onSelectField(null)}
      className="flex-1 overflow-y-auto py-8 px-6 bg-[#f4f5f7] relative"
    >
      {/* Top-right section & field count badge */}
      <div className="absolute top-4 right-5 hidden lg:flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white border border-zinc-200 shadow-2xs text-zinc-500 text-xs"
          title={`${sections.length} ${sections.length === 1 ? 'Section' : 'Sections'}, ${dataFieldCount} ${dataFieldCount === 1 ? 'Field' : 'Fields'}`}
        >
          <span className="font-mono text-[11px] font-medium text-zinc-700">
            {sections.length} {sections.length === 1 ? 'section' : 'sections'}
          </span>
          <span className="text-zinc-300">·</span>
          <span className="font-mono text-[11px] font-medium text-zinc-700">
            {dataFieldCount} {dataFieldCount === 1 ? 'field' : 'fields'}
          </span>
        </div>
      </div>

      <div className="max-w-[740px] mx-auto space-y-5">
        {/* Part A: Form Title & Description Header Card */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelectField(null);
          }}
          className={cn(
            'bg-white rounded-md border shadow-xs px-8 py-6 text-center transition-all cursor-pointer',
            selectedFieldId === null
              ? 'ring-1 ring-emerald-500/40 border-emerald-500/60'
              : 'border-zinc-200/90 hover:border-zinc-300',
          )}
        >
          <input
            aria-label="Form Title"
            value={schema.title}
            onChange={(e) => onUpdateMetadata({ title: e.target.value })}
            placeholder="Untitled Form"
            className="w-full text-center text-lg font-bold text-zinc-900 bg-transparent border-0 focus:outline-none focus:ring-0"
          />
          <input
            aria-label="Form Description"
            value={schema.description ?? ''}
            onChange={(e) =>
              onUpdateMetadata({
                description: e.target.value || undefined,
              })
            }
            placeholder="Add an optional description..."
            className="mt-2 w-full text-center text-xs text-zinc-500 placeholder:text-zinc-400 bg-transparent border-0 focus:outline-none focus:ring-0"
          />
        </div>

        {/* Part B: Section Cards (1 Card per Section / Page) */}
        <div className="space-y-5">
          {sections.map((section, sectionIdx) => {
            const sectionField = section.sectionField;
            const isSectionSelected =
              sectionField !== null && selectedFieldId === sectionField.id;
            const sectionEndSchemaIndex = getSectionEndSchemaIndex(sectionIdx);
            const isLastSection = sectionIdx === sections.length - 1;

            return (
              <section
                key={section.id}
                aria-label={`Section ${sectionIdx + 1}: ${section.title}`}
                className={cn(
                  'relative bg-white rounded-md border shadow-xs overflow-hidden transition-all',
                  isSectionSelected
                    ? 'border-emerald-500/70 ring-1 ring-emerald-500/40'
                    : 'border-zinc-200/90',
                )}
              >
                {/* Section Header Bar */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (sectionField) {
                      onSelectField(sectionField.id);
                    }
                  }}
                  className={cn(
                    'px-6 py-4 border-b border-zinc-200/90 flex items-start justify-between gap-4 cursor-pointer transition-colors',
                    isSectionSelected
                      ? 'bg-emerald-50/35'
                      : 'bg-zinc-50/70 hover:bg-zinc-50',
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-200/70 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-700">
                        Section {sectionIdx + 1} of {sections.length}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                        {section.topLevelFields.length}{' '}
                        {section.topLevelFields.length === 1
                          ? 'item'
                          : 'items'}
                      </span>
                    </div>

                    {sectionField ? (
                      <input
                        aria-label={`Section ${sectionIdx + 1} Title`}
                        value={sectionField.label}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectField(sectionField.id);
                        }}
                        onChange={(e) =>
                          onUpdateField?.({
                            ...sectionField,
                            label: e.target.value,
                          })
                        }
                        onBlur={(e) => {
                          if (!e.target.value.trim()) {
                            onUpdateField?.({
                              ...sectionField,
                              label: `Section ${sectionIdx + 1}`,
                            });
                          }
                        }}
                        placeholder={`Section ${sectionIdx + 1}`}
                        className="w-full text-sm font-semibold text-zinc-900 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 placeholder:text-zinc-400"
                      />
                    ) : (
                      <h3 className="text-sm font-semibold text-zinc-900">
                        {section.title}
                      </h3>
                    )}

                    {section.description && (
                      <p className="text-xs text-zinc-500 truncate">
                        {section.description}
                      </p>
                    )}
                  </div>

                  {/* Section Actions */}
                  {sectionField && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 bg-white border border-zinc-200 rounded-md px-1.5 py-0.5 shadow-2xs shrink-0"
                    >
                      <Tooltip content="Move section up">
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={sectionIdx === 0}
                          onClick={() =>
                            onMoveSection?.(sectionField.id, 'up')
                          }
                          aria-label={`Move ${section.title} up`}
                          className="h-6 px-1.5 text-xs"
                        >
                          ↑
                        </Button>
                      </Tooltip>
                      <Tooltip content="Move section down">
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={isLastSection}
                          onClick={() =>
                            onMoveSection?.(sectionField.id, 'down')
                          }
                          aria-label={`Move ${section.title} down`}
                          className="h-6 px-1.5 text-xs"
                        >
                          ↓
                        </Button>
                      </Tooltip>
                      <Button
                        size="xs"
                        variant="danger"
                        disabled={sections.length <= 1}
                        onClick={() => onRemoveSection?.(sectionField.id)}
                        aria-label={`Delete ${section.title}`}
                        title={
                          sections.length <= 1
                            ? 'At least one section is required'
                            : 'Delete section (keeps its fields)'
                        }
                        className="h-6 px-1.5 text-xs"
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>

                {/* Section Body */}
                {section.topLevelFields.length === 0 ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (dragOverIndex !== sectionEndSchemaIndex) {
                        setDragOverIndex(sectionEndSchemaIndex);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      executeDropAt(e, sectionEndSchemaIndex);
                    }}
                    className={cn(
                      'p-8 border border-dashed rounded-md m-4 text-center space-y-1.5 transition-colors duration-150',
                      dragOverIndex === sectionEndSchemaIndex ||
                        isCanvasDropActive
                        ? 'border-emerald-500 bg-emerald-50/25'
                        : 'border-zinc-300 bg-zinc-50/50',
                    )}
                  >
                    <p className="text-xs font-medium text-zinc-700">
                      No fields in {section.title} yet
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Click any field in the left palette or drag it here to add
                      it to this section.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-6 divide-y divide-zinc-100">
                    {section.topLevelFields.map((field, localIndex) => {
                      const bound = bindFieldModule(field);
                      const isSelected = selectedFieldId === field.id;
                      const schemaIndex = schema.fields.findIndex(
                        (f) => f.id === field.id,
                      );
                      const globalTopIndex = topLevelAll.findIndex(
                        (f) => f.id === field.id,
                      );
                      const prevGlobalTop =
                        globalTopIndex > 0
                          ? topLevelAll[globalTopIndex - 1]
                          : undefined;
                      const nextGlobalTop =
                        globalTopIndex >= 0 &&
                        globalTopIndex < topLevelAll.length - 1
                          ? topLevelAll[globalTopIndex + 1]
                          : undefined;
                      const canMoveUp =
                        prevGlobalTop !== undefined &&
                        !(
                          globalTopIndex === 1 &&
                          prevGlobalTop.type === 'section'
                        );
                      const canMoveDown = nextGlobalTop !== undefined;

                      const isDragTargetTop = dragOverIndex === schemaIndex;
                      const isDragTargetBottom =
                        localIndex === section.topLevelFields.length - 1 &&
                        dragOverIndex === sectionEndSchemaIndex;
                      const isMultiColumn = (field.columnSpan ?? 1) > 1;
                      const colSpanClass =
                        field.type === 'grid' ||
                        (field.columnSpan ?? 1) === 1
                          ? 'col-span-6'
                          : field.columnSpan === 2
                            ? 'col-span-6 sm:col-span-3'
                            : field.columnSpan === 3
                              ? 'col-span-6 sm:col-span-2'
                              : 'col-span-6';

                      return (
                        <div
                          key={field.id}
                          draggable
                          onDragStart={(e) =>
                            handleCardDragStart(e, schemaIndex)
                          }
                          onDragOver={(e) =>
                            handleCardDragOver(e, schemaIndex)
                          }
                          onDrop={(e) => handleCardDrop(e, schemaIndex)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectField(field.id);
                          }}
                          className={cn(
                            'group relative px-8 transition-colors duration-100 cursor-pointer',
                            colSpanClass,
                            field.type === 'grid' ? 'py-6' : 'py-4',
                            isSelected
                              ? 'bg-emerald-50/25 ring-1 ring-inset ring-emerald-500/50'
                              : 'hover:bg-zinc-50/70',
                            isDragTargetTop &&
                              'border-t-2 border-t-emerald-500',
                            isDragTargetBottom &&
                              'border-b-2 border-b-emerald-500',
                          )}
                        >
                          {field.showDividerAbove && (
                            <hr className="border-t border-zinc-200 mb-5 -mt-1" />
                          )}

                          {/* Floating Row Action Toolbar */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              'absolute right-3 top-2.5 z-10 flex items-center gap-1 bg-white/95 border border-zinc-200 rounded-md px-1.5 py-0.5 shadow-xs transition-opacity',
                              isSelected
                                ? 'opacity-100'
                                : 'opacity-0 group-hover:opacity-100',
                            )}
                          >
                            <Tooltip content="Move up">
                              <Button
                                size="xs"
                                variant="ghost"
                                disabled={!canMoveUp}
                                onClick={() => {
                                  if (!prevGlobalTop) return;
                                  const prevSchemaIndex =
                                    schema.fields.findIndex(
                                      (f) => f.id === prevGlobalTop.id,
                                    );
                                  if (prevSchemaIndex !== -1) {
                                    onMoveField(schemaIndex, prevSchemaIndex);
                                  }
                                }}
                                aria-label={`Move ${field.label} up`}
                                className="h-6 px-1.5 text-xs"
                              >
                                ↑
                              </Button>
                            </Tooltip>
                            <Tooltip content="Move down">
                              <Button
                                size="xs"
                                variant="ghost"
                                disabled={!canMoveDown}
                                onClick={() => {
                                  if (!nextGlobalTop) return;
                                  const nextSchemaIndex =
                                    schema.fields.findIndex(
                                      (f) => f.id === nextGlobalTop.id,
                                    );
                                  if (nextSchemaIndex !== -1) {
                                    onMoveField(schemaIndex, nextSchemaIndex);
                                  }
                                }}
                                aria-label={`Move ${field.label} down`}
                                className="h-6 px-1.5 text-xs"
                              >
                                ↓
                              </Button>
                            </Tooltip>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => onDuplicateField(field.id)}
                              aria-label={`Duplicate ${field.label}`}
                              title="Duplicate Field"
                              className="h-6 px-1.5 text-xs"
                            >
                              Duplicate
                            </Button>
                            <Button
                              size="xs"
                              variant="danger"
                              onClick={() => onRemoveField(field.id)}
                              aria-label={`Delete ${field.label}`}
                              title="Delete Field"
                              className="h-6 px-1.5 text-xs"
                            >
                              Delete
                            </Button>
                          </div>

                          {/* Field Content Preview */}
                          {field.type === 'grid' ? (
                            <div className="rounded-md border border-zinc-200/90 bg-white overflow-hidden">
                              <div
                                className={cn(
                                  'grid divide-y sm:divide-y-0 sm:divide-x divide-dashed divide-zinc-300',
                                  field.columns === 1
                                    ? 'grid-cols-1'
                                    : field.columns === 2
                                      ? 'grid-cols-1 sm:grid-cols-2'
                                      : 'grid-cols-1 sm:grid-cols-3',
                                )}
                              >
                                {Array.from(
                                  { length: field.columns },
                                  (_, i) => i as 0 | 1 | 2,
                                ).map((colIdx) => {
                                  const colFields = schema.fields.filter(
                                    (f) =>
                                      f.parentGridId === field.id &&
                                      (f.gridColumn ?? 0) === colIdx,
                                  );
                                  const isColDragOver =
                                    dragOverGridCol?.gridId === field.id &&
                                    dragOverGridCol?.colIdx === colIdx;

                                  if (colFields.length === 0) {
                                    return (
                                      <div
                                        key={colIdx}
                                        onDragOver={(e) =>
                                          handleGridColDragOver(
                                            e,
                                            field.id,
                                            colIdx,
                                          )
                                        }
                                        onDragLeave={handleGridColDragLeave}
                                        onDrop={(e) =>
                                          handleGridColDrop(
                                            e,
                                            field.id,
                                            colIdx,
                                            schemaIndex,
                                          )
                                        }
                                        className="p-3.5 min-h-[180px] flex flex-col transition-colors"
                                      >
                                        <div
                                          className={cn(
                                            'rounded-md border px-4 py-5 text-center text-xs font-medium transition-colors select-none',
                                            isColDragOver
                                              ? 'border-dashed border-emerald-500 bg-emerald-50/50 text-emerald-700'
                                              : 'border-zinc-200/90 bg-[#f3f4f6] text-zinc-700',
                                          )}
                                        >
                                          Drag and drop fields here
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={colIdx}
                                      onDragOver={(e) =>
                                        handleGridColDragOver(
                                          e,
                                          field.id,
                                          colIdx,
                                        )
                                      }
                                      onDragLeave={handleGridColDragLeave}
                                      onDrop={(e) =>
                                        handleGridColDrop(
                                          e,
                                          field.id,
                                          colIdx,
                                          schemaIndex,
                                        )
                                      }
                                      className={cn(
                                        'p-4 min-h-[180px] flex flex-col gap-3.5 transition-colors',
                                        isColDragOver && 'bg-emerald-50/20',
                                      )}
                                    >
                                      <FieldLayoutProvider layout="stacked">
                                        {colFields.map((childField) => {
                                          const childBound =
                                            bindFieldModule(childField);
                                          const isChildSelected =
                                            selectedFieldId === childField.id;
                                          const childSchemaIndex =
                                            schema.fields.findIndex(
                                              (f) => f.id === childField.id,
                                            );

                                          return (
                                            <div
                                              key={childField.id}
                                              draggable
                                              onDragStart={(e) => {
                                                e.stopPropagation();
                                                handleCardDragStart(
                                                  e,
                                                  childSchemaIndex,
                                                );
                                              }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectField(childField.id);
                                              }}
                                              className={cn(
                                                'group/child relative transition-colors cursor-pointer',
                                                isChildSelected
                                                  ? 'border border-dashed border-emerald-500 bg-emerald-50/10 rounded-md p-2.5 -mx-1.5'
                                                  : 'border border-transparent hover:border-dashed hover:border-zinc-300 rounded-md p-2.5 -mx-1.5',
                                              )}
                                            >
                                              <div
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                                className={cn(
                                                  'absolute right-1.5 top-1.5 z-10 flex items-center gap-1 bg-white/95 border border-zinc-200 rounded-md px-1 py-0.5 shadow-xs transition-opacity',
                                                  isChildSelected
                                                    ? 'opacity-100'
                                                    : 'opacity-0 group-hover/child:opacity-100',
                                                )}
                                              >
                                                <Button
                                                  size="xs"
                                                  variant="ghost"
                                                  onClick={() =>
                                                    onDuplicateField(
                                                      childField.id,
                                                    )
                                                  }
                                                  aria-label={`Duplicate ${childField.label}`}
                                                  title="Duplicate Field"
                                                  className="h-5 px-1.5 text-[11px]"
                                                >
                                                  Duplicate
                                                </Button>
                                                <Button
                                                  size="xs"
                                                  variant="danger"
                                                  onClick={() =>
                                                    onRemoveField(childField.id)
                                                  }
                                                  aria-label={`Delete ${childField.label}`}
                                                  title="Delete Field"
                                                  className="h-5 px-1.5 text-[11px]"
                                                >
                                                  Delete
                                                </Button>
                                              </div>

                                              <div className="pointer-events-none">
                                                {childBound.renderRuntime({
                                                  value:
                                                    childField.type ===
                                                    'checkbox'
                                                      ? Boolean(
                                                          childField.defaultChecked,
                                                        )
                                                      : '',
                                                  onChange: () => {},
                                                  disabled: false,
                                                })}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </FieldLayoutProvider>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="pointer-events-none">
                              {isMultiColumn ? (
                                <FieldLayoutProvider layout="stacked">
                                  {bound.renderRuntime({
                                    value:
                                      field.type === 'checkbox'
                                        ? Boolean(field.defaultChecked)
                                        : '',
                                    onChange: () => {},
                                    disabled: false,
                                  })}
                                </FieldLayoutProvider>
                              ) : (
                                bound.renderRuntime({
                                  value:
                                    field.type === 'checkbox'
                                      ? Boolean(field.defaultChecked)
                                      : '',
                                  onChange: () => {},
                                  disabled: false,
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Per-section bottom drop zone */}
                    <div
                      aria-label={`Drop field at end of ${section.title}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragOverIndex !== sectionEndSchemaIndex) {
                          setDragOverIndex(sectionEndSchemaIndex);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        executeDropAt(e, sectionEndSchemaIndex);
                      }}
                      className={cn(
                        'col-span-6 px-8 py-3 text-center text-xs transition-colors',
                        dragOverIndex === sectionEndSchemaIndex
                          ? 'bg-emerald-50/60 text-emerald-700 border-t-2 border-t-emerald-500'
                          : 'bg-zinc-50/30 text-zinc-400 hover:bg-zinc-50/70',
                      )}
                    >
                      Drop a field here to add it to {section.title}
                    </div>
                  </div>
                )}

                {/* Section Footer Preview (Next vs Submit) */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectField(null);
                  }}
                  className="px-8 py-3 bg-zinc-50/70 border-t border-zinc-200 flex items-center justify-between cursor-pointer"
                  title={
                    isLastSection
                      ? 'Click to edit submit button text in Form Settings'
                      : 'Respondents click Next to advance to the next section'
                  }
                >
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    Page {sectionIdx + 1} of {sections.length}
                  </span>
                  {isLastSection ? (
                    <span className="inline-flex items-center justify-center h-8 px-4 rounded-md bg-emerald-600 text-white text-xs font-medium opacity-90">
                      {schema.submitButtonText || 'Submit'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center h-8 px-4 rounded-md bg-zinc-900 text-white text-xs font-medium opacity-90">
                      Next →
                    </span>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* Part C: Add Section Action Bar */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative flex items-center justify-center py-2"
        >
          <div className="w-full border-t border-dashed border-zinc-300" />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onAddSection?.()}
            className="absolute shadow-xs"
          >
            + Add Section
          </Button>
        </div>
      </div>
    </main>
  );
}

import { useState, type DragEvent } from 'react';
import {
  isFieldType,
  type FieldType,
  type FormField,
  type FormSchema,
} from '../../domain/form-schema';
import { bindFieldModule, FieldLayoutProvider } from '../../fields/registry';
import { cn } from '../../shared/lib';
import { Button } from '../../shared/ui';

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
      Pick<FormSchema, 'title' | 'description' | 'slug' | 'submitButtonText'>
    >,
  ) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
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
  onMoveField,
  onMoveFieldToGrid,
  onDuplicateField,
  onRemoveField,
  onUpdateMetadata,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: BuilderCanvasProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverGridCol, setDragOverGridCol] = useState<{
    gridId: string;
    colIdx: 0 | 1 | 2;
  } | null>(null);
  const [isCanvasDropActive, setIsCanvasDropActive] = useState(false);

  const topLevelFields = schema.fields.filter((f) => !f.parentGridId);

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
        const toIndex =
          fromIndex < insertionIndex
            ? Math.min(schema.fields.length - 1, insertionIndex - 1)
            : Math.min(schema.fields.length - 1, insertionIndex);
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
      onAddFieldAt(paletteType, insertionIndex, presetPatch);
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

  return (
    <main
      aria-label="Builder Canvas"
      onDragOver={handleCanvasDragOver}
      onDragLeave={handleCanvasDragLeave}
      onDrop={handleCanvasDrop}
      onClick={() => onSelectField(null)}
      className="flex-1 overflow-y-auto py-8 px-6 bg-[#f4f5f7] relative"
    >
      {/* Top-right floating controls & page icon badge */}
      <div className="absolute top-4 right-5 hidden lg:flex items-center gap-2">
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="xs"
            variant="secondary"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo last change"
            className="h-7 px-2 text-xs"
          >
            Undo
          </Button>
          <Button
            size="xs"
            variant="secondary"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo change"
            className="h-7 px-2 text-xs"
          >
            Redo
          </Button>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-white border border-zinc-200 shadow-2xs text-zinc-500 text-xs"
          title={`${schema.fields.length} ${schema.fields.length === 1 ? 'Field' : 'Fields'}`}
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="font-medium text-zinc-700">
            {schema.fields.length}
          </span>
        </div>
      </div>

      <div className="max-w-[740px] mx-auto space-y-5">
        {/* Part A: Form Title Header Card */}
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
          <div className="mt-4 w-full py-1.5 px-4 rounded-xs bg-sky-50/70 border border-sky-200/80 text-center">
            <span className="text-xs font-medium text-zinc-600">
              {schema.description || 'Page Navigation Bar : Hidden'}
            </span>
          </div>
        </div>

        {/* Part B: Dashed Section Divider with + Button */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative flex items-center justify-center py-1"
        >
          <div className="w-full border-t border-dashed border-zinc-400/80" />
          <button
            type="button"
            onClick={() =>
              onAddFieldAt('section', 0, {
                label: 'New Section',
                showLine: true,
              })
            }
            title="Add Section Header"
            className="absolute h-6 w-6 rounded-full bg-white border border-zinc-300 shadow-2xs flex items-center justify-center text-zinc-500 hover:text-emerald-600 hover:border-emerald-500 transition-colors cursor-pointer text-sm leading-none"
          >
            +
          </button>
        </div>

        {/* Part C: Continuous Form Sheet Card */}
        <div className="relative bg-white rounded-md border border-zinc-200/90 shadow-xs overflow-hidden">
          <div
            className="absolute top-3 right-4 h-5 w-5 rounded-xs bg-amber-100 border border-amber-300/80 flex items-center justify-center text-[10px] font-bold text-amber-700 pointer-events-none select-none z-10"
            title="Form Layout Section"
          >
            Ab
          </div>

          {topLevelFields.length === 0 ? (
            <div
              className={cn(
                'p-12 border border-dashed border-zinc-300 rounded-md m-4 text-center space-y-2 transition-colors duration-150',
                isCanvasDropActive
                  ? 'border-emerald-500 bg-emerald-50/20'
                  : 'bg-zinc-50/50',
              )}
            >
              <p className="text-sm font-medium text-zinc-700">
                No fields in this form yet
              </p>
              <p className="text-xs text-zinc-500">
                Click any field in the left palette or drag it here to start
                building.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-6 divide-y divide-zinc-100">
              {topLevelFields.map((field, topIndex) => {
                const bound = bindFieldModule(field);
                const isSelected = selectedFieldId === field.id;
                const schemaIndex = schema.fields.findIndex(
                  (f) => f.id === field.id,
                );
                const isDragTargetTop = dragOverIndex === schemaIndex;
                const isDragTargetBottom =
                  topIndex === topLevelFields.length - 1 &&
                  dragOverIndex === schema.fields.length;
                const isMultiColumn = (field.columnSpan ?? 1) > 1;
                const colSpanClass =
                  field.type === 'grid' ||
                  field.type === 'section' ||
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
                    onDragStart={(e) => handleCardDragStart(e, schemaIndex)}
                    onDragOver={(e) => handleCardDragOver(e, schemaIndex)}
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
                      isDragTargetTop && 'border-t-2 border-t-emerald-500',
                      isDragTargetBottom && 'border-b-2 border-b-emerald-500',
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
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={topIndex === 0}
                        onClick={() => {
                          const prevTopField = topLevelFields[topIndex - 1];
                          const prevSchemaIndex = schema.fields.findIndex(
                            (f) => f.id === prevTopField.id,
                          );
                          if (prevSchemaIndex !== -1) {
                            onMoveField(schemaIndex, prevSchemaIndex);
                          }
                        }}
                        aria-label={`Move ${field.label} up`}
                        title="Move Up"
                        className="h-6 px-1.5 text-xs"
                      >
                        ↑
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={topIndex === topLevelFields.length - 1}
                        onClick={() => {
                          const nextTopField = topLevelFields[topIndex + 1];
                          const nextSchemaIndex = schema.fields.findIndex(
                            (f) => f.id === nextTopField.id,
                          );
                          if (nextSchemaIndex !== -1) {
                            onMoveField(schemaIndex, nextSchemaIndex);
                          }
                        }}
                        aria-label={`Move ${field.label} down`}
                        title="Move Down"
                        className="h-6 px-1.5 text-xs"
                      >
                        ↓
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => onDuplicateField(field.id)}
                        aria-label={`Duplicate ${field.label}`}
                        title="Duplicate Field"
                        className="h-6 px-1.5 text-xs"
                      >
                        Copy
                      </Button>
                      <Button
                        size="xs"
                        variant="danger"
                        onClick={() => onRemoveField(field.id)}
                        aria-label={`Delete ${field.label}`}
                        title="Delete Field"
                        className="h-6 px-1.5 text-xs"
                      >
                        Del
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
                                    handleGridColDragOver(e, field.id, colIdx)
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
                                  handleGridColDragOver(e, field.id, colIdx)
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
                                          onClick={(e) => e.stopPropagation()}
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
                                              onDuplicateField(childField.id)
                                            }
                                            aria-label={`Duplicate ${childField.label}`}
                                            title="Duplicate Field"
                                            className="h-5 px-1.5 text-[11px]"
                                          >
                                            Copy
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
                                            Del
                                          </Button>
                                        </div>

                                        <div className="pointer-events-none">
                                          {childBound.renderRuntime({
                                            value:
                                              childField.type === 'checkbox'
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
              <div
                aria-label="Drop field at bottom of form"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragOverIndex !== schema.fields.length) {
                    setDragOverIndex(schema.fields.length);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  executeDropAt(e, schema.fields.length);
                }}
                className={cn(
                  'col-span-6 px-8 py-3 text-center font-mono text-[11px] transition-colors',
                  dragOverIndex === schema.fields.length
                    ? 'bg-emerald-50/60 text-emerald-700 border-t-2 border-t-emerald-500'
                    : 'bg-zinc-50/30 text-zinc-400 hover:bg-zinc-50/70',
                )}
              >
                Drop field here to append to bottom
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

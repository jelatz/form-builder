import type { ReactElement } from 'react';
import type {
  ConditionOperator,
  FieldColSpan,
  FormField,
} from '../../domain/form-schema/index.ts';
import { getFieldDefinition, renderFieldInspector } from '../../fields/index.ts';
import { cn } from '../../shared/lib/cn.ts';

export interface PropertyInspectorProps {
  field: FormField | null;
  allFields?: FormField[];
  onUpdateField: (updatedField: FormField) => void;
  onRemoveField: (fieldId: string) => void;
  className?: string;
}

export function PropertyInspector({
  field,
  allFields = [],
  onUpdateField,
  onRemoveField,
  className,
}: PropertyInspectorProps): ReactElement {
  if (!field) {
    return (
      <div
        className={cn(
          'w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-sm',
          className
        )}
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 mb-6 min-w-0 gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate min-w-0">
            Question Settings
          </h2>
          <span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-sm">
            Settings
          </span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 py-12 px-4 text-center min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 shrink-0">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
              />
            </svg>
          </div>
          <p className="mt-3 text-xs font-medium text-zinc-700 dark:text-zinc-300">No question selected</p>
          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 max-w-[200px]">
            Click any question on your form to change its text, width, or settings.
          </p>
        </div>
      </div>
    );
  }

  const definition = getFieldDefinition(field.type);
  const otherFields = allFields.filter((f) => f.id !== field.id);
  const hasCondition = Boolean(field.condition);
  const currentColSpan: FieldColSpan = field.colSpan ?? 12;

  return (
    <div
      className={cn(
        'w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-sm space-y-4 sm:space-y-5',
        className
      )}
    >
      {/* Inspector Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 min-w-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-zinc-100 dark:bg-zinc-800 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60">
            {definition.badge}
          </span>
          <div>
            <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate min-w-0">
              {definition.paletteLabel}
            </h2>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Question Settings</p>
          </div>
        </div>
      </div>

      {/* Question Width */}
      <div className="space-y-2.5 min-w-0">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 min-w-0 gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate min-w-0">
            Question Width
          </span>
          <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-sm font-medium">
            Layout
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 min-w-0">
          {/* Full Width (1 per row) */}
          <button
            type="button"
            onClick={() => onUpdateField({ ...field, colSpan: 12 })}
            className={cn(
              'flex flex-col items-start rounded-md border p-2 text-left transition-all touch-manipulation min-h-[36px] min-w-0 active:scale-[0.99] cursor-pointer',
              currentColSpan === 12
                ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-100/60 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 ring-1 ring-zinc-950 dark:ring-zinc-100 shadow-sm'
                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            )}
          >
            <div className="mb-1.5 flex h-2 w-full rounded-sm bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
              <span
                className={cn(
                  'h-full w-full rounded-sm',
                  currentColSpan === 12 ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-400 dark:bg-zinc-500'
                )}
              />
            </div>
            <span className="text-xs font-medium truncate w-full">Full Width</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate w-full">1 per row</span>
          </button>

          {/* Half Width (2 per row) */}
          <button
            type="button"
            onClick={() => onUpdateField({ ...field, colSpan: 6 })}
            className={cn(
              'flex flex-col items-start rounded-md border p-2 text-left transition-all touch-manipulation min-h-[36px] min-w-0 active:scale-[0.99] cursor-pointer',
              currentColSpan === 6
                ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-100/60 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 ring-1 ring-zinc-950 dark:ring-zinc-100 shadow-sm'
                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            )}
          >
            <div className="mb-1.5 flex h-2 w-full gap-1">
              <span
                className={cn(
                  'h-full flex-1 rounded-sm',
                  currentColSpan === 6 ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-400 dark:bg-zinc-500'
                )}
              />
              <span className="h-full flex-1 rounded-sm bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <span className="text-xs font-medium truncate w-full">Half Width</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate w-full">2 per row</span>
          </button>

          {/* Third Width (3 per row) */}
          <button
            type="button"
            onClick={() => onUpdateField({ ...field, colSpan: 4 })}
            className={cn(
              'flex flex-col items-start rounded-md border p-2 text-left transition-all touch-manipulation min-h-[36px] min-w-0 active:scale-[0.99] cursor-pointer',
              currentColSpan === 4
                ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-100/60 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 ring-1 ring-zinc-950 dark:ring-zinc-100 shadow-sm'
                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            )}
          >
            <div className="mb-1.5 flex h-2 w-full gap-1">
              <span
                className={cn(
                  'h-full flex-1 rounded-sm',
                  currentColSpan === 4 ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-400 dark:bg-zinc-500'
                )}
              />
              <span className="h-full flex-1 rounded-sm bg-zinc-200 dark:bg-zinc-700" />
              <span className="h-full flex-1 rounded-sm bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <span className="text-xs font-medium truncate w-full">Third Width</span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate w-full">3 per row</span>
          </button>
        </div>

        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
          Tip: Drag a question beside another on the canvas to place them side-by-side (up to 3 across).
        </p>
      </div>

      {/* Common BaseField Controls */}
      <div className="space-y-3.5 min-w-0">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 min-w-0 gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate min-w-0">
            General Settings
          </span>
        </div>

        <div className="min-w-0">
          <label
            htmlFor={`inspector-${field.id}-label`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 truncate min-w-0"
          >
            Question Text / Label
          </label>
          <input
            id={`inspector-${field.id}-label`}
            type="text"
            value={field.label}
            onChange={(e) => onUpdateField({ ...field, label: e.target.value })}
            placeholder="Question Text / Label"
            className="h-9 w-full min-w-0 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300 shadow-sm transition-colors touch-manipulation"
          />
        </div>

        <div className="min-w-0">
          <label
            htmlFor={`inspector-${field.id}-helper`}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 truncate min-w-0"
          >
            Helpful Hint (Optional)
          </label>
          <input
            id={`inspector-${field.id}-helper`}
            type="text"
            value={field.helperText ?? ''}
            onChange={(e) =>
              onUpdateField({
                ...field,
                helperText: e.target.value,
              })
            }
            placeholder="Extra instructions shown below the question..."
            className="h-9 w-full min-w-0 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300 shadow-sm transition-colors touch-manipulation"
          />
        </div>

        <div className="flex items-center justify-between pt-1 min-w-0 gap-2">
          <label
            htmlFor={`inspector-${field.id}-required`}
            className="text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer truncate min-w-0"
          >
            Required (Customer must answer)
          </label>
          <input
            id={`inspector-${field.id}-required`}
            type="checkbox"
            checked={field.required}
            onChange={(e) =>
              onUpdateField({
                ...field,
                required: e.target.checked,
              })
            }
            className="h-4.5 w-4.5 shrink-0 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-zinc-950 dark:focus:ring-zinc-300 cursor-pointer accent-zinc-900 dark:accent-zinc-100 touch-manipulation"
          />
        </div>

        {/* Advanced CRM / Export Name Collapsible */}
        <details className="group rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 p-3 text-xs">
          <summary className="flex cursor-pointer select-none items-center justify-between font-medium text-zinc-700 dark:text-zinc-300">
            <span>Advanced / CRM Export Name</span>
            <span className="text-[11px] text-zinc-400 transition-transform group-open:rotate-180">▼</span>
          </summary>
          <div className="mt-3 space-y-3 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor={`inspector-${field.id}-crm-key`}
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  CRM / Webhook Field Key
                </label>
                <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                  #{field.id}
                </span>
              </div>
              <input
                id={`inspector-${field.id}-crm-key`}
                type="text"
                value={field.crmFieldKey ?? ''}
                onChange={(e) =>
                  onUpdateField({
                    ...field,
                    crmFieldKey: e.target.value.trim() || undefined,
                  })
                }
                placeholder="e.g. email, phone, deal_value, utm_source"
                className="h-9 w-full min-w-0 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 font-mono text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300 shadow-sm transition-colors touch-manipulation"
              />
              <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 break-words">
                Exported attribute key for GoHighLevel, Close, Zoho, Airtable, and Webhooks.
              </p>
            </div>
          </div>
        </details>
      </div>

      {/* Field-Specific Controls (Open/Closed - Delegated via registry) */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3.5 min-w-0">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 min-w-0 gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate min-w-0">
            Type Settings
          </span>
          <span className="shrink-0 font-mono text-[10px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-sm">
            {field.type}
          </span>
        </div>
        <div className="min-w-0 w-full">
          {renderFieldInspector({ field, onChange: onUpdateField })}
        </div>
      </div>

      {/* Conditional Visibility (Show/Hide Logic) */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3 min-w-0">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 min-w-0 gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block truncate min-w-0">
              Show / Hide Rule (Conditional)
            </span>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate min-w-0">
              Only show this question based on an earlier answer
            </p>
          </div>
          <input
            id={`inspector-${field.id}-has-condition`}
            type="checkbox"
            checked={hasCondition}
            onChange={(e) => {
              if (e.target.checked) {
                const defaultSource = otherFields[0]?.id ?? '';
                onUpdateField({
                  ...field,
                  condition: {
                    sourceFieldId: defaultSource,
                    operator: 'equals',
                    value: '',
                  },
                });
              } else {
                onUpdateField({
                  ...field,
                  condition: undefined,
                });
              }
            }}
            className="h-4.5 w-4.5 shrink-0 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-zinc-950 dark:focus:ring-zinc-300 cursor-pointer accent-zinc-900 dark:accent-zinc-100 touch-manipulation"
          />
        </div>

        {hasCondition && field.condition && (
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-3.5 space-y-3 text-xs min-w-0">
            <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-semibold min-w-0">
              <span>⚡</span>
              <span className="truncate min-w-0">Display Rule</span>
            </div>

            {otherFields.length === 0 ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 break-words">
                No other questions available. Add more questions to the form first.
              </p>
            ) : (
              <>
                <div className="min-w-0">
                  <label
                    htmlFor={`inspector-${field.id}-cond-source`}
                    className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1 truncate min-w-0"
                  >
                    When question:
                  </label>
                  <select
                    id={`inspector-${field.id}-cond-source`}
                    value={field.condition.sourceFieldId}
                    onChange={(e) =>
                      onUpdateField({
                        ...field,
                        condition: {
                          ...field.condition!,
                          sourceFieldId: e.target.value,
                        },
                      })
                    }
                    className="h-9 w-full min-w-0 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300 shadow-sm touch-manipulation cursor-pointer"
                  >
                    {otherFields.map((f) => (
                      <option key={f.id} value={f.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                        {f.label || 'Untitled Question'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor={`inspector-${field.id}-cond-op`}
                    className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1 truncate min-w-0"
                  >
                    Operator:
                  </label>
                  <select
                    id={`inspector-${field.id}-cond-op`}
                    value={field.condition.operator}
                    onChange={(e) =>
                      onUpdateField({
                        ...field,
                        condition: {
                          ...field.condition!,
                          operator: e.target.value as ConditionOperator,
                        },
                      })
                    }
                    className="h-9 w-full min-w-0 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300 shadow-sm touch-manipulation cursor-pointer"
                  >
                    <option value="equals" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Equals</option>
                    <option value="not_equals" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Does not equal</option>
                    <option value="contains" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Contains</option>
                    <option value="not_empty" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Is not empty (has value)</option>
                  </select>
                </div>

                {field.condition.operator !== 'not_empty' && (
                  <div className="min-w-0">
                    <label
                      htmlFor={`inspector-${field.id}-cond-val`}
                      className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1 truncate min-w-0"
                    >
                      Matching Value:
                    </label>
                    <input
                      id={`inspector-${field.id}-cond-val`}
                      type="text"
                      value={field.condition.value}
                      onChange={(e) =>
                        onUpdateField({
                          ...field,
                          condition: {
                            ...field.condition!,
                            value: e.target.value,
                          },
                        })
                      }
                      placeholder="e.g. Yes, Enterprise, USA"
                      className="h-9 w-full min-w-0 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300 shadow-sm transition-colors touch-manipulation"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer Danger Zone */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 min-w-0">
        <button
          type="button"
          onClick={() => onRemoveField(field.id)}
          className="flex w-full min-w-0 items-center justify-center gap-2 h-9 px-3 text-xs font-medium rounded-md text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 active:scale-[0.99] dark:text-rose-400 dark:bg-rose-950/40 dark:border-rose-800 dark:hover:bg-rose-950/80 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 touch-manipulation cursor-pointer"
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
          Delete Question
        </button>
      </div>
    </div>
  );
}

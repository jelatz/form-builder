import { useState } from 'react';
import type { FormField, FormSchema } from '../../domain/form-schema';
import { bindFieldModule } from '../../fields/registry';
import { THEME_OPTIONS, type ThemeMode } from '../../shared/lib';
import { Badge, Button, Input, Label, Select, Switch, Tooltip } from '../../shared/ui';

export interface PropertyInspectorProps {
  schema: FormSchema;
  selectedField: FormField | null;
  onUpdateField: (updated: FormField) => void;
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
  inspectorSide?: 'right' | 'left';
  onToggleInspectorSide?: () => void;
  themeMode?: ThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
}

export function PropertyInspector({
  schema,
  selectedField,
  onUpdateField,
  onDuplicateField,
  onRemoveField,
  onUpdateMetadata,
  inspectorSide = 'right',
  onToggleInspectorSide,
  themeMode,
  onThemeModeChange,
}: PropertyInspectorProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'field' | 'settings'>(
    selectedField ? 'field' : 'settings',
  );
  const [prevFieldId, setPrevFieldId] = useState<string | null>(
    selectedField?.id ?? null,
  );

  if ((selectedField?.id ?? null) !== prevFieldId) {
    setPrevFieldId(selectedField?.id ?? null);
    if (selectedField) {
      setIsDrawerOpen(true);
      setActiveTab('field');
    }
  }

  const bound = selectedField ? bindFieldModule(selectedField) : null;
  const isLeftSide = inspectorSide === 'left';
  const borderClass = isLeftSide
    ? 'border-r border-zinc-200'
    : 'border-l border-zinc-200';
  const showFieldInspector =
    activeTab === 'field' && Boolean(selectedField) && Boolean(bound);

  return (
    <div
      className={`relative z-30 pointer-events-auto flex shrink-0 h-full ${
        isLeftSide ? 'flex-row-reverse' : ''
      }`}
    >
      {/* Collapsible Inspector Drawer */}
      {isDrawerOpen ? (
        <aside
          aria-label={
            showFieldInspector
              ? 'Field Property Inspector'
              : 'Form Settings Inspector'
          }
          onClick={(e) => e.stopPropagation()}
          className={`relative z-30 pointer-events-auto w-80 shrink-0 ${borderClass} bg-white flex flex-col`}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <h2 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider font-mono truncate">
                {showFieldInspector && bound
                  ? bound.definition.label
                  : 'Form Settings'}
              </h2>
              <p className="text-xs text-zinc-500 truncate mt-0.5">
                {showFieldInspector && selectedField
                  ? selectedField.label || 'Field properties & validation'
                  : 'Title, description, publishing & theme'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {onToggleInspectorSide && (
                <button
                  type="button"
                  onClick={onToggleInspectorSide}
                  className="px-2 py-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded transition-colors cursor-pointer shrink-0"
                  title="Toggle inspector docking side"
                >
                  {inspectorSide === 'left'
                    ? 'Dock Right →'
                    : '← Dock Left'}
                </button>
              )}
              <Badge variant="neutral">
                {showFieldInspector && bound ? bound.definition.badge : 'FORM'}
              </Badge>
              <Tooltip content="Close inspector">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="h-6 w-6 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 flex items-center justify-center cursor-pointer text-base leading-none transition-colors"
                  aria-label="Close inspector drawer"
                >
                  ×
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Sub-tab Navigation when a field is selected */}
          {selectedField && bound && (
            <div className="flex border-b border-zinc-200 bg-zinc-50/50 px-4 pt-1.5 gap-4 text-xs shrink-0 select-none">
              <button
                type="button"
                onClick={() => setActiveTab('field')}
                className={`pb-1.5 border-b-2 font-medium cursor-pointer transition-colors ${
                  activeTab === 'field'
                    ? 'border-emerald-600 text-emerald-700 font-semibold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Field Properties
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`pb-1.5 border-b-2 font-medium cursor-pointer transition-colors ${
                  activeTab === 'settings'
                    ? 'border-emerald-600 text-emerald-700 font-semibold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Form Settings
              </button>
            </div>
          )}

          {/* Body */}
          {!showFieldInspector || !bound || !selectedField ? (
            /* Form Settings Inspector */
            <div
              data-inspector-scroll-container
              className="p-4 space-y-4 overflow-y-auto flex-1"
            >
              <div className="space-y-1.5">
                <Label htmlFor="form_meta_title">Form Title</Label>
                <Input
                  id="form_meta_title"
                  value={schema.title}
                  onChange={(e) => onUpdateMetadata({ title: e.target.value })}
                  placeholder="Form Title"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="form_meta_desc">Description</Label>
                <Input
                  id="form_meta_desc"
                  value={schema.description ?? ''}
                  onChange={(e) =>
                    onUpdateMetadata({
                      description: e.target.value || undefined,
                    })
                  }
                  placeholder="Optional form description"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="form_meta_submit">Submit Button Text</Label>
                <Input
                  id="form_meta_submit"
                  value={schema.submitButtonText ?? 'Submit'}
                  onChange={(e) =>
                    onUpdateMetadata({
                      submitButtonText: e.target.value || 'Submit',
                    })
                  }
                  placeholder="Submit"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="form_meta_slug">URL Slug</Label>
                <Input
                  id="form_meta_slug"
                  value={schema.slug}
                  onChange={(e) =>
                    onUpdateMetadata({
                      slug: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-_]/g, '-'),
                    })
                  }
                  placeholder="form-slug"
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-zinc-500">
                  Used in the shareable form link.
                </p>
              </div>

              <div className="pt-3 border-t border-zinc-200">
                <Switch
                  id="form_meta_published"
                  checked={schema.isPublished !== false}
                  onChange={(isPublished) => onUpdateMetadata({ isPublished })}
                  label="Published (accepting public responses)"
                />
              </div>

              {onThemeModeChange && (
                <div className="pt-3 border-t border-zinc-200 space-y-1.5">
                  <Label htmlFor="form_meta_theme_mode">
                    Appearance / Theme Mode
                  </Label>
                  <Select
                    id="form_meta_theme_mode"
                    aria-label="Appearance / Theme Mode"
                    menuHeading="Appearance"
                    value={themeMode ?? 'light'}
                    onValueChange={(val) =>
                      onThemeModeChange(val as ThemeMode)
                    }
                    options={THEME_OPTIONS}
                  />
                </div>
              )}

              <div className="pt-3 border-t border-zinc-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Total Fields</span>
                  <span className="font-mono text-zinc-700 font-medium">
                    {schema.fields.length}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Field Property Inspector */
            <div
              data-inspector-scroll-container
              className="p-4 space-y-4 overflow-y-auto flex-1"
            >
              {bound.renderInspector({
                onChange: onUpdateField,
              })}

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onDuplicateField(selectedField.id)}
                  className="flex-1"
                >
                  Duplicate Field
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onRemoveField(selectedField.id)}
                  className="flex-1"
                >
                  Delete Field
                </Button>
              </div>
            </div>
          )}
        </aside>
      ) : (
        <div
          className={`relative z-30 pointer-events-auto w-10 shrink-0 ${borderClass} bg-white flex flex-col items-center py-3 select-none`}
        >
          <Tooltip content="Open inspector" side="left">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="w-7 h-7 rounded-md border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Open Inspector"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {isLeftSide ? (
                  <path d="m9 18 6-6-6-6" />
                ) : (
                  <path d="m15 18-6-6 6-6" />
                )}
              </svg>
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

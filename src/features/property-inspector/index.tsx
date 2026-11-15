import { useState } from 'react';
import type { FormField, FormSchema } from '../../domain/form-schema';
import { bindFieldModule } from '../../fields/registry';
import { THEME_OPTIONS, type ThemeMode } from '../../shared/lib';
import { Badge, Button, Input, Label, Select } from '../../shared/ui';

export interface PropertyInspectorProps {
  schema: FormSchema;
  selectedField: FormField | null;
  onUpdateField: (updated: FormField) => void;
  onDuplicateField: (fieldId: string) => void;
  onRemoveField: (fieldId: string) => void;
  onUpdateMetadata: (
    patch: Partial<
      Pick<FormSchema, 'title' | 'description' | 'slug' | 'submitButtonText'>
    >,
  ) => void;
  onNavigateMode?: (
    mode: 'forms' | 'edit' | 'preview' | 'submissions' | 'schema',
  ) => void;
  onSelectField?: (fieldId: string | null) => void;
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
  onNavigateMode,
  onSelectField,
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

  const handleValidationRulesClick = () => {
    setIsDrawerOpen(true);
    setActiveTab('field');
    if (!selectedField && schema.fields[0]) {
      onSelectField?.(schema.fields[0].id);
    }
    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = document.querySelector<HTMLElement>(
          '[data-inspector-scroll-container]',
        );
        if (container) {
          const validationTarget = container.querySelector<HTMLElement>(
            'input[id^="insp_required_"], input[id*="min"], input[id*="max"], input[id*="step"], input[id*="domain"], input[type="checkbox"]',
          );
          if (validationTarget) {
            validationTarget.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
            try {
              validationTarget.focus({ preventScroll: true });
            } catch {
              // Ignore focus failure if not focusable
            }
          } else {
            container.scrollTo({
              top: container.scrollHeight,
              behavior: 'smooth',
            });
          }
        }
      }, 50);
    });
  };

  const focusThemeModeControl = () => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const themeControl = document.getElementById('form_meta_theme_mode');
        if (themeControl) {
          themeControl.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
          try {
            themeControl.focus({ preventScroll: true });
          } catch {
            // Ignore focus failure
          }
        }
      }, 50);
    });
  };

  const handleThemesStylingClick = () => {
    setIsDrawerOpen(true);
    if (!selectedField || activeTab === 'settings') {
      setActiveTab('settings');
      focusThemeModeControl();
      return;
    }

    setActiveTab('field');
    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = document.querySelector<HTMLElement>(
          '[data-inspector-scroll-container]',
        );
        const layoutTarget = container
          ? Array.from(
              container.querySelectorAll<HTMLButtonElement>('button'),
            ).find(
              (btn) =>
                btn.textContent?.includes('-Col') ||
                btn.textContent?.toLowerCase().includes('column'),
            ) ||
            container.querySelector<HTMLElement>(
              'input[id^="insp_divider_"], input[id*="divider"]',
            )
          : null;

        if (layoutTarget) {
          layoutTarget.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
          try {
            layoutTarget.focus({ preventScroll: true });
          } catch {
            // Ignore focus failure
          }
        } else {
          setActiveTab('settings');
          focusThemeModeControl();
        }
      }, 50);
    });
  };

  return (
    <div
      className={`relative z-30 pointer-events-auto flex shrink-0 h-full ${
        isLeftSide ? 'flex-row-reverse' : ''
      }`}
    >
      {/* Collapsible Inspector Drawer */}
      {isDrawerOpen && (
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
              <p className="text-xs text-zinc-500 truncate mt-0.5 font-mono">
                {showFieldInspector && selectedField
                  ? selectedField.id
                  : 'Select a field to inspect its rules'}
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
                    ? 'Dock Inspector Right →'
                    : '← Dock Inspector Left'}
                </button>
              )}
              <Badge variant="neutral">
                {showFieldInspector && bound ? bound.definition.badge : 'SCHEMA'}
              </Badge>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="h-6 w-6 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 flex items-center justify-center cursor-pointer text-base leading-none transition-colors"
                aria-label="Close inspector drawer"
                title="Close drawer"
              >
                ×
              </button>
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
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="form_meta_desc">
                  Description / Header Banner
                </Label>
                <Input
                  id="form_meta_desc"
                  value={schema.description ?? ''}
                  onChange={(e) =>
                    onUpdateMetadata({
                      description: e.target.value || undefined,
                    })
                  }
                  placeholder="Optional form description or banner note"
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

              <div className="pt-3 border-t border-zinc-200 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Schema ID</span>
                  <span className="font-mono text-zinc-600">{schema.id}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Tenant ID</span>
                  <span className="font-mono text-zinc-600">
                    {schema.clientId}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Total Fields</span>
                  <span className="font-mono text-zinc-600">
                    {schema.fields.length}
                  </span>
                </div>
              </div>

              {onToggleInspectorSide && (
                <div className="pt-3 border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={onToggleInspectorSide}
                    className="w-full py-1.5 px-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-md transition-colors cursor-pointer text-center"
                    title="Toggle inspector docking side"
                  >
                    {inspectorSide === 'left'
                      ? 'Dock Inspector Right →'
                      : '← Dock Inspector Left'}
                  </button>
                </div>
              )}
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

              {onToggleInspectorSide && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onToggleInspectorSide}
                    className="w-full py-1.5 px-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-md transition-colors cursor-pointer text-center"
                    title="Toggle inspector docking side"
                  >
                    {inspectorSide === 'left'
                      ? 'Dock Inspector Right →'
                      : '← Dock Inspector Left'}
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      )}

      {/* Zoho Right-Hand Vertical Icon Rail */}
      <div
        className={`relative z-30 pointer-events-auto w-11 shrink-0 ${borderClass} bg-white flex flex-col items-center py-3 gap-2.5 select-none`}
      >
        {/* Top green status / drawer toggle button */}
        <button
          type="button"
          onClick={() => setIsDrawerOpen((prev) => !prev)}
          className="w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
          title={
            isDrawerOpen ? 'Collapse Inspector Drawer' : 'Open Inspector Drawer'
          }
          aria-label="Toggle Inspector Drawer"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {/* Properties / Sliders */}
        <button
          type="button"
          onClick={() => {
            setIsDrawerOpen(true);
            setActiveTab('field');
            if (!selectedField && schema.fields[0]) {
              onSelectField?.(schema.fields[0].id);
            }
          }}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            isDrawerOpen && activeTab === 'field' && Boolean(selectedField)
              ? 'bg-zinc-100 text-emerald-600'
              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
          }`}
          title="Field Properties"
          aria-label="Field Properties"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
        </button>

        {/* Gear / Form Settings */}
        <button
          type="button"
          onClick={() => {
            setIsDrawerOpen(true);
            setActiveTab('settings');
          }}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            isDrawerOpen && (activeTab === 'settings' || !selectedField)
              ? 'bg-zinc-100 text-emerald-600'
              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
          }`}
          title="Form Settings"
          aria-label="Form Settings"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {/* Shield / Validation Rules */}
        <button
          type="button"
          onClick={handleValidationRulesClick}
          className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
          title="Validation Rules"
          aria-label="Validation Rules"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </button>

        {/* Palette / Themes */}
        <button
          type="button"
          onClick={handleThemesStylingClick}
          className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
          title="Themes & Styling"
          aria-label="Themes & Styling"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C21.937 6.402 17.477 2 12 2z" />
          </svg>
        </button>

        <div className="w-5 h-px bg-zinc-200 my-0.5" />

        {/* Share / Rules / Live Preview */}
        <button
          type="button"
          onClick={() => onNavigateMode?.('preview')}
          className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
          title="Live Preview / Access"
          aria-label="Live Preview / Access"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>

        {/* Database / Submissions */}
        <button
          type="button"
          onClick={() => onNavigateMode?.('submissions')}
          className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
          title="Submissions"
          aria-label="Submissions"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        </button>

        {/* Code / Schema JSON */}
        <button
          type="button"
          onClick={() => onNavigateMode?.('schema')}
          className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
          title="Schema JSON"
          aria-label="Schema JSON"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </button>

        {/* Directory / All Forms */}
        <button
          type="button"
          onClick={() => onNavigateMode?.('forms')}
          className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
          title="All Forms Directory"
          aria-label="All Forms Directory"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

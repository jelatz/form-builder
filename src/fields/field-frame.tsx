import { createContext, useContext, type ReactNode } from 'react';
import type { BaseFieldConfig, SelectOption } from '../domain/form-schema';
import { cn } from '../shared/lib';
import { Button, Input, Label, Switch } from '../shared/ui';

const FieldLayoutContext = createContext<'horizontal' | 'stacked'>('horizontal');

export function FieldLayoutProvider({
  layout,
  children,
}: {
  layout: 'horizontal' | 'stacked';
  children: ReactNode;
}) {
  return (
    <FieldLayoutContext.Provider value={layout}>
      {children}
    </FieldLayoutContext.Provider>
  );
}

export interface FieldFrameProps {
  id: string;
  label: string;
  required: boolean;
  helperText?: string;
  error?: string;
  children: ReactNode;
}

export function FieldFrame({
  id,
  label,
  required,
  helperText,
  error,
  children,
}: FieldFrameProps) {
  const layout = useContext(FieldLayoutContext);

  if (layout === 'stacked') {
    return (
      <div className="space-y-1.5">
        <Label
          htmlFor={id}
          requiredIndicator={required}
          className="block text-xs font-semibold text-zinc-800 leading-snug"
        >
          {label}
        </Label>
        <div className="space-y-1.5 min-w-0">
          {children}
          {error ? (
            <p className="text-xs text-rose-600" role="alert">
              {error}
            </p>
          ) : helperText ? (
            <p className="text-[11px] text-zinc-500">{helperText}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="sm:grid sm:grid-cols-[180px_1fr] sm:items-start sm:gap-6 space-y-1.5 sm:space-y-0">
      <Label
        htmlFor={id}
        requiredIndicator={required}
        className="pt-2 text-xs font-semibold text-zinc-800 leading-snug"
      >
        {label}
      </Label>
      <div className="space-y-1.5 min-w-0">
        {children}
        {error ? (
          <p className="text-xs text-rose-600" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-[11px] text-zinc-500">{helperText}</p>
        ) : null}
      </div>
    </div>
  );
}

export interface BaseInspectorSectionProps<T extends BaseFieldConfig> {
  field: T;
  onChange: (updated: T) => void;
  showPlaceholder?: boolean;
}

export function BaseInspectorSection<T extends BaseFieldConfig>({
  field,
  onChange,
  showPlaceholder = true,
}: BaseInspectorSectionProps<T>) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`insp_label_${field.id}`}>Field Label</Label>
        <Input
          id={`insp_label_${field.id}`}
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder="Enter field label"
        />
      </div>

      {showPlaceholder && (
        <div className="space-y-1.5">
          <Label htmlFor={`insp_placeholder_${field.id}`}>Placeholder</Label>
          <Input
            id={`insp_placeholder_${field.id}`}
            value={field.placeholder ?? ''}
            onChange={(e) =>
              onChange({
                ...field,
                placeholder: e.target.value || undefined,
              })
            }
            placeholder="Optional placeholder text"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`insp_helper_${field.id}`}>Helper Text</Label>
        <Input
          id={`insp_helper_${field.id}`}
          value={field.helperText ?? ''}
          onChange={(e) =>
            onChange({
              ...field,
              helperText: e.target.value || undefined,
            })
          }
          placeholder="Optional instructions below field"
        />
      </div>

      <div className="pt-1">
        <Switch
          id={`insp_required_${field.id}`}
          checked={field.required}
          onChange={(required) => onChange({ ...field, required })}
          label="Required field"
        />
      </div>

      <div className="space-y-1.5 pt-2 border-t border-zinc-200">
        <Label>Layout Column Width</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {([1, 2, 3] as const).map((cols) => (
            <button
              key={cols}
              type="button"
              onClick={() => onChange({ ...field, columnSpan: cols })}
              className={cn(
                'h-7 text-xs rounded border transition-colors select-none font-medium',
                (field.columnSpan ?? 1) === cols
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-semibold'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900',
              )}
            >
              {cols}-Col
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-zinc-200">
        <Switch
          id={`insp_divider_${field.id}`}
          checked={Boolean(field.showDividerAbove)}
          onChange={(showDividerAbove) =>
            onChange({ ...field, showDividerAbove })
          }
          label="Show horizontal divider line above field"
        />
      </div>
    </div>
  );
}

export interface OptionsEditorProps {
  options: SelectOption[];
  onChange: (options: SelectOption[]) => void;
}

export function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const handleOptionChange = (
    index: number,
    patch: Partial<SelectOption>,
  ) => {
    const next = options.map((opt, idx) =>
      idx === index ? { ...opt, ...patch } : opt,
    );
    onChange(next);
  };

  const handleAddOption = () => {
    const nextNum = options.length + 1;
    onChange([
      ...options,
      { label: `Option ${nextNum}`, value: `option_${nextNum}` },
    ]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 1) return;
    onChange(options.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-2 pt-2 border-t border-zinc-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-700">Options</span>
        <Button size="xs" variant="secondary" onClick={handleAddOption}>
          + Add Option
        </Button>
      </div>

      <div className="space-y-2">
        {options.map((opt, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Input
              aria-label={`Option ${index + 1} label`}
              value={opt.label}
              onChange={(e) =>
                handleOptionChange(index, { label: e.target.value })
              }
              placeholder="Label"
              className="h-8 text-xs"
            />
            <Input
              aria-label={`Option ${index + 1} value`}
              value={opt.value}
              onChange={(e) =>
                handleOptionChange(index, { value: e.target.value })
              }
              placeholder="value"
              className="h-8 text-xs font-mono"
            />
            <Button
              size="xs"
              variant="ghost"
              disabled={options.length <= 1}
              onClick={() => handleRemoveOption(index)}
              aria-label={`Remove option ${index + 1}`}
            >
              ×
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

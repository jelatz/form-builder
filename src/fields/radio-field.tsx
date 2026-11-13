import {
  BaseInspectorSection,
  FieldFrame,
  OptionsEditor,
} from './field-frame';
import type { FieldDefinition } from './types';

export const radioFieldDefinition: FieldDefinition<'radio'> = {
  type: 'radio',
  label: 'Radio',
  description: 'Single-choice radio button group for visible options.',
  badge: 'RAD',
  createDefaultConfig: (id) => ({
    id,
    type: 'radio',
    label: 'Radio Choice',
    required: false,
    options: [
      { label: 'Option A', value: 'option_a' },
      { label: 'Option B', value: 'option_b' },
    ],
  }),
  render: ({ field, value, onChange, error, disabled }) => {
    const selectedValue = typeof value === 'string' ? value : '';
    return (
      <FieldFrame
        id={field.id}
        label={field.label}
        required={field.required}
        helperText={field.helperText}
        error={error}
      >
        <div
          role="radiogroup"
          aria-label={field.label}
          className="space-y-1.5 pt-1"
        >
          {field.options.map((opt) => {
            const inputId = `${field.id}_${opt.value}`;
            const checked = selectedValue === opt.value;
            return (
              <label
                key={opt.value}
                htmlFor={inputId}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-zinc-200 bg-white hover:border-zinc-300 cursor-pointer text-xs text-zinc-800 select-none transition-colors"
              >
                <input
                  id={inputId}
                  type="radio"
                  name={field.id}
                  value={opt.value}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onChange(opt.value)}
                  className="h-3.5 w-3.5 accent-emerald-600 cursor-pointer"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </FieldFrame>
    );
  },
  renderInspector: ({ field, onChange }) => (
    <div className="space-y-4">
      <BaseInspectorSection
        field={field}
        onChange={onChange}
        showPlaceholder={false}
      />
      <OptionsEditor
        options={field.options}
        onChange={(options) => onChange({ ...field, options })}
      />
    </div>
  ),
};

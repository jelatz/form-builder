import { Switch } from '../shared/ui';
import { BaseInspectorSection, FieldFrame } from './field-frame';
import type { FieldDefinition } from './types';

export const checkboxFieldDefinition: FieldDefinition<'checkbox'> = {
  type: 'checkbox',
  label: 'Checkbox',
  description: 'Boolean toggle or consent confirmation checkbox.',
  badge: 'CHK',
  createDefaultConfig: (id) => ({
    id,
    type: 'checkbox',
    label: 'Terms & Conditions',
    helperText: 'Please accept to proceed',
    required: false,
    defaultChecked: false,
  }),
  render: ({ field, value, onChange, error, disabled }) => {
    const checked =
      typeof value === 'boolean' ? value : Boolean(field.defaultChecked);
    return (
      <FieldFrame
        id={field.id}
        label={field.label}
        required={field.required}
        helperText={field.helperText}
        error={error}
      >
        <div className="pt-1.5">
          <label
            htmlFor={field.id}
            className="inline-flex items-center gap-2.5 cursor-pointer select-none text-xs text-zinc-800"
          >
            <input
              id={field.id}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) => onChange(e.target.checked)}
              className="h-4 w-4 rounded-sm border-zinc-300 accent-emerald-600 cursor-pointer"
            />
            <span>{field.label}</span>
          </label>
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
      <div className="pt-2 border-t border-zinc-200">
        <Switch
          id={`insp_default_checked_${field.id}`}
          checked={Boolean(field.defaultChecked)}
          onChange={(defaultChecked) => onChange({ ...field, defaultChecked })}
          label="Checked by default"
        />
      </div>
    </div>
  ),
};

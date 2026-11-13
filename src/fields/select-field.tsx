import { Select } from '../shared/ui';
import {
  BaseInspectorSection,
  FieldFrame,
  OptionsEditor,
} from './field-frame';
import type { FieldDefinition } from './types';

export const selectFieldDefinition: FieldDefinition<'select'> = {
  type: 'select',
  label: 'Dropdown',
  description: 'Single-choice dropdown menu from configured options.',
  badge: 'SEL',
  createDefaultConfig: (id) => ({
    id,
    type: 'select',
    label: 'Dropdown',
    placeholder: '-Select-',
    required: false,
    options: [
      { label: 'Option 1', value: 'option_1' },
      { label: 'Option 2', value: 'option_2' },
    ],
  }),
  render: ({ field, value, onChange, error, disabled }) => (
    <FieldFrame
      id={field.id}
      label={field.label}
      required={field.required}
      helperText={field.helperText}
      error={error}
    >
      <Select
        id={field.id}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        hasError={Boolean(error)}
      >
        <option value="">{field.placeholder ?? '-Select-'}</option>
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </FieldFrame>
  ),
  renderInspector: ({ field, onChange }) => (
    <div className="space-y-4">
      <BaseInspectorSection field={field} onChange={onChange} />
      <OptionsEditor
        options={field.options}
        onChange={(options) => onChange({ ...field, options })}
      />
    </div>
  ),
};

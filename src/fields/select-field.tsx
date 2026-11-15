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
        onValueChange={(nextValue) => onChange(nextValue)}
        placeholder={field.placeholder ?? '-Select-'}
        menuHeading={field.label || 'Select Option'}
        disabled={disabled}
        hasError={Boolean(error)}
        options={[
          { value: '', label: field.placeholder ?? '-Select-' },
          ...field.options.map((opt) => ({
            value: opt.value,
            label: opt.label,
          })),
        ]}
      />
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

import { Input, Label } from '../shared/ui';
import { BaseInspectorSection, FieldFrame } from './field-frame';
import type { FieldDefinition } from './types';

export const textFieldDefinition: FieldDefinition<'text'> = {
  type: 'text',
  label: 'Single Line',
  description: 'Single-line text string with optional length bounds.',
  badge: 'TXT',
  createDefaultConfig: (id) => ({
    id,
    type: 'text',
    label: 'Single Line',
    placeholder: 'Enter text...',
    required: false,
  }),
  render: ({ field, value, onChange, error, disabled }) => (
    <FieldFrame
      id={field.id}
      label={field.label}
      required={field.required}
      helperText={field.helperText}
      error={error}
    >
      <Input
        id={field.id}
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        minLength={field.minLength}
        maxLength={field.maxLength}
        disabled={disabled}
        hasError={Boolean(error)}
      />
    </FieldFrame>
  ),
  renderInspector: ({ field, onChange }) => (
    <div className="space-y-4">
      <BaseInspectorSection field={field} onChange={onChange} />

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200">
        <div className="space-y-1.5">
          <Label htmlFor={`insp_minlen_${field.id}`}>Min Length</Label>
          <Input
            id={`insp_minlen_${field.id}`}
            type="number"
            min={0}
            value={field.minLength ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onChange({
                ...field,
                minLength: raw === '' ? undefined : Number(raw),
              });
            }}
            placeholder="None"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`insp_maxlen_${field.id}`}>Max Length</Label>
          <Input
            id={`insp_maxlen_${field.id}`}
            type="number"
            min={1}
            value={field.maxLength ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onChange({
                ...field,
                maxLength: raw === '' ? undefined : Number(raw),
              });
            }}
            placeholder="None"
          />
        </div>
      </div>
    </div>
  ),
};

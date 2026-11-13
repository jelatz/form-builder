import { Input, Label } from '../shared/ui';
import { BaseInspectorSection, FieldFrame } from './field-frame';
import type { FieldDefinition } from './types';

export const numberFieldDefinition: FieldDefinition<'number'> = {
  type: 'number',
  label: 'Number',
  description: 'Numeric input with optional min, max, and step constraints.',
  badge: 'NUM',
  createDefaultConfig: (id) => ({
    id,
    type: 'number',
    label: 'Number',
    placeholder: '0',
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
        type="number"
        value={
          typeof value === 'number' || typeof value === 'string'
            ? String(value)
            : ''
        }
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        min={field.min}
        max={field.max}
        step={field.step}
        disabled={disabled}
        hasError={Boolean(error)}
      />
    </FieldFrame>
  ),
  renderInspector: ({ field, onChange }) => (
    <div className="space-y-4">
      <BaseInspectorSection field={field} onChange={onChange} />

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-200">
        <div className="space-y-1.5">
          <Label htmlFor={`insp_min_${field.id}`}>Min</Label>
          <Input
            id={`insp_min_${field.id}`}
            type="number"
            value={field.min ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onChange({
                ...field,
                min: raw === '' ? undefined : Number(raw),
              });
            }}
            placeholder="Any"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`insp_max_${field.id}`}>Max</Label>
          <Input
            id={`insp_max_${field.id}`}
            type="number"
            value={field.max ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onChange({
                ...field,
                max: raw === '' ? undefined : Number(raw),
              });
            }}
            placeholder="Any"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`insp_step_${field.id}`}>Step</Label>
          <Input
            id={`insp_step_${field.id}`}
            type="number"
            value={field.step ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onChange({
                ...field,
                step: raw === '' ? undefined : Number(raw),
              });
            }}
            placeholder="1"
          />
        </div>
      </div>
    </div>
  ),
};

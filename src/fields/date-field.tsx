import { Input, Label } from '../shared/ui';
import { BaseInspectorSection, FieldFrame } from './field-frame';
import type { FieldDefinition } from './types';

export const dateFieldDefinition: FieldDefinition<'date'> = {
  type: 'date',
  label: 'Date',
  description: 'ISO calendar date selector with optional min/max bounds.',
  badge: 'DAT',
  createDefaultConfig: (id) => ({
    id,
    type: 'date',
    label: 'Date',
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
        type="date"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        min={field.minDate}
        max={field.maxDate}
        disabled={disabled}
        hasError={Boolean(error)}
      />
    </FieldFrame>
  ),
  renderInspector: ({ field, onChange }) => (
    <div className="space-y-4">
      <BaseInspectorSection
        field={field}
        onChange={onChange}
        showPlaceholder={false}
      />

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200">
        <div className="space-y-1.5">
          <Label htmlFor={`insp_mindate_${field.id}`}>Earliest Date</Label>
          <Input
            id={`insp_mindate_${field.id}`}
            type="date"
            value={field.minDate ?? ''}
            onChange={(e) =>
              onChange({
                ...field,
                minDate: e.target.value || undefined,
              })
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`insp_maxdate_${field.id}`}>Latest Date</Label>
          <Input
            id={`insp_maxdate_${field.id}`}
            type="date"
            value={field.maxDate ?? ''}
            onChange={(e) =>
              onChange({
                ...field,
                maxDate: e.target.value || undefined,
              })
            }
          />
        </div>
      </div>
    </div>
  ),
};

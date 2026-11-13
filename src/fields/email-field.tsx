import { Input, Label, Switch } from '../shared/ui';
import { BaseInspectorSection, FieldFrame } from './field-frame';
import type { FieldDefinition } from './types';

export const emailFieldDefinition: FieldDefinition<'email'> = {
  type: 'email',
  label: 'Email',
  description: 'Email input with format and optional domain validation.',
  badge: 'EML',
  createDefaultConfig: (id) => ({
    id,
    type: 'email',
    label: 'Email',
    placeholder: '',
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
      <div className="space-y-2">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
          <Input
            id={field.id}
            type="email"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? ''}
            disabled={disabled}
            hasError={Boolean(error)}
            className="pl-8 pr-8"
          />
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-rose-500 text-white rounded-xs px-1 text-[9px] font-bold leading-tight select-none pointer-events-none"
            title="Autofill enabled"
          >
            •••
          </span>
        </div>

        {field.confirmEmail && (
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
            <Input
              id={`${field.id}_confirm`}
              type="email"
              placeholder="Confirm Email"
              disabled={disabled}
              className="pl-8"
            />
          </div>
        )}
      </div>
    </FieldFrame>
  ),
  renderInspector: ({ field, onChange }) => (
    <div className="space-y-4">
      <BaseInspectorSection field={field} onChange={onChange} />

      <div className="pt-2 border-t border-zinc-200">
        <Switch
          id={`insp_confirm_email_${field.id}`}
          checked={Boolean(field.confirmEmail)}
          onChange={(confirmEmail) => onChange({ ...field, confirmEmail })}
          label="Require Confirm Email input"
        />
      </div>

      <div className="space-y-1.5 pt-2 border-t border-zinc-200">
        <Label htmlFor={`insp_domains_${field.id}`}>
          Allowed Domains (comma-separated)
        </Label>
        <Input
          id={`insp_domains_${field.id}`}
          value={(field.allowedDomains ?? []).join(', ')}
          onChange={(e) => {
            const raw = e.target.value;
            const parsed = raw
              .split(',')
              .map((d) => d.trim())
              .filter(Boolean);
            onChange({
              ...field,
              allowedDomains: parsed.length > 0 ? parsed : undefined,
            });
          }}
          placeholder="e.g. company.com, enterprise.org"
          className="font-mono text-xs"
        />
      </div>
    </div>
  ),
};

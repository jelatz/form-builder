import { cn } from '../shared/lib';
import { Input, Label, Select, Switch } from '../shared/ui';
import { BaseInspectorSection, FieldFrame } from './field-frame';
import type { FieldDefinition } from './types';

export const nameFieldDefinition: FieldDefinition<'name'> = {
  type: 'name',
  label: 'Name',
  description: 'First and Last name pair with sublabels.',
  badge: 'NAM',
  createDefaultConfig: (id) => ({
    id,
    type: 'name',
    label: 'Name',
    firstNameLabel: 'First Name',
    lastNameLabel: 'Last Name',
    required: false,
  }),
  render: ({ field, value, onChange, error, disabled }) => {
    const parsed =
      typeof value === 'object' && value !== null
        ? (value as { firstName?: string; lastName?: string })
        : {
            firstName: typeof value === 'string' ? value : '',
            lastName: '',
          };
    const firstName = parsed.firstName ?? '';
    const lastName = parsed.lastName ?? '';

    return (
      <FieldFrame
        id={field.id}
        label={field.label}
        required={field.required}
        helperText={field.helperText}
        error={error}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
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
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
              <Input
                id={`${field.id}_first`}
                type="text"
                value={firstName}
                onChange={(e) =>
                  onChange({ ...parsed, firstName: e.target.value })
                }
                disabled={disabled}
                hasError={Boolean(error)}
                className="pl-8 pr-8"
              />
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-rose-500 text-white rounded-xs px-1 text-[9px] font-bold leading-tight select-none"
                title="Autofill enabled"
              >
                •••
              </span>
            </div>
            <span className="block text-[11px] text-zinc-500 mt-1">
              {field.firstNameLabel ?? 'First Name'}
            </span>
          </div>

          <div>
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
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
              <Input
                id={`${field.id}_last`}
                type="text"
                value={lastName}
                onChange={(e) =>
                  onChange({ ...parsed, lastName: e.target.value })
                }
                disabled={disabled}
                hasError={Boolean(error)}
                className="pl-8"
              />
            </div>
            <span className="block text-[11px] text-zinc-500 mt-1">
              {field.lastNameLabel ?? 'Last Name'}
            </span>
          </div>
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

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200">
        <div className="space-y-1.5">
          <Label htmlFor={`insp_fn_${field.id}`}>First Name Sublabel</Label>
          <Input
            id={`insp_fn_${field.id}`}
            value={field.firstNameLabel ?? ''}
            onChange={(e) =>
              onChange({
                ...field,
                firstNameLabel: e.target.value || undefined,
              })
            }
            placeholder="First Name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`insp_ln_${field.id}`}>Last Name Sublabel</Label>
          <Input
            id={`insp_ln_${field.id}`}
            value={field.lastNameLabel ?? ''}
            onChange={(e) =>
              onChange({
                ...field,
                lastNameLabel: e.target.value || undefined,
              })
            }
            placeholder="Last Name"
          />
        </div>
      </div>
    </div>
  ),
};

export const phoneFieldDefinition: FieldDefinition<'phone'> = {
  type: 'phone',
  label: 'Phone',
  description: 'Phone number input with country selector.',
  badge: 'TEL',
  createDefaultConfig: (id) => ({
    id,
    type: 'phone',
    label: 'Phone',
    defaultCountryCode: '+1',
    required: false,
  }),
  render: ({ field, value, onChange, error, disabled }) => {
    return (
      <FieldFrame
        id={field.id}
        label={field.label}
        required={field.required}
        helperText={field.helperText}
        error={error}
      >
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
              d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
            />
          </svg>
          <Input
            id={field.id}
            type="tel"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? ''}
            disabled={disabled}
            hasError={Boolean(error)}
            className="pl-8"
          />
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

      <div className="space-y-1.5 pt-2 border-t border-zinc-200">
        <Label htmlFor={`insp_cc_${field.id}`}>Default Country Code</Label>
        <Select
          id={`insp_cc_${field.id}`}
          menuHeading="Default Country Code"
          value={field.defaultCountryCode ?? '+1'}
          onValueChange={(nextCode) =>
            onChange({ ...field, defaultCountryCode: nextCode })
          }
          options={[
            { value: '+1', label: '🇺🇸 United States', meta: '+1' },
            { value: '+44', label: '🇬🇧 United Kingdom', meta: '+44' },
            { value: '+63', label: '🇵🇭 Philippines', meta: '+63' },
            { value: '+61', label: '🇦🇺 Australia', meta: '+61' },
            { value: '+49', label: '🇩🇪 Germany', meta: '+49' },
          ]}
        />
      </div>
    </div>
  ),
};

interface AddressValue {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export const addressFieldDefinition: FieldDefinition<'address'> = {
  type: 'address',
  label: 'Address',
  description: 'Physical address with street, city, state, and zip inputs.',
  badge: 'ADR',
  createDefaultConfig: (id) => ({
    id,
    type: 'address',
    label: 'Address',
    showCountry: true,
    required: false,
  }),
  render: ({ field, value, onChange, error, disabled }) => {
    const addr =
      typeof value === 'object' && value !== null
        ? (value as AddressValue)
        : {
            street: typeof value === 'string' ? value : '',
            city: '',
            state: '',
            zip: '',
            country: 'United States',
          };

    const updatePart = (part: Partial<AddressValue>) => {
      onChange({ ...addr, ...part });
    };

    return (
      <FieldFrame
        id={field.id}
        label={field.label}
        required={field.required}
        helperText={field.helperText}
        error={error}
      >
        <div className="space-y-2">
          <div>
            <Input
              id={`${field.id}_street`}
              type="text"
              value={addr.street ?? ''}
              onChange={(e) => updatePart({ street: e.target.value })}
              placeholder="123 Main Street"
              disabled={disabled}
              hasError={Boolean(error)}
            />
            <span className="block text-[11px] text-zinc-500 mt-1">
              Street Address
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                id={`${field.id}_city`}
                type="text"
                value={addr.city ?? ''}
                onChange={(e) => updatePart({ city: e.target.value })}
                placeholder="City"
                disabled={disabled}
                hasError={Boolean(error)}
              />
              <span className="block text-[11px] text-zinc-500 mt-1">
                City
              </span>
            </div>
            <div>
              <Input
                id={`${field.id}_state`}
                type="text"
                value={addr.state ?? ''}
                onChange={(e) => updatePart({ state: e.target.value })}
                placeholder="State / Province"
                disabled={disabled}
                hasError={Boolean(error)}
              />
              <span className="block text-[11px] text-zinc-500 mt-1">
                State / Province
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                id={`${field.id}_zip`}
                type="text"
                value={addr.zip ?? ''}
                onChange={(e) => updatePart({ zip: e.target.value })}
                placeholder="Postal / Zip Code"
                disabled={disabled}
                hasError={Boolean(error)}
              />
              <span className="block text-[11px] text-zinc-500 mt-1">
                Postal / Zip Code
              </span>
            </div>
            {field.showCountry !== false && (
              <div>
                <Input
                  id={`${field.id}_country`}
                  type="text"
                  value={addr.country ?? 'United States'}
                  onChange={(e) => updatePart({ country: e.target.value })}
                  placeholder="Country"
                  disabled={disabled}
                />
                <span className="block text-[11px] text-zinc-500 mt-1">
                  Country
                </span>
              </div>
            )}
          </div>
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
          id={`insp_country_${field.id}`}
          checked={field.showCountry !== false}
          onChange={(showCountry) => onChange({ ...field, showCountry })}
          label="Include Country input"
        />
      </div>
    </div>
  ),
};

export const textareaFieldDefinition: FieldDefinition<'textarea'> = {
  type: 'textarea',
  label: 'Multi Line',
  description: 'Multi-line text area for paragraphs, feedback, or notes.',
  badge: 'MLT',
  createDefaultConfig: (id) => ({
    id,
    type: 'textarea',
    label: 'Multi Line',
    placeholder: 'Enter notes or details...',
    rows: 3,
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
      <textarea
        id={field.id}
        rows={field.rows ?? 3}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 text-sm rounded-md bg-white text-zinc-900 placeholder:text-zinc-400 border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-600 disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed resize-y',
          error
            ? 'border-rose-500 focus-visible:ring-rose-500/30'
            : 'border-zinc-200 hover:border-zinc-300',
        )}
      />
    </FieldFrame>
  ),
  renderInspector: ({ field, onChange }) => (
    <div className="space-y-4">
      <BaseInspectorSection field={field} onChange={onChange} />

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200">
        <div className="space-y-1.5">
          <Label htmlFor={`insp_rows_${field.id}`}>Visible Rows</Label>
          <Input
            id={`insp_rows_${field.id}`}
            type="number"
            min={1}
            max={20}
            value={field.rows ?? 3}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onChange({
                ...field,
                rows: raw === '' ? undefined : Number(raw),
              });
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`insp_tamax_${field.id}`}>Max Length</Label>
          <Input
            id={`insp_tamax_${field.id}`}
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

export const websiteFieldDefinition: FieldDefinition<'website'> = {
  type: 'website',
  label: 'Website',
  description: 'Web URL input with validation and protocol prefix.',
  badge: 'URL',
  createDefaultConfig: (id) => ({
    id,
    type: 'website',
    label: 'Website',
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
            d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
          />
        </svg>
        <Input
          id={field.id}
          type="url"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''}
          disabled={disabled}
          hasError={Boolean(error)}
          className="pl-8"
        />
      </div>
    </FieldFrame>
  ),
  renderInspector: ({ field, onChange }) => (
    <div className="space-y-4">
      <BaseInspectorSection field={field} onChange={onChange} />
    </div>
  ),
};

export const currencyFieldDefinition: FieldDefinition<'currency'> = {
  type: 'currency',
  label: 'Currency',
  description: 'Monetary input with customizable currency prefix symbol.',
  badge: 'CUR',
  createDefaultConfig: (id) => ({
    id,
    type: 'currency',
    label: 'Currency',
    currencyCode: '$',
    placeholder: '0.00',
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
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-500 pointer-events-none select-none">
          {field.currencyCode ?? '$'}
        </span>
        <Input
          id={field.id}
          type="number"
          step="0.01"
          value={
            typeof value === 'number' || typeof value === 'string'
              ? String(value)
              : ''
          }
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? '0.00'}
          min={field.min}
          max={field.max}
          disabled={disabled}
          hasError={Boolean(error)}
          className="pl-7"
        />
      </div>
    </FieldFrame>
  ),
  renderInspector: ({ field, onChange }) => (
    <div className="space-y-4">
      <BaseInspectorSection field={field} onChange={onChange} />

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-200">
        <div className="space-y-1.5">
          <Label htmlFor={`insp_cur_sym_${field.id}`}>Symbol</Label>
          <Input
            id={`insp_cur_sym_${field.id}`}
            value={field.currencyCode ?? '$'}
            onChange={(e) =>
              onChange({
                ...field,
                currencyCode: e.target.value || '$',
              })
            }
            className="font-mono text-center"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`insp_cur_min_${field.id}`}>Min</Label>
          <Input
            id={`insp_cur_min_${field.id}`}
            type="number"
            value={field.min ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onChange({
                ...field,
                min: raw === '' ? undefined : Number(raw),
              });
            }}
            placeholder="0"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`insp_cur_max_${field.id}`}>Max</Label>
          <Input
            id={`insp_cur_max_${field.id}`}
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
      </div>
    </div>
  ),
};

export const sectionFieldDefinition: FieldDefinition<'section'> = {
  type: 'section',
  label: 'Section',
  description: 'Visual section divider with heading title and separator line.',
  badge: 'SEC',
  createDefaultConfig: (id) => ({
    id,
    type: 'section',
    label: 'Contact Information',
    helperText: '',
    required: false,
    showLine: true,
  }),
  render: ({ field }) => (
    <div className="space-y-1 py-1">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">{field.label}</h3>
      </div>
      {field.helperText && (
        <p className="text-xs text-zinc-500">{field.helperText}</p>
      )}
      {field.showLine && <hr className="border-t border-zinc-200 mt-2" />}
    </div>
  ),
  renderInspector: ({ field, onChange }) => (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`insp_sec_title_${field.id}`}>Section Title</Label>
        <Input
          id={`insp_sec_title_${field.id}`}
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder="Section title"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`insp_sec_desc_${field.id}`}>
          Subtitle / Description
        </Label>
        <Input
          id={`insp_sec_desc_${field.id}`}
          value={field.helperText ?? ''}
          onChange={(e) =>
            onChange({
              ...field,
              helperText: e.target.value || undefined,
            })
          }
          placeholder="Optional section description"
        />
      </div>

      <div className="pt-2 border-t border-zinc-200">
        <Switch
          id={`insp_sec_line_${field.id}`}
          checked={field.showLine !== false}
          onChange={(showLine) => onChange({ ...field, showLine })}
          label="Show horizontal divider line"
        />
      </div>
    </div>
  ),
};

export const gridFieldDefinition: FieldDefinition<'grid'> = {
  type: 'grid',
  label: 'Grid',
  description: 'Multi-column layout container for side-by-side fields.',
  badge: 'GRD',
  createDefaultConfig: (id) => ({
    id,
    type: 'grid',
    label: '2-Column Grid',
    required: false,
    columns: 2,
  }),
  render: ({ field }) => {
    const colCount = field.columns ?? 2;
    const colClass =
      colCount === 1
        ? 'grid-cols-1'
        : colCount === 3
          ? 'grid-cols-1 md:grid-cols-3'
          : 'grid-cols-1 md:grid-cols-2';

    return (
      <div
        className={cn(
          'rounded-md border border-zinc-200/90 bg-white grid divide-x divide-dashed divide-zinc-300',
          colClass,
        )}
      >
        {Array.from({ length: colCount }, (_, idx) => (
          <div
            key={idx}
            className="p-3.5 min-h-[160px] flex flex-col justify-center items-center"
          >
            <div className="w-full rounded-md border border-zinc-200/80 bg-[#f3f4f6] py-5 px-4 text-center text-xs font-medium text-zinc-700">
              Drag and drop fields here
            </div>
          </div>
        ))}
      </div>
    );
  },
  renderInspector: ({ field, onChange }) => {
    const setColumns = (cols: 1 | 2 | 3) => {
      const isDefaultLabel =
        field.label === '1-Column Grid' ||
        field.label === '2-Column Grid' ||
        field.label === '3-Column Grid' ||
        field.label === '1-Column' ||
        field.label === '2-Column' ||
        field.label === '3-Column';
      onChange({
        ...field,
        columns: cols,
        label: isDefaultLabel ? `${cols}-Column Grid` : field.label,
      });
    };

    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={`insp_grid_label_${field.id}`}>Grid Label</Label>
          <Input
            id={`insp_grid_label_${field.id}`}
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
            placeholder="Grid label"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Number of Columns</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {([1, 2, 3] as const).map((cols) => {
              const active = field.columns === cols;
              return (
                <button
                  key={cols}
                  type="button"
                  onClick={() => setColumns(cols)}
                  className={cn(
                    'h-8 text-xs font-medium rounded-md border transition-colors flex items-center justify-center gap-1.5',
                    active
                      ? 'bg-zinc-900 border-zinc-900 text-white shadow-xs'
                      : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900',
                  )}
                >
                  <span>{cols}</span>
                  <span className="text-[10px] opacity-75">
                    {cols === 1 ? 'Col' : 'Cols'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-200">
          <Switch
            id={`insp_grid_divider_${field.id}`}
            checked={Boolean(field.showDividerAbove)}
            onChange={(showDividerAbove) =>
              onChange({ ...field, showDividerAbove })
            }
            label="Show divider above grid"
          />
        </div>
      </div>
    );
  },
};

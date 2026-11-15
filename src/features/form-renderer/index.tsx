import { useState, type FormEvent } from 'react';
import {
  createInitialFormValues,
  validateField,
  validateForm,
  type FormErrors,
  type FormSchema,
  type FormValues,
} from '../../domain/form-schema';
import { bindFieldModule, FieldLayoutProvider } from '../../fields/registry';
import { Badge, Button } from '../../shared/ui';
import { cn } from '../../shared/lib';

export interface FormRendererProps {
  schema: FormSchema;
  publicMode?: boolean;
  tenantName?: string;
  onSubmitRecord?: (values: FormValues) => void | Promise<void>;
}

export function FormRenderer({
  schema,
  publicMode = false,
  tenantName,
  onSubmitRecord,
}: FormRendererProps) {
  const [values, setValues] = useState<FormValues>(() =>
    createInitialFormValues(schema),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submittedPayload, setSubmittedPayload] = useState<FormValues | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFieldChange = (fieldId: string, nextValue: unknown) => {
    const nextValues: FormValues = { ...values, [fieldId]: nextValue };
    setValues(nextValues);
    setSubmittedPayload(null);

    if (touched[fieldId] || errors[fieldId]) {
      const targetField = schema.fields.find((f) => f.id === fieldId);
      if (targetField) {
        const fieldError = validateField(targetField, nextValue);
        setErrors((prev) => {
          const updated = { ...prev };
          if (fieldError) {
            updated[fieldId] = fieldError;
          } else {
            delete updated[fieldId];
          }
          return updated;
        });
      }
    }
  };

  const handleReset = () => {
    setValues(createInitialFormValues(schema));
    setErrors({});
    setTouched({});
    setSubmittedPayload(null);
    setSubmitError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const allTouched: Record<string, boolean> = {};
    for (const field of schema.fields) {
      if (field.type === 'section' || field.type === 'grid') {
        continue;
      }
      allTouched[field.id] = true;
    }
    setTouched(allTouched);

    const validation = validateForm(schema, values);
    setErrors(validation.errors);
    setSubmitError(null);

    if (!validation.valid) {
      setSubmittedPayload(null);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitRecord?.(values);
      setSubmittedPayload(values);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to submit form.',
      );
      setSubmittedPayload(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const topLevelFields = schema.fields.filter((f) => !f.parentGridId);
  const errorCount = Object.keys(errors).length;

  return (
    <main
      aria-label="Live Form Runner"
      className="flex-1 overflow-y-auto py-8 px-4 bg-[#f4f5f7]"
    >
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Runner Status Bar */}
        <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-md px-4 py-2.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <Badge variant={publicMode ? 'neutral' : 'success'}>
              {publicMode ? (tenantName ?? 'PUBLIC FORM') : 'LIVE PREVIEW'}
            </Badge>
            <span className="font-mono text-xs text-zinc-500">
              /{schema.slug}
            </span>
          </div>
          <Button size="xs" variant="ghost" onClick={handleReset}>
            Reset Form
          </Button>
        </div>

        {/* Interactive Form Card */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          className="bg-white border border-zinc-200 rounded-md shadow-xs overflow-hidden"
        >
          <div className="text-center py-6 px-6 border-b border-zinc-200 space-y-1">
            <h1 className="text-xl font-semibold text-zinc-900">
              {schema.title || 'Untitled Form'}
            </h1>
            {schema.description && (
              <p className="text-xs text-zinc-500">{schema.description}</p>
            )}
          </div>

          {schema.fields.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">
              This form has no fields configured. Switch to Edit mode to add
              fields.
            </p>
          ) : (
            <div className="grid grid-cols-6 gap-x-6 divide-y divide-zinc-100 px-8 py-4">
              {topLevelFields.map((field) => {
                const isMultiColumn = (field.columnSpan ?? 1) > 1;
                const colSpanClass =
                  field.type === 'grid' ||
                  field.type === 'section' ||
                  (field.columnSpan ?? 1) === 1
                    ? 'col-span-6'
                    : field.columnSpan === 2
                      ? 'col-span-6 sm:col-span-3'
                      : field.columnSpan === 3
                        ? 'col-span-6 sm:col-span-2'
                        : 'col-span-6';

                if (field.type === 'grid') {
                  return (
                    <div key={field.id} className={cn('py-4', colSpanClass)}>
                      {field.showDividerAbove && (
                        <hr className="border-t border-zinc-200 mb-5" />
                      )}
                      <div className="rounded-md border border-zinc-200/90 bg-white overflow-hidden">
                        <div
                          className={cn(
                            'grid divide-y sm:divide-y-0 sm:divide-x divide-dashed divide-zinc-300',
                            field.columns === 1
                              ? 'grid-cols-1'
                              : field.columns === 2
                                ? 'grid-cols-1 sm:grid-cols-2'
                                : 'grid-cols-1 sm:grid-cols-3',
                          )}
                        >
                          {Array.from({ length: field.columns }, (_, i) => i as 0 | 1 | 2).map(
                            (colIdx) => {
                              const colFields = schema.fields.filter(
                                (f) =>
                                  f.parentGridId === field.id &&
                                  (f.gridColumn ?? 0) === colIdx,
                              );
                              return (
                                <div
                                  key={colIdx}
                                  className="p-4 flex flex-col gap-4 min-h-[120px]"
                                >
                                  <FieldLayoutProvider layout="stacked">
                                    {colFields.length === 0 ? (
                                      <div className="rounded-md border border-zinc-200/80 bg-zinc-50/70 px-4 py-5 text-center text-xs text-zinc-400">
                                        Empty column
                                      </div>
                                    ) : (
                                      colFields.map((childField) => {
                                        const childBound = bindFieldModule(childField);
                                        return (
                                          <div key={childField.id}>
                                            {childBound.renderRuntime({
                                              value: values[childField.id],
                                              onChange: (val) =>
                                                handleFieldChange(childField.id, val),
                                              error: errors[childField.id],
                                            })}
                                          </div>
                                        );
                                      })
                                    )}
                                  </FieldLayoutProvider>
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                const bound = bindFieldModule(field);
                return (
                  <div key={field.id} className={cn('py-4', colSpanClass)}>
                    {field.showDividerAbove && (
                      <hr className="border-t border-zinc-200 mb-5" />
                    )}
                    {isMultiColumn ? (
                      <FieldLayoutProvider layout="stacked">
                        {bound.renderRuntime({
                          value: values[field.id],
                          onChange: (val) => handleFieldChange(field.id, val),
                          error: errors[field.id],
                        })}
                      </FieldLayoutProvider>
                    ) : (
                      bound.renderRuntime({
                        value: values[field.id],
                        onChange: (val) => handleFieldChange(field.id, val),
                        error: errors[field.id],
                      })
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {errorCount > 0 && (
            <div className="px-8 pb-4">
              <div
                role="alert"
                className="px-3 py-2 rounded-md border border-rose-200 bg-rose-50 text-xs text-rose-700"
              >
                Please resolve {errorCount}{' '}
                {errorCount === 1 ? 'validation error' : 'validation errors'}{' '}
                before submitting.
              </div>
            </div>
          )}

          {submitError && (
            <div className="px-8 pb-4">
              <div
                role="alert"
                className="px-3 py-2 rounded-md border border-rose-200 bg-rose-50 text-xs text-rose-700"
              >
                {submitError}
              </div>
            </div>
          )}

          <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleReset}>
              Clear
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={schema.fields.length === 0 || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : schema.submitButtonText || 'Submit'}
            </Button>
          </div>
        </form>

        {/* Submitted Confirmation / Payload Preview */}
        {submittedPayload && (
          <section
            aria-label="Submitted Payload"
            className="p-4 rounded-md border border-emerald-200 bg-emerald-50/50 space-y-2 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <Badge variant="success">
                {publicMode ? 'SUBMISSION RECEIVED' : 'VALID SUBMISSION'}
              </Badge>
              <span className="font-mono text-xs text-zinc-500">
                {new Date().toISOString()}
              </span>
            </div>
            {publicMode ? (
              <p className="text-xs text-zinc-700">
                Thank you! Your response has been recorded.
              </p>
            ) : (
              <pre className="p-3 rounded-md bg-white border border-zinc-200 font-mono text-xs text-zinc-800 overflow-x-auto">
                {JSON.stringify(submittedPayload, null, 2)}
              </pre>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

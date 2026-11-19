import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  createInitialFormValues,
  partitionFieldsIntoSections,
  validateField,
  validateForm,
  validateSection,
  type FormErrors,
  type FormSchema,
  type FormValues,
} from '../../domain/form-schema';
import { bindFieldModule, FieldLayoutProvider } from '../../fields/registry';
import { cn } from '../../shared/lib';
import { Badge, Button } from '../../shared/ui';

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
  const mainRef = useRef<HTMLElement | null>(null);
  const [values, setValues] = useState<FormValues>(() =>
    createInitialFormValues(
      schema,
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : undefined,
    ),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [submittedPayload, setSubmittedPayload] = useState<FormValues | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sections = partitionFieldsIntoSections(schema.fields);
  const safeSectionIndex = Math.min(
    currentSectionIndex,
    Math.max(0, sections.length - 1),
  );
  const currentSection = sections[safeSectionIndex];
  const isFirstSection = safeSectionIndex === 0;
  const isLastSection = safeSectionIndex === sections.length - 1;
  const dataFieldCount = schema.fields.filter(
    (f) => f.type !== 'section' && f.type !== 'grid',
  ).length;

  const scrollToTop = () => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    setCurrentSectionIndex(0);
    setSubmittedPayload(null);
    setSubmitError(null);
    scrollToTop();
  };

  const handleNext = () => {
    if (!currentSection || isLastSection) return;

    const sectionTouched: Record<string, boolean> = {};
    for (const field of currentSection.allFields) {
      if (field.type === 'section' || field.type === 'grid') continue;
      sectionTouched[field.id] = true;
    }
    setTouched((prev) => ({ ...prev, ...sectionTouched }));

    const validation = validateSection(currentSection, values);
    setErrors((prev) => {
      const next = { ...prev };
      for (const field of currentSection.allFields) {
        delete next[field.id];
      }
      return { ...next, ...validation.errors };
    });
    setSubmitError(null);

    if (!validation.valid) {
      return;
    }

    setCurrentSectionIndex(safeSectionIndex + 1);
    scrollToTop();
  };

  const handlePrevious = () => {
    if (isFirstSection) return;
    setSubmitError(null);
    setCurrentSectionIndex(safeSectionIndex - 1);
    scrollToTop();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    // Pressing Enter inside a non-final section advances to the next section
    if (!isLastSection) {
      handleNext();
      return;
    }

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
      const firstInvalidSectionIndex = sections.findIndex((sec) =>
        sec.allFields.some((f) => Boolean(validation.errors[f.id])),
      );
      if (
        firstInvalidSectionIndex !== -1 &&
        firstInvalidSectionIndex !== safeSectionIndex
      ) {
        setCurrentSectionIndex(firstInvalidSectionIndex);
        scrollToTop();
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitRecord?.(values);
      setSubmittedPayload(values);
      if (typeof window !== 'undefined' && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'formbuilder:submitted',
            formId: schema.id,
            slug: schema.slug,
            values,
          },
          '*',
        );
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to submit form.',
      );
      setSubmittedPayload(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const rawRedirect = schema.redirectUrl?.trim();
  const redirectTarget =
    rawRedirect && /^https?:\/\//i.test(rawRedirect) ? rawRedirect : null;

  useEffect(() => {
    if (!publicMode || !submittedPayload || !redirectTarget) {
      return;
    }
    const timer = window.setTimeout(() => {
      window.location.assign(redirectTarget);
    }, 1500);
    return () => {
      window.clearTimeout(timer);
    };
  }, [publicMode, submittedPayload, redirectTarget]);

  const currentSectionErrorCount = currentSection
    ? currentSection.allFields.filter((f) => Boolean(errors[f.id])).length
    : 0;
  const progressPercent = Math.round(
    ((safeSectionIndex + 1) / sections.length) * 100,
  );

  return (
    <main
      ref={mainRef}
      aria-label="Live Form Runner"
      className="flex-1 overflow-y-auto py-8 px-4 bg-[#f4f5f7]"
    >
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Runner Status Bar (Preview Mode only) */}
        {!publicMode && (
          <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-md px-4 py-2.5 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="success">LIVE PREVIEW</Badge>
              <span className="text-xs text-zinc-600 truncate">
                {schema.title}
              </span>
              <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                · Section {safeSectionIndex + 1}/{sections.length}
              </span>
            </div>
            <Button size="xs" variant="ghost" onClick={handleReset}>
              Reset Preview
            </Button>
          </div>
        )}

        {publicMode && submittedPayload ? (
          <section
            aria-label="Submission Confirmed"
            className="bg-white border border-zinc-200 rounded-md shadow-xs p-8 text-center space-y-4"
          >
            {tenantName && (
              <p className="font-mono text-xs uppercase tracking-wider text-zinc-500">
                {tenantName}
              </p>
            )}
            <Badge variant="success">SUBMISSION RECEIVED</Badge>
            <h1 className="text-xl font-semibold text-zinc-900">
              {schema.thankYouTitle?.trim() || 'Thank you!'}
            </h1>
            <p className="text-xs text-zinc-600 max-w-md mx-auto">
              {schema.thankYouMessage?.trim() ? (
                schema.thankYouMessage
              ) : (
                <>
                  Your response for{' '}
                  <span className="font-medium text-zinc-900">
                    {schema.title}
                  </span>{' '}
                  has been recorded.
                </>
              )}
            </p>
            {redirectTarget && (
              <p className="text-xs text-emerald-700 font-medium">
                Redirecting you to{' '}
                <a
                  href={redirectTarget}
                  className="underline hover:text-emerald-800"
                >
                  {redirectTarget}
                </a>
                ...
              </p>
            )}
            <div className="pt-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleReset}
              >
                Submit another response
              </Button>
            </div>
          </section>
        ) : (
          <>
            {/* Interactive Form Card */}
            <form
              onSubmit={(e) => void handleSubmit(e)}
              noValidate
              className="bg-white border border-zinc-200 rounded-md shadow-xs overflow-hidden"
            >
              {/* Form Header */}
              <div className="text-center py-6 px-6 border-b border-zinc-200 space-y-1">
                {publicMode && tenantName && (
                  <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                    {tenantName}
                  </p>
                )}
                <h1 className="text-xl font-semibold text-zinc-900">
                  {schema.title || 'Untitled Form'}
                </h1>
                {schema.description && (
                  <p className="text-xs text-zinc-500">{schema.description}</p>
                )}
              </div>

              {/* Active Section Header & Step Progress */}
              {currentSection && (
                <div className="px-8 pt-5 pb-4 border-b border-zinc-100 bg-zinc-50/50 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                      Section {safeSectionIndex + 1} of {sections.length}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {sections.map((sec, idx) => (
                        <span
                          key={sec.id}
                          aria-label={`Section ${idx + 1}: ${sec.title}`}
                          className={cn(
                            'h-1.5 rounded-full transition-all duration-200',
                            idx === safeSectionIndex
                              ? 'w-5 bg-emerald-600'
                              : idx < safeSectionIndex
                                ? 'w-2 bg-emerald-400'
                                : 'w-2 bg-zinc-300',
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="h-1 w-full rounded-full bg-zinc-200/80 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-200"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="pt-1">
                    <h2 className="text-base font-semibold text-zinc-900">
                      {currentSection.title}
                    </h2>
                    {currentSection.description && (
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {currentSection.description}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Active Section Fields */}
              {dataFieldCount === 0 ? (
                <p className="text-xs text-zinc-500 py-8 text-center">
                  {publicMode
                    ? 'This form currently has no fields.'
                    : 'This form has no fields configured. Switch to Edit mode to add fields.'}
                </p>
              ) : currentSection && currentSection.topLevelFields.length === 0 ? (
                <p className="text-xs text-zinc-500 py-8 text-center">
                  No fields in {currentSection.title}.
                </p>
              ) : (
                <div className="grid grid-cols-6 gap-x-6 divide-y divide-zinc-100 px-8 py-4">
                  {currentSection?.topLevelFields.map((field) => {
                    const isMultiColumn = (field.columnSpan ?? 1) > 1;
                    const colSpanClass =
                      field.type === 'grid' ||
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
                              {Array.from(
                                { length: field.columns },
                                (_, i) => i as 0 | 1 | 2,
                              ).map((colIdx) => {
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
                                        publicMode ? null : (
                                          <div className="rounded-md border border-zinc-200/80 bg-zinc-50/70 px-4 py-5 text-center text-xs text-zinc-400">
                                            Empty column
                                          </div>
                                        )
                                      ) : (
                                        colFields.map((childField) => {
                                          const childBound =
                                            bindFieldModule(childField);
                                          return (
                                            <div key={childField.id}>
                                              {childBound.renderRuntime({
                                                value: values[childField.id],
                                                onChange: (val) =>
                                                  handleFieldChange(
                                                    childField.id,
                                                    val,
                                                  ),
                                                error: errors[childField.id],
                                              })}
                                            </div>
                                          );
                                        })
                                      )}
                                    </FieldLayoutProvider>
                                  </div>
                                );
                              })}
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
                              onChange: (val) =>
                                handleFieldChange(field.id, val),
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

              {currentSectionErrorCount > 0 && (
                <div className="px-8 pb-4">
                  <div
                    role="alert"
                    className="px-3 py-2 rounded-md border border-rose-200 bg-rose-50 text-xs text-rose-700"
                  >
                    Please resolve {currentSectionErrorCount}{' '}
                    {currentSectionErrorCount === 1
                      ? 'validation error'
                      : 'validation errors'}{' '}
                    {isLastSection
                      ? 'before submitting.'
                      : 'before continuing to the next section.'}
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

              {/* Paginated Section Footer */}
              <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleReset}
                  >
                    Clear
                  </Button>
                  {!isFirstSection && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handlePrevious}
                    >
                      Previous
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isLastSection ? (
                    <Button
                      key="btn-next-section"
                      type="button"
                      variant="primary"
                      onClick={(e) => {
                        e.preventDefault();
                        handleNext();
                      }}
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      key="btn-submit-form"
                      type="submit"
                      variant="primary"
                      disabled={dataFieldCount === 0 || isSubmitting}
                    >
                      {isSubmitting
                        ? 'Submitting...'
                        : schema.submitButtonText || 'Submit'}
                    </Button>
                  )}
                </div>
              </div>
            </form>

            {/* Submitted Confirmation / Payload Preview (Preview Mode) */}
            {!publicMode && submittedPayload && (
              <section
                aria-label="Submitted Payload"
                className="p-4 rounded-md border border-emerald-200 bg-emerald-50/50 space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="success">VALID SUBMISSION</Badge>
                  <span className="font-mono text-xs text-zinc-500">
                    {new Date().toISOString()}
                  </span>
                </div>
                <pre className="p-3 rounded-md bg-white border border-zinc-200 font-mono text-xs text-zinc-800 overflow-x-auto">
                  {JSON.stringify(submittedPayload, null, 2)}
                </pre>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

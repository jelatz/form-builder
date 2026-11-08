import { useMemo, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type {
  ClientTenant,
  FieldColSpan,
  FormErrors,
  FormSchema,
  FormValues,
  SubmissionRecord,
} from '../../domain/form-schema/index.ts';
import {
  createDefaultFormValues,
  isFieldVisible,
  validateFieldValue,
  validateFormValues,
} from '../../domain/form-schema/index.ts';
import { renderFieldInput } from '../../fields/index.ts';
import { cn } from '../../shared/lib/cn.ts';
import { Badge } from '../../shared/ui/badge.tsx';
import { Button } from '../../shared/ui/button.tsx';

const COL_SPAN_CLASSES: Record<FieldColSpan, string> = {
  12: 'col-span-1 md:col-span-12',
  8: 'col-span-1 md:col-span-8',
  6: 'col-span-1 md:col-span-6',
  4: 'col-span-1 md:col-span-4',
};

export interface PublicFormRunnerProps {
  client: ClientTenant;
  schema: FormSchema;
  embedMode?: boolean;
  onToggleEmbedMode?: (embed: boolean) => void;
  onExitPublicView: () => void;
  onSubmitPublicForm: (
    values: FormValues,
    urlParams: Record<string, string>,
  ) => SubmissionRecord | null;
}

function parseBrowserQueryParams(): Record<string, string> {
  const params: Record<string, string> = {};
  if (typeof window === 'undefined') return params;

  try {
    const search = window.location.search;
    if (search && search.length > 1) {
      const sp = new URLSearchParams(search);
      sp.forEach((val, key) => {
        params[key] = val;
      });
    }
  } catch {
    // Graceful fallback if URLSearchParams is restricted
  }

  // If no search params are present in the current URL, merge sample UTM campaign params
  if (Object.keys(params).length === 0) {
    params['utm_source'] = 'google-cpc';
    params['utm_medium'] = 'cpc';
    params['utm_campaign'] = 'direct_intake_q4';
    params['utm_content'] = 'hero_landing';
  }

  return params;
}

function computeRedirectUrl(
  rawUrl: string,
  appendParams: boolean,
  customDomain: string,
  urlParams: Record<string, string>,
  values: FormValues,
): string {
  if (!rawUrl) return '';
  if (!appendParams) return rawUrl;

  try {
    const base = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      ? undefined
      : `https://${customDomain}`;
    const urlObj = new URL(rawUrl, base);

    // Append captured URL parameters
    Object.entries(urlParams).forEach(([k, v]) => {
      if (v) urlObj.searchParams.set(k, v);
    });

    // Append non-empty form values
    Object.entries(values).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== false && v !== '') {
        urlObj.searchParams.set(k, String(v));
      }
    });

    return urlObj.toString();
  } catch {
    const queryPairs: string[] = [];
    Object.entries(urlParams).forEach(([k, v]) => {
      if (v) queryPairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    });
    Object.entries(values).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== false && v !== '') {
        queryPairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
      }
    });
    if (queryPairs.length === 0) return rawUrl;
    const sep = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${sep}${queryPairs.join('&')}`;
  }
}

export function PublicFormRunner({
  client,
  schema,
  embedMode = false,
  onToggleEmbedMode,
  onExitPublicView,
  onSubmitPublicForm,
}: PublicFormRunnerProps): ReactElement {
  const [internalEmbedMode, setInternalEmbedMode] = useState<boolean>(embedMode);
  const activeEmbedMode = onToggleEmbedMode ? embedMode : internalEmbedMode;

  const [urlParams] = useState<Record<string, string>>(parseBrowserQueryParams);
  const [values, setValues] = useState<FormValues>(() =>
    createDefaultFormValues(schema, urlParams),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [, setSubmissionRecord] = useState<SubmissionRecord | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

  // Filter visible fields; hidden fields remain in `values` for submission
  const visibleFields = useMemo(
    () => schema.fields.filter((field) => isFieldVisible(field, values) && field.type !== 'hidden'),
    [schema.fields, values],
  );

  const settings = schema.settings ?? {
    submitButtonText: 'Submit Request',
    actionType: 'message',
    successTitle: 'Thank you!',
    successMessage: 'Your submission has been received and logged.',
  };

  const targetRedirectUrl = computeRedirectUrl(
    settings.redirectUrl ?? '',
    Boolean(settings.appendParamsToRedirect),
    schema.customDomain,
    urlParams,
    values,
  );

  const embedSnippet = `<iframe\n  src="https://${schema.customDomain || 'forms.client.com'}/${schema.slug || 'intake'}?embed=1"\n  width="100%"\n  height="700"\n  frameborder="0"\n  style="border:none;max-width:100%;"\n></iframe>`;

  const handleToggleMode = (nextEmbed: boolean): void => {
    setInternalEmbedMode(nextEmbed);
    onToggleEmbedMode?.(nextEmbed);
  };

  const handleFieldChange = (fieldId: string, nextValue: string | boolean): void => {
    setValues((prev) => ({
      ...prev,
      [fieldId]: nextValue,
    }));

    if (errors[fieldId]) {
      const field = schema.fields.find((f) => f.id === fieldId);
      if (field) {
        const fieldError = validateFieldValue(field, nextValue);
        setErrors((prev) => {
          const nextErrors = { ...prev };
          if (fieldError) {
            nextErrors[fieldId] = fieldError;
          } else {
            delete nextErrors[fieldId];
          }
          return nextErrors;
        });
      }
    }
  };

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const result = validateFormValues(schema, values);
    if (!result.isValid) {
      setErrors(result.errors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    setTimeout(() => {
      const record = onSubmitPublicForm(values, urlParams);
      setSubmissionRecord(record);
      setIsSubmitted(true);
      setIsSubmitting(false);
    }, 250);
  };

  const handleReset = (): void => {
    setValues(createDefaultFormValues(schema, urlParams));
    setErrors({});
    setIsSubmitted(false);
    setSubmissionRecord(null);
  };

  const handleCopySnippet = (): void => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(embedSnippet).then(() => {
        setCopiedSnippet(true);
        setTimeout(() => setCopiedSnippet(false), 2000);
      });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100/70 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased flex flex-col">
      {/* 1. Friendly Customer View Preview Control Bar */}
      <aside
        aria-label="Customer View Preview Controls"
        className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-3 py-2.5 sm:px-6 shadow-xs w-full min-w-0"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs min-w-0 w-full">
          {/* Back to Form Editor Button & Friendly Preview Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onExitPublicView}
              className="gap-1.5 touch-manipulation"
            >
              <span>&larr; Back to Form Editor</span>
            </Button>

            <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">|</span>

            <div className="hidden sm:flex items-center gap-2">
              <Badge variant="default" className="gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Customer View Preview
              </Badge>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden lg:inline">
                This is how your customers will see and fill out your form
              </span>
            </div>
          </div>

          {/* Mode Switcher: Full Page View vs Website Embed View */}
          <nav
            aria-label="Preview display mode"
            className="inline-flex p-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shrink-0"
          >
            <button
              type="button"
              onClick={() => handleToggleMode(false)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-all touch-manipulation',
                !activeEmbedMode
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
              )}
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
              </svg>
              <span>Full Page View</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleMode(true)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-all touch-manipulation',
                activeEmbedMode
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
              )}
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
              <span>Website Embed View</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* 2. Public Form Experience Container */}
      <main className="flex-1 flex flex-col justify-start items-center p-3.5 sm:p-8 w-full max-w-full overflow-x-hidden">
        {/* MODE A: FULL PAGE VIEW */}
        {!activeEmbedMode ? (
          <div className="w-full max-w-xl space-y-4 my-3 sm:my-8 min-w-0">
            {/* Simulated Browser URL Bar */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 sm:p-2.5 shadow-sm flex items-center gap-2 text-xs text-zinc-500 font-mono min-w-0 max-w-full overflow-hidden">
              <div className="hidden sm:flex items-center gap-1.5 pr-2 shrink-0">
                <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden flex items-center gap-1 rounded-md bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 truncate">
                <span className="text-emerald-600 dark:text-emerald-400 select-none shrink-0">https://</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{schema.customDomain}</span>
                <span className="text-zinc-400 dark:text-zinc-500 shrink-0">/{schema.slug}</span>
                {Object.keys(urlParams).length > 0 && (
                  <span className="text-zinc-500 select-all truncate">
                    ?{new URLSearchParams(urlParams).toString()}
                  </span>
                )}
              </div>
            </div>

            {/* Public Form Card */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 md:p-8 shadow-sm text-zinc-900 dark:text-zinc-100 min-w-0 max-w-full">
              {!isSubmitted ? (
                <>
                  {/* Public Form Title & Description */}
                  <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {client.name}
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
                      {schema.title || 'Untitled Form'}
                    </h1>
                    {schema.description && (
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {schema.description}
                      </p>
                    )}
                  </div>

                  {/* Public Inputs */}
                  {visibleFields.length === 0 ? (
                    <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No fields available to fill out at this time.
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-x-5 gap-y-5">
                        {visibleFields.map((field) => {
                          const colSpanClass = COL_SPAN_CLASSES[field.colSpan ?? 12];

                          if (field.type === 'section') {
                            return (
                              <div key={field.id} className={cn(colSpanClass, 'min-w-0')}>
                                {renderFieldInput({
                                  field,
                                  value: undefined,
                                  onChange: () => {},
                                })}
                              </div>
                            );
                          }

                          const error = errors[field.id];
                          return (
                            <div key={field.id} className={cn(colSpanClass, 'space-y-1.5 min-w-0')}>
                              <label
                                htmlFor={field.id}
                                className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
                              >
                                {field.label}
                                {field.required && (
                                  <span className="ml-1 text-rose-500 font-semibold" title="Required">
                                    *
                                  </span>
                                )}
                              </label>

                              {field.helperText && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">{field.helperText}</p>
                              )}

                              <div>
                                {renderFieldInput({
                                  field,
                                  value: values[field.id],
                                  onChange: (val) => handleFieldChange(field.id, val),
                                  error,
                                })}
                              </div>

                              {error && (
                                <p className="text-xs font-normal text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1.5">
                                  <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                  </svg>
                                  <span>{error}</span>
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Submit Button */}
                      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 flex items-center justify-end">
                        <Button
                          type="submit"
                          variant="primary"
                          isLoading={isSubmitting}
                          className="w-full sm:w-auto"
                        >
                          {settings.submitButtonText || 'Submit Request'}
                        </Button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                /* Customer Success Outcome */
                <div className="py-6">
                  {settings.actionType === 'redirect' ? (
                    <div className="text-center space-y-4">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold text-xl">
                        &rarr;
                      </div>
                      <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
                        Redirecting to Destination...
                      </h2>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
                        Your response has been saved. You are being redirected to:
                      </p>
                      <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 font-mono text-xs text-zinc-900 dark:text-zinc-100 break-all">
                        {targetRedirectUrl || 'https://client.com/thank-you'}
                      </div>
                      <div className="pt-4 flex items-center justify-center gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleReset}
                        >
                          Submit Another Response
                        </Button>
                        {targetRedirectUrl && (
                          <a
                            href={targetRedirectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium rounded-md text-white bg-zinc-900 hover:bg-zinc-800 dark:text-zinc-950 dark:bg-zinc-100 dark:hover:bg-zinc-200 transition"
                          >
                            Proceed to URL &rarr;
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-emerald-700 bg-emerald-100 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/60 dark:border-emerald-800">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
                        {settings.successTitle || 'Thank You!'}
                      </h2>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                        {settings.successMessage || 'Your response has been recorded and safely delivered.'}
                      </p>
                      <div className="pt-4">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleReset}
                        >
                          Submit Another Response
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Subtle, Reassuring Customer-Facing Footer */}
            <footer className="text-center py-3">
              <div className="inline-flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                <svg className="h-3.5 w-3.5 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
                <span>Powered by Secure Form Studio &bull; SSL Encrypted</span>
              </div>
            </footer>
          </div>
        ) : (
          /* MODE B: WEBSITE EMBED VIEW */
          <div className="w-full max-w-3xl space-y-6 my-3 sm:my-8 min-w-0">
            {/* Host Website Simulation Frame */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
              {/* Mock Host Header */}
              <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    Website Embed Preview:
                  </span>
                  <span className="rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-full">
                    https://{client.primaryDomain}/contact
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopySnippet}
                  >
                    {copiedSnippet ? '✓ Copied Embed Code!' : 'Copy Embed Code'}
                  </Button>
                </div>
              </div>

              {/* Host Website Page Simulation Body */}
              <div className="p-3.5 sm:p-10 bg-zinc-50/50 dark:bg-zinc-950/50">
                <div className="max-w-xl mx-auto space-y-6">
                  {/* Host Section Header */}
                  <div className="text-center space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Contact Us
                    </span>
                    <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                      Get in Touch with {client.name}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Preview how this form looks embedded seamlessly into your website pages.
                    </p>
                  </div>

                  {/* Embedded Iframe Container */}
                  <div className="relative rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 sm:p-6 md:p-8 shadow-sm text-zinc-900 dark:text-zinc-100 min-w-0 max-w-full">
                    <div className="absolute -top-3 right-4 rounded-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 px-2 py-0.5 text-[10px] font-mono font-medium uppercase shadow-xs">
                      Website Embed
                    </div>

                    {!isSubmitted ? (
                      <form onSubmit={handleSubmit} noValidate className="space-y-5">
                        <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                            {schema.title}
                          </h3>
                          {schema.description && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                              {schema.description}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-x-5 gap-y-5">
                          {visibleFields.map((field) => {
                            const colSpanClass = COL_SPAN_CLASSES[field.colSpan ?? 12];

                            if (field.type === 'section') {
                              return (
                                <div key={field.id} className={cn(colSpanClass, 'min-w-0')}>
                                  {renderFieldInput({
                                    field: { ...field, id: `embed-${field.id}` },
                                    value: undefined,
                                    onChange: () => {},
                                  })}
                                </div>
                              );
                            }

                            const error = errors[field.id];
                            return (
                              <div key={field.id} className={cn(colSpanClass, 'space-y-1 min-w-0')}>
                                <label
                                  htmlFor={`embed-${field.id}`}
                                  className="block text-xs font-medium text-zinc-900 dark:text-zinc-100"
                                >
                                  {field.label}
                                  {field.required && (
                                    <span className="ml-1 text-rose-500 font-semibold">*</span>
                                  )}
                                </label>

                                {field.helperText && (
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{field.helperText}</p>
                                )}

                                <div>
                                  {renderFieldInput({
                                    field: { ...field, id: `embed-${field.id}` },
                                    value: values[field.id],
                                    onChange: (val) => handleFieldChange(field.id, val),
                                    error,
                                  })}
                                </div>

                                {error && (
                                  <p className="text-[11px] font-normal text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                    <span>&#9888;</span>
                                    <span>{error}</span>
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="pt-3">
                          <Button
                            type="submit"
                            variant="primary"
                            isLoading={isSubmitting}
                            className="w-full"
                          >
                            {settings.submitButtonText || 'Submit Form'}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="py-8 text-center space-y-3">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-emerald-700 bg-emerald-100 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/60 dark:border-emerald-800">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                          {settings.successTitle || 'Thank You!'}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                          {settings.successMessage || 'Your response has been received.'}
                        </p>
                        <div className="pt-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={handleReset}
                          >
                            Reset Form
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Subtle, Reassuring Customer-Facing Footer */}
            <footer className="text-center py-3">
              <div className="inline-flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                <svg className="h-3.5 w-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
                <span>Powered by Secure Form Studio &bull; SSL Encrypted</span>
              </div>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}

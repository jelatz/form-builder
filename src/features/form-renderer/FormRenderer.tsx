import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type {
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

export interface FormRendererProps {
  schema: FormSchema;
  clientName?: string;
  onRecordSubmission?: (
    values: FormValues,
    urlParams: Record<string, string>,
  ) => SubmissionRecord | null;
}

function parseQueryString(qs: string): Record<string, string> {
  const params: Record<string, string> = {};
  const cleaned = qs.startsWith('?') ? qs.slice(1) : qs;
  if (!cleaned.trim()) return params;
  try {
    const searchParams = new URLSearchParams(cleaned);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  } catch {
    cleaned.split('&').forEach((part) => {
      const [k, v] = part.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
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

    // Append URL params
    Object.entries(urlParams).forEach(([k, v]) => {
      if (v) urlObj.searchParams.set(k, v);
    });

    // Append form values
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

const DEFAULT_QUERY_STRING =
  'utm_source=linkedin&utm_campaign=q4_automation&gclid=EAIaIQobChMI';

export function FormRenderer({
  schema,
  clientName,
  onRecordSubmission,
}: FormRendererProps): ReactElement {
  const [prevSchema, setPrevSchema] = useState<FormSchema>(schema);
  const [queryString, setQueryString] = useState<string>(DEFAULT_QUERY_STRING);
  const [urlParams, setUrlParams] = useState<Record<string, string>>(() =>
    parseQueryString(DEFAULT_QUERY_STRING),
  );
  const [values, setValues] = useState<FormValues>(() =>
    createDefaultFormValues(schema, parseQueryString(DEFAULT_QUERY_STRING)),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [submittedValues, setSubmittedValues] = useState<FormValues | null>(null);
  const [recordedSubmission, setRecordedSubmission] = useState<SubmissionRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync state during render when schema reference changes (React 19 pattern)
  if (schema !== prevSchema) {
    setPrevSchema(schema);
    const parsed = parseQueryString(queryString);
    setUrlParams(parsed);
    setValues(createDefaultFormValues(schema, parsed));
    setErrors({});
    setSubmittedValues(null);
    setRecordedSubmission(null);
  }

  const handleQueryStringChange = (nextQuery: string): void => {
    setQueryString(nextQuery);
    const nextParams = parseQueryString(nextQuery);
    setUrlParams(nextParams);

    // Sync any hidden fields whose URL param changed
    setValues((prev) => {
      const updated = { ...prev };
      for (const field of schema.fields) {
        if (field.type === 'hidden') {
          updated[field.id] = nextParams[field.urlParamKey] ?? field.defaultValue ?? '';
        }
      }
      return updated;
    });
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
      setSubmittedValues(null);
      setRecordedSubmission(null);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    // Brief tactile transition
    setTimeout(() => {
      setSubmittedValues(values);
      const submission = onRecordSubmission?.(values, urlParams) ?? null;
      setRecordedSubmission(submission);
      setIsSubmitting(false);
    }, 250);
  };

  const handleReset = (): void => {
    const currentParams = parseQueryString(queryString);
    setValues(createDefaultFormValues(schema, currentParams));
    setErrors({});
    setSubmittedValues(null);
    setRecordedSubmission(null);
  };

  const visibleFields = schema.fields.filter((field) => isFieldVisible(field, values));
  const settings = schema.settings ?? {
    submitButtonText: 'Submit Request',
    actionType: 'message',
    successTitle: 'Thank you!',
    successMessage: 'Your response has been recorded and routed to our team.',
  };

  const targetRedirectUrl = computeRedirectUrl(
    settings.redirectUrl ?? '',
    Boolean(settings.appendParamsToRedirect),
    schema.customDomain,
    urlParams,
    submittedValues ?? values,
  );

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden space-y-6">
      {/* Marketing Link & Ad Tracking Test (Optional Collapsible Disclosure) */}
      <details className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <summary className="flex items-center justify-between p-3.5 sm:px-4 cursor-pointer select-none text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors list-none">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
              URL
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              Marketing Link &amp; Ad Tracking Test (Optional)
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="success" className="gap-1 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {clientName || schema.clientId || 'Client Tenant'}
            </Badge>
            <svg
              className="h-4 w-4 text-zinc-400 transition-transform duration-200 group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </summary>

        <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-950/40">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-xs focus-within:border-zinc-950 dark:focus-within:border-zinc-300 focus-within:ring-1 focus-within:ring-zinc-950 dark:focus-within:ring-zinc-300 transition-colors">
            <div className="flex items-center px-3 py-2 bg-zinc-100/70 dark:bg-zinc-900 border-b sm:border-b-0 sm:border-r border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-600 dark:text-zinc-400 select-none min-w-0 max-w-full overflow-hidden truncate shrink-0 sm:shrink">
              <span className="text-zinc-400 dark:text-zinc-500 shrink-0">https://</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{schema.customDomain || 'forms.client.com'}</span>
              <span className="text-zinc-400 dark:text-zinc-500 truncate">/{schema.slug || 'form'}?</span>
            </div>
            <input
              id="simulated-utm-query"
              type="text"
              value={queryString}
              onChange={(e) => handleQueryStringChange(e.target.value)}
              placeholder="utm_source=linkedin&utm_campaign=q4&gclid=123"
              className="flex-1 bg-transparent px-3 py-2 font-mono text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none min-w-0"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>
              Edit query parameters above to test live URL capture into{' '}
              <strong className="font-semibold text-zinc-700 dark:text-zinc-300">Hidden UTM / Param</strong> fields.
            </span>
            {Object.keys(urlParams).length > 0 && (
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                {Object.keys(urlParams).length} param{Object.keys(urlParams).length === 1 ? '' : 's'} parsed
              </span>
            )}
          </div>
        </div>
      </details>

      {/* Main Form or Submission Result */}
      {!submittedValues ? (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 md:p-8 shadow-sm">
          {/* Form Title & Description Header */}
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
              {schema.title || 'Untitled Form'}
            </h2>
            {schema.description && (
              <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {schema.description}
              </p>
            )}
          </div>

          {schema.fields.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                This form does not have any fields configured yet.
              </p>
            </div>
          ) : visibleFields.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No fields are currently visible based on conditional display rules.
              </p>
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
                      <div className="flex items-center justify-between">
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
                        {field.type === 'hidden' && field.crmFieldKey && (
                          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                            {field.crmFieldKey}
                          </span>
                        )}
                      </div>

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
                          <svg
                            className="h-3.5 w-3.5 shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>{error}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Form Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-5">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleReset}
                  className="w-full sm:w-auto"
                >
                  Reset Form
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  className="w-full sm:w-auto"
                >
                  {settings.submitButtonText || 'Submit Response'}
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* Submitted Outcome Screen */
        <div className="space-y-6">
          {settings.actionType === 'redirect' ? (
            /* Redirect Triggered Banner */
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 md:p-8 shadow-sm space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold text-base">
                  &rarr;
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Simulated Redirect Triggered
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    In production runtime, the user is forwarded immediately to the destination below:
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Target Destination URL
                </div>
                <div className="break-all rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 font-mono text-xs text-zinc-900 dark:text-zinc-100 shadow-sm">
                  {targetRedirectUrl || 'https://client.com/thank-you'}
                </div>
                {settings.appendParamsToRedirect && (
                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    &#10003; Form responses &amp; URL UTM parameters were successfully encoded and appended.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Thank-You Screen */
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 sm:p-6 md:p-8 text-center space-y-4 shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-emerald-700 bg-emerald-100 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/60 dark:border-emerald-800">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
                  {settings.successTitle || 'Thank you!'}
                </h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                  {settings.successMessage || 'Your response has been recorded and routed.'}
                </p>
              </div>
              <div className="pt-2">
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

          {/* Collapsible Delivery & Technical Details */}
          <details className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
            <summary className="flex items-center justify-between p-4 cursor-pointer select-none text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors list-none">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
                  CRM
                </span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  View Connected App Delivery &amp; Technical Details
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                  Tenant: {schema.clientId}
                </span>
                <svg
                  className="h-4 w-4 text-zinc-400 transition-transform duration-200 group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </summary>

            <div className="border-t border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-4 bg-zinc-50/30 dark:bg-zinc-950/30">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    CRM Store-and-Forward Delivery Receipt
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Live delivery status across configured destinations
                  </p>
                </div>
                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 sm:hidden">
                  Tenant: {schema.clientId}
                </span>
              </div>

              {recordedSubmission && recordedSubmission.deliveryLogs.length > 0 ? (
                <div className="space-y-3">
                  {recordedSubmission.deliveryLogs.map((log) => (
                    <div
                      key={log.integrationId}
                      className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-4 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {log.integrationName}
                          </span>
                          <span className="rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-600 dark:text-zinc-400">
                            {log.provider}
                          </span>
                        </div>
                        <Badge variant={log.status === 'delivered' ? 'success' : 'destructive'}>
                          {log.status === 'delivered' ? `Delivered (${log.statusCode})` : `Failed (${log.statusCode})`}
                        </Badge>
                      </div>

                      <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">{log.responseMessage}</p>

                      <div>
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                          Dispatched Payload Preview:
                        </span>
                        <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-100">
                          {log.payloadPreview}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              ) : schema.integrations && schema.integrations.length > 0 ? (
                <div className="space-y-3">
                  {schema.integrations.map((integration) => (
                    <div
                      key={integration.id}
                      className="flex items-center justify-between rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {integration.name}
                          </span>
                          <span className="rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-600 dark:text-zinc-400">
                            {integration.provider}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                          {integration.endpointUrl}
                        </span>
                      </div>
                      <Badge variant="success">
                        Forward Queued
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/30 p-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  No third-party integrations configured. Form response was stored in D1 submissions.
                </div>
              )}

              {/* Captured Form Values Preview */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Captured Form Values:
                </span>
                <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-100">
                  {JSON.stringify(submittedValues, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleReset}
                >
                  Submit Another Response
                </Button>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

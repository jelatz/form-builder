import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type {
  ClientTenant,
  FormSchema,
  SubmissionRecord,
} from '../../domain/form-schema/index.ts';
import { cn } from '../../shared/lib/cn.ts';
import { Badge } from '../../shared/ui/badge.tsx';
import { Button } from '../../shared/ui/button.tsx';

export interface SubmissionsLedgerProps {
  client: ClientTenant;
  forms: FormSchema[];
  submissions: SubmissionRecord[];
  onRetrySubmission: (submissionId: string) => void;
  onClearSubmissions: () => void;
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatFallbackLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function SubmissionsLedger({
  client,
  forms,
  submissions,
  onRetrySubmission,
  onClearSubmissions,
}: SubmissionsLedgerProps): ReactElement {
  const [selectedFormId, setSelectedFormId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'failed'>('all');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (!showClearConfirm) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setShowClearConfirm(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showClearConfirm]);

  // Client isolation: filter strictly by client.id
  const clientSubmissions = submissions.filter((sub) => sub.clientId === client.id);

  // Build human question label lookup map from forms schema
  const fieldLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const form of forms) {
      for (const field of form.fields) {
        if (field.label) {
          map.set(field.id, field.label);
          if (field.crmFieldKey) {
            map.set(field.crmFieldKey, field.label);
          }
        }
      }
    }
    return map;
  }, [forms]);

  const getReadableFieldLabel = (key: string): string => {
    return fieldLabelMap.get(key) || formatFallbackLabel(key);
  };

  // Compute metrics across client's submissions
  const totalSubmissions = clientSubmissions.length;

  let totalDeliveries = 0;
  let deliveredCount = 0;
  let failedCount = 0;

  for (const sub of clientSubmissions) {
    for (const log of sub.deliveryLogs) {
      totalDeliveries++;
      if (log.status === 'delivered') {
        deliveredCount++;
      } else if (log.status === 'failed') {
        failedCount++;
      }
    }
  }

  const successRate =
    totalDeliveries > 0 ? Math.round((deliveredCount / totalDeliveries) * 100) : 100;

  // Filter submissions by form & delivery status
  const filteredSubmissions = clientSubmissions.filter((sub) => {
    if (selectedFormId !== 'all' && sub.formId !== selectedFormId) {
      return false;
    }
    if (statusFilter === 'delivered') {
      return sub.deliveryLogs.some((l) => l.status === 'delivered');
    }
    if (statusFilter === 'failed') {
      return sub.deliveryLogs.some((l) => l.status === 'failed');
    }
    return true;
  });

  const handleRetry = (submissionId: string): void => {
    setRetryingId(submissionId);
    onRetrySubmission(submissionId);
    setTimeout(() => {
      setRetryingId((current) => (current === submissionId ? null : current));
    }, 800);
  };

  const handleExportJson = (): void => {
    const dataStr = JSON.stringify(filteredSubmissions, null, 2);
    downloadFile(
      dataStr,
      `submissions-${client.slug}-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    );
  };

  const handleExportCsv = (): void => {
    if (filteredSubmissions.length === 0) return;

    // Gather all distinct keys
    const allFieldKeys = Array.from(
      new Set(filteredSubmissions.flatMap((s) => Object.keys(s.values))),
    );

    const humanHeaders = allFieldKeys.map(
      (k) => `"${getReadableFieldLabel(k).replace(/"/g, '""')}"`,
    );

    const headers = [
      '"Submission ID"',
      '"Form Title"',
      '"Submitted At"',
      '"Domain"',
      ...humanHeaders,
      '"Delivery Status"',
    ];

    const rows = filteredSubmissions.map((s) => {
      const fieldValues = allFieldKeys.map((k) => {
        const val = s.values[k];
        if (val === undefined || val === null) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      const hasFailed = s.deliveryLogs.some((l) => l.status === 'failed');
      const hasDelivered = s.deliveryLogs.some((l) => l.status === 'delivered');
      const status = hasFailed ? 'Needs Retry' : hasDelivered ? 'Delivered' : 'Pending';

      return [
        `"${s.id}"`,
        `"${s.formTitle.replace(/"/g, '""')}"`,
        `"${s.submittedAt}"`,
        `"${s.domain}"`,
        ...fieldValues,
        `"${status}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadFile(
      csvContent,
      `customer-leads-${client.slug}-${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv',
    );
  };

  const formatTimestamp = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-sm text-zinc-900 dark:text-zinc-100">
      {/* Friendly Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
              Customer Responses &amp; Leads
            </h2>
            <Badge variant="success" className="gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {client.name}
            </Badge>
            <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              ({client.primaryDomain})
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Every form submission is safely saved here and automatically sent to your connected business apps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {clientSubmissions.length > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              className="touch-manipulation"
            >
              Clear Responses
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showClearConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-submissions-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl text-zinc-900 dark:text-zinc-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="clear-submissions-title"
              className="text-sm font-semibold text-zinc-950 dark:text-zinc-100"
            >
              Clear Responses for {client.name}?
            </h3>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              This will remove all stored customer responses and delivery logs for this account from local state.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="touch-manipulation"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="touch-manipulation"
                onClick={() => {
                  onClearSubmissions();
                  setShowClearConfirm(false);
                }}
              >
                Confirm Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Metrics Cards */}
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-3">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Total Responses
          </span>
          <p className="mt-1 font-mono text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
            {totalSubmissions}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
            Saved safely in cloud
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-3">
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            Sent to Connected Apps
          </span>
          <p className="mt-1 font-mono text-xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
            {deliveredCount}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
            Delivered to your CRM
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-3">
          <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
            Needs Retry
          </span>
          <p className="mt-1 font-mono text-xl font-semibold tracking-tight text-rose-600 dark:text-rose-400">
            {failedCount}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
            Click retry to resend
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-3">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Sync Success Rate
          </span>
          <p className="mt-1 font-mono text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
            {successRate}%
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
            App delivery reliability
          </p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Form Filter */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[140px]">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Form:</span>
            <select
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(e.target.value)}
              aria-label="Filter by form"
              className="h-9 w-full sm:w-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs font-medium text-zinc-900 dark:text-zinc-100 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 touch-manipulation"
            >
              <option value="all">All Forms ({clientSubmissions.length})</option>
              {forms
                .filter((f) => f.clientId === client.id)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[140px]">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'delivered' | 'failed')
              }
              aria-label="Filter by delivery status"
              className="h-9 w-full sm:w-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs font-medium text-zinc-900 dark:text-zinc-100 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300 touch-manipulation"
            >
              <option value="all">All Statuses</option>
              <option value="delivered">Successfully Sent</option>
              <option value="failed">Needs Retry</option>
            </select>
          </div>
        </div>

        {/* Action Buttons: Export & Count */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              disabled={filteredSubmissions.length === 0}
              title="Download CSV spreadsheet with readable question labels"
              className="touch-manipulation"
            >
              Export CSV
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExportJson}
              disabled={filteredSubmissions.length === 0}
              title="Download JSON data file"
              className="touch-manipulation"
            >
              Export JSON
            </Button>
          </div>

          <span className="text-xs text-zinc-500 dark:text-zinc-400 sm:pl-2">
            Showing {filteredSubmissions.length} of {clientSubmissions.length}
          </span>
        </div>
      </div>

      {/* Submissions List */}
      {filteredSubmissions.length === 0 ? (
        <div className="my-8 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            No customer responses recorded yet for {client.name}.
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Responses submitted through your form will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto -webkit-overflow-scrolling-touch">
          <div className="min-w-0 space-y-3">
            {filteredSubmissions.map((submission) => {
              const hasFailedDeliveries = submission.deliveryLogs.some(
                (l) => l.status === 'failed',
              );
              const hasDelivered = submission.deliveryLogs.some(
                (l) => l.status === 'delivered',
              );

              return (
                <div
                  key={submission.id}
                  className={cn(
                    'overflow-hidden rounded-lg border transition-all duration-150',
                    hasFailedDeliveries
                      ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900',
                  )}
                >
                  {/* Submission Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-zinc-50/50 dark:bg-zinc-950/50 border-b border-zinc-100 dark:border-zinc-800/80">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate max-w-full">
                        {submission.formTitle}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-full">
                        {submission.id}
                      </span>
                      <span className="rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:text-zinc-400 truncate max-w-full">
                        {submission.domain}
                      </span>
                      <Badge
                        variant={
                          hasFailedDeliveries
                            ? 'destructive'
                            : hasDelivered
                              ? 'success'
                              : 'warning'
                        }
                      >
                        {hasFailedDeliveries
                          ? 'Needs Retry'
                          : hasDelivered
                            ? 'Sent to Apps'
                            : 'Pending'}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {formatTimestamp(submission.submittedAt)}
                      </span>

                      {/* 1-Click Retry Delivery Button */}
                      <Button
                        type="button"
                        variant={hasFailedDeliveries ? 'destructive' : 'secondary'}
                        size="sm"
                        disabled={retryingId === submission.id}
                        onClick={() => handleRetry(submission.id)}
                        isLoading={retryingId === submission.id}
                        title="Retry sending lead data to connected apps"
                        className="touch-manipulation"
                      >
                        <span>&orarr; Retry</span>
                      </Button>
                    </div>
                  </div>

                  {/* Submitted Field Values with Human Question Labels */}
                  <div className="p-3.5 space-y-3">
                    {/* Marketing Campaign / UTM Parameters (if present) */}
                    {Object.keys(submission.capturedUrlParams).length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          Campaign Tracking:
                        </span>
                        {Object.entries(submission.capturedUrlParams).map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-700 dark:text-zinc-300"
                          >
                            <span className="text-zinc-400 dark:text-zinc-500">{k}:</span> {v}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Human-Readable Question Answers Grid */}
                    <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                      {Object.entries(submission.values).map(([fieldKey, val]) => {
                        if (val === undefined || val === '') return null;
                        const label = getReadableFieldLabel(fieldKey);

                        return (
                          <div
                            key={fieldKey}
                            className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-2.5 text-xs"
                          >
                            <span className="block font-medium text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                              {label}
                            </span>
                            <p className="mt-0.5 truncate font-semibold text-zinc-950 dark:text-zinc-100">
                              {typeof val === 'boolean'
                                ? val
                                  ? 'Yes'
                                  : 'No'
                                : String(val)}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Connected Apps Delivery Section with Progressive Disclosure */}
                    <div className="mt-3.5 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          Connected Apps Delivery Status ({submission.deliveryLogs.length})
                        </span>
                      </div>

                      {submission.deliveryLogs.length === 0 ? (
                        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 italic">
                          No connected apps configured for this form.
                        </p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {submission.deliveryLogs.map((log) => {
                            const isDelivered = log.status === 'delivered';

                            return (
                              <div
                                key={`${log.integrationId}-${log.timestamp}`}
                                className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 text-xs shadow-xs"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                                      {log.provider}
                                    </span>
                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                      {log.integrationName}
                                    </span>
                                    <Badge variant={isDelivered ? 'success' : 'destructive'} className="gap-1">
                                      {isDelivered
                                        ? `✓ Sent to ${log.integrationName}`
                                        : '⚠ Delivery Failed — Click Retry'}
                                    </Badge>
                                  </div>

                                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                                    {formatTimestamp(log.timestamp)}
                                  </span>
                                </div>

                                <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                                  {log.responseMessage}
                                </p>

                                {/* Progressive Disclosure: Technical Delivery Details */}
                                <details className="mt-2 group">
                                  <summary className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer select-none">
                                    <svg
                                      className="h-3 w-3 transition-transform group-open:rotate-90 text-zinc-400"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span>Technical Delivery Details</span>
                                  </summary>

                                  <div className="mt-2 space-y-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 p-2.5">
                                    <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                                      <span
                                        className={cn(
                                          'font-semibold',
                                          log.statusCode >= 200 && log.statusCode < 300
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-rose-600 dark:text-rose-400',
                                        )}
                                      >
                                        HTTP {log.statusCode}
                                      </span>
                                      <span className="text-zinc-400 dark:text-zinc-500">
                                        Log Time: {log.timestamp}
                                      </span>
                                    </div>

                                    {log.payloadPreview && (
                                      <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-[10px] text-zinc-100">
                                        <span className="block text-[9px] text-zinc-400 uppercase tracking-wider mb-1">
                                          Dispatched JSON Payload:
                                        </span>
                                        <pre className="overflow-x-auto whitespace-pre-wrap">
                                          {log.payloadPreview}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </details>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

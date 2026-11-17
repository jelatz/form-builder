import { useEffect, useState } from 'react';
import type {
  ClientTenant,
  FormSchema,
  SubmissionRecord,
} from '../../domain/form-schema';
import { Badge, Button, PageContainer } from '../../shared/ui';
import { formatIsoTimestamp, getSubmissionPreview } from './tenant-utils';

export interface FormDetailPanelProps {
  tenant: ClientTenant;
  form: FormSchema;
  submissions: SubmissionRecord[];
  tenantFormCount: number;
  onBackToForms: () => void;
  onOpenBuilder: (fieldId?: string) => void;
  onViewForm: () => void;
  onViewSubmissions: () => void;
  onTogglePublish?: (isPublished: boolean) => void;
  onDeleteForm: (formId: string) => void;
}

export function FormDetailPanel({
  tenant,
  form,
  submissions,
  tenantFormCount,
  onBackToForms,
  onOpenBuilder,
  onViewForm,
  onViewSubmissions,
  onTogglePublish,
  onDeleteForm,
}: FormDetailPanelProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!showDeleteConfirm) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowDeleteConfirm(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDeleteConfirm]);

  const sortedSubmissions = [...submissions].sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt),
  );
  const latestSubmission = sortedSubmissions[0];
  const dataFields = form.fields.filter(
    (field) => field.type !== 'section' && field.type !== 'grid',
  );
  const publicPath = `/f/${tenant.slug}/${form.slug}`;
  const publicUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${publicPath}`
      : publicPath;

  const handleCopyPublicUrl = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(publicUrl).then(() => {
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 1800);
    });
  };

  return (
    <main
      aria-label={`Form Details: ${form.title}`}
      className="flex-1 overflow-y-auto p-6 bg-[#f4f5f7]"
    >
      <PageContainer className="space-y-5">
        {/* Top Breadcrumb & Form Header Card */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={onBackToForms}
                aria-label="Back to All Forms"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                <span>All Forms</span>
              </Button>

              <Badge variant={form.isPublished === false ? 'warning' : 'success'}>
                {form.isPublished === false ? 'UNPUBLISHED' : 'PUBLISHED'}
              </Badge>

              {onTogglePublish && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => onTogglePublish(form.isPublished === false)}
                >
                  {form.isPublished === false ? 'Publish' : 'Unpublish'}
                </Button>
              )}

              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 font-mono text-[11px] text-zinc-700"
                title={tenant.name}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{tenant.name}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleCopyPublicUrl}
                title={`Copy public form URL: ${publicPath}`}
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                <span>{copiedUrl ? 'Copied Link' : 'Copy Public URL'}</span>
              </Button>

              <a
                href={publicPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                title={`Open public form in a new tab: ${publicPath}`}
              >
                <span>Public Link</span>
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 3h6v6" />
                  <path d="M10 14 21 3" />
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                </svg>
              </a>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              {form.title}
            </h1>
            {form.description ? (
              <p className="text-xs text-zinc-600 max-w-3xl leading-relaxed">
                {form.description}
              </p>
            ) : (
              <p className="text-xs text-zinc-400 italic">
                No form description configured yet.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-1 font-mono text-xs text-zinc-500">
              <span>Updated {formatIsoTimestamp(form.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Primary Form Action Options */}
        <section aria-label="Form Options" className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-zinc-500 font-semibold">
              Form Options
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Option 1: Builder */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </div>
                  <Badge variant="neutral">
                    {form.fields.length}{' '}
                    {form.fields.length === 1 ? 'field' : 'fields'}
                  </Badge>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Builder
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                    Add fields, rearrange layouts, and edit validation rules.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={() => onOpenBuilder()}
                className="w-full"
              >
                Open Builder
              </Button>
            </div>

            {/* Option 2: View Form */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700 flex items-center justify-center">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">
                    View Form
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                    Run the interactive form preview and test field validation.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={onViewForm}
                className="w-full"
              >
                View Form
              </Button>
            </div>

            {/* Option 3: Submissions View */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700 flex items-center justify-center">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                    </svg>
                  </div>
                  <Badge
                    variant={submissions.length > 0 ? 'success' : 'neutral'}
                  >
                    {submissions.length}{' '}
                    {submissions.length === 1 ? 'record' : 'records'}
                  </Badge>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Submissions View
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                    Browse captured entries, inspect payloads, and export CSV or
                    JSON.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={onViewSubmissions}
                className="w-full"
              >
                Submissions View
              </Button>
            </div>

            {/* Option 4: Delete */}
            <div className="rounded-lg border border-rose-200/80 dark:border-rose-900/50 bg-white p-4 shadow-2xs flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-md border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      <line x1="10" x2="10" y1="11" y2="17" />
                      <line x1="14" x2="14" y1="11" y2="17" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Delete Form
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                    Permanently remove this schema and all stored submissions.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full"
              >
                Delete Form
              </Button>
            </div>
          </div>
        </section>

        {/* Form Schema & Activity Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Fields Summary */}
          <section
            aria-label="Form Fields Overview"
            className="lg:col-span-7 rounded-lg border border-zinc-200 bg-white p-4 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-zinc-600 font-semibold">
                  Configured Fields
                </span>
                <Badge variant="neutral">{dataFields.length}</Badge>
              </div>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onOpenBuilder()}
              >
                Edit in Builder →
              </Button>
            </div>

            {form.fields.length === 0 ? (
              <div className="p-6 rounded-md border border-dashed border-zinc-200 bg-zinc-50/50 text-center space-y-2">
                <p className="text-xs font-medium text-zinc-700">
                  This form has no fields yet
                </p>
                <Button
                  size="xs"
                  variant="primary"
                  onClick={() => onOpenBuilder()}
                >
                  Add Fields in Builder
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-md overflow-hidden">
                {form.fields.map((field, index) => (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => onOpenBuilder(field.id)}
                    className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-[11px] text-zinc-400 w-5 shrink-0">
                        {index + 1}.
                      </span>
                      <span className="text-xs font-medium text-zinc-900 truncate">
                        {field.label || 'Untitled field'}
                      </span>
                      {field.required && (
                        <Badge variant="warning">REQUIRED</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[11px] uppercase px-1.5 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-600">
                        {field.type}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Submissions Snapshot */}
          <section
            aria-label="Recent Submissions Snapshot"
            className="lg:col-span-5 rounded-lg border border-zinc-200 bg-white p-4 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-zinc-600 font-semibold">
                  Recent Submissions
                </span>
                <Badge variant={submissions.length > 0 ? 'success' : 'neutral'}>
                  {submissions.length}
                </Badge>
              </div>
              <Button
                size="xs"
                variant="ghost"
                onClick={onViewSubmissions}
              >
                Open View →
              </Button>
            </div>

            {latestSubmission && (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 flex items-center justify-between text-xs">
                <span className="text-zinc-500">Latest response</span>
                <span className="font-mono text-zinc-800">
                  {formatIsoTimestamp(latestSubmission.submittedAt)}
                </span>
              </div>
            )}

            {sortedSubmissions.length === 0 ? (
              <div className="p-6 rounded-md border border-dashed border-zinc-200 bg-zinc-50/50 text-center space-y-2">
                <p className="text-xs font-medium text-zinc-700">
                  No submissions recorded yet
                </p>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={onViewForm}
                >
                  Open Live Preview
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-md overflow-hidden">
                {sortedSubmissions.slice(0, 5).map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={onViewSubmissions}
                    className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-zinc-50 transition-colors cursor-pointer text-xs"
                  >
                    <span className="text-zinc-900 font-medium truncate">
                      {getSubmissionPreview(sub, form)}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500 shrink-0">
                      {formatIsoTimestamp(sub.submittedAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </PageContainer>

      {/* Delete Form Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-form-dialog-title"
            className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-lg space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <Badge variant="danger">DELETE FORM</Badge>
                <span className="font-mono text-xs text-zinc-500">
                  {tenant.name}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p
                id="delete-form-dialog-title"
                className="text-sm font-semibold text-zinc-900"
              >
                Delete &ldquo;{form.title}&rdquo;?
              </p>
              <p className="text-xs text-zinc-600 leading-relaxed">
                This action permanently deletes the form schema and{' '}
                <span className="font-semibold text-zinc-900">
                  {submissions.length}{' '}
                  {submissions.length === 1 ? 'submission' : 'submissions'}
                </span>{' '}
                recorded under this form.
              </p>
              {tenantFormCount <= 1 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  This is the last remaining form for {tenant.name}. A fresh
                  blank form will be created automatically for this tenant.
                </p>
              )}
            </div>

            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500 shrink-0">Public URL</span>
                <span className="font-mono text-zinc-800 truncate">
                  {publicPath}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Fields</span>
                <span className="font-mono text-zinc-800">
                  {form.fields.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Submissions</span>
                <span className="font-mono text-zinc-800">
                  {submissions.length}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDeleteForm(form.id);
                }}
              >
                Delete Form
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

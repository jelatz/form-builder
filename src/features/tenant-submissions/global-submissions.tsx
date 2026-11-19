import { useState } from 'react';
import type {
  ClientTenant,
  FormSchema,
  SubmissionRecord,
} from '../../domain/form-schema';
import {
  Badge,
  Button,
  FilterDropdown,
  Input,
  PageContainer,
  type FilterDropdownOption,
} from '../../shared/ui';
import {
  formatIsoTimestamp,
  formatSubmissionValue,
  getSubmissionPreview,
} from './tenant-utils';

export interface GlobalSubmissionsPanelProps {
  tenants: ClientTenant[];
  forms: FormSchema[];
  submissions: SubmissionRecord[];
  isSuperadmin: boolean;
  activeTenantId: string;
  onDeleteSubmission: (clientId: string, submissionId: string) => void;
}

/**
 * Cross-form (and for superadmin, cross-tenant) submission explorer with search,
 * tenant/form filters, and CSV/JSON export.
 */
export function GlobalSubmissionsPanel({
  tenants,
  forms,
  submissions,
  isSuperadmin,
  activeTenantId,
  onDeleteSubmission,
}: GlobalSubmissionsPanelProps) {
  const [tenantFilter, setTenantFilter] = useState<string>(
    isSuperadmin ? 'ALL' : activeTenantId,
  );
  const [formFilter, setFormFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const effectiveTenantFilter = isSuperadmin ? tenantFilter : activeTenantId;

  const tenantMap = new Map(tenants.map((t) => [t.id, t]));
  const formMap = new Map(forms.map((f) => [f.id, f]));

  const scopedForms =
    effectiveTenantFilter === 'ALL'
      ? forms
      : forms.filter((f) => f.clientId === effectiveTenantFilter);

  const effectiveFormFilter =
    formFilter !== 'ALL' && scopedForms.some((f) => f.id === formFilter)
      ? formFilter
      : 'ALL';

  const filteredSubmissions = submissions.filter((sub) => {
    if (effectiveTenantFilter !== 'ALL' && sub.clientId !== effectiveTenantFilter) {
      return false;
    }
    if (effectiveFormFilter !== 'ALL' && sub.formId !== effectiveFormFilter) {
      return false;
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    const form = formMap.get(sub.formId);
    const tenant = tenantMap.get(sub.clientId);
    const payloadText = JSON.stringify(sub.values).toLowerCase();
    return (
      sub.id.toLowerCase().includes(q) ||
      payloadText.includes(q) ||
      (form?.title.toLowerCase().includes(q) ?? false) ||
      (tenant?.name.toLowerCase().includes(q) ?? false)
    );
  });

  const selectedRecord =
    filteredSubmissions.find((s) => s.id === selectedRecordId) ??
    filteredSubmissions[0] ??
    null;
  const selectedForm = selectedRecord
    ? formMap.get(selectedRecord.formId)
    : undefined;
  const selectedTenant = selectedRecord
    ? tenantMap.get(selectedRecord.clientId)
    : undefined;

  const tenantOptions: FilterDropdownOption[] = [
    {
      value: 'ALL',
      label: 'All Tenants',
      description: 'Every tenant workspace',
      meta: String(submissions.length),
    },
    ...tenants.map((t) => ({
      value: t.id,
      label: t.name,
      meta: String(submissions.filter((s) => s.clientId === t.id).length),
    })),
  ];

  const formOptions: FilterDropdownOption[] = [
    {
      value: 'ALL',
      label: 'All Forms',
      description: 'Every form in scope',
      meta: String(
        submissions.filter(
          (s) =>
            effectiveTenantFilter === 'ALL' ||
            s.clientId === effectiveTenantFilter,
        ).length,
      ),
    },
    ...scopedForms.map((f) => ({
      value: f.id,
      label: f.title,
      meta: String(submissions.filter((s) => s.formId === f.id).length),
    })),
  ];

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(filteredSubmissions, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'submissions_export.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const escapeCsv = (val: unknown): string => {
      const str =
        val === undefined || val === null
          ? ''
          : typeof val === 'object'
            ? JSON.stringify(val)
            : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = ['id', 'clientId', 'formId', 'submittedAt', 'valuesJson'];
    const rows = filteredSubmissions.map((sub) => [
      escapeCsv(sub.id),
      escapeCsv(sub.clientId),
      escapeCsv(sub.formId),
      escapeCsv(sub.submittedAt),
      escapeCsv(sub.values),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'submissions_export.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main
      aria-label="Submissions Explorer"
      className="flex-1 overflow-y-auto p-6 bg-[#f4f5f7]"
    >
      <PageContainer>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="neutral">
                {isSuperadmin ? 'GLOBAL SUBMISSIONS' : 'TENANT SUBMISSIONS'}
              </Badge>
              <span className="font-mono text-xs text-zinc-500">
                {filteredSubmissions.length}{' '}
                {filteredSubmissions.length === 1 ? 'record' : 'records'}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              {isSuperadmin
                ? 'Inspect, search, and export captured form submissions across all tenants and forms.'
                : 'Inspect, search, and export submissions captured across your tenant forms.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="secondary"
              disabled={filteredSubmissions.length === 0}
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
            <Button
              size="xs"
              variant="secondary"
              disabled={filteredSubmissions.length === 0}
              onClick={handleExportJson}
            >
              Export JSON
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <Input
            aria-label="Search submissions"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by record ID, form title, or submitted value..."
            className="h-9 flex-1 bg-zinc-50 focus:bg-white text-xs"
          />

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isSuperadmin && (
              <FilterDropdown
                ariaLabel="Filter submissions by tenant"
                prefix="Tenant"
                menuHeading="Filter by Tenant"
                value={effectiveTenantFilter}
                options={tenantOptions}
                isActive={effectiveTenantFilter !== 'ALL'}
                onChange={(next) => {
                  setTenantFilter(next);
                  setFormFilter('ALL');
                }}
              />
            )}
            <FilterDropdown
              ariaLabel="Filter submissions by form"
              prefix="Form"
              menuHeading="Filter by Form"
              value={effectiveFormFilter}
              options={formOptions}
              isActive={effectiveFormFilter !== 'ALL'}
              onChange={setFormFilter}
            />
          </div>
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="p-12 rounded-lg border border-dashed border-zinc-300 bg-white/60 text-center space-y-2">
            <p className="text-sm font-medium text-zinc-800">
              No submissions match the current filter
            </p>
            <p className="text-xs text-zinc-500">
              Submit any form in Live Preview or via a public form link to see
              records here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div className="lg:col-span-2 rounded-lg border border-zinc-200 bg-white shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 font-mono text-xs uppercase text-zinc-600">
                      <th scope="col" className="py-2.5 px-3">Response</th>
                      {isSuperadmin && <th scope="col" className="py-2.5 px-3">Tenant</th>}
                      <th scope="col" className="py-2.5 px-3">Form</th>
                      <th scope="col" className="py-2.5 px-3">Submitted At</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {filteredSubmissions.map((sub) => {
                      const form = formMap.get(sub.formId);
                      const tenant = tenantMap.get(sub.clientId);
                      const isSelected = selectedRecord?.id === sub.id;
                      const isConfirming = confirmDeleteId === sub.id;
                      return (
                        <tr
                          key={sub.id}
                          onClick={() => setSelectedRecordId(sub.id)}
                          className={
                            isSelected
                              ? 'bg-emerald-50/70 text-zinc-900 cursor-pointer'
                              : 'hover:bg-zinc-50 text-zinc-700 cursor-pointer'
                          }
                        >
                          <td className="py-2.5 px-3 font-medium text-zinc-900 max-w-[200px] truncate">
                            {getSubmissionPreview(sub, form)}
                          </td>
                          {isSuperadmin && (
                            <td className="py-2.5 px-3">
                              <span className="font-medium text-zinc-800">
                                {tenant?.name ?? 'Unknown tenant'}
                              </span>
                            </td>
                          )}
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-zinc-900">
                              {form?.title ?? 'Untitled form'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-500 whitespace-nowrap tabular-nums">
                            {formatIsoTimestamp(sub.submittedAt)}
                          </td>
                          <td
                            className="py-2.5 px-3 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isConfirming ? (
                              <div className="inline-flex items-center gap-1">
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => setConfirmDeleteId(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="xs"
                                  variant="danger"
                                  onClick={() => {
                                    setConfirmDeleteId(null);
                                    onDeleteSubmission(sub.clientId, sub.id);
                                  }}
                                >
                                  Confirm
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="xs"
                                variant="danger"
                                onClick={() => setConfirmDeleteId(sub.id)}
                              >
                                Delete
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedRecord && (
              <aside className="rounded-lg border border-zinc-200 bg-white p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-zinc-900 block truncate">
                      {selectedForm?.title ?? 'Submission Details'}
                    </span>
                    <div className="font-mono text-[11px] text-zinc-500 mt-0.5">
                      {formatIsoTimestamp(selectedRecord.submittedAt)}
                    </div>
                  </div>
                  {isSuperadmin && selectedTenant && (
                    <Badge variant="neutral">{selectedTenant.name}</Badge>
                  )}
                </div>

                {selectedForm && (
                  <div className="space-y-2">
                    {selectedForm.fields
                      .filter((f) => f.type !== 'section' && f.type !== 'grid')
                      .map((field) => (
                        <div
                          key={field.id}
                          className="p-2.5 rounded-md border border-zinc-200 bg-zinc-50/50 space-y-0.5"
                        >
                          <span className="text-xs font-medium text-zinc-700 block">
                            {field.label}
                          </span>
                          <p className="text-xs text-zinc-900 break-all">
                            {formatSubmissionValue(selectedRecord.values[field.id], field)}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </aside>
            )}
          </div>
        )}
      </PageContainer>
    </main>
  );
}

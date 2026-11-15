import { useEffect, useRef, useState } from 'react';
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
  Label,
  Select,
  type FilterDropdownOption,
} from '../../shared/ui';
import {
  CreateTenantModal,
  EditTenantModal,
  SelectedCheckIcon,
} from './tenant-modals';
import { formatIsoTimestamp } from './tenant-utils';

export {
  GlobalSubmissionsPanel,
  type GlobalSubmissionsPanelProps,
} from './global-submissions';
export { type ManagedTenantUser } from './storage';
export {
  TenantUsersModal,
  type TenantUsersModalProps,
} from './tenant-users-modal';
export {
  TenantsDirectoryPanel,
  type TenantsDirectoryPanelProps,
} from './tenants-directory';

export interface TenantDashboardPanelProps {
  tenants: ClientTenant[];
  forms: FormSchema[];
  submissions: SubmissionRecord[];
  activeTenantId: string;
  activeFormId: string;
  isSuperadmin?: boolean;
  onSelectTenant: (tenantId: string, navigateToForms?: boolean) => void;
  onCreateTenant: (input: { name: string; slug: string }) => void;
  onUpdateTenant: (
    tenantId: string,
    input: {
      name: string;
      slug: string;
    },
  ) => void;
  onEditForm: (form: FormSchema) => void;
  onViewForm: (form: FormSchema) => void;
  onViewFormSubmissions: (form: FormSchema) => void;
  onCreateFormForTenant: (tenantId: string, title: string) => void;
}

export function TenantDashboardPanel({
  tenants,
  forms,
  submissions,
  activeTenantId,
  activeFormId,
  isSuperadmin = true,
  onSelectTenant,
  onCreateTenant,
  onUpdateTenant,
  onEditForm,
  onViewForm,
  onViewFormSubmissions,
  onCreateFormForTenant,
}: TenantDashboardPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateFormModal, setShowCreateFormModal] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [editingTenant, setEditingTenant] = useState<ClientTenant | null>(null);

  useEffect(() => {
    if (!showCreateFormModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowCreateFormModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCreateFormModal]);

  const activeTenant =
    tenants.find((t) => t.id === activeTenantId) ?? tenants[0];

  const handleCreateFormSubmit = () => {
    const trimmed = newFormTitle.trim();
    if (!trimmed || !activeTenant) return;
    onCreateFormForTenant(activeTenant.id, trimmed);
    setNewFormTitle('');
    setShowCreateFormModal(false);
  };

  const filteredTenants = tenants.filter((tenant) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      tenant.name.toLowerCase().includes(q) ||
      tenant.id.toLowerCase().includes(q) ||
      tenant.slug.toLowerCase().includes(q)
    );
  });

  const activeTenantForms = activeTenant
    ? forms.filter((f) => f.clientId === activeTenant.id)
    : [];
  const activeTenantSubmissions = activeTenant
    ? submissions
        .filter((s) => s.clientId === activeTenant.id)
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    : [];
  const activeTenantTotalFields = activeTenantForms.reduce(
    (sum, f) => sum + f.fields.length,
    0,
  );
  const activeTenantFormMap = new Map(activeTenantForms.map((f) => [f.id, f]));
  const latestFormUpdatedAt = activeTenantForms.reduce<string | null>(
    (latest, f) => (!latest || f.updatedAt > latest ? f.updatedAt : latest),
    null,
  );
  const latestSubmissionAt = activeTenantSubmissions[0]?.submittedAt ?? null;

  return (
    <main
      aria-label="Tenant Dashboard"
      className="flex-1 overflow-y-auto p-6 bg-[#f4f5f7]"
    >
      <div className="w-full space-y-4">
        {/* Header & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">TENANT DASHBOARD</Badge>
              {activeTenant && (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-emerald-200 bg-emerald-50 font-mono text-[11px] text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
                  title={`Selected tenant: ${activeTenant.name} (/${activeTenant.slug})`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="uppercase tracking-wider text-[10px] text-emerald-700 dark:text-emerald-400">
                    Selected:
                  </span>
                  <span className="font-semibold">{activeTenant.name}</span>
                  <span className="text-emerald-700/80 dark:text-emerald-400/80 hidden sm:inline">
                    (/{activeTenant.slug})
                  </span>
                </span>
              )}
              <span className="font-mono text-xs text-zinc-500">
                {filteredTenants.length} of {tenants.length}{' '}
                {tenants.length === 1 ? 'workspace' : 'workspaces'}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              {isSuperadmin
                ? 'Select a client tenant workspace to inspect all tenant details, forms, and submission activity, or provision a new tenant.'
                : 'Inspect your workspace details, forms, and recent submission activity.'}
            </p>
          </div>

          {isSuperadmin && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Search tenants"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tenant, id, or slug..."
                className="h-8 w-56 text-xs"
              />
              <Button
                size="sm"
                variant="primary"
                onClick={() => setShowCreateModal(true)}
              >
                + New Tenant
              </Button>
            </div>
          )}
        </div>

        {/* Platform Summary Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs space-y-1">
            <span className="block font-mono text-xs uppercase text-zinc-500 font-semibold tracking-wider">
              Total Tenants
            </span>
            <span className="block text-2xl font-bold font-mono text-zinc-900">
              {tenants.length}
            </span>
            <p className="text-xs text-zinc-500">
              Active isolated client workspaces
            </p>
          </div>
          <div className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs space-y-1">
            <span className="block font-mono text-xs uppercase text-zinc-500 font-semibold tracking-wider">
              Total Forms
            </span>
            <span className="block text-2xl font-bold font-mono text-zinc-900">
              {forms.length}
            </span>
            <p className="text-xs text-zinc-500">
              Published and configured schemas
            </p>
          </div>
          <div className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs space-y-1">
            <span className="block font-mono text-xs uppercase text-zinc-500 font-semibold tracking-wider">
              Total Submissions
            </span>
            <span className="block text-2xl font-bold font-mono text-zinc-900">
              {submissions.length}
            </span>
            <p className="text-xs text-zinc-500">
              Captured responses across tenants
            </p>
          </div>
        </div>

        {/* Master-Detail: Tenant List (Superadmin) + Full Selected Tenant Details */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Left Column: Client Tenant Selection List */}
          {isSuperadmin && (
            <div className="xl:col-span-5 space-y-3">
            {filteredTenants.length === 0 ? (
              <div className="p-10 rounded-lg border border-dashed border-zinc-300 bg-white/60 text-center space-y-2">
                <p className="text-sm font-medium text-zinc-800">
                  No client tenants match your search
                </p>
                <p className="text-xs text-zinc-500">
                  Try adjusting your query or click &quot;+ New Tenant&quot; to
                  provision a new workspace.
                </p>
              </div>
            ) : (
              filteredTenants.map((tenant) => {
                const isActive = tenant.id === activeTenant?.id;
                const tenantFormsCount = forms.filter(
                  (f) => f.clientId === tenant.id,
                ).length;
                const tenantSubmissionsCount = submissions.filter(
                  (s) => s.clientId === tenant.id,
                ).length;

                return (
                  <div
                    key={tenant.id}
                    onClick={() => onSelectTenant(tenant.id, false)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    data-selected={isActive ? 'true' : 'false'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectTenant(tenant.id, false);
                      }
                    }}
                    className={`p-4 rounded-lg border shadow-2xs flex flex-col justify-between gap-3 transition-colors cursor-pointer ${
                      isActive
                        ? 'border-emerald-600 bg-emerald-50/25 ring-1 ring-emerald-600/20 dark:border-emerald-500/60 dark:bg-zinc-900 dark:ring-1 dark:ring-emerald-500/20'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex h-4 w-4 items-center justify-center rounded-full border shrink-0 transition-colors ${
                                isActive
                                  ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-zinc-950'
                                  : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950'
                              }`}
                              aria-hidden="true"
                            >
                              {isActive && (
                                <SelectedCheckIcon className="w-2.5 h-2.5 text-white dark:text-zinc-950" />
                              )}
                            </span>
                            <h3 className="font-semibold text-zinc-900 text-sm truncate">
                              {tenant.name}
                            </h3>
                            {isActive && (
                              <Badge variant="success" className="gap-1">
                                <SelectedCheckIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                SELECTED
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 font-mono text-xs text-zinc-500">
                            <span className="truncate">/{tenant.slug}</span>
                            <span className="text-zinc-300">•</span>
                            <span className="truncate">{tenant.id}</span>
                          </div>
                        </div>
                        <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                          {tenant.createdAt.slice(0, 10)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-md bg-zinc-50 border border-zinc-200">
                        <div>
                          <span className="block font-mono text-[10px] uppercase text-zinc-500">
                            Forms
                          </span>
                          <span className="font-mono text-sm font-semibold text-zinc-900">
                            {tenantFormsCount}
                          </span>
                        </div>
                        <div>
                          <span className="block font-mono text-[10px] uppercase text-zinc-500">
                            Submissions
                          </span>
                          <span className="font-mono text-sm font-semibold text-zinc-900">
                            {tenantSubmissionsCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 pt-2 border-t border-zinc-100"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => onSelectTenant(tenant.id, true)}
                      >
                        View Tenant Forms →
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          )}

          {/* Right Column: Full Selected Tenant Details */}
          {activeTenant && (
            <section
              aria-label="Selected Tenant Details"
              className={`${
                isSuperadmin ? 'xl:col-span-7' : 'xl:col-span-12'
              } rounded-lg border border-zinc-200 bg-white shadow-2xs p-5 space-y-5`}
            >
              {/* Tenant Detail Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-zinc-200">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="neutral">TENANT DETAILS</Badge>
                    <Badge variant="success" className="gap-1">
                      <SelectedCheckIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      SELECTED
                    </Badge>
                  </div>
                  <h2 className="text-base font-semibold text-zinc-900 truncate">
                    {activeTenant.name}
                  </h2>
                  <p className="font-mono text-xs text-zinc-500">
                    {activeTenant.id} • /{activeTenant.slug}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isSuperadmin && (
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => setEditingTenant(activeTenant)}
                    >
                      Edit Details
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => onSelectTenant(activeTenant.id, true)}
                  >
                    Filter in All Forms →
                  </Button>
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => {
                      setNewFormTitle('');
                      setShowCreateFormModal(true);
                    }}
                  >
                    + New Form
                  </Button>
                </div>
              </div>

              {/* Complete Tenant Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3 rounded-md border border-zinc-200 bg-zinc-50/70 space-y-1">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Tenant ID
                  </span>
                  <span className="block font-mono text-xs text-zinc-900 font-medium break-all">
                    {activeTenant.id}
                  </span>
                </div>

                <div className="p-3 rounded-md border border-zinc-200 bg-zinc-50/70 space-y-1">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Workspace Slug
                  </span>
                  <span className="block font-mono text-xs text-zinc-900 font-medium">
                    /{activeTenant.slug}
                  </span>
                </div>

                <div className="p-3 rounded-md border border-zinc-200 bg-zinc-50/70 space-y-1">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Created At (UTC)
                  </span>
                  <span className="block font-mono text-xs text-zinc-900 font-medium">
                    {formatIsoTimestamp(activeTenant.createdAt)}
                  </span>
                </div>
              </div>

              {/* Tenant Activity & Usage Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-md border border-zinc-200 bg-white space-y-0.5">
                  <span className="block font-mono text-[10px] uppercase text-zinc-500">
                    Forms
                  </span>
                  <span className="block font-mono text-lg font-bold text-zinc-900">
                    {activeTenantForms.length}
                  </span>
                </div>
                <div className="p-3 rounded-md border border-zinc-200 bg-white space-y-0.5">
                  <span className="block font-mono text-[10px] uppercase text-zinc-500">
                    Total Fields
                  </span>
                  <span className="block font-mono text-lg font-bold text-zinc-900">
                    {activeTenantTotalFields}
                  </span>
                </div>
                <div className="p-3 rounded-md border border-zinc-200 bg-white space-y-0.5">
                  <span className="block font-mono text-[10px] uppercase text-zinc-500">
                    Submissions
                  </span>
                  <span className="block font-mono text-lg font-bold text-zinc-900">
                    {activeTenantSubmissions.length}
                  </span>
                </div>
                <div className="p-3 rounded-md border border-zinc-200 bg-white space-y-0.5">
                  <span className="block font-mono text-[10px] uppercase text-zinc-500">
                    Last Activity
                  </span>
                  <span className="block font-mono text-xs font-semibold text-zinc-900 pt-1">
                    {latestSubmissionAt
                      ? latestSubmissionAt.slice(0, 10)
                      : latestFormUpdatedAt
                        ? latestFormUpdatedAt.slice(0, 10)
                        : '—'}
                  </span>
                </div>
              </div>

              {/* Tenant Forms Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-zinc-600 font-semibold">
                    Configured Forms ({activeTenantForms.length})
                  </span>
                  {latestFormUpdatedAt && (
                    <span className="font-mono text-[11px] text-zinc-400">
                      Last schema update: {formatIsoTimestamp(latestFormUpdatedAt)}
                    </span>
                  )}
                </div>

                {activeTenantForms.length === 0 ? (
                  <div className="p-6 rounded-md border border-dashed border-zinc-300 bg-zinc-50/50 text-center space-y-2">
                    <p className="text-xs font-medium text-zinc-700">
                      No forms configured for {activeTenant.name}
                    </p>
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => {
                        setNewFormTitle('');
                        setShowCreateFormModal(true);
                      }}
                    >
                      + Create First Form
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border border-zinc-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-200 bg-zinc-50 font-mono text-[11px] uppercase text-zinc-500">
                            <th className="py-2 px-3">Form</th>
                            <th className="py-2 px-3">Route</th>
                            <th className="py-2 px-3">Fields</th>
                            <th className="py-2 px-3">Submissions</th>
                            <th className="py-2 px-3">Updated</th>
                            <th className="py-2 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 text-xs">
                          {activeTenantForms.map((form) => {
                            const isCurrentForm = form.id === activeFormId;
                            const formSubCount = activeTenantSubmissions.filter(
                              (s) => s.formId === form.id,
                            ).length;

                            return (
                              <tr
                                key={form.id}
                                className={
                                  isCurrentForm
                                    ? 'bg-emerald-50/50 text-zinc-900'
                                    : 'hover:bg-zinc-50 text-zinc-700'
                                }
                              >
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-zinc-900">
                                      {form.title}
                                    </span>
                                    {isCurrentForm && (
                                      <Badge variant="success">OPEN</Badge>
                                    )}
                                  </div>
                                  <span className="font-mono text-[11px] text-zinc-400">
                                    {form.id}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-zinc-600">
                                  /{form.slug}
                                </td>
                                <td className="py-2.5 px-3">
                                  <Badge variant="neutral">
                                    {form.fields.length}
                                  </Badge>
                                </td>
                                <td className="py-2.5 px-3">
                                  <Badge
                                    variant={
                                      formSubCount > 0 ? 'success' : 'neutral'
                                    }
                                  >
                                    {formSubCount}
                                  </Badge>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-zinc-500 whitespace-nowrap">
                                  {formatIsoTimestamp(form.updatedAt)}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1">
                                    <Button
                                      size="xs"
                                      variant="secondary"
                                      onClick={() => onViewForm(form)}
                                    >
                                      Preview
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="secondary"
                                      onClick={() => onEditForm(form)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="xs"
                                      variant="ghost"
                                      onClick={() => onViewFormSubmissions(form)}
                                    >
                                      Subs
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Submissions Snapshot */}
              <div className="space-y-2">
                <span className="block font-mono text-xs uppercase tracking-wider text-zinc-600 font-semibold">
                  Recent Submissions ({activeTenantSubmissions.length})
                </span>
                {activeTenantSubmissions.length === 0 ? (
                  <p className="text-xs text-zinc-500 p-3 rounded-md border border-zinc-200 bg-zinc-50/50">
                    No submissions captured yet for {activeTenant.name}.
                  </p>
                ) : (
                  <div className="rounded-md border border-zinc-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50 font-mono text-[11px] uppercase text-zinc-500">
                          <th className="py-2 px-3">Record ID</th>
                          <th className="py-2 px-3">Form</th>
                          <th className="py-2 px-3">Submitted At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-xs">
                        {activeTenantSubmissions.slice(0, 5).map((sub) => {
                          const parentForm = activeTenantFormMap.get(sub.formId);
                          return (
                            <tr key={sub.id} className="hover:bg-zinc-50">
                              <td className="py-2 px-3 font-mono text-zinc-900">
                                {sub.id}
                              </td>
                              <td className="py-2 px-3 text-zinc-700">
                                {parentForm?.title ?? sub.formId}
                              </td>
                              <td className="py-2 px-3 font-mono text-zinc-500 whitespace-nowrap">
                                {formatIsoTimestamp(sub.submittedAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Create Tenant Modal */}
      <CreateTenantModal
        open={showCreateModal}
        tenants={tenants}
        idPrefix="dashboard"
        onClose={() => setShowCreateModal(false)}
        onCreateTenant={onCreateTenant}
      />

      {/* Create Form for Active Tenant Modal */}
      {showCreateFormModal && activeTenant && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowCreateFormModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 space-y-3 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
              <span className="font-mono text-xs uppercase text-zinc-700 font-semibold">
                Create Form
              </span>
              <Badge variant="neutral">{activeTenant.name}</Badge>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dashboard_new_form_title">Form Title</Label>
              <Input
                id="dashboard_new_form_title"
                value={newFormTitle}
                onChange={(e) => setNewFormTitle(e.target.value)}
                placeholder="Customer Intake Form"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateFormSubmit();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setShowCreateFormModal(false)}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                variant="primary"
                disabled={!newFormTitle.trim()}
                onClick={handleCreateFormSubmit}
              >
                Create Form
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tenant Details Modal */}
      <EditTenantModal
        tenant={editingTenant}
        tenants={tenants}
        idPrefix="dashboard"
        onClose={() => setEditingTenant(null)}
        onUpdateTenant={onUpdateTenant}
      />
    </main>
  );
}

export interface SubmissionsPanelProps {
  tenant: ClientTenant;
  schema: FormSchema;
  submissions: SubmissionRecord[];
  onDeleteSubmission: (submissionId: string) => void;
  onClearFormSubmissions: () => void;
}

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function SubmissionsPanel({
  tenant,
  schema,
  submissions,
  onDeleteSubmission,
  onClearFormSubmissions,
}: SubmissionsPanelProps) {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(
    submissions[0]?.id ?? null,
  );

  const dataFields = schema.fields.filter(
    (f) => f.type !== 'section' && f.type !== 'grid',
  );

  const selectedRecord =
    submissions.find((s) => s.id === selectedRecordId) ??
    submissions[0] ??
    null;

  const handleExportJson = () => {
    const payload = JSON.stringify(submissions, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tenant.slug}_${schema.slug}_submissions.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const headers = [
      'id',
      'submittedAt',
      ...dataFields.map((f) => f.id),
    ];
    const escapeCsv = (val: unknown): string => {
      const str = val === undefined || val === null ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = submissions.map((sub) => [
      escapeCsv(sub.id),
      escapeCsv(sub.submittedAt),
      ...dataFields.map((f) => escapeCsv(sub.values[f.id])),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tenant.slug}_${schema.slug}_submissions.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main
      aria-label="Tenant Submissions"
      className="flex-1 overflow-y-auto p-6 bg-[#f4f5f7]"
    >
      <div className="w-full space-y-4">
        {/* Tenant Scope & Export Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="neutral">TENANT ISOLATION</Badge>
              <span className="font-mono text-xs text-zinc-700">
                {tenant.name} ({tenant.id})
              </span>
              <span className="text-zinc-300">•</span>
              <span className="font-mono text-xs text-zinc-500">
                /{tenant.slug}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Showing {submissions.length}{' '}
              {submissions.length === 1 ? 'submission' : 'submissions'} scoped
              to <span className="text-zinc-900 font-medium">{schema.title}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="secondary"
              disabled={submissions.length === 0}
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
            <Button
              size="xs"
              variant="secondary"
              disabled={submissions.length === 0}
              onClick={handleExportJson}
            >
              Export JSON
            </Button>
            <Button
              size="xs"
              variant="danger"
              disabled={submissions.length === 0}
              onClick={onClearFormSubmissions}
            >
              Clear All
            </Button>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="p-12 rounded-lg border border-dashed border-zinc-300 bg-white/60 text-center space-y-2">
            <p className="text-sm font-medium text-zinc-800">
              No submissions recorded for {schema.title}
            </p>
            <p className="text-xs text-zinc-500">
              Switch to the Preview tab and submit the form to store a tenant
              submission record.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Tabular Submissions List */}
            <div className="lg:col-span-2 rounded-lg border border-zinc-200 bg-white shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 font-mono text-xs uppercase text-zinc-600">
                      <th className="py-2.5 px-3">Record ID</th>
                      <th className="py-2.5 px-3">Submitted At</th>
                      {dataFields.slice(0, 3).map((field) => (
                        <th key={field.id} className="py-2.5 px-3 truncate">
                          {field.label}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {submissions.map((sub) => {
                      const isSelected = selectedRecord?.id === sub.id;
                      return (
                        <tr
                          key={sub.id}
                          onClick={() => setSelectedRecordId(sub.id)}
                          className={
                            isSelected
                              ? 'bg-emerald-50/60 text-zinc-900 cursor-pointer'
                              : 'hover:bg-zinc-50 text-zinc-700 cursor-pointer'
                          }
                        >
                          <td className="py-2.5 px-3 font-mono text-zinc-900 font-medium">
                            {sub.id}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-500">
                            {sub.submittedAt.slice(0, 19).replace('T', ' ')}
                          </td>
                          {dataFields.slice(0, 3).map((field) => (
                            <td
                              key={field.id}
                              className="py-2.5 px-3 max-w-[160px] truncate"
                            >
                              {formatCellValue(sub.values[field.id])}
                            </td>
                          ))}
                          <td
                            className="py-2.5 px-3 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="xs"
                              variant="danger"
                              onClick={() => onDeleteSubmission(sub.id)}
                            >
                              Del
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected Record Inspector */}
            {selectedRecord && (
              <aside
                aria-label="Submission Payload Detail"
                className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
                  <div>
                    <Badge variant="success">RECORD PAYLOAD</Badge>
                    <p className="font-mono text-xs text-zinc-500 mt-1">
                      {selectedRecord.id}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-zinc-500">
                    /{tenant.slug}
                  </span>
                </div>

                <div className="space-y-2">
                  {dataFields.map((field) => (
                    <div
                      key={field.id}
                      className="p-2.5 rounded-md border border-zinc-200 bg-zinc-50/50 space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-700">
                          {field.label}
                        </span>
                        <span className="font-mono text-xs text-zinc-400">
                          {field.id}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-zinc-900 break-all">
                        {formatCellValue(selectedRecord.values[field.id])}
                      </p>
                    </div>
                  ))}
                </div>

                <pre className="p-3 rounded-md bg-zinc-50 border border-zinc-200 font-mono text-xs text-zinc-800 overflow-x-auto">
                  {JSON.stringify(selectedRecord, null, 2)}
                </pre>
              </aside>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

type FormSortKey = 'updated' | 'title' | 'submissions' | 'fields';

export interface FormsDirectoryPanelProps {
  tenants: ClientTenant[];
  forms: FormSchema[];
  submissions: SubmissionRecord[];
  activeTenantId: string;
  activeFormId: string;
  isSuperadmin?: boolean;
  tenantFilter?: string;
  onTenantFilterChange?: (tenantId: string) => void;
  isActionModalOpen?: boolean;
  onViewForm: (form: FormSchema) => void;
  onEditForm: (form: FormSchema) => void;
  onViewFormSubmissions: (form: FormSchema) => void;
  onDeleteForm: (formId: string) => void;
  onCreateFormForTenant: (tenantId: string, title: string) => void;
}

export function FormsDirectoryPanel({
  tenants,
  forms,
  submissions,
  activeTenantId,
  activeFormId,
  isSuperadmin = true,
  tenantFilter: controlledTenantFilter,
  onTenantFilterChange,
  isActionModalOpen = false,
  onViewForm,
  onEditForm,
  onViewFormSubmissions,
  onDeleteForm,
  onCreateFormForTenant,
}: FormsDirectoryPanelProps) {
  const [internalTenantFilter, setInternalTenantFilter] =
    useState<string>('ALL');
  const [formFilter, setFormFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<FormSortKey>('updated');

  const tenantFilter = controlledTenantFilter ?? internalTenantFilter;
  const setTenantFilter = (nextTenantId: string) => {
    if (onTenantFilterChange) {
      onTenantFilterChange(nextTenantId);
    } else {
      setInternalTenantFilter(nextTenantId);
    }
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newFormTenantId, setNewFormTenantId] =
    useState<string>(activeTenantId);
  const [newFormTitle, setNewFormTitle] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showCreateModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowCreateModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCreateModal]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        !showCreateModal &&
        !isActionModalOpen
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [showCreateModal, isActionModalOpen]);

  const tenantMap = new Map<string, ClientTenant>(
    tenants.map((t) => [t.id, t]),
  );

  const submissionCountsByFormId = new Map<string, number>();
  for (const sub of submissions) {
    const key = `${sub.clientId}::${sub.formId}`;
    submissionCountsByFormId.set(
      key,
      (submissionCountsByFormId.get(key) ?? 0) + 1,
    );
  }

  const availableFormsForFilter =
    tenantFilter === 'ALL'
      ? forms
      : forms.filter((f) => f.clientId === tenantFilter);

  const effectiveFormFilter =
    formFilter !== 'ALL' &&
    availableFormsForFilter.some((f) => f.id === formFilter)
      ? formFilter
      : 'ALL';

  const handleTenantFilterSelect = (nextTenantId: string) => {
    setTenantFilter(nextTenantId);
    if (
      formFilter !== 'ALL' &&
      nextTenantId !== 'ALL' &&
      !forms.some((f) => f.id === formFilter && f.clientId === nextTenantId)
    ) {
      setFormFilter('ALL');
    }
  };

  const filteredForms = forms.filter((form) => {
    const matchesTenant =
      tenantFilter === 'ALL' || form.clientId === tenantFilter;
    if (!matchesTenant) return false;

    const matchesForm =
      effectiveFormFilter === 'ALL' || form.id === effectiveFormFilter;
    if (!matchesForm) return false;

    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    const tenant = tenantMap.get(form.clientId);
    return (
      form.title.toLowerCase().includes(query) ||
      form.slug.toLowerCase().includes(query) ||
      (tenant?.name.toLowerCase().includes(query) ?? false)
    );
  });

  const sortedForms = [...filteredForms].sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === 'fields') {
      return b.fields.length - a.fields.length;
    }
    if (sortBy === 'submissions') {
      const aCount = submissionCountsByFormId.get(`${a.clientId}::${a.id}`) ?? 0;
      const bCount = submissionCountsByFormId.get(`${b.clientId}::${b.id}`) ?? 0;
      return bCount - aCount;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const hasActiveFilters =
    tenantFilter !== 'ALL' ||
    effectiveFormFilter !== 'ALL' ||
    searchQuery.trim() !== '';

  const selectedTenantName =
    tenantFilter === 'ALL' ? null : (tenantMap.get(tenantFilter)?.name ?? tenantFilter);
  const selectedFormTitle =
    effectiveFormFilter === 'ALL'
      ? null
      : (forms.find((f) => f.id === effectiveFormFilter)?.title ?? effectiveFormFilter);

  const tenantDropdownOptions: FilterDropdownOption[] = [
    {
      value: 'ALL',
      label: 'All Tenants',
      description: 'Show forms across every client workspace',
      meta: String(forms.length),
    },
    ...tenants.map((t) => ({
      value: t.id,
      label: t.name,
      description: `/${t.slug}`,
      meta: String(forms.filter((f) => f.clientId === t.id).length),
    })),
  ];

  const formDropdownOptions: FilterDropdownOption[] = [
    {
      value: 'ALL',
      label: 'All Forms',
      description:
        tenantFilter === 'ALL'
          ? 'All available forms across tenants'
          : `All forms in ${selectedTenantName ?? 'selected tenant'}`,
      meta: String(availableFormsForFilter.length),
    },
    ...availableFormsForFilter.map((f) => {
      const tenant = tenantMap.get(f.clientId);
      return {
        value: f.id,
        label: f.title,
        description:
          tenantFilter === 'ALL'
            ? `${tenant?.name ?? f.clientId} · /${f.slug}`
            : `/${f.slug}`,
        meta: `${f.fields.length}f`,
      };
    }),
  ];

  const sortDropdownOptions: FilterDropdownOption[] = [
    {
      value: 'updated',
      label: 'Last Updated',
      description: 'Most recently modified first',
    },
    {
      value: 'title',
      label: 'Title (A–Z)',
      description: 'Alphabetical by form title',
    },
    {
      value: 'submissions',
      label: 'Most Submissions',
      description: 'Highest submission volume first',
    },
    {
      value: 'fields',
      label: 'Most Fields',
      description: 'Largest schema field count first',
    },
  ];

  const handleClearFilters = () => {
    setTenantFilter('ALL');
    setFormFilter('ALL');
    setSearchQuery('');
  };

  const handleOpenCreateModal = () => {
    setNewFormTenantId(
      tenantFilter === 'ALL' ? activeTenantId : tenantFilter,
    );
    setNewFormTitle('');
    setShowCreateModal(true);
  };

  const handleCreateSubmit = () => {
    const trimmed = newFormTitle.trim();
    if (!trimmed) return;
    onCreateFormForTenant(newFormTenantId, trimmed);
    setNewFormTitle('');
    setShowCreateModal(false);
  };

  return (
    <main
      aria-label="Forms Directory"
      className="flex-1 overflow-y-auto p-6 bg-[#f4f5f7]"
    >
      <div className="w-full space-y-4">
        {/* Page Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1.5">
            <Badge variant="neutral" className="gap-1.5">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-3 w-3 text-zinc-500"
                aria-hidden="true"
              >
                <path
                  d="M5 4h8M5 8h8M5 12h8M2.5 4h.5M2.5 8h.5M2.5 12h.5"
                  strokeLinecap="round"
                />
              </svg>
              FORMS DIRECTORY
            </Badge>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              All Forms
            </h1>
            <p className="text-xs text-zinc-500">
              Showing forms across all client tenants. Filter by tenant or
              specific form, or open any form to preview, edit, view
              submissions, or delete.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="inline-flex items-center h-9 px-3 rounded-md border border-zinc-200 bg-white font-mono text-xs text-zinc-600 shadow-2xs">
              Showing{' '}
              <span className="mx-1 font-semibold text-zinc-900">
                {sortedForms.length}
              </span>{' '}
              of {forms.length} {forms.length === 1 ? 'form' : 'forms'}
            </div>
            <Button
              size="default"
              variant="primary"
              onClick={handleOpenCreateModal}
            >
              + New Form
            </Button>
          </div>
        </div>

        {/* Dedicated Filter Toolbar Card */}
        <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-2xs space-y-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0 flex items-center">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-zinc-400"
                aria-hidden="true"
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L13.5 13.5" strokeLinecap="round" />
              </svg>
              <Input
                ref={searchInputRef}
                aria-label="Search forms"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter forms by title, /slug, or tenant..."
                className="h-9 w-full pl-9 pr-14 bg-zinc-50 focus:bg-white text-xs"
              />
              {searchQuery ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 rounded p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" strokeLinecap="round" />
                  </svg>
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2.5 rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                  ⌘K
                </kbd>
              )}
            </div>

            <div className="hidden lg:block h-5 w-px bg-zinc-200 shrink-0" />

            {/* Filter & Sort Controls */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isSuperadmin && (
                <FilterDropdown
                  ariaLabel="Filter forms by tenant"
                  prefix="Tenant"
                  menuHeading="Filter by Tenant"
                  value={tenantFilter}
                  options={tenantDropdownOptions}
                  onChange={handleTenantFilterSelect}
                  isActive={tenantFilter !== 'ALL'}
                  icon={
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path
                        d="M2.5 13.5h11M4 13.5V3.5l4-1.5 4 1.5v10M6.5 6h1M6.5 8.5h1M9 6h1M9 8.5h1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />
              )}

              <FilterDropdown
                ariaLabel="Filter forms by form"
                prefix="Form"
                menuHeading="Filter by Form"
                value={effectiveFormFilter}
                options={formDropdownOptions}
                onChange={setFormFilter}
                isActive={effectiveFormFilter !== 'ALL'}
                icon={
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 2.5h5.5L12.5 5.5v8a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z"
                      strokeLinejoin="round"
                    />
                    <path d="M5.5 8.5h5M5.5 11h3.5" strokeLinecap="round" />
                  </svg>
                }
              />

              <FilterDropdown
                ariaLabel="Sort forms"
                prefix="Sort"
                menuHeading="Sort Directory"
                value={sortBy}
                options={sortDropdownOptions}
                onChange={(nextValue) => setSortBy(nextValue as FormSortKey)}
                align="right"
                icon={
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 3v10M5 13l-2-2M5 13l2-2M11 13V3M11 3L9 5M11 3l2 2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              />

              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearFilters}
                  className="h-9 px-2.5 text-xs text-zinc-500 hover:text-zinc-900"
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" strokeLinecap="round" />
                  </svg>
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400 mr-1">
                Active:
              </span>
              {searchQuery.trim() !== '' && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                >
                  <span>Search: &ldquo;{searchQuery.trim()}&rdquo;</span>
                  <span className="text-zinc-400" aria-hidden="true">
                    ×
                  </span>
                </button>
              )}
              {selectedTenantName && (
                <button
                  type="button"
                  onClick={() => handleTenantFilterSelect('ALL')}
                  className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                >
                  <span>Tenant: {selectedTenantName}</span>
                  <span className="text-emerald-600" aria-hidden="true">
                    ×
                  </span>
                </button>
              )}
              {selectedFormTitle && (
                <button
                  type="button"
                  onClick={() => setFormFilter('ALL')}
                  className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                >
                  <span>Form: {selectedFormTitle}</span>
                  <span className="text-emerald-600" aria-hidden="true">
                    ×
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Forms Table */}
        {sortedForms.length === 0 ? (
          <div className="p-12 rounded-lg border border-dashed border-zinc-300 bg-white/60 text-center space-y-2">
            <p className="text-sm font-medium text-zinc-800">
              No forms match the current filter
            </p>
            <p className="text-xs text-zinc-500">
              Try clearing your filters, switching Tenant or Form back to All,
              or creating a new form.
            </p>
            {hasActiveFilters && (
              <div className="pt-1">
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={handleClearFilters}
                >
                  Reset Filters
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 font-mono text-xs uppercase text-zinc-600">
                    <th className="py-2.5 px-3">Form Title</th>
                    <th className="py-2.5 px-3">Tenant</th>
                    <th className="py-2.5 px-3">Route</th>
                    <th className="py-2.5 px-3">Fields</th>
                    <th className="py-2.5 px-3">Submissions</th>
                    <th className="py-2.5 px-3">Updated</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {sortedForms.map((form) => {
                    const tenant = tenantMap.get(form.clientId);
                    const isActive = form.id === activeFormId;
                    const formSubmissionsCount =
                      submissionCountsByFormId.get(
                        `${form.clientId}::${form.id}`,
                      ) ?? 0;

                    return (
                      <tr
                        key={form.id}
                        tabIndex={0}
                        onClick={() => onEditForm(form)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onEditForm(form);
                          }
                        }}
                        className={
                          isActive
                            ? 'bg-emerald-50/50 hover:bg-emerald-50/80 text-zinc-900 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40'
                            : 'hover:bg-zinc-50 text-zinc-700 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40'
                        }
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-900">
                              {form.title}
                            </span>
                            {isActive && (
                              <Badge variant="success">ACTIVE</Badge>
                            )}
                          </div>
                          {form.description && (
                            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1 max-w-xs">
                              {form.description}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-zinc-800 font-medium">
                              {tenant?.name ?? form.clientId}
                            </span>
                            <span className="font-mono text-xs text-zinc-500">
                              {tenant ? `/${tenant.slug}` : '—'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-xs text-zinc-700">
                            /{form.slug}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <Badge variant="neutral">
                            {form.fields.length}{' '}
                            {form.fields.length === 1 ? 'field' : 'fields'}
                          </Badge>
                        </td>

                        <td
                          className="py-3 px-3"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onViewFormSubmissions(form)}
                            title={`View submissions for ${form.title}`}
                            aria-label={`View ${formSubmissionsCount} submissions for ${form.title}`}
                            className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                          >
                            <Badge
                              variant={
                                formSubmissionsCount > 0 ? 'success' : 'neutral'
                              }
                            >
                              {formSubmissionsCount}
                            </Badge>
                          </button>
                        </td>

                        <td className="py-3 px-3 font-mono text-zinc-500">
                          {form.updatedAt.slice(0, 16).replace('T', ' ')}
                        </td>

                        <td
                          className="py-3 px-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {tenant && (
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={() => {
                                  const publicUrl = `${window.location.origin}/f/${tenant.slug}/${form.slug}`;
                                  void navigator.clipboard
                                    ?.writeText(publicUrl)
                                    .then(() => {
                                      setCopiedFormId(form.id);
                                      window.setTimeout(
                                        () => setCopiedFormId(null),
                                        1800,
                                      );
                                    });
                                }}
                                title={`Copy public form URL: /f/${tenant.slug}/${form.slug}`}
                              >
                                {copiedFormId === form.id ? 'Copied' : 'Share'}
                              </Button>
                            )}
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => onViewForm(form)}
                              aria-label={`View ${form.title}`}
                              title={`Open ${form.title} in Live Preview`}
                              className="h-7 w-7 p-0"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              >
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </Button>
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => onEditForm(form)}
                              aria-label={`Edit ${form.title}`}
                              title={`Edit ${form.title} in Builder`}
                              className="h-7 w-7 p-0"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                              </svg>
                            </Button>
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => onViewFormSubmissions(form)}
                              aria-label={`Submissions for ${form.title}`}
                              title={`View submissions for ${form.title}`}
                              className="h-7 w-7 p-0"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              >
                                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                              </svg>
                            </Button>
                            <Button
                              size="xs"
                              variant="danger"
                              onClick={() => onDeleteForm(form.id)}
                              aria-label={`Delete ${form.title}`}
                              title={`Delete ${form.title}`}
                              className="h-7 w-7 p-0"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              >
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                <line x1="10" x2="10" y1="11" y2="17" />
                                <line x1="14" x2="14" y1="11" y2="17" />
                              </svg>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/70 px-3 py-2 text-xs text-zinc-500">
              <span>
                Showing <span className="font-medium text-zinc-800">1</span> to{' '}
                <span className="font-medium text-zinc-800">
                  {sortedForms.length}
                </span>{' '}
                of <span className="font-medium text-zinc-800">{forms.length}</span>{' '}
                {forms.length === 1 ? 'entry' : 'entries'}
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                Sorted by{' '}
                {sortBy === 'updated'
                  ? 'Last Updated'
                  : sortBy === 'title'
                    ? 'Title (A–Z)'
                    : sortBy === 'submissions'
                      ? 'Most Submissions'
                      : 'Most Fields'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Create Form Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 space-y-3 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
              <span className="font-mono text-xs uppercase text-zinc-700 font-semibold">
                Create New Form
              </span>
              <Badge variant="neutral">MULTI-TENANT</Badge>
            </div>
            {isSuperadmin && (
              <div className="space-y-1.5">
                <Label htmlFor="dir_new_form_tenant">Client Tenant</Label>
                <Select
                  id="dir_new_form_tenant"
                  menuHeading="Select Client Tenant"
                  value={newFormTenantId}
                  onValueChange={setNewFormTenantId}
                  options={tenants.map((t) => ({
                    value: t.id,
                    label: t.name,
                    description: `/${t.slug}`,
                    meta: `${forms.filter((f) => f.clientId === t.id).length}f`,
                  }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="dir_new_form_title">Form Title</Label>
              <Input
                id="dir_new_form_title"
                value={newFormTitle}
                onChange={(e) => setNewFormTitle(e.target.value)}
                placeholder="Vendor Security Questionnaire"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                variant="primary"
                disabled={!newFormTitle.trim()}
                onClick={handleCreateSubmit}
              >
                Create Form
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

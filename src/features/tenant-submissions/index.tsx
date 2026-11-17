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
  PageContainer,
  Select,
  type FilterDropdownOption,
} from '../../shared/ui';
import type {
  ManagedTenantUser,
  ResetUserCredentialsResponse,
} from './storage';
import {
  CreateTenantModal,
  EditTenantModal,
  SelectedCheckIcon,
  type CreateTenantInputPayload,
} from './tenant-modals';
import { TenantUsersModal } from './tenant-users-modal';
import {
  formatIsoTimestamp,
  formatSubmissionValue,
} from './tenant-utils';

export {
  FormDetailPanel,
  type FormDetailPanelProps,
} from './form-detail';
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
  users?: ManagedTenantUser[];
  activeTenantId: string;
  isSuperadmin?: boolean;
  onSelectTenant: (tenantId: string, navigateToForms?: boolean) => void;
  onCreateTenant: (input: CreateTenantInputPayload) => Promise<void>;
  onUpdateTenant: (
    tenantId: string,
    input: {
      name: string;
      slug: string;
      status?: 'active' | 'suspended';
    },
  ) => Promise<void> | void;
  onCreateTenantUser?: (input: {
    clientId: string;
    username: string;
    displayName: string;
    password: string;
    role: 'tenant_admin' | 'tenant_member';
  }) => Promise<void>;
  onUpdateTenantUser?: (
    userId: string,
    input: {
      username?: string;
      displayName?: string;
      role?: 'tenant_admin' | 'tenant_member';
      isActive?: boolean;
      password?: string;
    },
  ) => Promise<void>;
  onDeleteTenantUser?: (userId: string) => Promise<void>;
  onResetTenantUserCredentials?: (
    userId: string,
    input: {
      password?: string;
      email?: string;
    },
  ) => Promise<ResetUserCredentialsResponse>;
  onEditForm: (form: FormSchema) => void;
  onViewForm: (form: FormSchema) => void;
  onViewFormSubmissions: (form: FormSchema) => void;
  onCreateFormForTenant: (tenantId: string, title: string) => void;
}

export function TenantDashboardPanel({
  tenants,
  forms,
  submissions,
  users = [],
  activeTenantId,
  isSuperadmin = true,
  onSelectTenant,
  onCreateTenant,
  onUpdateTenant,
  onCreateTenantUser,
  onUpdateTenantUser,
  onDeleteTenantUser,
  onResetTenantUserCredentials,
  onEditForm,
  onViewForm,
  onViewFormSubmissions,
  onCreateFormForTenant,
}: TenantDashboardPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string | null>(
    null,
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateFormModal, setShowCreateFormModal] = useState(false);
  const [newFormTenantId, setNewFormTenantId] = useState(activeTenantId);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [editingTenant, setEditingTenant] = useState<ClientTenant | null>(null);
  const [managingUsersTenantId, setManagingUsersTenantId] = useState<
    string | null
  >(null);

  const managingUsersTenant = managingUsersTenantId
    ? (tenants.find((t) => t.id === managingUsersTenantId) ?? null)
    : null;

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

  const tenantMap = new Map<string, ClientTenant>(
    tenants.map((t) => [t.id, t]),
  );
  const effectiveTenantFilter =
    isSuperadmin && selectedTenantFilter && tenantMap.has(selectedTenantFilter)
      ? selectedTenantFilter
      : null;
  const filteredTenant = effectiveTenantFilter
    ? (tenantMap.get(effectiveTenantFilter) ?? null)
    : null;
  const activeTenant =
    tenants.find((t) => t.id === activeTenantId) ?? tenants[0];

  const formCountByTenant = new Map<string, number>();
  let totalFieldsCount = 0;
  let latestFormUpdatedAt: string | null = null;

  for (const form of forms) {
    formCountByTenant.set(
      form.clientId,
      (formCountByTenant.get(form.clientId) ?? 0) + 1,
    );
    totalFieldsCount += form.fields.length;
    if (!latestFormUpdatedAt || form.updatedAt > latestFormUpdatedAt) {
      latestFormUpdatedAt = form.updatedAt;
    }
  }

  const submissionCountByTenant = new Map<string, number>();
  const submissionCountByFormKey = new Map<string, number>();
  let latestSubmissionAt: string | null = null;

  for (const sub of submissions) {
    submissionCountByTenant.set(
      sub.clientId,
      (submissionCountByTenant.get(sub.clientId) ?? 0) + 1,
    );
    const formKey = `${sub.clientId}::${sub.formId}`;
    submissionCountByFormKey.set(
      formKey,
      (submissionCountByFormKey.get(formKey) ?? 0) + 1,
    );
    if (!latestSubmissionAt || sub.submittedAt > latestSubmissionAt) {
      latestSubmissionAt = sub.submittedAt;
    }
  }

  const latestActivityAt =
    latestSubmissionAt && latestFormUpdatedAt
      ? latestSubmissionAt > latestFormUpdatedAt
        ? latestSubmissionAt
        : latestFormUpdatedAt
      : (latestSubmissionAt ?? latestFormUpdatedAt);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredTenants = tenants.filter((tenant) => {
    if (!normalizedQuery) return true;
    return (
      tenant.name.toLowerCase().includes(normalizedQuery) ||
      tenant.slug.toLowerCase().includes(normalizedQuery) ||
      tenant.id.toLowerCase().includes(normalizedQuery)
    );
  });

  const filteredForms = [...forms]
    .filter((form) => {
      if (effectiveTenantFilter && form.clientId !== effectiveTenantFilter) {
        return false;
      }
      if (!normalizedQuery) return true;
      const tenant = tenantMap.get(form.clientId);
      return (
        form.title.toLowerCase().includes(normalizedQuery) ||
        form.slug.toLowerCase().includes(normalizedQuery) ||
        (form.description?.toLowerCase().includes(normalizedQuery) ?? false) ||
        (tenant?.name.toLowerCase().includes(normalizedQuery) ?? false)
      );
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const handleToggleTenantFilter = (tenantId: string) => {
    setSelectedTenantFilter((prev) => (prev === tenantId ? null : tenantId));
    onSelectTenant(tenantId, false);
  };

  const handleOpenCreateFormModal = () => {
    const fallbackTenantId =
      effectiveTenantFilter ?? activeTenant?.id ?? tenants[0]?.id ?? '';
    setNewFormTenantId(fallbackTenantId);
    setNewFormTitle('');
    setShowCreateFormModal(true);
  };

  const handleCreateFormSubmit = () => {
    const trimmed = newFormTitle.trim();
    const targetTenantId = isSuperadmin
      ? newFormTenantId
      : (activeTenant?.id ?? newFormTenantId);
    if (!trimmed || !targetTenantId) return;
    onCreateFormForTenant(targetTenantId, trimmed);
    setNewFormTitle('');
    setShowCreateFormModal(false);
  };

  return (
    <main
      aria-label="Tenant Dashboard"
      className="flex-1 overflow-y-auto p-6 bg-[#f4f5f7]"
    >
      <PageContainer>
        {/* Header & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">
                {isSuperadmin ? 'DASHBOARD' : 'WORKSPACE OVERVIEW'}
              </Badge>
              {isSuperadmin ? (
                <span className="font-mono text-xs text-zinc-500">
                  {tenants.length} {tenants.length === 1 ? 'tenant' : 'tenants'} ·{' '}
                  {forms.length} {forms.length === 1 ? 'form' : 'forms'}
                </span>
              ) : (
                activeTenant && (
                  <span className="font-mono text-xs text-zinc-500">
                    {activeTenant.name} · {forms.length}{' '}
                    {forms.length === 1 ? 'form' : 'forms'}
                  </span>
                )
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {isSuperadmin
                ? 'Overview of platform metrics, client tenants, and all forms. Click a tenant row to filter forms, and use form action icons to edit, preview, or view submissions.'
                : 'Overview of your workspace metrics and forms. Use the action icons on any row to edit, preview, or view submissions.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={
                isSuperadmin ? 'Search tenants and forms' : 'Search forms'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isSuperadmin ? 'Search tenants or forms...' : 'Search forms...'
              }
              className="h-8 w-56 text-xs"
            />
            <Button
              size="sm"
              variant={isSuperadmin ? 'secondary' : 'primary'}
              onClick={handleOpenCreateFormModal}
              disabled={tenants.length === 0}
            >
              + New Form
            </Button>
            {isSuperadmin && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setShowCreateModal(true)}
              >
                + New Tenant
              </Button>
            )}
          </div>
        </div>

        {/* Summary KPI Cards */}
        {isSuperadmin ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
            <div className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs space-y-1">
              <span className="block font-mono text-xs uppercase text-zinc-500 font-semibold tracking-wider">
                Total Fields
              </span>
              <span className="block text-2xl font-bold font-mono text-zinc-900">
                {totalFieldsCount}
              </span>
              <p className="text-xs text-zinc-500">
                Configured inputs across all forms
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs space-y-1">
              <span className="block font-mono text-xs uppercase text-zinc-500 font-semibold tracking-wider">
                Forms
              </span>
              <span className="block text-2xl font-bold font-mono text-zinc-900">
                {forms.length}
              </span>
              <p className="text-xs text-zinc-500">
                Configured workspace schemas
              </p>
            </div>
            <div className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs space-y-1">
              <span className="block font-mono text-xs uppercase text-zinc-500 font-semibold tracking-wider">
                Total Fields
              </span>
              <span className="block text-2xl font-bold font-mono text-zinc-900">
                {totalFieldsCount}
              </span>
              <p className="text-xs text-zinc-500">
                Configured inputs across forms
              </p>
            </div>
            <div className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs space-y-1">
              <span className="block font-mono text-xs uppercase text-zinc-500 font-semibold tracking-wider">
                Submissions
              </span>
              <span className="block text-2xl font-bold font-mono text-zinc-900">
                {submissions.length}
              </span>
              <p className="text-xs text-zinc-500">
                Captured workspace responses
              </p>
            </div>
            <div className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs space-y-1">
              <span className="block font-mono text-xs uppercase text-zinc-500 font-semibold tracking-wider">
                Last Activity
              </span>
              <span className="block text-2xl font-bold font-mono text-zinc-900">
                {latestActivityAt ? latestActivityAt.slice(0, 10) : '—'}
              </span>
              <p className="text-xs text-zinc-500">
                Latest form or submission update
              </p>
            </div>
          </div>
        )}

        {/* All Tenants Table (Superadmin only) */}
        {isSuperadmin && (
          <section
            aria-label="All Tenants"
            className="rounded-lg border border-zinc-200 bg-white shadow-2xs overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200 bg-zinc-50/70">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-zinc-700 font-semibold">
                  All Tenants ({filteredTenants.length})
                </span>
                <span className="text-xs text-zinc-400">
                  Click a row to filter forms below
                </span>
              </div>
              {filteredTenant && (
                <div className="flex items-center gap-2">
                  <Badge variant="success">
                    Filtering: {filteredTenant.name}
                  </Badge>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setSelectedTenantFilter(null)}
                  >
                    Clear filter
                  </Button>
                </div>
              )}
            </div>

            {filteredTenants.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-zinc-800">
                  No client tenants match your search
                </p>
                <p className="text-xs text-zinc-500">
                  Try adjusting your query or click &quot;+ New Tenant&quot; to
                  provision a new workspace.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 font-mono text-[11px] uppercase text-zinc-500">
                      <th className="py-2.5 px-3">Tenant</th>
                      <th className="py-2.5 px-3">Forms</th>
                      <th className="py-2.5 px-3">Submissions</th>
                      <th className="py-2.5 px-3">Created</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {filteredTenants.map((tenant) => {
                      const isFiltered = tenant.id === effectiveTenantFilter;
                      const tenantFormsCount =
                        formCountByTenant.get(tenant.id) ?? 0;
                      const tenantSubmissionsCount =
                        submissionCountByTenant.get(tenant.id) ?? 0;

                      return (
                        <tr
                          key={tenant.id}
                          tabIndex={0}
                          aria-selected={isFiltered}
                          onClick={() => handleToggleTenantFilter(tenant.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleToggleTenantFilter(tenant.id);
                            }
                          }}
                          className={
                            isFiltered
                              ? 'bg-emerald-50/50 hover:bg-emerald-50/80 text-zinc-900 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40'
                              : 'hover:bg-zinc-50 text-zinc-700 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40'
                          }
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-zinc-900">
                                {tenant.name}
                              </span>
                              <Badge
                                variant={
                                  tenant.status === 'suspended'
                                    ? 'danger'
                                    : 'success'
                                }
                              >
                                {tenant.status === 'suspended'
                                  ? 'SUSPENDED'
                                  : 'ACTIVE'}
                              </Badge>
                              {isFiltered && (
                                <Badge variant="success" className="gap-1">
                                  <SelectedCheckIcon className="w-3 h-3 text-emerald-600" />
                                  FILTERED
                                </Badge>
                              )}
                            </div>
                            <span className="block font-mono text-[11px] text-zinc-400 mt-0.5">
                              /{tenant.slug}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="neutral">
                              {tenantFormsCount}{' '}
                              {tenantFormsCount === 1 ? 'form' : 'forms'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant={
                                tenantSubmissionsCount > 0
                                  ? 'success'
                                  : 'neutral'
                              }
                            >
                              {tenantSubmissionsCount}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-500 whitespace-nowrap">
                            {tenant.createdAt.slice(0, 10)}
                          </td>
                          <td
                            className="py-2.5 px-3 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {onCreateTenantUser &&
                                onUpdateTenantUser &&
                                onDeleteTenantUser && (
                                  <Button
                                    size="xs"
                                    variant="secondary"
                                    onClick={() =>
                                      setManagingUsersTenantId(tenant.id)
                                    }
                                    aria-label={`Manage users and credentials for ${tenant.name}`}
                                    title={`Manage users and credentials for ${tenant.name}`}
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
                                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                      <circle cx="9" cy="7" r="4" />
                                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    </svg>
                                  </Button>
                                )}
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={() => setEditingTenant(tenant)}
                                aria-label={`Edit ${tenant.name}`}
                                title={`Edit ${tenant.name}`}
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
                                onClick={() => onSelectTenant(tenant.id, true)}
                                aria-label={`Open ${tenant.name} in All Forms`}
                                title={`Open ${tenant.name} in All Forms`}
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
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <line x1="16" y1="13" x2="8" y2="13" />
                                  <line x1="16" y1="17" x2="8" y2="17" />
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
            )}
          </section>
        )}

        {/* All Forms Table */}
        <section
          aria-label="All Forms"
          className="rounded-lg border border-zinc-200 bg-white shadow-2xs overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200 bg-zinc-50/70">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-zinc-700 font-semibold">
                {filteredTenant
                  ? `${filteredTenant.name} Forms (${filteredForms.length})`
                  : `All Forms (${filteredForms.length})`}
              </span>
              <span className="text-xs text-zinc-400">
                Use action icons to edit, preview, or view submissions
              </span>
            </div>
            {filteredTenant && (
              <Button
                size="xs"
                variant="secondary"
                onClick={() => setSelectedTenantFilter(null)}
              >
                Show All Forms
              </Button>
            )}
          </div>

          {filteredForms.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-zinc-800">
                {normalizedQuery || filteredTenant
                  ? 'No forms match your current filter'
                  : 'No forms configured yet'}
              </p>
              <p className="text-xs text-zinc-500">
                {normalizedQuery || filteredTenant
                  ? 'Try clearing your search or tenant filter, or create a new form.'
                  : 'Create your first form to open the builder, preview, or collect submissions.'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                {(normalizedQuery || filteredTenant) && (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedTenantFilter(null);
                    }}
                  >
                    Reset Filters
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="primary"
                  onClick={handleOpenCreateFormModal}
                  disabled={tenants.length === 0}
                >
                  + New Form
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 font-mono text-[11px] uppercase text-zinc-500">
                    <th className="py-2.5 px-3">Form</th>
                    {isSuperadmin && <th className="py-2.5 px-3">Tenant</th>}
                    <th className="py-2.5 px-3">Fields</th>
                    <th className="py-2.5 px-3">Submissions</th>
                    <th className="py-2.5 px-3">Updated</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {filteredForms.map((form) => {
                    const tenant = tenantMap.get(form.clientId);
                    const formSubCount =
                      submissionCountByFormKey.get(
                        `${form.clientId}::${form.id}`,
                      ) ?? 0;

                    return (
                      <tr
                        key={form.id}
                        className="hover:bg-zinc-50 text-zinc-700 transition-colors"
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-900">
                              {form.title}
                            </span>
                          </div>
                          {form.description ? (
                            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1 max-w-xs">
                              {form.description}
                            </p>
                          ) : (
                            <span className="font-mono text-[11px] text-zinc-400">
                              /{form.slug}
                            </span>
                          )}
                        </td>
                        {isSuperadmin && (
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-zinc-800">
                              {tenant?.name ?? form.clientId}
                            </span>
                          </td>
                        )}
                        <td className="py-2.5 px-3">
                          <Badge variant="neutral">
                            {form.fields.length}{' '}
                            {form.fields.length === 1 ? 'field' : 'fields'}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={formSubCount > 0 ? 'success' : 'neutral'}
                          >
                            {formSubCount}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-zinc-500 whitespace-nowrap">
                          {formatIsoTimestamp(form.updatedAt)}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => onEditForm(form)}
                              aria-label={`Edit ${form.title}`}
                              title={`Edit ${form.title}`}
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
                              onClick={() => onViewForm(form)}
                              aria-label={`Preview ${form.title}`}
                              title={`Preview ${form.title}`}
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
                              onClick={() => onViewFormSubmissions(form)}
                              aria-label={`Submissions for ${form.title}`}
                              title={`Submissions for ${form.title}`}
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
                                <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
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
          )}
        </section>
      </PageContainer>

      {/* Create Tenant Modal */}
      <CreateTenantModal
        open={showCreateModal}
        tenants={tenants}
        idPrefix="dashboard"
        onClose={() => setShowCreateModal(false)}
        onCreateTenant={onCreateTenant}
      />

      {/* Create Form Modal */}
      {showCreateFormModal && (
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
              {!isSuperadmin && activeTenant && (
                <Badge variant="neutral">{activeTenant.name}</Badge>
              )}
            </div>
            {isSuperadmin && (
              <div className="space-y-1.5">
                <Label htmlFor="dashboard_new_form_tenant">Client Tenant</Label>
                <Select
                  id="dashboard_new_form_tenant"
                  menuHeading="Select Client Tenant"
                  value={newFormTenantId}
                  onValueChange={setNewFormTenantId}
                  options={tenants.map((t) => {
                    const count = formCountByTenant.get(t.id) ?? 0;
                    return {
                      value: t.id,
                      label: t.name,
                      meta: `${count} ${count === 1 ? 'form' : 'forms'}`,
                    };
                  })}
                />
              </div>
            )}
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
        onManageUsers={
          onCreateTenantUser && onUpdateTenantUser && onDeleteTenantUser
            ? (target) => {
                setEditingTenant(null);
                setManagingUsersTenantId(target.id);
              }
            : undefined
        }
      />

      {/* Tenant Users & Credentials Modal */}
      {managingUsersTenant &&
        onCreateTenantUser &&
        onUpdateTenantUser &&
        onDeleteTenantUser && (
          <TenantUsersModal
            tenant={managingUsersTenant}
            users={users}
            onClose={() => setManagingUsersTenantId(null)}
            onCreateUser={onCreateTenantUser}
            onUpdateUser={onUpdateTenantUser}
            onDeleteUser={onDeleteTenantUser}
            onResetCredentials={onResetTenantUserCredentials}
          />
        )}
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

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
      <PageContainer>
        {/* Tenant Scope & Export Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="neutral">{tenant.name}</Badge>
              <span className="text-xs font-medium text-zinc-900">
                {schema.title}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              {submissions.length}{' '}
              {submissions.length === 1 ? 'submission' : 'submissions'} recorded
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
            {confirmClearAll ? (
              <div className="inline-flex items-center gap-1">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setConfirmClearAll(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="xs"
                  variant="danger"
                  onClick={() => {
                    setConfirmClearAll(false);
                    onClearFormSubmissions();
                  }}
                >
                  Confirm Clear All
                </Button>
              </div>
            ) : (
              <Button
                size="xs"
                variant="danger"
                disabled={submissions.length === 0}
                onClick={() => setConfirmClearAll(true)}
              >
                Clear All
              </Button>
            )}
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="p-12 rounded-lg border border-dashed border-zinc-300 bg-white/60 text-center space-y-2">
            <p className="text-sm font-medium text-zinc-800">
              No submissions recorded for {schema.title}
            </p>
            <p className="text-xs text-zinc-500">
              Switch to Live Preview and submit the form to record a submission.
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
                      <th className="py-2.5 px-3">#</th>
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
                    {submissions.map((sub, idx) => {
                      const isSelected = selectedRecord?.id === sub.id;
                      const isConfirming = confirmDeleteId === sub.id;
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
                          <td className="py-2.5 px-3 font-mono text-zinc-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-zinc-500 whitespace-nowrap">
                            {formatIsoTimestamp(sub.submittedAt)}
                          </td>
                          {dataFields.slice(0, 3).map((field) => (
                            <td
                              key={field.id}
                              className="py-2.5 px-3 max-w-[160px] truncate"
                            >
                              {formatSubmissionValue(sub.values[field.id])}
                            </td>
                          ))}
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
                                    onDeleteSubmission(sub.id);
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
              {dataFields.length > 3 && (
                <div className="px-3 py-2 border-t border-zinc-200 bg-zinc-50/60 text-[11px] text-zinc-500">
                  Showing first 3 of {dataFields.length} fields — select a row to view all responses.
                </div>
              )}
            </div>

            {/* Selected Record Inspector */}
            {selectedRecord && (
              <aside
                aria-label="Submission Details"
                className="p-4 rounded-lg border border-zinc-200 bg-white shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
                  <div>
                    <Badge variant="success">RESPONSE DETAILS</Badge>
                    <p className="font-mono text-[11px] text-zinc-500 mt-1">
                      {formatIsoTimestamp(selectedRecord.submittedAt)}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {tenant.name}
                  </span>
                </div>

                <div className="space-y-2">
                  {dataFields.map((field) => (
                    <div
                      key={field.id}
                      className="p-2.5 rounded-md border border-zinc-200 bg-zinc-50/50 space-y-0.5"
                    >
                      <span className="text-xs font-medium text-zinc-700 block">
                        {field.label}
                      </span>
                      <p className="text-xs text-zinc-900 break-all">
                        {formatSubmissionValue(selectedRecord.values[field.id])}
                      </p>
                    </div>
                  ))}
                </div>
              </aside>
            )}
          </div>
        )}
      </PageContainer>
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
  onOpenForm: (form: FormSchema) => void;
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
  onOpenForm,
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
        !showCreateModal
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [showCreateModal]);

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
        description: tenantFilter === 'ALL' ? (tenant?.name ?? undefined) : undefined,
        meta: `${f.fields.length} ${f.fields.length === 1 ? 'field' : 'fields'}`,
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
      <PageContainer>
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
              specific form, or click any row to open its form management page.
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
                placeholder={
                  isSuperadmin
                    ? 'Filter forms by title or tenant...'
                    : 'Filter forms by title...'
                }
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
                    <th className="py-2.5 px-3">Fields</th>
                    <th className="py-2.5 px-3">Submissions</th>
                    <th className="py-2.5 px-3">Updated</th>
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
                        onClick={() => onOpenForm(form)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenForm(form);
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
                          <span className="text-zinc-800 font-medium">
                            {tenant?.name ?? form.clientId}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <Badge variant="neutral">
                            {form.fields.length}{' '}
                            {form.fields.length === 1 ? 'field' : 'fields'}
                          </Badge>
                        </td>

                        <td className="py-3 px-3">
                          <Badge
                            variant={
                              formSubmissionsCount > 0 ? 'success' : 'neutral'
                            }
                          >
                            {formSubmissionsCount}
                          </Badge>
                        </td>

                        <td className="py-3 px-3 font-mono text-zinc-500">
                          {form.updatedAt.slice(0, 16).replace('T', ' ')}
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
      </PageContainer>

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
            </div>
            {isSuperadmin && (
              <div className="space-y-1.5">
                <Label htmlFor="dir_new_form_tenant">Client Tenant</Label>
                <Select
                  id="dir_new_form_tenant"
                  menuHeading="Select Client Tenant"
                  value={newFormTenantId}
                  onValueChange={setNewFormTenantId}
                  options={tenants.map((t) => {
                    const count = forms.filter((f) => f.clientId === t.id).length;
                    return {
                      value: t.id,
                      label: t.name,
                      meta: `${count} ${count === 1 ? 'form' : 'forms'}`,
                    };
                  })}
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

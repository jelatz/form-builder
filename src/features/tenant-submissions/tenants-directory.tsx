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
  PageContainer,
  type FilterDropdownOption,
} from '../../shared/ui';
import {
  CreateTenantModal,
  EditTenantModal,
  type CreateTenantInputPayload,
} from './tenant-modals';
import type {
  ManagedTenantUser,
  ResetUserCredentialsResponse,
} from './storage';
import { TenantUsersModal } from './tenant-users-modal';

type TenantSortKey = 'name' | 'created' | 'forms' | 'submissions';
type TenantActivityFilter =
  | 'ALL'
  | 'WITH_FORMS'
  | 'WITH_SUBMISSIONS'
  | 'NO_SUBMISSIONS';

export interface TenantsDirectoryPanelProps {
  tenants: ClientTenant[];
  forms: FormSchema[];
  submissions: SubmissionRecord[];
  users?: ManagedTenantUser[];
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
  onDeleteTenant: (tenantId: string) => void;
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
}

const ACTIVITY_LABELS: Record<TenantActivityFilter, string> = {
  ALL: 'All Tenants',
  WITH_FORMS: 'Has Forms',
  WITH_SUBMISSIONS: 'Has Submissions',
  NO_SUBMISSIONS: 'No Submissions',
};

const SORT_LABELS: Record<TenantSortKey, string> = {
  name: 'Name (A–Z)',
  created: 'Newest Created',
  forms: 'Most Forms',
  submissions: 'Most Submissions',
};

/** Full-page searchable, filterable directory listing all client tenants. */
export function TenantsDirectoryPanel({
  tenants,
  forms,
  submissions,
  users = [],
  onSelectTenant,
  onCreateTenant,
  onUpdateTenant,
  onDeleteTenant,
  onCreateTenantUser,
  onUpdateTenantUser,
  onDeleteTenantUser,
  onResetTenantUserCredentials,
}: TenantsDirectoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activityFilter, setActivityFilter] =
    useState<TenantActivityFilter>('ALL');
  const [sortBy, setSortBy] = useState<TenantSortKey>('name');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<ClientTenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<ClientTenant | null>(
    null,
  );
  const [managingUsersTenantId, setManagingUsersTenantId] = useState<
    string | null
  >(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const managingUsersTenant = managingUsersTenantId
    ? (tenants.find((t) => t.id === managingUsersTenantId) ?? null)
    : null;

  const hasOpenModal =
    showCreateModal ||
    editingTenant !== null ||
    deletingTenant !== null ||
    managingUsersTenant !== null;

  useEffect(() => {
    if (!deletingTenant) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDeletingTenant(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [deletingTenant]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        !hasOpenModal
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [hasOpenModal]);

  const formCountByTenant = new Map<string, number>();
  for (const form of forms) {
    formCountByTenant.set(
      form.clientId,
      (formCountByTenant.get(form.clientId) ?? 0) + 1,
    );
  }

  const submissionCountByTenant = new Map<string, number>();
  for (const submission of submissions) {
    submissionCountByTenant.set(
      submission.clientId,
      (submissionCountByTenant.get(submission.clientId) ?? 0) + 1,
    );
  }

  const filteredTenants = tenants.filter((tenant) => {
    const formCount = formCountByTenant.get(tenant.id) ?? 0;
    const submissionCount = submissionCountByTenant.get(tenant.id) ?? 0;

    if (activityFilter === 'WITH_FORMS' && formCount === 0) return false;
    if (activityFilter === 'WITH_SUBMISSIONS' && submissionCount === 0) {
      return false;
    }
    if (activityFilter === 'NO_SUBMISSIONS' && submissionCount > 0) {
      return false;
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    return (
      tenant.name.toLowerCase().includes(query) ||
      tenant.id.toLowerCase().includes(query) ||
      tenant.slug.toLowerCase().includes(query)
    );
  });

  const sortedTenants = [...filteredTenants].sort((a, b) => {
    if (sortBy === 'created') {
      return b.createdAt.localeCompare(a.createdAt);
    }
    if (sortBy === 'forms') {
      return (
        (formCountByTenant.get(b.id) ?? 0) - (formCountByTenant.get(a.id) ?? 0)
      );
    }
    if (sortBy === 'submissions') {
      return (
        (submissionCountByTenant.get(b.id) ?? 0) -
        (submissionCountByTenant.get(a.id) ?? 0)
      );
    }
    return a.name.localeCompare(b.name);
  });

  const hasActiveFilters =
    activityFilter !== 'ALL' || searchQuery.trim() !== '';

  const activityDropdownOptions: FilterDropdownOption[] = [
    {
      value: 'ALL',
      label: 'All Tenants',
      description: 'Every client workspace',
      meta: String(tenants.length),
    },
    {
      value: 'WITH_FORMS',
      label: 'Has Forms',
      description: 'Tenants with at least one form',
      meta: String(
        tenants.filter((t) => (formCountByTenant.get(t.id) ?? 0) > 0).length,
      ),
    },
    {
      value: 'WITH_SUBMISSIONS',
      label: 'Has Submissions',
      description: 'Tenants with captured responses',
      meta: String(
        tenants.filter((t) => (submissionCountByTenant.get(t.id) ?? 0) > 0)
          .length,
      ),
    },
    {
      value: 'NO_SUBMISSIONS',
      label: 'No Submissions',
      description: 'Tenants without recorded submissions',
      meta: String(
        tenants.filter((t) => (submissionCountByTenant.get(t.id) ?? 0) === 0)
          .length,
      ),
    },
  ];

  const sortDropdownOptions: FilterDropdownOption[] = [
    {
      value: 'name',
      label: 'Name (A–Z)',
      description: 'Alphabetical by organization name',
    },
    {
      value: 'created',
      label: 'Newest Created',
      description: 'Most recently provisioned first',
    },
    {
      value: 'forms',
      label: 'Most Forms',
      description: 'Highest form count first',
    },
    {
      value: 'submissions',
      label: 'Most Submissions',
      description: 'Highest submission volume first',
    },
  ];

  const handleClearFilters = () => {
    setActivityFilter('ALL');
    setSearchQuery('');
  };

  const canDeleteTenants = tenants.length > 1;
  const deletingFormCount = deletingTenant
    ? (formCountByTenant.get(deletingTenant.id) ?? 0)
    : 0;
  const deletingSubmissionCount = deletingTenant
    ? (submissionCountByTenant.get(deletingTenant.id) ?? 0)
    : 0;

  return (
    <main
      aria-label="Tenants Directory"
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
                  d="M2.5 13.5h11M4 13.5V3.5l4-1.5 4 1.5v10M6.5 6h1M6.5 8.5h1M9 6h1M9 8.5h1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              TENANTS DIRECTORY
            </Badge>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              All Tenants
            </h1>
            <p className="text-xs text-zinc-500">
              Browse all isolated client tenant workspaces. Search by
              organization, switch active context, or jump directly into a
              tenant&apos;s forms.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="inline-flex items-center h-9 px-3 rounded-md border border-zinc-200 bg-white font-mono text-xs text-zinc-600 shadow-2xs">
              Showing{' '}
              <span className="mx-1 font-semibold text-zinc-900">
                {sortedTenants.length}
              </span>{' '}
              of {tenants.length}{' '}
              {tenants.length === 1 ? 'tenant' : 'tenants'}
            </div>
            <Button
              size="default"
              variant="primary"
              onClick={() => setShowCreateModal(true)}
            >
              + New Tenant
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
                aria-label="Search tenants"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter tenants by name..."
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
              <FilterDropdown
                ariaLabel="Filter tenants by activity"
                prefix="Activity"
                menuHeading="Filter by Activity"
                value={activityFilter}
                options={activityDropdownOptions}
                onChange={(nextValue) =>
                  setActivityFilter(nextValue as TenantActivityFilter)
                }
                isActive={activityFilter !== 'ALL'}
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
                      d="M2.5 8h2.5l1.5-4 3 8 1.5-4h2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              />

              <FilterDropdown
                ariaLabel="Sort tenants"
                prefix="Sort"
                menuHeading="Sort Directory"
                value={sortBy}
                options={sortDropdownOptions}
                onChange={(nextValue) => setSortBy(nextValue as TenantSortKey)}
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
              {activityFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setActivityFilter('ALL')}
                  className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                >
                  <span>Activity: {ACTIVITY_LABELS[activityFilter]}</span>
                  <span className="text-emerald-600" aria-hidden="true">
                    ×
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tenants Table */}
        {sortedTenants.length === 0 ? (
          <div className="p-12 rounded-lg border border-dashed border-zinc-300 bg-white/60 text-center space-y-2">
            <p className="text-sm font-medium text-zinc-800">
              No tenants match the current filter
            </p>
            <p className="text-xs text-zinc-500">
              Try clearing your filters or provisioning a new client tenant
              workspace.
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
                    <th className="py-2.5 px-3">Tenant</th>
                    <th className="py-2.5 px-3">Forms</th>
                    <th className="py-2.5 px-3">Submissions</th>
                    <th className="py-2.5 px-3">Users</th>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {sortedTenants.map((tenant) => {
                    const formCount = formCountByTenant.get(tenant.id) ?? 0;
                    const submissionCount =
                      submissionCountByTenant.get(tenant.id) ?? 0;
                    const userCount = users.filter(
                      (u) => u.clientId === tenant.id,
                    ).length;

                    return (
                      <tr
                        key={tenant.id}
                        tabIndex={0}
                        onClick={() => onSelectTenant(tenant.id, false)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectTenant(tenant.id, false);
                          }
                        }}
                        className="hover:bg-zinc-50 text-zinc-700 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40"
                      >
                        <td className="py-3 px-3">
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
                          </div>
                          <span className="block font-mono text-[11px] text-zinc-400 mt-0.5">
                            /{tenant.slug}
                          </span>
                        </td>

                        <td
                          className="py-3 px-3"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectTenant(tenant.id, true)}
                            title={`View ${formCount} forms for ${tenant.name}`}
                            aria-label={`View ${formCount} forms for ${tenant.name}`}
                            className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                          >
                            <Badge variant="neutral">
                              {formCount} {formCount === 1 ? 'form' : 'forms'}
                            </Badge>
                          </button>
                        </td>

                        <td className="py-3 px-3">
                          <Badge
                            variant={submissionCount > 0 ? 'success' : 'neutral'}
                          >
                            {submissionCount}
                          </Badge>
                        </td>

                        <td
                          className="py-3 px-3"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setManagingUsersTenantId(tenant.id)}
                            title={`Manage logins for ${tenant.name}`}
                            className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                          >
                            <Badge variant="neutral">
                              {userCount} {userCount === 1 ? 'user' : 'users'}
                            </Badge>
                          </button>
                        </td>

                        <td className="py-3 px-3 font-mono text-zinc-500 whitespace-nowrap">
                          {tenant.createdAt.slice(0, 10)}
                        </td>

                        <td
                          className="py-3 px-3 text-right whitespace-nowrap"
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
                              variant="danger"
                              disabled={!canDeleteTenants}
                              onClick={() => setDeletingTenant(tenant)}
                              aria-label={`Delete ${tenant.name}`}
                              title={
                                canDeleteTenants
                                  ? `Delete ${tenant.name}`
                                  : 'Cannot delete the last remaining tenant'
                              }
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
                  {sortedTenants.length}
                </span>{' '}
                of{' '}
                <span className="font-medium text-zinc-800">
                  {tenants.length}
                </span>{' '}
                {tenants.length === 1 ? 'entry' : 'entries'}
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                Sorted by {SORT_LABELS[sortBy]}
              </span>
            </div>
          </div>
        )}
      </PageContainer>

      {/* Create Tenant Modal */}
      <CreateTenantModal
        open={showCreateModal}
        tenants={tenants}
        idPrefix="tenants_dir"
        onClose={() => setShowCreateModal(false)}
        onCreateTenant={onCreateTenant}
      />

      {/* Edit Tenant Modal */}
      <EditTenantModal
        tenant={editingTenant}
        tenants={tenants}
        idPrefix="tenants_dir"
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

      {/* Delete Tenant Confirmation Modal */}
      {deletingTenant && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeletingTenant(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete_tenant_modal_title"
            className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-lg space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <Badge variant="danger">DELETE TENANT</Badge>
            </div>

            <div className="space-y-2">
              <p
                id="delete_tenant_modal_title"
                className="text-sm font-semibold text-zinc-900"
              >
                Delete &ldquo;{deletingTenant.name}&rdquo;?
              </p>
              <p className="text-xs text-zinc-600 leading-relaxed">
                This permanently removes the tenant workspace along with{' '}
                <span className="font-semibold text-zinc-900">
                  {deletingFormCount}{' '}
                  {deletingFormCount === 1 ? 'form' : 'forms'}
                </span>{' '}
                and{' '}
                <span className="font-semibold text-zinc-900">
                  {deletingSubmissionCount}{' '}
                  {deletingSubmissionCount === 1
                    ? 'submission'
                    : 'submissions'}
                </span>{' '}
                scoped to this tenant.
              </p>
            </div>

            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Created</span>
                <span className="font-mono text-zinc-800">
                  {deletingTenant.createdAt.slice(0, 10)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200">
              <Button
                size="xs"
                variant="secondary"
                onClick={() => setDeletingTenant(null)}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                variant="danger"
                onClick={() => {
                  onDeleteTenant(deletingTenant.id);
                  setDeletingTenant(null);
                }}
              >
                Delete Tenant
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Users / Credentials Modal */}
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

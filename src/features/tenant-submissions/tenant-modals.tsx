import { useCallback, useEffect, useState } from 'react';
import type { ClientTenant } from '../../domain/form-schema';
import {
  EMAIL_PATTERN,
  USERNAME_PATTERN,
  toSnakeCaseUsername,
} from '../../shared/lib';
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  type DropdownOption,
} from '../../shared/ui';
import {
  ensureUniqueTenantSlug,
  validateEditTenantInput,
} from './tenant-utils';

/** Checkmark icon used to highlight active/selected tenant badges. */
export function SelectedCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? 'w-3 h-3 shrink-0'}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M2.5 6.25l2.25 2.25L9.5 3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface CreateTenantInputPayload {
  name: string;
  slug: string;
  adminUsername: string;
  email: string;
}

export interface CreateTenantModalProps {
  open: boolean;
  tenants: ClientTenant[];
  idPrefix: string;
  onClose: () => void;
  onCreateTenant: (input: CreateTenantInputPayload) => Promise<void>;
}

/** Modal dialog for provisioning a new multi-tenant client workspace. */
export function CreateTenantModal({
  open,
  tenants,
  idPrefix,
  onClose,
  onCreateTenant,
}: CreateTenantModalProps) {
  const [tenantName, setTenantName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [isUsernameEdited, setIsUsernameEdited] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resetAndClose = useCallback(() => {
    setTenantName('');
    setAdminUsername('');
    setIsUsernameEdited(false);
    setAdminEmail('');
    setSubmitError(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        resetAndClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, isSubmitting, resetAndClose]);

  if (!open) return null;

  const handleDismiss = () => {
    if (isSubmitting) return;
    resetAndClose();
  };

  const resolvedUsername = isUsernameEdited
    ? adminUsername.trim()
    : tenantName.trim()
      ? toSnakeCaseUsername(tenantName)
      : '';

  const hasUsernameError =
    resolvedUsername !== '' && !USERNAME_PATTERN.test(resolvedUsername);

  const trimmedEmail = adminEmail.trim();
  const hasEmailError =
    trimmedEmail !== '' && !EMAIL_PATTERN.test(trimmedEmail);

  const handleNameChange = (nextName: string) => {
    setTenantName(nextName);
    setSubmitError(null);
    if (!isUsernameEdited) {
      setAdminUsername(
        nextName.trim() ? toSnakeCaseUsername(nextName) : '',
      );
    }
  };

  const handleUsernameChange = (nextUsername: string) => {
    setIsUsernameEdited(true);
    setSubmitError(null);
    setAdminUsername(nextUsername);
  };

  const canSubmit =
    !isSubmitting &&
    tenantName.trim().length >= 2 &&
    USERNAME_PATTERN.test(resolvedUsername) &&
    EMAIL_PATTERN.test(trimmedEmail);

  const handleSubmit = async () => {
    const trimmedName = tenantName.trim();
    if (!canSubmit || !trimmedName) return;

    const resolvedSlug = ensureUniqueTenantSlug(trimmedName, tenants);

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onCreateTenant({
        name: trimmedName,
        slug: resolvedSlug,
        adminUsername: resolvedUsername,
        email: trimmedEmail.toLowerCase(),
      });
      resetAndClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Failed to create tenant workspace.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleId = `${idPrefix}_create_tenant_modal_title`;
  const nameId = `${idPrefix}_new_tenant_name`;
  const usernameId = `${idPrefix}_new_tenant_username`;
  const emailId = `${idPrefix}_new_tenant_email`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={handleDismiss}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 space-y-3 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
          <span
            id={titleId}
            className="font-mono text-xs uppercase text-zinc-700 font-semibold"
          >
            New Client Tenant
          </span>
        </div>

        {submitError && (
          <div
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
          >
            {submitError}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={nameId}>Organization Name</Label>
          <Input
            id={nameId}
            value={tenantName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Value One"
            disabled={isSubmitting}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={usernameId}>Default Admin Username</Label>
          <Input
            id={usernameId}
            value={adminUsername}
            onChange={(e) => handleUsernameChange(e.target.value)}
            placeholder="value_one"
            disabled={isSubmitting}
            className="font-mono text-xs"
          />
          {hasUsernameError ? (
            <p className="text-[11px] text-rose-600">
              Username must be 3–32 characters (letters, numbers, _, ., or -).
            </p>
          ) : (
            <p className="text-[11px] text-zinc-500">
              Auto-derived from organization name for the initial admin account.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={emailId}>Admin Email</Label>
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            required
            value={adminEmail}
            onChange={(e) => {
              setSubmitError(null);
              setAdminEmail(e.target.value);
            }}
            placeholder="admin@valueone.com"
            disabled={isSubmitting}
          />
          {hasEmailError ? (
            <p className="text-[11px] text-rose-600">
              Please enter a valid email address.
            </p>
          ) : (
            <p className="text-[11px] text-zinc-500">
              A generated password will be emailed to this address.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            size="xs"
            variant="ghost"
            onClick={handleDismiss}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="xs"
            variant="primary"
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Creating...' : 'Create Tenant'}
          </Button>
        </div>
      </form>
    </div>
  );
}

const TENANT_STATUS_OPTIONS: DropdownOption[] = [
  {
    value: 'active',
    label: 'Active',
    description: 'Tenant portal logins and public forms are enabled',
    meta: 'ACTIVE',
  },
  {
    value: 'suspended',
    label: 'Suspended',
    description: 'Revokes active sessions and blocks logins and public forms',
    meta: 'SUSPENDED',
  },
];

export interface EditTenantModalProps {
  tenant: ClientTenant | null;
  tenants?: ClientTenant[];
  idPrefix: string;
  onClose: () => void;
  onUpdateTenant: (
    tenantId: string,
    input: {
      name: string;
      slug: string;
      status: 'active' | 'suspended';
    },
  ) => Promise<void> | void;
  onManageUsers?: (tenant: ClientTenant) => void;
}

interface EditTenantModalFormProps {
  tenant: ClientTenant;
  tenants: ClientTenant[];
  idPrefix: string;
  onClose: () => void;
  onUpdateTenant: EditTenantModalProps['onUpdateTenant'];
  onManageUsers?: (tenant: ClientTenant) => void;
}

function EditTenantModalForm({
  tenant,
  tenants,
  idPrefix,
  onClose,
  onUpdateTenant,
  onManageUsers,
}: EditTenantModalFormProps) {
  const [editName, setEditName] = useState(tenant.name);
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>(
    tenant.status ?? 'active',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubmitting, onClose]);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const validation = validateEditTenantInput(
      { name: editName, slug: tenant.slug, status: editStatus },
      tenants,
      tenant.id,
    );
    if (!validation.ok) {
      setSubmitError(validation.error);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onUpdateTenant(tenant.id, validation.data);
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to update tenant details.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleId = `${idPrefix}_edit_tenant_modal_title`;
  const nameId = `${idPrefix}_edit_tenant_name`;
  const statusId = `${idPrefix}_edit_tenant_status`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 space-y-3 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
          <span
            id={titleId}
            className="font-mono text-xs uppercase text-zinc-700 font-semibold"
          >
            Edit Tenant Details
          </span>
          <Badge
            size="sm"
            variant={editStatus === 'suspended' ? 'danger' : 'success'}
          >
            {editStatus === 'suspended' ? 'SUSPENDED' : 'ACTIVE'}
          </Badge>
        </div>

        {submitError && (
          <div
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
          >
            {submitError}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={nameId} requiredIndicator>
            Organization Name
          </Label>
          <Input
            id={nameId}
            value={editName}
            onChange={(e) => {
              setSubmitError(null);
              setEditName(e.target.value);
            }}
            placeholder="Acme Corp"
            disabled={isSubmitting}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={statusId}>Workspace Status</Label>
          <Select
            id={statusId}
            aria-label="Workspace Status"
            value={editStatus}
            options={TENANT_STATUS_OPTIONS}
            onValueChange={(next) => {
              setSubmitError(null);
              setEditStatus(next as 'active' | 'suspended');
            }}
            disabled={isSubmitting}
          />
          {editStatus === 'suspended' && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
              Suspending this workspace immediately revokes active tenant
              sessions, blocks logins, and hides public forms.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200">
          {onManageUsers ? (
            <Button
              type="button"
              size="xs"
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => {
                onClose();
                onManageUsers(tenant);
              }}
            >
              Manage Credentials &amp; Users
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="xs"
              variant="primary"
              disabled={isSubmitting || !editName.trim()}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

/** Modal dialog for editing an existing client tenant's details. */
export function EditTenantModal({
  tenant,
  tenants = [],
  idPrefix,
  onClose,
  onUpdateTenant,
  onManageUsers,
}: EditTenantModalProps) {
  if (!tenant) return null;

  return (
    <EditTenantModalForm
      key={tenant.id}
      tenant={tenant}
      tenants={tenants}
      idPrefix={idPrefix}
      onClose={onClose}
      onUpdateTenant={onUpdateTenant}
      onManageUsers={onManageUsers}
    />
  );
}

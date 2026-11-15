import { useEffect, useState } from 'react';
import type { ClientTenant } from '../../domain/form-schema';
import { Badge, Button, Input, Label } from '../../shared/ui';
import { ensureUniqueTenantSlug, sanitizeTenantSlug } from './tenant-utils';

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

export interface CreateTenantModalProps {
  open: boolean;
  tenants: ClientTenant[];
  idPrefix: string;
  onClose: () => void;
  onCreateTenant: (input: { name: string; slug: string }) => void;
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
  const [tenantSlug, setTenantSlug] = useState('');
  const [isSlugEdited, setIsSlugEdited] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const normalizedSlug = isSlugEdited
    ? sanitizeTenantSlug(tenantSlug)
    : ensureUniqueTenantSlug(tenantName, tenants);

  const hasSlugConflict =
    isSlugEdited &&
    normalizedSlug !== '' &&
    tenants.some((t) => t.slug.toLowerCase() === normalizedSlug);

  const handleNameChange = (nextName: string) => {
    setTenantName(nextName);
    if (!isSlugEdited) {
      setTenantSlug(
        nextName.trim() ? ensureUniqueTenantSlug(nextName, tenants) : '',
      );
    }
  };

  const handleSlugChange = (nextSlug: string) => {
    setIsSlugEdited(true);
    setTenantSlug(nextSlug);
  };

  const handleSubmit = () => {
    const trimmedName = tenantName.trim();
    if (!trimmedName || hasSlugConflict) return;

    const resolvedSlug = isSlugEdited
      ? normalizedSlug || ensureUniqueTenantSlug(trimmedName, tenants)
      : ensureUniqueTenantSlug(trimmedName, tenants);

    onCreateTenant({
      name: trimmedName,
      slug: resolvedSlug,
    });
    setTenantName('');
    setTenantSlug('');
    setIsSlugEdited(false);
    onClose();
  };

  const titleId = `${idPrefix}_create_tenant_modal_title`;
  const nameId = `${idPrefix}_new_tenant_name`;
  const slugId = `${idPrefix}_new_tenant_slug`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 space-y-3 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
          <span
            id={titleId}
            className="font-mono text-xs uppercase text-zinc-700 font-semibold"
          >
            New Client Tenant
          </span>
          <Badge variant="neutral">MULTI-TENANT</Badge>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={nameId}>Organization Name</Label>
          <Input
            id={nameId}
            value={tenantName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Stark Industries"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={slugId}>Workspace Slug</Label>
          <Input
            id={slugId}
            value={tenantSlug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="stark-industries"
            className="font-mono text-xs"
          />
          {hasSlugConflict ? (
            <p className="text-[11px] text-rose-600">
              Slug <span className="font-mono">/{normalizedSlug}</span> is
              already used by another tenant.
            </p>
          ) : (
            <p className="text-[11px] text-zinc-500">
              Forms route under{' '}
              <span className="font-mono text-zinc-700">
                /{normalizedSlug || 'tenant-slug'}/&lt;form-slug&gt;
              </span>
              .
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button size="xs" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="xs"
            variant="primary"
            disabled={!tenantName.trim() || hasSlugConflict}
          >
            Create Tenant
          </Button>
        </div>
      </form>
    </div>
  );
}

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
    },
  ) => void;
}

interface EditTenantModalFormProps {
  tenant: ClientTenant;
  tenants: ClientTenant[];
  idPrefix: string;
  onClose: () => void;
  onUpdateTenant: EditTenantModalProps['onUpdateTenant'];
}

function EditTenantModalForm({
  tenant,
  tenants,
  idPrefix,
  onClose,
  onUpdateTenant,
}: EditTenantModalFormProps) {
  const [editName, setEditName] = useState(tenant.name);
  const [editSlug, setEditSlug] = useState(tenant.slug);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const normalizedSlug = sanitizeTenantSlug(editSlug);
  const hasSlugConflict =
    normalizedSlug !== '' &&
    tenants.some(
      (t) => t.id !== tenant.id && t.slug.toLowerCase() === normalizedSlug,
    );

  const handleSubmit = () => {
    const trimmedName = editName.trim();
    if (!trimmedName || hasSlugConflict) return;

    const resolvedSlug =
      normalizedSlug ||
      ensureUniqueTenantSlug(tenant.slug || trimmedName, tenants, tenant.id);

    onUpdateTenant(tenant.id, {
      name: trimmedName,
      slug: resolvedSlug,
    });
    onClose();
  };

  const titleId = `${idPrefix}_edit_tenant_modal_title`;
  const nameId = `${idPrefix}_edit_tenant_name`;
  const slugId = `${idPrefix}_edit_tenant_slug`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 space-y-3 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
          <span
            id={titleId}
            className="font-mono text-xs uppercase text-zinc-700 font-semibold"
          >
            Edit Tenant Details
          </span>
          <Badge variant="neutral">{tenant.id}</Badge>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={nameId}>Organization Name</Label>
          <Input
            id={nameId}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Acme Corp"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={slugId}>Workspace Slug</Label>
          <Input
            id={slugId}
            value={editSlug}
            onChange={(e) => setEditSlug(e.target.value)}
            placeholder="acme-corp"
            className="font-mono text-xs"
          />
          {hasSlugConflict ? (
            <p className="text-[11px] text-rose-600">
              Slug <span className="font-mono">/{normalizedSlug}</span> is
              already used by another tenant.
            </p>
          ) : (
            <p className="text-[11px] text-zinc-500">
              Forms route under{' '}
              <span className="font-mono text-zinc-700">
                /{normalizedSlug || tenant.slug}/&lt;form-slug&gt;
              </span>
              .
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button size="xs" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="xs"
            variant="primary"
            disabled={!editName.trim() || !normalizedSlug || hasSlugConflict}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Modal dialog for editing an existing client tenant's name and slug. */
export function EditTenantModal({
  tenant,
  tenants = [],
  idPrefix,
  onClose,
  onUpdateTenant,
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
    />
  );
}

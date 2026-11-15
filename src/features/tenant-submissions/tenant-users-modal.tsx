import { useEffect, useState, type FormEvent } from 'react';
import type { ClientTenant } from '../../domain/form-schema';
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  type DropdownOption,
} from '../../shared/ui';
import type { ManagedTenantUser } from './storage';

export interface TenantUsersModalProps {
  tenant: ClientTenant;
  users: ManagedTenantUser[];
  onClose: () => void;
  onCreateUser: (input: {
    clientId: string;
    username: string;
    displayName: string;
    password: string;
    role: 'tenant_admin' | 'tenant_member';
  }) => Promise<void>;
  onUpdateUser: (
    userId: string,
    input: {
      role?: 'tenant_admin' | 'tenant_member';
      isActive?: boolean;
      password?: string;
    },
  ) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
}

const ROLE_OPTIONS: DropdownOption[] = [
  {
    value: 'tenant_admin',
    label: 'Tenant Admin',
    description: 'Full form builder & submission management for this tenant',
    meta: 'ADMIN',
  },
  {
    value: 'tenant_member',
    label: 'Tenant Member',
    description: 'Collaborator restricted to this tenant workspace',
    meta: 'MEMBER',
  },
];

export function TenantUsersModal({
  tenant,
  users,
  onClose,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
}: TenantUsersModalProps) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'tenant_admin' | 'tenant_member'>(
    'tenant_admin',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLoginUrl, setCopiedLoginUrl] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPasswordDraft, setResetPasswordDraft] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

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

  const tenantUsers = users.filter((u) => u.clientId === tenant.id);
  const loginUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/t/${tenant.slug}/login`
      : `/t/${tenant.slug}/login`;

  const handleCopyLoginUrl = async () => {
    try {
      await navigator.clipboard.writeText(loginUrl);
      setCopiedLoginUrl(true);
      window.setTimeout(() => setCopiedLoginUrl(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await onCreateUser({
        clientId: tenant.id,
        username: username.trim(),
        displayName: displayName.trim(),
        password,
        role,
      });
      setUsername('');
      setDisplayName('');
      setPassword('');
      setRole('tenant_admin');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create tenant user.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (user: ManagedTenantUser) => {
    setBusyUserId(user.id);
    setError(null);
    try {
      await onUpdateUser(user.id, { isActive: !user.isActive });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (resetPasswordDraft.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    setBusyUserId(userId);
    setError(null);
    try {
      await onUpdateUser(userId, { password: resetPasswordDraft });
      setResetUserId(null);
      setResetPasswordDraft('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to reset password.',
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDelete = async (userId: string) => {
    setBusyUserId(userId);
    setError(null);
    try {
      await onDeleteUser(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user.');
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tenant-users-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white shadow-xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="neutral">TENANT LOGINS</Badge>
              <span className="font-mono text-xs text-zinc-500">
                /{tenant.slug}
              </span>
            </div>
            <h2
              id="tenant-users-modal-title"
              className="text-sm font-semibold text-zinc-900 mt-1 truncate"
            >
              {tenant.name} — User Credentials
            </h2>
          </div>
          <Button size="xs" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Dedicated Tenant Login URL */}
          <div className="p-3 rounded-md border border-zinc-200 bg-zinc-50 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                Dedicated Tenant Login URL
              </div>
              <div className="font-mono text-xs text-zinc-800 truncate">
                {loginUrl}
              </div>
            </div>
            <Button
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => void handleCopyLoginUrl()}
            >
              {copiedLoginUrl ? 'Copied!' : 'Copy Login URL'}
            </Button>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
            >
              {error}
            </div>
          )}

          {/* Existing Tenant Users */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-zinc-600 font-semibold">
                Provisioned Accounts ({tenantUsers.length})
              </span>
            </div>

            {tenantUsers.length === 0 ? (
              <div className="p-6 rounded-md border border-dashed border-zinc-300 bg-zinc-50/50 text-center text-xs text-zinc-500">
                No tenant logins provisioned yet for {tenant.name}. Create one
                below.
              </div>
            ) : (
              <div className="rounded-md border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
                {tenantUsers.map((user) => {
                  const isBusy = busyUserId === user.id;
                  return (
                    <div key={user.id} className="p-3 bg-white space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-900">
                              {user.displayName}
                            </span>
                            <span className="font-mono text-xs text-zinc-500">
                              @{user.username}
                            </span>
                            <Badge variant="neutral">{user.role}</Badge>
                            <Badge
                              variant={user.isActive ? 'success' : 'danger'}
                            >
                              {user.isActive ? 'ACTIVE' : 'DISABLED'}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="xs"
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => {
                              setResetUserId(
                                resetUserId === user.id ? null : user.id,
                              );
                              setResetPasswordDraft('');
                            }}
                          >
                            Reset Password
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => void handleToggleActive(user)}
                          >
                            {user.isActive ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="danger"
                            disabled={isBusy}
                            onClick={() => void handleDelete(user.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>

                      {resetUserId === user.id && (
                        <div className="flex items-center gap-2 pt-1">
                          <Input
                            type="password"
                            aria-label={`New password for ${user.username}`}
                            placeholder="New password (min 8 chars)"
                            value={resetPasswordDraft}
                            onChange={(e) =>
                              setResetPasswordDraft(e.target.value)
                            }
                            className="h-8 text-xs flex-1"
                          />
                          <Button
                            type="button"
                            size="xs"
                            variant="primary"
                            disabled={isBusy}
                            onClick={() => void handleResetPassword(user.id)}
                          >
                            Save Password
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Create New Tenant User Form */}
          <form
            onSubmit={(e) => void handleCreateSubmit(e)}
            className="p-4 rounded-md border border-zinc-200 bg-zinc-50/70 space-y-3"
          >
            <div className="font-mono text-xs uppercase tracking-wider text-zinc-600 font-semibold">
              + Provision New Tenant Login
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="new-tenant-user-username" requiredIndicator>
                  Username
                </Label>
                <Input
                  id="new-tenant-user-username"
                  placeholder="e.g. acme_editor"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-tenant-user-display" requiredIndicator>
                  Display Name
                </Label>
                <Input
                  id="new-tenant-user-display"
                  placeholder="e.g. Jane Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-tenant-user-password" requiredIndicator>
                  Password (min 8 chars)
                </Label>
                <Input
                  id="new-tenant-user-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-tenant-user-role">Role</Label>
                <Select
                  id="new-tenant-user-role"
                  aria-label="Tenant user role"
                  value={role}
                  options={ROLE_OPTIONS}
                  onValueChange={(next) =>
                    setRole(next as 'tenant_admin' | 'tenant_member')
                  }
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating Login...' : 'Create Tenant Login'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

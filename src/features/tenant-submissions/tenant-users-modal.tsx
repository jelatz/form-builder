import { useEffect, useState, type FormEvent } from 'react';
import type { ClientTenant } from '../../domain/form-schema';
import { EMAIL_PATTERN } from '../../shared/lib';
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  type DropdownOption,
} from '../../shared/ui';
import type {
  ManagedTenantUser,
  ResetUserCredentialsResponse,
} from './storage';
import { validateEditTenantUserInput } from './tenant-utils';

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
      username?: string;
      displayName?: string;
      role?: 'tenant_admin' | 'tenant_member';
      isActive?: boolean;
      password?: string;
    },
  ) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onResetCredentials?: (
    userId: string,
    input: {
      password?: string;
      email?: string;
    },
  ) => Promise<ResetUserCredentialsResponse>;
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
  onResetCredentials,
}: TenantUsersModalProps) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'tenant_admin' | 'tenant_member'>(
    'tenant_admin',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<'tenant_admin' | 'tenant_member'>(
    'tenant_admin',
  );
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPasswordDraft, setResetPasswordDraft] = useState('');
  const [resetEmailDraft, setResetEmailDraft] = useState('');
  const [issuedCredentials, setIssuedCredentials] = useState<{
    username: string;
    generatedPassword?: string;
    email?: string;
    emailDelivery?: ResetUserCredentialsResponse['emailDelivery'];
  } | null>(null);
  const [copiedCredential, setCopiedCredential] = useState(false);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(
    null,
  );
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

  const startEditingUser = (user: ManagedTenantUser) => {
    setError(null);
    setResetUserId(null);
    setConfirmDeleteUserId(null);
    if (editingUserId === user.id) {
      setEditingUserId(null);
      return;
    }
    setEditingUserId(user.id);
    setEditUsername(user.username);
    setEditDisplayName(user.displayName);
    setEditRole(user.role === 'tenant_member' ? 'tenant_member' : 'tenant_admin');
  };

  const handleSaveUserEdit = async (userId: string) => {
    const validation = validateEditTenantUserInput({
      username: editUsername,
      displayName: editDisplayName,
      role: editRole,
    });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setBusyUserId(userId);
    setError(null);
    try {
      await onUpdateUser(userId, validation.data);
      setEditingUserId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update user profile.',
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleResetPassword = async (user: ManagedTenantUser) => {
    const trimmedEmail = resetEmailDraft.trim().toLowerCase();
    if (resetPasswordDraft !== '' && resetPasswordDraft.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (trimmedEmail !== '' && !EMAIL_PATTERN.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!onResetCredentials && resetPasswordDraft.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setBusyUserId(user.id);
    setError(null);
    setCopiedCredential(false);
    try {
      if (onResetCredentials) {
        const result = await onResetCredentials(user.id, {
          ...(resetPasswordDraft ? { password: resetPasswordDraft } : {}),
          ...(trimmedEmail ? { email: trimmedEmail } : {}),
        });
        setIssuedCredentials({
          username: result.user.username,
          generatedPassword: result.generatedPassword,
          email: trimmedEmail || undefined,
          emailDelivery: result.emailDelivery,
        });
      } else {
        await onUpdateUser(user.id, { password: resetPasswordDraft });
        setIssuedCredentials({
          username: user.username,
        });
      }
      setResetUserId(null);
      setResetPasswordDraft('');
      setResetEmailDraft('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to reset credentials.',
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleCopyGeneratedPassword = async (value: string) => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedCredential(true);
    } catch {
      setError('Unable to copy password to clipboard.');
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
            <Badge variant="neutral">TEAM ACCESS</Badge>
            <h2
              id="tenant-users-modal-title"
              className="text-sm font-semibold text-zinc-900 mt-1 truncate"
            >
              {tenant.name} — Team Users
            </h2>
          </div>
          <Button size="xs" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
            >
              {error}
            </div>
          )}

          {issuedCredentials && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-xs text-emerald-950 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  Credentials updated for @{issuedCredentials.username}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setIssuedCredentials(null)}
                >
                  Dismiss
                </Button>
              </div>
              {issuedCredentials.generatedPassword && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-200 bg-white px-2.5 py-1.5">
                  <div className="font-mono text-xs text-zinc-900">
                    <span className="text-zinc-500 mr-2">Password:</span>
                    <span>{issuedCredentials.generatedPassword}</span>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={() =>
                      void handleCopyGeneratedPassword(
                        issuedCredentials.generatedPassword!,
                      )
                    }
                  >
                    {copiedCredential ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}
              {issuedCredentials.emailDelivery && (
                <p className="text-[11px] text-emerald-800">
                  {issuedCredentials.emailDelivery.status === 'sent'
                    ? `Emailed login credentials to ${issuedCredentials.email ?? 'recipient'} via ${issuedCredentials.emailDelivery.provider}.`
                    : `Logged login credentials for ${issuedCredentials.email ?? 'recipient'} to dev console.`}
                </p>
              )}
            </div>
          )}

          {/* Existing Tenant Users */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-zinc-600 font-semibold">
                Team Accounts ({tenantUsers.length})
              </span>
            </div>

            {tenantUsers.length === 0 ? (
              <div className="p-6 rounded-md border border-dashed border-zinc-300 bg-zinc-50/50 text-center text-xs text-zinc-500">
                No team members added yet for {tenant.name}. Add one below.
              </div>
            ) : (
              <div className="rounded-md border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
                {tenantUsers.map((user) => {
                  const isBusy = busyUserId === user.id;
                  const isConfirmingDelete = confirmDeleteUserId === user.id;
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
                            <Badge variant="neutral">
                              {user.role === 'tenant_admin' ? 'Admin' : 'Member'}
                            </Badge>
                            <Badge
                              variant={user.isActive ? 'success' : 'danger'}
                            >
                              {user.isActive ? 'ACTIVE' : 'DISABLED'}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            type="button"
                            size="xs"
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => startEditingUser(user)}
                          >
                            {editingUserId === user.id ? 'Close Edit' : 'Edit'}
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => {
                              setEditingUserId(null);
                              setConfirmDeleteUserId(null);
                              setResetUserId(
                                resetUserId === user.id ? null : user.id,
                              );
                              setResetPasswordDraft('');
                              setResetEmailDraft('');
                            }}
                          >
                            Reset Credentials
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
                          {isConfirmingDelete ? (
                            <>
                              <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                disabled={isBusy}
                                onClick={() => setConfirmDeleteUserId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="xs"
                                variant="danger"
                                disabled={isBusy}
                                onClick={() => {
                                  setConfirmDeleteUserId(null);
                                  void handleDelete(user.id);
                                }}
                              >
                                Confirm
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              size="xs"
                              variant="danger"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteUserId(user.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>

                      {editingUserId === user.id && (
                        <div className="rounded-md border border-zinc-200 bg-zinc-50/70 p-3 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="space-y-1">
                              <Label htmlFor={`edit-user-username-${user.id}`}>
                                Username
                              </Label>
                              <Input
                                id={`edit-user-username-${user.id}`}
                                value={editUsername}
                                onChange={(e) => {
                                  setError(null);
                                  setEditUsername(e.target.value);
                                }}
                                disabled={isBusy}
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`edit-user-display-${user.id}`}>
                                Display Name
                              </Label>
                              <Input
                                id={`edit-user-display-${user.id}`}
                                value={editDisplayName}
                                onChange={(e) => {
                                  setError(null);
                                  setEditDisplayName(e.target.value);
                                }}
                                disabled={isBusy}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`edit-user-role-${user.id}`}>
                                Role
                              </Label>
                              <Select
                                id={`edit-user-role-${user.id}`}
                                aria-label={`Role for ${user.username}`}
                                value={editRole}
                                options={ROLE_OPTIONS}
                                onValueChange={(next) => {
                                  setError(null);
                                  setEditRole(
                                    next as 'tenant_admin' | 'tenant_member',
                                  );
                                }}
                                disabled={isBusy}
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              disabled={isBusy}
                              onClick={() => setEditingUserId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="primary"
                              disabled={isBusy}
                              onClick={() => void handleSaveUserEdit(user.id)}
                            >
                              Save Profile
                            </Button>
                          </div>
                        </div>
                      )}

                      {resetUserId === user.id && (
                        <div className="rounded-md border border-zinc-200 bg-zinc-50/70 p-3 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <Label htmlFor={`reset-pw-${user.id}`}>
                                New Password{' '}
                                {onResetCredentials
                                  ? '(leave blank to auto-generate)'
                                  : '(min 8 chars)'}
                              </Label>
                              <Input
                                id={`reset-pw-${user.id}`}
                                type="password"
                                aria-label={`New password for ${user.username}`}
                                placeholder={
                                  onResetCredentials
                                    ? 'Blank = generate 16-char password'
                                    : 'New password (min 8 chars)'
                                }
                                value={resetPasswordDraft}
                                onChange={(e) => {
                                  setError(null);
                                  setResetPasswordDraft(e.target.value);
                                }}
                                disabled={isBusy}
                                className="h-8 text-xs"
                              />
                            </div>
                            {onResetCredentials && (
                              <div className="space-y-1">
                                <Label htmlFor={`reset-email-${user.id}`}>
                                  Email Credentials To (optional)
                                </Label>
                                <Input
                                  id={`reset-email-${user.id}`}
                                  type="email"
                                  aria-label={`Email credentials for ${user.username}`}
                                  placeholder="admin@company.com"
                                  value={resetEmailDraft}
                                  onChange={(e) => {
                                    setError(null);
                                    setResetEmailDraft(e.target.value);
                                  }}
                                  disabled={isBusy}
                                  className="h-8 text-xs"
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              disabled={isBusy}
                              onClick={() => {
                                setResetUserId(null);
                                setResetPasswordDraft('');
                                setResetEmailDraft('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="primary"
                              disabled={isBusy}
                              onClick={() => void handleResetPassword(user)}
                            >
                              {resetPasswordDraft
                                ? 'Save Password'
                                : 'Generate & Reset'}
                            </Button>
                          </div>
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
              + Add Team Member
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
                {isSubmitting ? 'Adding...' : 'Add Member'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
